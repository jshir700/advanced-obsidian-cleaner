/**
 * Type definitions for the Clean Rule system.
 * Defines actions, criteria types, operators, and rule structures.
 */

// ========================
// Action Types
// ========================
export type CleanAction = 'delete' | 'skip';

// ========================
// Aggregation Type
// ========================
export type AggregationType = 'all' | 'any' | 'none';

// ========================
// Scope Type
// ========================
export type CleanScope = 'folder' | 'markdown' | 'attachment';

// ========================
// Criteria Types
// ========================
export type FolderCriteriaType =
  | 'parent_path'
  | 'folder_name'
  | 'depth'
  | 'folder_depth'
  | 'created_at'
  | 'modified_at'
  | 'size'
  | 'children_count'
  | 'subfolders_count';

export type MarkdownCriteriaType =
  | 'parent_path'
  | 'parent_name'
  | 'fileName'
  | 'file_size'
  | 'content_length'
  | 'created_at'
  | 'modified_at'
  | 'links'
  | 'backlinks'
  | 'headings'
  | 'frontmatter';

export type AttachmentCriteriaType =
  | 'parent_path'
  | 'parent_name'
  | 'fileName'
  | 'extension'
  | 'file_size'
  | 'created_at'
  | 'modified_at'
  | 'attachment_usage';

export type CleanCriteriaType = FolderCriteriaType | MarkdownCriteriaType | AttachmentCriteriaType;

// ========================
// Text Operators (for paths, names, file names)
// ========================
export type TextOperator =
  | 'is'
  | 'is not'
  | 'contains'
  | 'does not contain'
  | 'starts with'
  | 'does not start with'
  | 'ends with'
  | 'does not end with'
  | 'match regex'
  | 'does not match regex';

// ========================
// Comparison Operators (for numbers, sizes, counts, depth)
// ========================
export type CompareOperator = '=' | '>' | '<' | '≥' | '≤';

// ========================
// Date Operators (for created_at, modified_at)
// ========================
export type DateOperator =
  | 'is'
  | 'is before'
  | 'is after'
  | 'time is before'
  | 'time is after'
  | 'time is before now'
  | 'time is after now'
  | 'date is'
  | 'date is not'
  | 'date is before'
  | 'date is after'
  | 'date is today'
  | 'date is not today'
  | 'is under X days ago'
  | 'is over X days ago'
  | 'day of week is'
  | 'day of week is not'
  | 'day of week is before'
  | 'day of week is after'
  | 'day of month is'
  | 'day of month is not'
  | 'day of month is before'
  | 'day of month is after'
  | 'month is'
  | 'month is not'
  | 'month is before'
  | 'month is after'
  | 'year is'
  | 'year is not'
  | 'year is before'
  | 'year is after';

// ========================
// List Operators (for headings, frontmatter)
// ========================
export type ListOperator =
  | 'includes item'
  | 'does not include item'
  | 'all are'
  | 'all start with'
  | 'all end with'
  | 'all match regex'
  | 'any contain'
  | 'any end with'
  | 'any match regex'
  | 'none contain'
  | 'none start with'
  | 'none end with';

// ========================
// Extension Category Operators
// ========================
export type ExtensionCategoryOperator = 'is image' | 'is video' | 'is audio' | 'is document' | 'is archive';

// ========================
// Attachment Usage Operators
// ========================
export type AttachmentUsageOperator =
  | 'link count ='
  | 'link count >'
  | 'link count <'
  | 'link count ≥'
  | 'link count ≤';

// ========================
// Frontmatter Base Operators
// ========================
export type FrontmatterBaseOperator =
  | 'has any value'
  | 'has no value'
  | 'property is present'
  | 'property is missing';

// ========================
// Frontmatter Text Operators
// ========================
export type FrontmatterTextOperator = FrontmatterBaseOperator | TextOperator;

// ========================
// Frontmatter Number Operators
// ========================
export type FrontmatterNumberOperator =
  | FrontmatterBaseOperator
  | 'equals'
  | 'does not equal'
  | 'is less than'
  | 'is more than'
  | 'is divisible by'
  | 'is not divisible by';

// ========================
// Frontmatter List Operators
// ========================
export type FrontmatterListOperator =
  | FrontmatterBaseOperator
  | ListOperator
  | 'count is'
  | 'count is not'
  | 'count is less than'
  | 'count is more than';

// ========================
// Frontmatter Date Operators
// ========================
export type FrontmatterDateOperator =
  | FrontmatterBaseOperator
  | DateOperator;

// ========================
// Frontmatter Checkbox Operators
// ========================
export type FrontmatterCheckboxOperator =
  | FrontmatterBaseOperator
  | 'is true'
  | 'is false';

// ========================
// Operator mapping by CriteriaType
// ========================
export type CriteriaTypeToOperatorMap = {
  // Folder criteria
  parent_path: TextOperator;
  folder_name: TextOperator;
  depth: CompareOperator;
  folder_depth: CompareOperator;
  created_at: DateOperator;
  modified_at: DateOperator;
  size: CompareOperator;
  children_count: CompareOperator;
  subfolders_count: CompareOperator;

  // Markdown criteria
  parent_path_md: TextOperator;
  parent_name: TextOperator;
  fileName: TextOperator;
  file_size: CompareOperator;
  content_length: CompareOperator;
  created_at_md: DateOperator;
  modified_at_md: DateOperator;
  links: CompareOperator;
  backlinks: CompareOperator;
  headings: ListOperator;
  frontmatter: FrontmatterTextOperator | FrontmatterNumberOperator | FrontmatterListOperator | FrontmatterDateOperator | FrontmatterCheckboxOperator;

  // Attachment criteria
  parent_path_att: TextOperator;
  parent_name_att: TextOperator;
  fileName_att: TextOperator;
  extension: TextOperator | ExtensionCategoryOperator;
  file_size_att: CompareOperator;
  created_at_att: DateOperator;
  modified_at_att: DateOperator;
  attachment_usage: AttachmentUsageOperator;
};

// ========================
// Trigger Interface
// ========================
export interface CleanTrigger {
  criteriaType: keyof CriteriaTypeToOperatorMap;
  operator: CriteriaTypeToOperatorMap[keyof CriteriaTypeToOperatorMap];
  value: string;
  // For frontmatter: the property name to check
  fieldName?: string;
}

// ========================
// CleanRule Interface
// ========================
export interface CleanRule {
  name: string;
  active: boolean;
  aggregation: AggregationType;
  triggers: CleanTrigger[];
  action: CleanAction | null;
  scope: CleanScope | null;
}
