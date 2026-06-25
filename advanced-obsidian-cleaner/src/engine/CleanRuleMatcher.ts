import type { CleanRule, CleanTrigger, AggregationType, DateOperator, CompareOperator, TextOperator, ListOperator, AttachmentUsageOperator, FrontmatterTextOperator, FrontmatterNumberOperator, FrontmatterListOperator, FrontmatterDateOperator, FrontmatterCheckboxOperator } from '../types/CleanRule';

/**
 * Pure Clean Rule matching engine (no Obsidian dependencies).
 * Evaluates CleanRules against file/folder contexts.
 */
export class CleanRuleMatcher {
  private regexCache: Map<string, RegExp>;

  constructor() {
    this.regexCache = new Map();
  }

  /**
   * Pre-compile regex patterns used by active rules.
   */
  warmRegexCache(rules: CleanRule[]): void {
    const regexOperators = new Set<string>([
      'match regex',
      'does not match regex',
      'all match regex',
      'any match regex',
    ]);
    for (const rule of rules) {
      if (!rule.active) continue;
      for (const t of rule.triggers) {
        const op = String(t.operator);
        if (regexOperators.has(op) && t.value && t.value.trim() !== '') {
          this.getRegex(t.value);
        }
      }
    }
  }

  /**
   * Finds the first matching rule for the given scope.
   */
  findMatchingRule(context: FileContext | FolderContext, rules: CleanRule[], scope: 'folder' | 'markdown' | 'attachment'): CleanRule | null {
    for (const rule of rules) {
      if (!rule.active) continue;
      if (rule.scope !== scope) continue;
      if (rule.triggers.length === 0) continue;

      const triggerResults: boolean[] = [];
      for (const trigger of rule.triggers) {
        const result = this.evaluateTrigger(context, trigger);
        triggerResults.push(result);
      }

      if (this.evaluateAggregation(triggerResults, rule.aggregation)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * Evaluates a single trigger against context.
   */
  evaluateTrigger(context: FileContext | FolderContext, trigger: CleanTrigger): boolean {
    const criteriaType = trigger.criteriaType;
    const operator = trigger.operator;
    const value = trigger.value;

    // Folder criteria
    if (criteriaType === 'parent_path' || criteriaType === 'parent_path_md' || criteriaType === 'parent_path_att') {
      const actualPath = context.type === 'folder' ? (context as FolderContext).parentPath : (context as FileContext).parentPath;
      return this.evaluateTextOperator(actualPath, operator as TextOperator, value);
    }

    if (criteriaType === 'folder_name') {
      const actualName = (context as FolderContext).folderName;
      return this.evaluateTextOperator(actualName, operator as TextOperator, value);
    }

    if (criteriaType === 'parent_name') {
      const actualName = (context as FileContext).parentName;
      return this.evaluateTextOperator(actualName, operator as TextOperator, value);
    }

    if (criteriaType === 'depth' || criteriaType === 'folder_depth') {
      const actualDepth = context.type === 'folder' ? (context as FolderContext).depth : (context as FileContext).folderDepth;
      return this.evaluateCompareOperator(actualDepth, operator as CompareOperator, value);
    }

    if (criteriaType === 'created_at' || criteriaType === 'created_at_md' || criteriaType === 'created_at_att') {
      const actualDate = context.type === 'folder' ? (context as FolderContext).createdAt : (context as FileContext).createdAt;
      return this.evaluateDateOperator(actualDate, operator as DateOperator, value);
    }

    if (criteriaType === 'modified_at' || criteriaType === 'modified_at_md' || criteriaType === 'modified_at_att') {
      const actualDate = context.type === 'folder' ? (context as FolderContext).modifiedAt : (context as FileContext).modifiedAt;
      return this.evaluateDateOperator(actualDate, operator as DateOperator, value);
    }

    if (criteriaType === 'size') {
      const actualSize = (context as FolderContext).size;
      return this.evaluateCompareOperator(actualSize, operator as CompareOperator, value);
    }

    if (criteriaType === 'children_count') {
      const actualCount = (context as FolderContext).childrenCount;
      return this.evaluateCompareOperator(actualCount, operator as CompareOperator, value);
    }

    if (criteriaType === 'subfolders_count') {
      const actualCount = (context as FolderContext).subfoldersCount;
      return this.evaluateCompareOperator(actualCount, operator as CompareOperator, value);
    }

    // Markdown criteria
    if (criteriaType === 'fileName' || criteriaType === 'fileName_att') {
      const actualName = (context as FileContext).fileName;
      return this.evaluateTextOperator(actualName, operator as TextOperator, value);
    }

    if (criteriaType === 'file_size' || criteriaType === 'file_size_att') {
      const actualSize = (context as FileContext).fileSize;
      return this.evaluateCompareOperator(actualSize, operator as CompareOperator, value);
    }

    if (criteriaType === 'content_length') {
      const actualLen = (context as FileContext).contentLength;
      return this.evaluateCompareOperator(actualLen, operator as CompareOperator, value);
    }

    if (criteriaType === 'links') {
      const actualCount = (context as FileContext).links.length;
      return this.evaluateCompareOperator(actualCount, operator as CompareOperator, value);
    }

    if (criteriaType === 'backlinks') {
      const actualCount = (context as FileContext).backlinksCount;
      return this.evaluateCompareOperator(actualCount, operator as CompareOperator, value);
    }

    if (criteriaType === 'headings') {
      const items = (context as FileContext).headings;
      return this.evaluateListOperator(items, operator as ListOperator, value);
    }

    if (criteriaType === 'frontmatter') {
      const fm = (context as FileContext).frontmatter;
      const fieldName = trigger.fieldName || '';
      const fieldValue = fm[fieldName];
      return this.evaluateFrontmatterOperator(fieldValue, operator as any, value);
    }

    // Attachment criteria
    if (criteriaType === 'extension') {
      const actualExt = (context as FileContext).extension;
      return this.evaluateExtensionOperator(actualExt, operator as string, value);
    }

    if (criteriaType === 'attachment_usage') {
      const isLinked = (context as FileContext).attachmentLinked;
      return this.evaluateAttachmentUsageOperator(isLinked, operator as AttachmentUsageOperator, value);
    }

    return false;
  }

  /**
   * Evaluates aggregation logic.
   */
  private evaluateAggregation(results: boolean[], aggregation: AggregationType): boolean {
    if (results.length === 0) return false;

    switch (aggregation) {
      case 'all':
        return results.every(r => r === true);
      case 'any':
        return results.some(r => r === true);
      case 'none':
        return results.every(r => r === false);
      default:
        return false;
    }
  }

  /**
   * Evaluates text-based operators.
   */
  private evaluateTextOperator(value: string, operator: TextOperator, expected: string): boolean {
    const valueLower = value.toLowerCase();
    const expectedLower = expected.toLowerCase();

    switch (operator) {
      case 'is': return valueLower === expectedLower;
      case 'is not': return valueLower !== expectedLower;
      case 'contains': return valueLower.includes(expectedLower);
      case 'does not contain': return !valueLower.includes(expectedLower);
      case 'starts with': return valueLower.startsWith(expectedLower);
      case 'does not start with': return !valueLower.startsWith(expectedLower);
      case 'ends with': return valueLower.endsWith(expectedLower);
      case 'does not end with': return !valueLower.endsWith(expectedLower);
      case 'match regex': {
        const regex = this.getRegex(expected);
        return regex !== null ? regex.test(value) : false;
      }
      case 'does not match regex': {
        const regex = this.getRegex(expected);
        return regex !== null ? !regex.test(value) : true;
      }
      default: return false;
    }
  }

  /**
   * Evaluates comparison operators (=, >, <, ≥, ≤).
   */
  private evaluateCompareOperator(actual: number, operator: CompareOperator, expected: string): boolean {
    const expectedNum = Number(expected);
    if (isNaN(expectedNum)) return false;

    switch (operator) {
      case '=': return actual === expectedNum;
      case '>': return actual > expectedNum;
      case '<': return actual < expectedNum;
      case '≥': return actual >= expectedNum;
      case '≤': return actual <= expectedNum;
      default: return false;
    }
  }

  /**
   * Evaluates date operators.
   */
  private evaluateDateOperator(date: Date | null, operator: DateOperator, expected: string): boolean {
    if (!date) {
      if (operator === 'date is today' || operator === 'time is before now') return false;
      if (operator === 'date is not today' || operator === 'time is after now') return true;
      return false;
    }

    const now = new Date();

    switch (operator) {
      case 'is': return this.parseDate(expected)?.getTime() === date.getTime();
      case 'is before': return this.parseDate(expected) ? date < this.parseDate(expected)! : false;
      case 'is after': return this.parseDate(expected) ? date > this.parseDate(expected)! : false;
      case 'time is before': return this.parseTime(expected) ? date.getHours() * 60 + date.getMinutes() < this.parseTime(expected)!.getTime() : false;
      case 'time is after': return this.parseTime(expected) ? date.getHours() * 60 + date.getMinutes() > this.parseTime(expected)!.getTime() : false;
      case 'time is before now': return date.getHours() * 60 + date.getMinutes() < now.getHours() * 60 + now.getMinutes();
      case 'time is after now': return date.getHours() * 60 + date.getMinutes() > now.getHours() * 60 + now.getMinutes();
      case 'date is': return this.isSameDate(date, this.parseDate(expected));
      case 'date is not': return !this.isSameDate(date, this.parseDate(expected));
      case 'date is before': return this.parseDate(expected) ? this.isDateBefore(date, this.parseDate(expected)!) : false;
      case 'date is after': return this.parseDate(expected) ? this.isDateAfter(date, this.parseDate(expected)!) : false;
      case 'date is today': return this.isSameDate(date, now);
      case 'date is not today': return !this.isSameDate(date, now);
      case 'is under X days ago': {
        const days = Number(expected);
        return days !== null && this.isDaysAgo(date, days, 'under');
      }
      case 'is over X days ago': {
        const days = Number(expected);
        return days !== null && this.isDaysAgo(date, days, 'over');
      }
      case 'day of week is':
      case 'day of week is not': {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = dayNames.indexOf(expected.toLowerCase());
        if (dayIndex === -1) return false;
        const actualDay = date.getDay();
        return operator === 'day of week is' ? actualDay === dayIndex : actualDay !== dayIndex;
      }
      case 'day of week is before': {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = dayNames.indexOf(expected.toLowerCase());
        return dayIndex !== -1 && date.getDay() < dayIndex;
      }
      case 'day of week is after': {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = dayNames.indexOf(expected.toLowerCase());
        return dayIndex !== -1 && date.getDay() > dayIndex;
      }
      case 'day of month is':
      case 'day of month is not': {
        const day = Number(expected);
        if (isNaN(day)) return false;
        return operator === 'day of month is' ? date.getDate() === day : date.getDate() !== day;
      }
      case 'day of month is before': {
        const day = Number(expected);
        return !isNaN(day) && date.getDate() < day;
      }
      case 'day of month is after': {
        const day = Number(expected);
        return !isNaN(day) && date.getDate() > day;
      }
      case 'month is':
      case 'month is not': {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIndex = monthNames.indexOf(expected.toLowerCase());
        if (monthIndex !== -1) {
          return operator === 'month is' ? date.getMonth() === monthIndex : date.getMonth() !== monthIndex;
        }
        const month = Number(expected);
        if (!isNaN(month)) {
          return operator === 'month is' ? date.getMonth() + 1 === month : date.getMonth() + 1 !== month;
        }
        return false;
      }
      case 'month is before': {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIndex = monthNames.indexOf(expected.toLowerCase());
        if (monthIndex !== -1) return date.getMonth() < monthIndex;
        const month = Number(expected);
        return !isNaN(month) && date.getMonth() + 1 < month;
      }
      case 'month is after': {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIndex = monthNames.indexOf(expected.toLowerCase());
        if (monthIndex !== -1) return date.getMonth() > monthIndex;
        const month = Number(expected);
        return !isNaN(month) && date.getMonth() + 1 > month;
      }
      case 'year is':
      case 'year is not': {
        const year = Number(expected);
        if (isNaN(year)) return false;
        return operator === 'year is' ? date.getFullYear() === year : date.getFullYear() !== year;
      }
      case 'year is before': {
        const year = Number(expected);
        return !isNaN(year) && date.getFullYear() < year;
      }
      case 'year is after': {
        const year = Number(expected);
        return !isNaN(year) && date.getFullYear() > year;
      }
      default: return false;
    }
  }

  /**
   * Evaluates list-based operators.
   */
  private evaluateListOperator(items: string[], operator: ListOperator, expected: string): boolean {
    const expectedLower = expected.toLowerCase();

    switch (operator) {
      case 'includes item': return items.some(i => i.toLowerCase() === expectedLower);
      case 'does not include item': return !items.some(i => i.toLowerCase() === expectedLower);
      case 'all are': return items.length > 0 && items.every(i => i.toLowerCase() === expectedLower);
      case 'all start with': return items.length > 0 && items.every(i => i.toLowerCase().startsWith(expectedLower));
      case 'all end with': return items.length > 0 && items.every(i => i.toLowerCase().endsWith(expectedLower));
      case 'all match regex': {
        const regex = this.getRegex(expected);
        return regex !== null && items.length > 0 && items.every(i => regex.test(i));
      }
      case 'any contain': return items.some(i => i.toLowerCase().includes(expectedLower));
      case 'any end with': return items.some(i => i.toLowerCase().endsWith(expectedLower));
      case 'any match regex': {
        const regex = this.getRegex(expected);
        return regex !== null ? items.some(i => regex.test(i)) : false;
      }
      case 'none contain': return !items.some(i => i.toLowerCase().includes(expectedLower));
      case 'none start with': return !items.some(i => i.toLowerCase().startsWith(expectedLower));
      case 'none end with': return !items.some(i => i.toLowerCase().endsWith(expectedLower));
      default: return false;
    }
  }

  /**
   * Evaluates extension category operators.
   */
  private evaluateExtensionOperator(ext: string, operator: string, _expected: string): boolean {
    const categories: Record<string, string[]> = {
      'is image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'],
      'is video': ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'],
      'is audio': ['mp3', 'wav', 'ogg', 'aac', 'flac', 'wma', 'm4a', 'midi', 'opus'],
      'is document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'odt'],
      'is archive': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dmg', 'iso'],
    };

    if (categories[operator]) {
      return categories[operator].includes(ext.toLowerCase());
    }
    return false;
  }

  /**
   * Evaluates attachment usage operators.
   */
  private evaluateAttachmentUsageOperator(isLinked: boolean, operator: AttachmentUsageOperator, expected: string): boolean {
    switch (operator) {
      case 'link count =': return !isLinked && Number(expected) === 0;
      case 'link count >': return !isLinked && Number(expected) === 0;
      case 'link count <': return isLinked && Number(expected) > 0;
      case 'link count ≥': return isLinked && Number(expected) >= 1;
      case 'link count ≤': return !isLinked && Number(expected) === 0;
      default: return false;
    }
  }

  /**
   * Evaluates frontmatter operators.
   */
  private evaluateFrontmatterOperator(value: unknown, operator: string, expected: string): boolean {
    if (value === null || value === undefined) {
      return operator === 'has no value' || operator === 'property is missing';
    }

    // Base operators
    if (operator === 'has any value' || operator === 'property is present') return value !== null && value !== undefined && value !== '';
    if (operator === 'has no value' || operator === 'property is missing') return value === null || value === undefined || value === '';
    if (operator === 'is true') return value === true;
    if (operator === 'is false') return value === false;

    // Numeric operators
    if (operator === 'equals') return Number(value) === Number(expected);
    if (operator === 'does not equal') return Number(value) !== Number(expected);
    if (operator === 'is less than') return Number(value) < Number(expected);
    if (operator === 'is more than') return Number(value) > Number(expected);
    if (operator === 'is divisible by') return Number(value) % Number(expected) === 0;
    if (operator === 'is not divisible by') return Number(value) % Number(expected) !== 0;

    // Text operators (for string/list values)
    const strValue = String(value);
    const expectedLower = expected.toLowerCase();
    const strLower = strValue.toLowerCase();

    if (operator === 'is') return strLower === expectedLower;
    if (operator === 'is not') return strLower !== expectedLower;
    if (operator === 'contains') return strLower.includes(expectedLower);
    if (operator === 'does not contain') return !strLower.includes(expectedLower);
    if (operator === 'starts with') return strLower.startsWith(expectedLower);
    if (operator === 'does not start with') return !strLower.startsWith(expectedLower);
    if (operator === 'ends with') return strLower.endsWith(expectedLower);
    if (operator === 'does not end with') return !strLower.endsWith(expectedLower);
    if (operator === 'match regex') {
      const regex = this.getRegex(expected);
      return regex !== null ? regex.test(strValue) : false;
    }
    if (operator === 'does not match regex') {
      const regex = this.getRegex(expected);
      return regex !== null ? !regex.test(strValue) : true;
    }

    // List operators (for array values)
    if (Array.isArray(value)) {
      return this.evaluateListOperator(value.map(String), operator as ListOperator, expected);
    }

    return false;
  }

  /**
   * Gets compiled regex from cache.
   */
  private getRegex(pattern: string): RegExp | null {
    if (this.regexCache.has(pattern)) {
      return this.regexCache.get(pattern)!;
    }
    try {
      const regex = new RegExp(pattern, 'i');
      this.regexCache.set(pattern, regex);
      return regex;
    } catch {
      return null;
    }
  }

  /**
   * Parses a date string.
   */
  private parseDate(value: string): Date | null {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Parses a time string (HH:MM).
   */
  private parseTime(value: string): Date | null {
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const date = new Date();
    date.setHours(parseInt(match[1]), parseInt(match[2]));
    return date;
  }

  /**
   * Checks if two dates are the same day.
   */
  private isSameDate(date1: Date, date2: Date | null): boolean {
    if (!date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Checks if date1 is before date2 (ignoring time).
   */
  private isDateBefore(date1: Date, date2: Date): boolean {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return d1 < d2;
  }

  /**
   * Checks if date1 is after date2 (ignoring time).
   */
  private isDateAfter(date1: Date, date2: Date): boolean {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return d1 > d2;
  }

  /**
   * Checks if date is under/over X days ago.
   */
  private isDaysAgo(date: Date, days: number, type: 'under' | 'over'): boolean {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return type === 'under' ? diffDays < days : diffDays > days;
  }
}

// ========================
// Context Interfaces
// ========================
export interface FolderContext {
  type: 'folder';
  folderPath: string;
  folderName: string;
  parentPath: string;
  depth: number;
  size: number;
  childrenCount: number;
  subfoldersCount: number;
  createdAt: Date | null;
  modifiedAt: Date | null;
}

export interface FileContext {
  type: 'file';
  filePath: string;
  fileName: string;
  extension: string;
  fileSize: number;
  contentLength: number;
  createdAt: Date | null;
  modifiedAt: Date | null;
  links: string[];
  backlinksCount: number;
  headings: string[];
  frontmatter: Record<string, unknown>;
  attachmentLinked: boolean;
  parentPath: string;
  parentName: string;
  folderDepth: number;
}
