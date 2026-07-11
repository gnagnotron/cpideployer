// Shared types across popup, options, background

export interface Tenant {
  id: string;
  name: string;
  baseUrl: string;      // e.g. https://my-tenant.it-cpi.cloud.sap
  tokenUrl: string;     // e.g. https://my-tenant.authentication.sap.hana.ondemand.com/oauth/token
  clientId: string;
  clientSecret: string;
}

export type ArtifactType =
  | 'IntegrationFlow'
  | 'ValueMapping'
  | 'ScriptCollection'
  | 'MessageMapping';

export interface DesigntimeArtifact {
  Id: string;
  Version: string;
  PackageId: string;
  Name: string;
  ArtifactContent?: string;
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

export interface IntegrationPackage {
  Id: string;
  Name: string;
  Description?: string;
  Version?: string;
}

export interface PresetGroup {
  id: string;
  name: string;
  artifactIds: { id: string; type: ArtifactType }[];
}

export interface StorageData {
  tenants: Tenant[];
  activeTenantId: string | null;
  presets: PresetGroup[];
  operationLog: OperationLogEntry[];
  theme: 'dark' | 'light';
}

export interface OperationLogEntry {
  id: string;
  timestamp: number;
  tenantId: string;
  tenantName: string;
  operation: 'deploy' | 'undeploy';
  artifacts: { id: string; name: string; status: 'success' | 'error'; message?: string }[];
}

// Messages between popup/options and background service worker
export type BgMessage =
  | { type: 'GET_PACKAGES'; tenantId: string; forceRefresh?: boolean }
  | { type: 'GET_ARTIFACTS'; tenantId: string; packageId?: string; forceRefresh?: boolean }
  | { type: 'GET_RUNTIME_ARTIFACTS'; tenantId: string; forceRefresh?: boolean }
  | { type: 'DEPLOY'; tenantId: string; artifacts: { id: string; version: string; type: ArtifactType }[] }
  | { type: 'UNDEPLOY'; tenantId: string; artifactIds: string[] }
  | { type: 'GET_STORAGE' }
  | { type: 'SAVE_TENANT'; tenant: Tenant }
  | { type: 'DELETE_TENANT'; tenantId: string }
  | { type: 'SET_ACTIVE_TENANT'; tenantId: string }
  | { type: 'SET_THEME'; theme: 'dark' | 'light' }
  | { type: 'SAVE_PRESET'; preset: PresetGroup }
  | { type: 'DELETE_PRESET'; presetId: string };

export interface BgResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
