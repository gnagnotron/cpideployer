import type { Tenant, DesigntimeArtifact, RuntimeArtifact, IntegrationPackage, ArtifactType } from '../types';
import { getAccessToken } from './token-manager';

const DESIGNTIME_TYPES: ArtifactType[] = [
  'IntegrationFlow',
  'ValueMapping',
  'ScriptCollection',
  'MessageMapping',
];

// Designtime resource paths per type
const TYPE_RESOURCE: Record<ArtifactType, string> = {
  IntegrationFlow: 'IntegrationDesigntimeArtifacts',
  ValueMapping: 'ValueMappingDesigntimeArtifacts',
  ScriptCollection: 'ScriptCollectionDesigntimeArtifacts',
  MessageMapping: 'MessageMappingDesigntimeArtifacts',
};

const CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const packagesCache = new Map<string, CacheEntry<IntegrationPackage[]>>();
const artifactsCache = new Map<string, CacheEntry<DesigntimeArtifact[]>>();
const runtimeCache = new Map<string, CacheEntry<RuntimeArtifact[]>>();

function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() < entry.expiresAt;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function cpiGet<T>(tenant: Tenant, path: string): Promise<T> {
  const token = await getAccessToken(tenant);
  const url = `${tenant.baseUrl.replace(/\/$/, '')}/api/v1/${path}`;
  console.log(`[CPIClient] GET ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[CPIClient] GET failed (${response.status}):`, text);
      throw new Error(`GET ${path} failed (${response.status}): ${text}`);
    }
    return (await response.json()) as T;
  } catch (err) {
    console.error('[CPIClient] GET error:', err);
    throw err;
  }
}

async function fetchCsrfToken(tenant: Tenant): Promise<string> {
  const token = await getAccessToken(tenant);
  const url = `${tenant.baseUrl.replace(/\/$/, '')}/api/v1/`;
  console.log(`[CPIClient] Fetching CSRF token from ${url}`);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': 'Fetch',
        Accept: 'application/json',
      },
    });
    const csrf = response.headers.get('X-CSRF-Token');
    if (!csrf) {
      console.error('[CPIClient] CSRF token not found in response headers');
      throw new Error('Could not retrieve CSRF token from CPI');
    }
    console.log('[CPIClient] CSRF token retrieved');
    return csrf;
  } catch (err) {
    console.error('[CPIClient] CSRF fetch error:', err);
    throw err;
  }
}

async function cpiPost(tenant: Tenant, path: string, csrf: string, body?: string): Promise<void> {
  const token = await getAccessToken(tenant);
  const url = `${tenant.baseUrl.replace(/\/$/, '')}/api/v1/${path}`;
  console.log(`[CPIClient] POST ${url}`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': csrf,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body,
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[CPIClient] POST failed (${response.status}):`, text);
      throw new Error(`POST ${path} failed (${response.status}): ${text}`);
    }
  } catch (err) {
    console.error('[CPIClient] POST error:', err);
    throw err;
  }
}

async function cpiDelete(tenant: Tenant, path: string, csrf: string): Promise<void> {
  const token = await getAccessToken(tenant);
  const url = `${tenant.baseUrl.replace(/\/$/, '')}/api/v1/${path}`;
  console.log(`[CPIClient] DELETE ${url}`);
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': csrf,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[CPIClient] DELETE failed (${response.status}):`, text);
      throw new Error(`DELETE ${path} failed (${response.status}): ${text}`);
    }
  } catch (err) {
    console.error('[CPIClient] DELETE error:', err);
    throw err;
  }
}

export async function getPackages(tenant: Tenant, forceRefresh = false): Promise<IntegrationPackage[]> {
  if (!forceRefresh) {
    const cached = packagesCache.get(tenant.id);
    if (isCacheValid(cached)) {
      console.log(`[CPIClient] Packages cache hit for tenant ${tenant.name}`);
      return cached.value;
    }
  }

  const data = await cpiGet<{ d: { results: IntegrationPackage[] } }>(
    tenant,
    'IntegrationPackages'
  );
  setCached(packagesCache, tenant.id, data.d.results);
  return data.d.results;
}

