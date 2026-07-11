// ─────────────────────────────────────────────────────────────────────────────
// Shared types for CPI Mapping Copilot
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
export type DataFormat = 'XML' | 'JSON' | 'CSV';
export type OutputType = 'GROOVY' | 'XSLT' | 'BOTH';

export interface SchemaField {
  path: string;        // dot-notation path e.g. "Order.Header.OrderDate"
  name: string;
  type: FieldType;
  required: boolean;
  isArray?: boolean;
  children?: SchemaField[];
  namespace?: string;
  description?: string;
}

export type TransformationType =
  | 'direct'
  | 'constant'
  | 'concat'
  | 'split'
  | 'date_format'
  | 'number_format'
  | 'conditional'
  | 'upper_case'
  | 'lower_case'
  | 'trim'
  | 'custom_groovy';

export interface TransformationDef {
  type: TransformationType;
  params?: Record<string, string>;
}

export interface MappingRule {
  id: string;
  sourcePaths: string[];
  targetPath: string;
  transformation?: TransformationDef;
  description?: string;
}

export interface MappingSpec {
  id: string;
  name: string;
  description?: string;
  sourceFormat: DataFormat;
  targetFormat: DataFormat;
  outputType: OutputType;
  sourceSchema: SchemaField[];
  targetSchema: SchemaField[];
  rules: MappingRule[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedArtifact {
  type: 'GROOVY' | 'XSLT';
  filename: string;
  content: string;
}

export interface TransformResult {
  success: boolean;
  artifacts: GeneratedArtifact[];
  lintReport?: LintReport;
  previewOutput?: string;
  errors?: string[];
}

export interface LintIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location?: string;
}

export interface LintReport {
  passed: boolean;
  issues: LintIssue[];
  score: number;   // 0-100
}

export interface SchemaParseResult {
  fields: SchemaField[];
  format: DataFormat;
  errors: string[];
}

export interface ParsedCsvSchema {
  columns: string[];
  sampleRows: string[][];
}
