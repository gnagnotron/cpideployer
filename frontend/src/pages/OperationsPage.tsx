import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deployCpiArtifacts,
  listCpiArtifacts,
  listCpiPackages,
  listCpiRuntimeArtifacts,
  listEnvironments,
  listPresets,
  undeployCpiArtifacts,
  createPreset,
} from '../api/client';
import type { ArtifactType, DesigntimeArtifact, PresetItem } from '../types';

export default function OperationsPage() {
  const qc = useQueryClient();
  const [environmentId, setEnvironmentId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [presetName, setPresetName] = useState('');
  const [opSummary, setOpSummary] = useState<string | null>(null);

  const { data: environments = [] } = useQuery({
    queryKey: ['environments'],
    queryFn: listEnvironments,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['cpi-packages', environmentId],
    queryFn: () => listCpiPackages(environmentId),
    enabled: !!environmentId,
  });

  const { data: artifacts = [], isLoading: artifactsLoading } = useQuery({
    queryKey: ['cpi-artifacts', environmentId, packageId],
    queryFn: () => listCpiArtifacts(environmentId, packageId || undefined),
    enabled: !!environmentId,
  });

  const { data: runtime = [] } = useQuery({
    queryKey: ['cpi-runtime', environmentId],
    queryFn: () => listCpiRuntimeArtifacts(environmentId),
    enabled: !!environmentId,
  });

  const { data: presets = [] } = useQuery({
    queryKey: ['presets'],
    queryFn: listPresets,
  });

  const deployMut = useMutation({
    mutationFn: () =>
      deployCpiArtifacts(
        environmentId,
        artifacts
          .filter((a) => selectedIds.has(a.Id))
          .map((a) => ({ id: a.Id, version: a.Version, type: a.Type }))
      ),
    onSuccess: (result) => {
      const ok = result.filter((r) => r.status === 'success').length;
      const ko = result.length - ok;
      setOpSummary(`Deploy complete: ${ok} success, ${ko} errors`);
      qc.invalidateQueries({ queryKey: ['cpi-runtime', environmentId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });

  const undeployMut = useMutation({
    mutationFn: () => undeployCpiArtifacts(environmentId, Array.from(selectedIds)),
    onSuccess: (result) => {
      const ok = result.filter((r) => r.status === 'success').length;
      const ko = result.length - ok;
      setOpSummary(`Undeploy complete: ${ok} success, ${ko} errors`);
      qc.invalidateQueries({ queryKey: ['cpi-runtime', environmentId] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });

  const createPresetMut = useMutation({
    mutationFn: () => {
      const selected = artifacts.filter((a) => selectedIds.has(a.Id));
      const payload = {
        kind: 'artifact-bulk-selection',
        artifactIds: selected.map((a) => ({ id: a.Id, type: a.Type as ArtifactType })),
      };
      return createPreset({ name: presetName, payload });
    },
    onSuccess: () => {
      setPresetName('');
      qc.invalidateQueries({ queryKey: ['presets'] });
      setOpSummary('Preset saved successfully');
    },
  });

  const filteredArtifacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return artifacts;
    return artifacts.filter((a) =>
      a.Name.toLowerCase().includes(q) ||
      a.Id.toLowerCase().includes(q) ||
      a.Type.toLowerCase().includes(q)
    );
  }, [artifacts, search]);

  const runtimeSet = useMemo(() => new Set(runtime.map((r) => r.Id)), [runtime]);
  const isLoadingCpiData = artifactsLoading || deployMut.isPending || undeployMut.isPending;

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyPreset(item: PresetItem) {
    const payload = item.payload as { kind?: string; artifactIds?: Array<{ id: string; type?: string }> };
    if (payload?.kind !== 'artifact-bulk-selection' || !Array.isArray(payload.artifactIds)) return;
    const next = new Set(payload.artifactIds.map((x) => x.id));
    setSelectedIds(next);
    setOpSummary(`Preset applied: ${item.name} (${next.size} selected)`);
  }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Bulk Operations</h2>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          Filtra per package o iFlow, seleziona un set e fai deploy/undeploy in blocco.
        </p>
      </div>

      {opSummary && (
        <div className="panel" style={{ padding: '10px 12px', borderRadius: 6, color: 'var(--green)' }}>
          {opSummary}
        </div>
      )}

      <div className="panel" style={{ borderRadius: 6, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
          <select className="field" value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)}>
            <option value="">Select environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>

          <select
            className="field"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            disabled={!environmentId}
          >
            <option value="">All packages</option>
            {packages.map((pkg) => (
              <option key={pkg.Id} value={pkg.Id}>{pkg.Name}</option>
            ))}
          </select>

          <input
            className="field"
            placeholder="Search iFlow/artifact"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!environmentId}
          />

          <button
            className="btn btn-ghost"
            onClick={() => {
              setSelectedIds(new Set(filteredArtifacts.map((a) => a.Id)));
            }}
            disabled={!environmentId || filteredArtifacts.length === 0}
          >
            Select visible
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-success"
            disabled={!environmentId || selectedIds.size === 0 || deployMut.isPending}
            onClick={() => deployMut.mutate()}
          >
            {deployMut.isPending ? 'Deploying...' : `Deploy (${selectedIds.size})`}
          </button>
          <button
            className="btn btn-danger"
            disabled={!environmentId || selectedIds.size === 0 || undeployMut.isPending}
            onClick={() => undeployMut.mutate()}
          >
            {undeployMut.isPending ? 'Undeploying...' : `Undeploy (${selectedIds.size})`}
          </button>

          <input
            className="field"
            placeholder="Preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button
            className="btn btn-primary"
            disabled={!presetName.trim() || selectedIds.size === 0 || createPresetMut.isPending}
            onClick={() => createPresetMut.mutate()}
          >
            Save selection as preset
          </button>
        </div>

        {environmentId && (artifactsLoading || deployMut.isPending || undeployMut.isPending) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--text-mid)',
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--amber)',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span>
              {artifactsLoading
                ? packageId
                  ? 'Loading selected package artifacts...'
                  : 'Loading artifacts from all packages...'
                : deployMut.isPending
                  ? 'Deploy operation in progress...'
                  : 'Undeploy operation in progress...'}
            </span>
          </div>
        )}
      </div>

      <div className="panel" style={{ borderRadius: 6, overflow: 'hidden' }}>
        {environmentId && isLoadingCpiData && (
          <div style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12 }}>
            Please wait, CPI is responding...
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['', 'Artifact', 'Type', 'Package', 'Version', 'Runtime'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!artifactsLoading && filteredArtifacts.map((a: DesigntimeArtifact) => (
              <tr key={a.Id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                <td style={{ padding: 10 }}>
                  <input type="checkbox" checked={selectedIds.has(a.Id)} onChange={() => toggleSelection(a.Id)} />
                </td>
                <td style={{ padding: 10 }}>
                  <div style={{ fontWeight: 600 }}>{a.Name}</div>
                  <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 11 }}>{a.Id}</div>
                </td>
                <td style={{ padding: 10 }}>{a.Type}</td>
                <td style={{ padding: 10 }}>{a.PackageId}</td>
                <td style={{ padding: 10 }}>{a.Version}</td>
                <td style={{ padding: 10 }}>
                  <span className={`badge ${runtimeSet.has(a.Id) ? 'badge-green' : 'badge-gray'}`}>
                    {runtimeSet.has(a.Id) ? 'DEPLOYED' : 'NOT DEPLOYED'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ borderRadius: 6, padding: 12, display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 600 }}>Saved presets</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {presets
            .filter((p) => (p.payload as { kind?: string }).kind === 'artifact-bulk-selection')
            .map((p) => (
              <button key={p.id} className="btn btn-ghost" onClick={() => applyPreset(p)}>
                Apply: {p.name}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
