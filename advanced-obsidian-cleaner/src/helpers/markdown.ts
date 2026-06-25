import { App, TFile } from "obsidian";
import { type FileCleanerSettings } from "../settings";

export async function checkMarkdown(
  _file: TFile,
  _app: App,
  _settings: FileCleanerSettings,
) {
  // CleanRule system replaces these legacy settings.
  // Return false so files are never auto-deleted by legacy logic.
  return false;
}

export async function getMarkdownSections(file: TFile, app: App, type = "") {
  const cache = app.metadataCache.getFileCache(file);

  if (!cache.sections) return [];

  if (type !== "")
    return cache.sections.filter((section) => section.type === type);

  return cache.sections;
}
