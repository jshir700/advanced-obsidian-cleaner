import { App, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { FileCleanerSettings } from './settings';
import { CleanRuleMatcher } from './engine/CleanRuleMatcher';
import type { FolderContext, FileContext } from './engine/CleanRuleMatcher';
import type { CleanRule } from './types/CleanRule';
import {
  getExtensions,
  getFilesInFolder,
  getInUseAttachments,
  getSubFoldersInFolder,
  removeFiles,
  notify,
  userHasPlugin,
} from './helpers/helpers';
import { getFolders } from './helpers/helpers';
import { checkMarkdown } from './helpers/markdown';
import { checkCanvas, getCanvasAttachments } from './helpers/canvas';
import { DeletionConfirmationModal } from './modals/DeletionConfirmationModal';
import translate from './i18n';
import { getAdmonitionAttachments } from './helpers/extras/admonition';
import { Deletion } from './enums';
import { checkExcalidraw } from './helpers/extras/excalidraw';
import { getCodeblockAttachments } from './helpers/codeblock';
import { getInkAttachments } from './helpers/extras/ink';

// ========================
// scanVault - Main cleanup scanner
// ========================
export async function scanVault(app: App, settings: FileCleanerSettings) {
  const indexingStart = Date.now();
  console.group('Advanced Obsidian Cleaner');
  console.log('Starting cleanup');

  // 1. Warm regex cache
  const matcher = new CleanRuleMatcher();
  matcher.warmRegexCache(settings.cleanRules);

  // 2. Collect in-use attachments
  const inUseAttachmentsInitial = getInUseAttachments(app);
  inUseAttachmentsInitial.push(...(await getCanvasAttachments(app)));
  if (userHasPlugin('obsidian-admonition', app))
    inUseAttachmentsInitial.push(...(await getAdmonitionAttachments(app)));
  if (userHasPlugin('ink', app))
    inUseAttachmentsInitial.push(...(await getInkAttachments(app)));
  const codeblockTypes = (settings as any).codeblockTypes;
  if (codeblockTypes && codeblockTypes.length > 0) {
    const codeblockLanguages = RegExp(`${codeblockTypes.join('|')}`);
    inUseAttachmentsInitial.push(...(await getCodeblockAttachments(app, codeblockLanguages)));
  }
  const inUseAttachments = Array.from(new Set(inUseAttachmentsInitial));

  // 3. Get all folders, sorted deepest-first
  const folders = getFolders(app)
    .filter(f => f.path !== '/')
    .sort((a, b) => b.path.localeCompare(a.path))
    .reverse();
  folders.push(app.vault.getFolderByPath('/'));

  const filesToRemove: TFile[] = [];
  const foldersToRemove: TFolder[] = [];
  const skippedPaths = new Set<string>();

  // 4. Process each folder
  for (const folder of folders) {
    // 4a. Check Folder Rules
    const folderCtx = buildFolderContext(folder);
    const folderRule = matcher.findMatchingRule(folderCtx, settings.cleanRules, 'folder');

    if (folderRule?.action === 'skip') {
      skippedPaths.add(folder.path);
      continue;
    }

    // 4b. Process files in this folder
    const files = getFilesInFolder(folder);
    let childrenCount = files.length;

    for (const file of files) {
      if (isPathUnderSkipped(file.path, skippedPaths)) continue;
      if (inUseAttachments.includes(file.path)) continue;
      if (file.extension === 'base') continue;

      const fileCtx = buildFileContext(file, folder, inUseAttachments, app);
      const ruleScope = file.extension === 'md' ? 'markdown' : 'attachment';
      const rule = matcher.findMatchingRule(fileCtx, settings.cleanRules, ruleScope);

      if (rule) {
        if (rule.action === 'skip') continue;
        if (rule.action === 'delete') {
          filesToRemove.push(file);
          childrenCount--;
        }
        continue;
      }

      // No rule matched -> default logic
      if (await checkDefaultFile(file, fileCtx, settings, app)) {
        filesToRemove.push(file);
        childrenCount--;
      }
    }

    // 4c. Check folder deletion
    if (childrenCount === 0 && !folder.isRoot()) {
      if (hasNonRemovedSubfolder(folder, foldersToRemove)) continue;
      foldersToRemove.push(folder);
    }
  }

  // 5. Post-process: remove parents with non-removed children
  postProcessFolders(foldersToRemove);

  const duration = ((Date.now() - indexingStart) / 1000).toFixed(2);
  console.log(`Finished indexing after ${duration}s`);
  console.log(`Found ${filesToRemove.length} files and ${foldersToRemove.length} folders to clean up.`);

  return { filesToRemove, foldersToRemove };
}

// ========================
// Context builders
// ========================
function buildFolderContext(folder: TFolder): FolderContext {
  const pathParts = folder.path.split('/');
  const depth = Math.max(0, pathParts.length - 1);
  const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

  // Calculate size recursively
  let size = 0;
  const calcSize = (f: TFolder): number => {
    let total = 0;
    for (const child of f.children) {
      if ('children' in child) {
        total += calcSize(child as unknown as TFolder);
      } else {
        total += (child as TFile).stat.size;
      }
    }
    return total;
  };
  size = calcSize(folder);

  const directFiles = getFilesInFolder(folder);
  const directSubFolders = getSubFoldersInFolder(folder);

  return {
    type: 'folder',
    folderPath: folder.path,
    folderName: folder.name,
    parentPath,
    depth,
    size,
    childrenCount: directFiles.length + directSubFolders.length,
    subfoldersCount: directSubFolders.length,
    createdAt: new Date((folder as any).stat.ctime),
    modifiedAt: new Date((folder as any).stat.mtime),
  };
}

function buildFileContext(
  file: TFile,
  folder: TFolder,
  inUseAttachments: string[],
  app: App
): FileContext {
  const pathParts = folder.path.split('/');
  const depth = Math.max(0, pathParts.length - 1);
  const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

  // Get metadata cache info
  const cache = app.metadataCache.getFileCache(file);
  const links = cache?.links?.map((l: any) => l.link).filter(Boolean) || [];
  const backlinksCount = ((cache as any)?.backlinks?.length) || 0;
  const headings = cache?.headings?.map((h: any) => h.heading).filter(Boolean) || [];
  const frontmatter = cache?.frontmatter || {};

  // Content length (excluding frontmatter)
  let contentLength = 0;
  try {
    const content = file.path ? '' : ''; // Will be read at runtime
    // Remove frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const body = fmMatch ? content.substring(fmMatch[0].length) : content;
    contentLength = body.length;
  } catch {
    contentLength = 0;
  }

  return {
    type: 'file',
    filePath: file.path,
    fileName: file.basename,
    extension: file.extension || '',
    fileSize: file.stat.size,
    contentLength,
    createdAt: new Date(file.stat.ctime),
    modifiedAt: new Date(file.stat.mtime),
    links,
    backlinksCount,
    headings,
    frontmatter,
    attachmentLinked: inUseAttachments.includes(file.path),
    parentPath,
    parentName: folder.name,
    folderDepth: depth,
  };
}

// ========================
// Helper functions
// ========================
function isPathUnderSkipped(filePath: string, skippedPaths: Set<string>): boolean {
  for (const skipped of skippedPaths) {
    if (filePath.startsWith(skipped + '/')) return true;
  }
  return false;
}

function hasNonRemovedSubfolder(folder: TFolder, foldersToRemove: TFolder[]): boolean {
  const subFolders = getSubFoldersInFolder(folder);
  return subFolders.some(sub => !foldersToRemove.includes(sub));
}

function postProcessFolders(foldersToRemove: TFolder[]): void {
  [...foldersToRemove].reverse().forEach(folder => {
    const subFolders = getSubFoldersInFolder(folder);
    subFolders.forEach(subFolder => {
      if (!foldersToRemove.includes(subFolder)) {
        const idx = foldersToRemove.indexOf(folder);
        if (idx > -1) foldersToRemove.splice(idx, 1);
      }
    });
  });
}

// ========================
// Default file check (FCR fallback)
// ========================
async function checkDefaultFile(
  file: TFile,
  fileCtx: FileContext,
  settings: FileCleanerSettings,
  app: App
): Promise<boolean> {
  // Markdown files
  if (file.extension === 'md') {
    if (fileCtx.contentLength === 0) {
      return fileCtx.backlinksCount === 0;
    }
    return false;
  }

  // Canvas files
  if (file.extension === 'canvas') {
    return await checkCanvas(file, app);
  }

  // Attachments
  if (!fileCtx.attachmentLinked) {
    return true;
  }

  return false;
}

// ========================
// Cleanup runner
// ========================
export async function runCleanup(
  filesToRemove: TFile[],
  foldersToRemove: TFolder[],
  app: App,
  settings: FileCleanerSettings
) {
  const filesAndFolders: TAbstractFile[] = [...filesToRemove];
  filesAndFolders.push(...foldersToRemove.reverse());

  if (filesAndFolders.length === 0) {
    notify(translate().Notifications.NoFileToClean);
  } else {
    if (!settings.deletionConfirmation) {
      await removeFiles(filesAndFolders, app, settings);
    } else {
      new DeletionConfirmationModal({
        app,
        filesAndFolders,
        settings,
      });
    }

    console.group('Files:');
    filesToRemove.forEach(item => console.debug(item.path));
    console.groupEnd();

    console.group('Folders:');
    foldersToRemove.forEach(item => console.debug(item.path));
    console.groupEnd();
  }

  if (settings.deletionDestination === Deletion.ObsidianTrash) {
    cleanTrashFolder(app, settings);
  }

  if (settings.closeNewTabs) {
    app.workspace.detachLeavesOfType('empty');
  }

  console.groupEnd();
}

// ========================
// Obsidian trash cleanup
// ========================
function cleanTrashFolder(app: App, settings: FileCleanerSettings) {
  if (settings.obsidianTrashCleanupAge < 0) return;
  if (!app.vault.adapter.exists('.trash')) return;

  const date = new Date();
  const ageThreshold = date.setDate(date.getDate() - settings.obsidianTrashCleanupAge);

  console.group("Checking '.trash' folder");
  app.vault.adapter.list('.trash').then(dir => {
    for (const file of dir.files) {
      app.vault.adapter.stat(file).then(f => {
        if (f.ctime < ageThreshold) {
          app.vault.adapter.remove(file);
          console.debug('Removed file:', file);
        }
      });
    }
    for (const folder of dir.folders) {
      app.vault.adapter.stat(folder).then(f => {
        if (f.ctime < ageThreshold) {
          app.vault.adapter.rmdir(folder, true);
          console.debug('Removed folder:', folder);
        }
      });
    }
    console.groupEnd();
  });
}
