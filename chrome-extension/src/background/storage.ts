import type { StorageData, Tenant, PresetGroup } from '../types';

const STORAGE_KEY = 'cpi_deployer_data';

export async function loadStorage(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result: Record<string, StorageData | undefined>) => {
      const data: StorageData = result[STORAGE_KEY] ?? {
        tenants: [],
        activeTenantId: null,
        presets: [],
        operationLog: [],
        theme: 'dark',
      };
      if (!data.theme) data.theme = 'dark';
      resolve(data);
    });
  });
}

export async function saveStorage(data: StorageData): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

export async function saveTenant(tenant: Tenant): Promise<StorageData> {
  const data = await loadStorage();
  const idx = data.tenants.findIndex((t) => t.id === tenant.id);
  if (idx >= 0) {
    data.tenants[idx] = tenant;
  } else {
    data.tenants.push(tenant);
  }
  if (!data.activeTenantId) data.activeTenantId = tenant.id;
  await saveStorage(data);
  return data;
}

export async function deleteTenant(tenantId: string): Promise<StorageData> {
  const data = await loadStorage();
  data.tenants = data.tenants.filter((t) => t.id !== tenantId);
  if (data.activeTenantId === tenantId) {
    data.activeTenantId = data.tenants[0]?.id ?? null;
  }
  await saveStorage(data);
  return data;
}

export async function setActiveTenant(tenantId: string): Promise<StorageData> {
  const data = await loadStorage();
  data.activeTenantId = tenantId;
  await saveStorage(data);
  return data;
}

export async function setTheme(theme: 'dark' | 'light'): Promise<StorageData> {
  const data = await loadStorage();
  data.theme = theme;
  await saveStorage(data);
  return data;
}

export async function savePreset(preset: PresetGroup): Promise<StorageData> {
  const data = await loadStorage();
  const idx = data.presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    data.presets[idx] = preset;
  } else {
    data.presets.push(preset);
  }
  await saveStorage(data);
  return data;
}

export async function deletePreset(presetId: string): Promise<StorageData> {
  const data = await loadStorage();
  data.presets = data.presets.filter((p) => p.id !== presetId);
  await saveStorage(data);
  return data;
}