export async function getArtifacts(
  tenant: Tenant,
  packageId?: string,
  forceRefresh = false
): Promise<DesigntimeArtifact[]> {
  const cacheKey = `${tenant.id}:${packageId ?? 'ALL'}`;
  if (!forceRefresh) {
    const cached = artifactsCache.get(cacheKey);
    if (isCacheValid(cached)) {
      console.log(`[CPIClient] Artifacts cache hit for key ${cacheKey}`);
      return cached.value;
    }
  }

  const allArtifacts: DesigntimeArtifact[] = [];

  // If no packageId, fetch all packages first, then artifacts per package
  let packageIds: string[] = [];
  if (packageId) {
    packageIds = [packageId];
  } else {
    console.log('[CPIClient] Fetching artifacts for all packages');
    try {
      const pkgs = await getPackages(tenant, forceRefresh);
      packageIds = pkgs.map((p) => p.Id);
      console.log(`[CPIClient] Found ${packageIds.length} packages`);
    } catch (err) {
      console.error('[CPIClient] Failed to fetch packages:', err);
      return [];
    }
  }

  // Fetch artifacts for each package
  for (const pkgId of packageIds) {
    for (const type of DESIGNTIME_TYPES) {
      try {
        const path = `IntegrationPackages('${encodeURIComponent(pkgId)}')/${TYPE_RESOURCE[type]}`;
        console.log(`[CPIClient] Fetching ${type} artifacts for package ${pkgId}...`);
        const data = await cpiGet<{ d: { results: (DesigntimeArtifact & { __metadata?: unknown })[] } }>(
          tenant,
          path
        );
        const items = data.d.results.map((r) => ({ ...r, Type: type }));
        console.log(`[CPIClient] Found ${items.length} ${type} artifacts`);
        allArtifacts.push(...items);
      } catch (err) {
        console.warn(`[CPIClient] Could not fetch ${type} for package ${pkgId}:`, (err as Error).message);
        // Continue with next type
      }
    }
  }

  console.log(`[CPIClient] Total artifacts fetched: ${allArtifacts.length}`);
  setCached(artifactsCache, cacheKey, allArtifacts);
  return allArtifacts;
}

export async function getRuntimeArtifacts(tenant: Tenant, forceRefresh = false): Promise<RuntimeArtifact[]> {
  if (!forceRefresh) {
    const cached = runtimeCache.get(tenant.id);
    if (isCacheValid(cached)) {
      console.log(`[CPIClient] Runtime cache hit for tenant ${tenant.name}`);
      return cached.value;
    }
  }

  const data = await cpiGet<{ d: { results: RuntimeArtifact[] } }>(
    tenant,
    'IntegrationRuntimeArtifacts'
  );
  setCached(runtimeCache, tenant.id, data.d.results);
  return data.d.results;
}

