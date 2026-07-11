// Shared frontend types (mirrors backend types.ts)

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
export type DataFormat = 'XML' | 'JSON' | 'CSV';
export type OutputType = 'GROOVY' | 'XSLT' | 'BOTH';

export interface SchemaField {
  path: string;
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

export interface LintIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location?: string;
}

export interface LintReport {
  passed: boolean;
  issues: LintIssue[];
  score: number;
}

export interface TransformResult {
  success: boolean;
  artifacts: GeneratedArtifact[];
  lintReport?: LintReport;
  errors?: string[];
}

export interface SchemaParseResult {
  fields: SchemaField[];
  format: DataFormat;
  errors: string[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  sourceFormat: DataFormat;
  targetFormat: DataFormat;
  outputType: OutputType;
  tags: string[];
  sourceSchema: SchemaField[];
  targetSchema: SchemaField[];
  rules: MappingRule[];
}

export type OrgRole = 'owner' | 'admin' | 'member';

export interface Membership {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrgRole;
}

export interface CurrentUser {
  userId: string;
  email: string | null;
  memberships: Membership[];
}

export interface EnvironmentConfig {
  id: string;
  name: string;
  base_url: string;
  token_url: string;
  client_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PresetItem {
  id: string;
  name: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  email: string | null;
  fullName: string | null;
}

export type ArtifactType =
  | 'IntegrationFlow'
  | 'ValueMapping'
  | 'ScriptCollection'
  | 'MessageMapping';

export interface IntegrationPackage {
  Id: string;
  Name: string;
  Description?: string;
  Version?: string;
}

export interface DesigntimeArtifact {
  Id: string;
  Version: string;
  PackageId: string;
  Name: string;
  Type: ArtifactType;
}

export interface RuntimeArtifact {
  Id: string;
  Version: string;
  Name: string;
  Type: string;
  Status: 'STARTED' | 'STARTING' | 'ERROR' | 'STOPPING' | 'STOPPED';
  ErrorInformation?: { LastErrorMessage: string };
}
