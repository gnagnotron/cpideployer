import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { compareTenants, createPreset, listEnvironments, listPresets } from '../api/client';
import type { TenantDiffIflowItem, TenantDiffPackageItem, TenantDiffResult } from '../types';

type PackageStatusFilter = 'all' | 'notTransported' | 'synced' | 'onlyInTarget';
type IflowStatusFilter = 'all' | 'notTransported' | 'versionMismatch' | 'synced' | 'onlyInTarget';

export default function TenantDiffsPage() {
  const qc = useQueryClient();
  const [customerLabel, setCustomerLabel] = useState('');
  const [sourceEnvironmentId, setSourceEnvironmentId] = useState('');
  const [targetEnvironmentId, setTargetEnvironmentId] = useState('');
  const [packageStatusFilter, setPackageStatusFilter] = useState<PackageStatusFilter>('all');
  const [iflowStatusFilter, setIflowStatusFilter] = useState<IflowStatusFilter>('all');
  const [packageSearch, setPackageSearch] = useState('');
  const [iflowSearch, setIflowSearch] = useState('');
  const [presetName, setPresetName] = useState('');

  const { data: environments = [] } = useQuery({
    queryKey: ['environments'],
    queryFn: listEnvironments,
  });

  const { data: presets = [] } = useQuery({
    queryKey: ['presets'],
    queryFn: listPresets,
  });

  const compareMut = useMutation({
    mutationFn: compareTenants,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });

  const savePresetMut = useMutation({
    mutationFn: createPreset,
    onSuccess: () => {
      setPresetName('');
      qc.invalidateQueries({ queryKey: ['presets'] });
    },
  });

  const diffResult = compareMut.data;

  const packageRows = useMemo(() => {
    if (!diffResult) return [] as Array<TenantDiffPackageItem & { status: PackageStatusFilter }>;

    const rows: Array<TenantDiffPackageItem & { status: PackageStatusFilter }> = [
      ...diffResult.packages.notTransported.map((x) => ({ ...x, status: 'notTransported' as const })),
      ...diffResult.packages.synced.map((x) => ({ ...x, status: 'synced' as const })),
      ...diffResult.packages.onlyInTarget.map((x) => ({ ...x, status: 'onlyInTarget' as const })),
    ];

    const q = packageSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const matchStatus = packageStatusFilter === 'all' || row.status === packageStatusFilter;
      const matchSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        (row.sourceVersion ?? '').toLowerCase().includes(q) ||
        (row.targetVersion ?? '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [diffResult, packageSearch, packageStatusFilter]);

  const iflowRows = useMemo(() => {
    if (!diffResult) return [] as Array<TenantDiffIflowItem & { status: IflowStatusFilter }>;

    const rows: Array<TenantDiffIflowItem & { status: IflowStatusFilter }> = [
      ...diffResult.iflows.notTransported.map((x) => ({ ...x, status: 'notTransported' as const })),
      ...diffResult.iflows.versionMismatch.map((x) => ({ ...x, status: 'versionMismatch' as const })),
      ...diffResult.iflows.synced.map((x) => ({ ...x, status: 'synced' as const })),
      ...diffResult.iflows.onlyInTarget.map((x) => ({ ...x, status: 'onlyInTarget' as const })),
    ];

    const q = iflowSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const matchStatus = iflowStatusFilter === 'all' || row.status === iflowStatusFilter;
      const matchSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        (row.sourceVersion ?? '').toLowerCase().includes(q) ||
        (row.targetVersion ?? '').toLowerCase().includes(q) ||
        (row.sourcePackageId ?? '').toLowerCase().includes(q) ||
        (row.targetPackageId ?? '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [diffResult, iflowSearch, iflowStatusFilter]);

  function runCompare() {
    compareMut.mutate({
      sourceEnvironmentId,
      targetEnvironmentId,
      customerLabel: customerLabel.trim() || undefined,
    });
  }

  function saveDiffPreset() {
    savePresetMut.mutate({
      name: presetName,
      payload: {
        kind: 'tenant-diff',
        customerLabel: customerLabel.trim() || null,
        sourceEnvironmentId,
        targetEnvironmentId,
        packageStatusFilter,
        iflowStatusFilter,
      },
    });
  }

  function applyDiffPreset(presetPayload: unknown) {
    if (!presetPayload || typeof presetPayload !== 'object') return;
    const p = presetPayload as {
      kind?: string;
      customerLabel?: string | null;
      sourceEnvironmentId?: string;
      targetEnvironmentId?: string;
      packageStatusFilter?: PackageStatusFilter;
      iflowStatusFilter?: IflowStatusFilter;
    };

    if (p.kind !== 'tenant-diff') return;

    setCustomerLabel(p.customerLabel ?? '');
    if (p.sourceEnvironmentId) setSourceEnvironmentId(p.sourceEnvironmentId);
    if (p.targetEnvironmentId) setTargetEnvironmentId(p.targetEnvironmentId);
    if (p.packageStatusFilter) setPackageStatusFilter(p.packageStatusFilter);
    if (p.iflowStatusFilter) setIflowStatusFilter(p.iflowStatusFilter);
  }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Tenant Diffs</h2>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          Compare source and target tenant (typically TEST vs PROD) under the same customer umbrella.
        </p>
      </div>

      <div className="panel" style={{ borderRadius: 6, padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Compare setup</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
          <input
            className="field"
            placeholder="Customer label (e.g. Cliente ABC)"
            value={customerLabel}
            onChange={(e) => setCustomerLabel(e.target.value)}
          />

          <select className="field" value={sourceEnvironmentId} onChange={(e) => setSourceEnvironmentId(e.target.value)}>
            <option value="">Source environment (TEST)</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>

          <select className="field" value={targetEnvironmentId} onChange={(e) => setTargetEnvironmentId(e.target.value)}>
            <option value="">Target environment (PROD)</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>

          <button
            className="btn btn-primary"
            onClick={runCompare}
            disabled={
              compareMut.isPending ||
              !sourceEnvironmentId ||
              !targetEnvironmentId ||
              sourceEnvironmentId === targetEnvironmentId
            }
          >
            {compareMut.isPending ? 'Comparing...' : 'Compare'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="field"
            placeholder="Preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button
            className="btn btn-ghost"
            onClick={saveDiffPreset}
            disabled={!presetName.trim() || !sourceEnvironmentId || !targetEnvironmentId || savePresetMut.isPending}
          >
            Save diff preset
          </button>

          {presets
            .filter((p) => (p.payload as { kind?: string })?.kind === 'tenant-diff')
            .map((p) => (
              <button key={p.id} className="btn btn-ghost" onClick={() => applyDiffPreset(p.payload)}>
                Apply: {p.name}
              </button>
            ))}
        </div>
      </div>

      {diffResult && <SummaryPanel diffResult={diffResult} />}

      <div className="panel" style={{ borderRadius: 6, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Packages</div>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 8 }}>
          <select className="field" value={packageStatusFilter} onChange={(e) => setPackageStatusFilter(e.target.value as PackageStatusFilter)}>
            <option value="all">All statuses</option>
            <option value="notTransported">Not transported</option>
            <option value="synced">Synced</option>
            <option value="onlyInTarget">Only in target</option>
          </select>
          <input className="field" placeholder="Filter packages" value={packageSearch} onChange={(e) => setPackageSearch(e.target.value)} />
        </div>
        <SimplePackageTable rows={packageRows} />
      </div>

      <div className="panel" style={{ borderRadius: 6, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Integration Flows</div>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 8 }}>
          <select className="field" value={iflowStatusFilter} onChange={(e) => setIflowStatusFilter(e.target.value as IflowStatusFilter)}>
            <option value="all">All statuses</option>
            <option value="notTransported">Not transported</option>
            <option value="versionMismatch">Version mismatch</option>
            <option value="synced">Synced</option>
            <option value="onlyInTarget">Only in target</option>
          </select>
          <input className="field" placeholder="Filter iflows" value={iflowSearch} onChange={(e) => setIflowSearch(e.target.value)} />
        </div>
        <SimpleIflowTable rows={iflowRows} />
      </div>
    </div>
  );
}

function SummaryPanel({ diffResult }: { diffResult: TenantDiffResult }) {
  return (
    <div className="panel" style={{ borderRadius: 6, padding: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 600 }}>
          {diffResult.metadata.customerLabel ?? 'No customer label'}
        </div>
        <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          {diffResult.metadata.source.environmentName} {'->'} {diffResult.metadata.target.environmentName} | {diffResult.metadata.durationSeconds}s
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="badge badge-amber">Pkg missing: {diffResult.summary.packageNotTransported}</span>
        <span className="badge badge-green">Pkg synced: {diffResult.summary.packageSynced}</span>
        <span className="badge badge-gray">Pkg only target: {diffResult.summary.packageOnlyInTarget}</span>
        <span className="badge badge-amber">iFlow missing: {diffResult.summary.iflowNotTransported}</span>
        <span className="badge badge-blue">iFlow mismatch: {diffResult.summary.iflowVersionMismatch}</span>
        <span className="badge badge-green">iFlow synced: {diffResult.summary.iflowSynced}</span>
        <span className="badge badge-gray">iFlow only target: {diffResult.summary.iflowOnlyInTarget}</span>
      </div>
    </div>
  );
}

function SimplePackageTable({ rows }: { rows: Array<TenantDiffPackageItem & { status: string }> }) {
  return (
    <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Package', 'Status', 'Source v', 'Target v'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={`${r.name}-${idx}`} style={{ borderBottom: '1px solid var(--border-dim)' }}>
              <td style={{ padding: 10 }}>{r.name}</td>
              <td style={{ padding: 10 }}>{r.status}</td>
              <td style={{ padding: 10 }}>{r.sourceVersion ?? '-'}</td>
              <td style={{ padding: 10 }}>{r.targetVersion ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleIflowTable({ rows }: { rows: Array<TenantDiffIflowItem & { status: string }> }) {
  return (
    <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['iFlow', 'Status', 'Source v', 'Target v', 'Source package', 'Target package'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={`${r.name}-${idx}`} style={{ borderBottom: '1px solid var(--border-dim)' }}>
              <td style={{ padding: 10 }}>{r.name}</td>
              <td style={{ padding: 10 }}>{r.status}</td>
              <td style={{ padding: 10 }}>{r.sourceVersion ?? '-'}</td>
              <td style={{ padding: 10 }}>{r.targetVersion ?? '-'}</td>
              <td style={{ padding: 10 }}>{r.sourcePackageId ?? '-'}</td>
              <td style={{ padding: 10 }}>{r.targetPackageId ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
