import axios from 'axios';
import { supabase } from '../lib/supabase';
import type {
  MappingSpec,
  TransformResult,
  SchemaParseResult,
  LintReport,
  Template,
  AuditEntry,
  CurrentUser,
  EnvironmentConfig,
  OrganizationMember,
  OrgRole,
  PresetItem,
  DesigntimeArtifact,
  IntegrationPackage,
  RuntimeArtifact,
} from '../types';

const legacyApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : '/api',
});

const appApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
    : '/api/v1',
});

const ACTIVE_ORG_KEY = 'cpideployer.activeOrgId';

export function getActiveOrganizationId(): string | null {
  return localStorage.getItem(ACTIVE_ORG_KEY);
}

export function setActiveOrganizationId(organizationId: string) {
  localStorage.setItem(ACTIVE_ORG_KEY, organizationId);
}

appApi.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const organizationId = getActiveOrganizationId();
  if (organizationId) {
    config.headers['x-org-id'] = organizationId;
  }
  return config;
});

export const parseSchema = (content: string, hint?: string): Promise<SchemaParseResult> =>
  legacyApi.post<SchemaParseResult>('/parse-schema', { content, hint }).then((r) => r.data);

export const listMappings = (): Promise<MappingSpec[]> =>
  legacyApi.get<MappingSpec[]>('/mappings').then((r) => r.data);

export const createMapping = (
  spec: Omit<MappingSpec, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MappingSpec> => legacyApi.post<MappingSpec>('/mappings', spec).then((r) => r.data);

export const updateMapping = (
  id: string,
  partial: Partial<MappingSpec>
): Promise<MappingSpec> => legacyApi.put<MappingSpec>(`/mappings/${id}`, partial).then((r) => r.data);

export const deleteMapping = (id: string): Promise<void> =>
  legacyApi.delete(`/mappings/${id}`).then(() => undefined);

export const generateFromSaved = (id: string): Promise<TransformResult> =>
  legacyApi.post<TransformResult>(`/mappings/${id}/generate`).then((r) => r.data);

export const generatePreview = (spec: Partial<MappingSpec>): Promise<TransformResult> =>
  legacyApi.post<TransformResult>('/generate', spec).then((r) => r.data);

export const validateSpec = (spec: MappingSpec, groovyScript?: string): Promise<LintReport> =>
  legacyApi.post<LintReport>('/validate', { spec, groovyScript }).then((r) => r.data);

export const listTemplates = (): Promise<Template[]> =>
  legacyApi.get<Template[]>('/templates').then((r) => r.data);

export const getCurrentUser = (): Promise<CurrentUser> =>
  appApi.get<CurrentUser>('/auth/me').then((r) => r.data);

export const bootstrapOrganization = (organizationName: string, fullName?: string): Promise<void> =>
  appApi.post('/auth/bootstrap', { organizationName, fullName }).then(() => undefined);

export const listEnvironments = (): Promise<EnvironmentConfig[]> =>
  appApi.get<EnvironmentConfig[]>('/environments').then((r) => r.data);

export const createEnvironment = (payload: {
  name: string;
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  serviceKey: string;
}): Promise<EnvironmentConfig> =>
  appApi.post<EnvironmentConfig>('/environments', payload).then((r) => r.data);

export const updateEnvironment = (
  id: string,
  payload: Partial<{
    name: string;
    baseUrl: string;
    tokenUrl: string;
    clientId: string;
    serviceKey: string;
  }>
): Promise<EnvironmentConfig> =>
  appApi.put<EnvironmentConfig>(`/environments/${id}`, payload).then((r) => r.data);

export const deleteEnvironment = (id: string): Promise<void> =>
  appApi.delete(`/environments/${id}`).then(() => undefined);

export const listPresets = (): Promise<PresetItem[]> =>
  appApi.get<PresetItem[]>('/presets').then((r) => r.data);

export const createPreset = (payload: { name: string; payload: unknown }): Promise<PresetItem> =>
  appApi.post<PresetItem>('/presets', payload).then((r) => r.data);

export const updatePreset = (
  id: string,
  payload: Partial<{ name: string; payload: unknown }>
): Promise<PresetItem> => appApi.put<PresetItem>(`/presets/${id}`, payload).then((r) => r.data);

export const deletePreset = (id: string): Promise<void> =>
  appApi.delete(`/presets/${id}`).then(() => undefined);

export const listAudit = (limit = 50): Promise<AuditEntry[]> =>
  appApi.get<AuditEntry[]>('/audit', { params: { limit } }).then((r) => r.data);

export const listOrganizationMembers = (): Promise<OrganizationMember[]> =>
  appApi.get<OrganizationMember[]>('/admin/members').then((r) => r.data);

export const updateOrganizationMemberRole = (
  memberId: string,
  role: OrgRole
): Promise<{ id: string; role: OrgRole }> =>
  appApi.patch<{ id: string; role: OrgRole }>(`/admin/members/${memberId}/role`, { role }).then((r) => r.data);

export const listCpiPackages = (environmentId: string): Promise<IntegrationPackage[]> =>
  appApi
    .get<IntegrationPackage[]>('/cpi/packages', { params: { environmentId } })
    .then((r) => r.data);

export const listCpiArtifacts = (
  environmentId: string,
  packageId?: string
): Promise<DesigntimeArtifact[]> =>
  appApi
    .get<DesigntimeArtifact[]>('/cpi/artifacts', { params: { environmentId, packageId } })
    .then((r) => r.data);

export const listCpiRuntimeArtifacts = (environmentId: string): Promise<RuntimeArtifact[]> =>
  appApi
    .get<RuntimeArtifact[]>('/cpi/runtime-artifacts', { params: { environmentId } })
    .then((r) => r.data);

export const deployCpiArtifacts = (
  environmentId: string,
  artifacts: Array<{ id: string; version: string; type?: string }>
): Promise<Array<{ id: string; status: 'success' | 'error'; message?: string }>> =>
  appApi
    .post<Array<{ id: string; status: 'success' | 'error'; message?: string }>>('/cpi/deploy', {
      environmentId,
      artifacts,
    })
    .then((r) => r.data);

export const undeployCpiArtifacts = (
  environmentId: string,
  artifactIds: string[]
): Promise<Array<{ id: string; status: 'success' | 'error'; message?: string }>> =>
  appApi
    .post<Array<{ id: string; status: 'success' | 'error'; message?: string }>>('/cpi/undeploy', {
      environmentId,
      artifactIds,
    })
    .then((r) => r.data);
