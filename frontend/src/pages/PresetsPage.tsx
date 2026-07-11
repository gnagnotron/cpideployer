import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPreset, deletePreset, listPresets } from '../api/client';
import type { PresetItem } from '../types';

export default function PresetsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['presets'],
    queryFn: listPresets,
  });

  const [name, setName] = useState('');
  const [payloadText, setPayloadText] = useState('{\n  "example": true\n}');
  const [error, setError] = useState<string | null>(null);
  const [openJsonById, setOpenJsonById] = useState<Record<string, boolean>>({});

  const createMut = useMutation({
    mutationFn: createPreset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presets'] });
      setName('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: deletePreset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presets'] }),
  });

  function handleCreate() {
    try {
      const payload = JSON.parse(payloadText);
      setError(null);
      createMut.mutate({ name, payload });
    } catch {
      setError('Payload must be valid JSON');
    }
  }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Preset condivisi</h2>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          Tutti i membri della stessa organizzazione vedono gli stessi preset.
        </p>
      </div>

      <div className="panel" style={{ padding: 16, borderRadius: 6, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Nuovo preset</div>
        <input className="field" placeholder="Preset name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          className="field mono"
          rows={10}
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
        />
        {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
        <div>
          <button className="btn btn-primary" onClick={handleCreate} disabled={createMut.isPending || !name.trim()}>
            {createMut.isPending ? 'Saving...' : 'Save preset'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {!isLoading && data.map((item) => (
          <div key={item.id} className="panel" style={{ borderRadius: 6, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  Updated {new Date(item.updated_at).toLocaleString('it-IT')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    setOpenJsonById((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                >
                  {openJsonById[item.id] ? 'Hide JSON' : 'Show JSON'}
                </button>
                <button className="btn btn-danger" onClick={() => deleteMut.mutate(item.id)}>Delete</button>
              </div>
            </div>

            <PresetSummary item={item} />

            {openJsonById[item.id] && (
              <pre
                className="mono"
                style={{ margin: 0, overflow: 'auto', background: 'var(--bg-base)', padding: 10, borderRadius: 4, marginTop: 10 }}
              >
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PresetSummary({ item }: { item: PresetItem }) {
  const parsed = parsePresetPayload(item.payload);

  if (!parsed.ok) {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
        Custom preset payload. Use Show JSON for full details.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span className="badge badge-blue">bulk selection</span>
        <span className="badge badge-gray">env: {parsed.environmentName ?? parsed.environmentId ?? 'n/a'}</span>
        <span className="badge badge-green">{parsed.artifactIds.length} elements</span>
      </div>

      <div style={{ color: 'var(--text-mid)', fontSize: 12 }}>
        {parsed.artifactIds.slice(0, 8).map((x) => x.id).join(', ')}
        {parsed.artifactIds.length > 8 ? ' ...' : ''}
      </div>
    </div>
  );
}

function parsePresetPayload(payload: unknown):
  | {
      ok: true;
      environmentId: string | null;
      environmentName: string | null;
      artifactIds: Array<{ id: string; type?: string }>;
    }
  | { ok: false } {
  if (!payload || typeof payload !== 'object') return { ok: false };

  const value = payload as {
    kind?: string;
    environmentId?: string;
    environmentName?: string | null;
    artifactIds?: Array<{ id: string; type?: string }>;
  };

  if (value.kind !== 'artifact-bulk-selection' || !Array.isArray(value.artifactIds)) {
    return { ok: false };
  }

  return {
    ok: true,
    environmentId: value.environmentId ?? null,
    environmentName: value.environmentName ?? null,
    artifactIds: value.artifactIds,
  };
}
