import type {
  BgMessage,
  BgResponse,
  OperationLogEntry,
  ArtifactType,
} from '../types';
import { getAccessToken, invalidateToken } from './token-manager';
import {
  getPackages,
  getArtifacts,
  getRuntimeArtifacts,
  deployArtifact,
  undeployArtifact,
  pollDeployStatus,
  acquireCsrf,
  invalidateTenantCache,
  invalidateRuntimeCache,
} from './cpi-client';
import {
  loadStorage,
  saveTenant,
  deleteTenant,
  setActiveTenant,
  setTheme,
  savePreset,
  deletePreset,
  saveStorage,
} from './storage';

// Polling helper: waits until build/deploy status is terminal or times out
async function waitForDeploy(
  tenant: Parameters<typeof pollDeployStatus>[0],
  taskId: string,
  timeoutMs = 60_000
): Promise<'COMPLETED' | 'FAILED' | 'TIMEOUT'> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const { status } = await pollDeployStatus(tenant, taskId);
    if (status === 'COMPLETED' || status === 'SUCCESS') return 'COMPLETED';
    if (status === 'FAILED' || status === 'ERROR') return 'FAILED';
  }
  return 'TIMEOUT';
}

chrome.runtime.onMessage.addListener(
  (message: BgMessage, _sender, sendResponse: (r: BgResponse) => void) => {
    handleMessage(message)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async
  }
);

async function handleMessage(msg: BgMessage): Promise<unknown> {
  console.log('[BgWorker] Received message:', msg.type);
  try {
    switch (msg.type) {
    case 'GET_STORAGE': {
      return loadStorage();
    }

    case 'SAVE_TENANT': {
      invalidateToken(msg.tenant.id);
      invalidateTenantCache(msg.tenant.id);
      return saveTenant(msg.tenant);
    }

    case 'DELETE_TENANT': {
      invalidateToken(msg.tenantId);
      invalidateTenantCache(msg.tenantId);
      return deleteTenant(msg.tenantId);
    }

    case 'SET_ACTIVE_TENANT': {
      return setActiveTenant(msg.tenantId);
    }

    case 'SET_THEME': {
      return setTheme(msg.theme);
    }

    case 'SAVE_PRESET': {
      return savePreset(msg.preset);
    }

    case 'DELETE_PRESET': {
      return deletePreset(msg.presetId);
    }

    case 'GET_PACKAGES': {
      const data = await loadStorage();
      const tenant = data.tenants.find((t) => t.id === msg.tenantId);
      if (!tenant) throw new Error('Tenant not found');
      return getPackages(tenant, msg.forceRefresh === true);
    }

    case 'GET_ARTIFACTS': {
      const data = await loadStorage();
      const tenant = data.tenants.find((t) => t.id === msg.tenantId);
      if (!tenant) throw new Error('Tenant not found');
      return getArtifacts(tenant, msg.packageId, msg.forceRefresh === true);
    }

    case 'GET_RUNTIME_ARTIFACTS': {
      const data = await loadStorage();
      const tenant = data.tenants.find((t) => t.id === msg.tenantId);
      if (!tenant) throw new Error('Tenant not found');
      return getRuntimeArtifacts(tenant, msg.forceRefresh === true);
    }

    case 'DEPLOY': {
      const data = await loadStorage();
      const tenant = data.tenants.find((t) => t.id === msg.tenantId);
      if (!tenant) throw new Error('Tenant not found');

      const csrf = await acquireCsrf(tenant);
      const results: OperationLogEntry['artifacts'] = [];

      for (const artifact of msg.artifacts) {
        try {
          const taskId = await deployArtifact(tenant, artifact.id, artifact.version, csrf);
          const outcome = await waitForDeploy(tenant, taskId);
          results.push({
            id: artifact.id,
            name: artifact.id,
            status: outcome === 'COMPLETED' ? 'success' : 'error',
            message: outcome !== 'COMPLETED' ? `Deploy ended with status: ${outcome}` : undefined,
          });
        } catch (err) {
          results.push({
            id: artifact.id,
            name: artifact.id,
            status: 'error',
            message: (err as Error).message,
          });
        }
      }

      // Persist log entry
      const logEntry: OperationLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        tenantId: tenant.id,
        tenantName: tenant.name,
        operation: 'deploy',
        artifacts: results,
      };
      data.operationLog = [logEntry, ...data.operationLog].slice(0, 100);
      await saveStorage(data);
      invalidateRuntimeCache(tenant.id);

      return results;
    }

    case 'UNDEPLOY': {
      const data = await loadStorage();
      const tenant = data.tenants.find((t) => t.id === msg.tenantId);
      if (!tenant) throw new Error('Tenant not found');

      const csrf = await acquireCsrf(tenant);
      const results: OperationLogEntry['artifacts'] = [];

      for (const id of msg.artifactIds) {
        try {
          await undeployArtifact(tenant, id, csrf);
          results.push({ id, name: id, status: 'success' });
        } catch (err) {
          results.push({ id, name: id, status: 'error', message: (err as Error).message });
        }
      }

      const logEntry: OperationLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        tenantId: tenant.id,
        tenantName: tenant.name,
        operation: 'undeploy',
        artifacts: results,
      };
      data.operationLog = [logEntry, ...data.operationLog].slice(0, 100);
      await saveStorage(data);
      invalidateRuntimeCache(tenant.id);

      return results;
    }

    default:
      throw new Error('Unknown message type');
    }
  } catch (err) {
    console.error('[BgWorker] Message handler error:', err);
    throw err;
  }
}

// Keep service worker alive while long operations run
export {};
