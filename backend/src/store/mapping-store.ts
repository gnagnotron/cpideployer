import { MappingSpec } from '../core/types';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store for mapping specs (replace with DB in production)
// ─────────────────────────────────────────────────────────────────────────────

const store = new Map<string, MappingSpec>();

export function saveMapping(spec: Omit<MappingSpec, 'id' | 'createdAt' | 'updatedAt'>): MappingSpec {
  const now = new Date().toISOString();
  const full: MappingSpec = {
    ...spec,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
  store.set(full.id, full);
  return full;
}

export function updateMapping(id: string, partial: Partial<MappingSpec>): MappingSpec | null {
  const existing = store.get(id);
  if (!existing) return null;
  const updated: MappingSpec = {
    ...existing,
    ...partial,
    id,
    updatedAt: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

export function getMapping(id: string): MappingSpec | undefined {
  return store.get(id);
}

export function listMappings(): MappingSpec[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function deleteMapping(id: string): boolean {
  return store.delete(id);
}