export async function deployArtifact(
  tenant: Tenant,
  id: string,
  version: string,
  csrf: string
): Promise<string> {
  // Returns a taskId for status polling
  const path = `DeployIntegrationDesigntimeArtifact?Id='${encodeURIComponent(id)}'&Version='${encodeURIComponent(version)}'`;
  const token = await getAccessToken(tenant);
  const url = `${tenant.baseUrl.replace(/\/$/, '')}/api/v1/${path}`;
  console.log(`[CPIClient] Deploying artifact ${id}, URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': csrf,
        Accept: 'application/json',
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`[CPIClient] Deploy POST failed (${response.status}):`, text);
      throw new Error(`Deploy ${id} failed (${response.status}): ${text}`);
    }
    
    // Read response body as text first to inspect
    const text = await response.text();
    console.log(`[CPIClient] Deploy response body (raw):`, text);
    
    // Try to parse as JSON
    if (!text || text.trim() === '') {
      console.log(`[CPIClient] Empty response body, assuming immediate success`);
      return ''; // Empty taskId indicates immediate success
    }
    
    try {
      const json = JSON.parse(text) as { d?: { TaskId?: string } };
      const taskId = json.d?.TaskId ?? '';
      console.log(`[CPIClient] Deploy TaskId extracted:`, taskId);
      return taskId;
    } catch (jsonErr) {
      // If not JSON, try interpreting as raw TaskId
      const rawTaskId = text.trim().replace(/^"|"$/g, '');
      console.warn(`[CPIClient] Response is not JSON, treating as raw TaskId:`, rawTaskId);
      return rawTaskId;
    }
  } catch (err) {
    console.error('[CPIClient] Deploy error:', err);
    throw err;
  }
}

export async function pollDeployStatus(
  tenant: Tenant,
  taskId: string
): Promise<{ status: string; errorMessage?: string }> {
  if (!taskId) {
    console.log('[CPIClient] No TaskId provided, assuming immediate success');
    return { status: 'COMPLETED' };
  }

  const token = await getAccessToken(tenant);
  const normalizedTaskId = taskId.replace(/^"|"$/g, '');
  const path = `BuildAndDeployStatus(TaskId='${encodeURIComponent(normalizedTaskId)}')`;
  const url = `${tenant.baseUrl.replace(/\/$/, '')}/api/v1/${path}`;
  console.log(`[CPIClient] Polling deploy status for TaskId: ${normalizedTaskId}`);
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[CPIClient] Poll status failed (${response.status}):`, text);
      throw new Error(`Poll deploy status failed (${response.status}): ${text}`);
    }

    const body = await response.text();
    if (!body || body.trim() === '') {
      console.log('[CPIClient] Empty poll response, treating as PROCESSING');
      return { status: 'PROCESSING' };
    }

    // Normal case: OData JSON payload
    try {
      const data = JSON.parse(body) as {
        d?: { Status?: string; DeployedArtifact?: { ErrorInformation?: { LastErrorMessage?: string } } };
      };
      const status = data.d?.Status;
      if (status) {
        const errorMsg = data.d?.DeployedArtifact?.ErrorInformation?.LastErrorMessage;
        console.log(`[CPIClient] Deploy status: ${status}`, errorMsg ? `Error: ${errorMsg}` : '');
        return { status, errorMessage: errorMsg };
      }
    } catch {
      // Fall through to textual status parsing
    }

    // Some tenants may return plain text status/task-id instead of JSON
    const raw = body.trim().replace(/^"|"$/g, '');
    const upper = raw.toUpperCase();
    if (['COMPLETED', 'SUCCESS', 'FAILED', 'ERROR', 'PROCESSING', 'IN_PROGRESS', 'STARTED'].includes(upper)) {
      console.log(`[CPIClient] Deploy status (text): ${upper}`);
      return { status: upper };
    }

    // If server echoes a taskId-like value, keep polling.
    console.warn('[CPIClient] Poll returned non-JSON/non-status payload, treating as PROCESSING:', raw);
    return { status: 'PROCESSING' };
  } catch (err) {
    console.error('[CPIClient] Poll status error:', err);
    throw err;
  }
}

export async function undeployArtifact(
  tenant: Tenant,
  id: string,
  csrf: string
): Promise<void> {
  await cpiDelete(tenant, `IntegrationRuntimeArtifacts('${encodeURIComponent(id)}')`, csrf);
}

export async function acquireCsrf(tenant: Tenant): Promise<string> {
  return fetchCsrfToken(tenant);
}

export function invalidateTenantCache(tenantId: string): void {
  packagesCache.delete(tenantId);
  runtimeCache.delete(tenantId);
  for (const key of artifactsCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      artifactsCache.delete(key);
    }
  }
}

export function invalidateRuntimeCache(tenantId: string): void {
  runtimeCache.delete(tenantId);
}

export { DESIGNTIME_TYPES };
