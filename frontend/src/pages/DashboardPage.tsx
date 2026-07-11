import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMappings, deleteMapping, generateFromSaved } from '../api/client';
import { useNavigate } from 'react-router-dom';
import type { MappingSpec, TransformResult, LintReport } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<TransformResult | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['mappings'],
    queryFn: listMappings,
  });

  const deleteMut = useMutation({
    mutationFn: deleteMapping,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mappings'] }),
  });

  const generateMut = useMutation({
    mutationFn: generateFromSaved,
    onSuccess: (data, id) => {
      setLastResult(data);
      setActiveId(id);
    },
  });

  function downloadArtifact(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text-hi)' }}>Mappings</span>
          <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 12 }}>
            {mappings.length} defined
          </span>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/new')}>
          + New mapping
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading && (
          <div style={{ padding: '40px 24px', color: 'var(--text-dim)' }}>Loading…</div>
        )}

        {!isLoading && mappings.length === 0 && <EmptyState onNew={() => navigate('/new')} onTemplates={() => navigate('/templates')} />}

        {mappings.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Source → Target', 'Rules', 'Output', 'Updated', ''].map((h) => (
                  <th key={h} style={{
                    padding: '8px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-dim)',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    background: 'var(--bg-surface)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mappings.map((m: MappingSpec, i) => {
                const isActive = activeId === m.id;
                return (
                  <tr
                    key={m.id}
                    style={{
                      background: isActive ? 'var(--bg-raised)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      borderBottom: '1px solid var(--border-dim)',
                      transition: 'background 0.1s',
                    }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-hi)' }}>{m.name}</div>
                      {m.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span className="mono badge badge-gray">
                        {m.sourceFormat}
                      </span>
                      <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>→</span>
                      <span className="mono badge badge-gray">
                        {m.targetFormat}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-mid)' }}>
                      {m.rules.length}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span className={`badge ${m.outputType === 'GROOVY' ? 'badge-amber' : m.outputType === 'XSLT' ? 'badge-blue' : 'badge-green'}`}>
                        {m.outputType}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-dim)', fontSize: 11 }} className="mono">
                      {new Date(m.updatedAt).toLocaleDateString('it-IT')}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-success"
                          onClick={async () => {
                            const result = await generateMut.mutateAsync(m.id);
                            result.artifacts.forEach((a) => downloadArtifact(a.filename, a.content));
                          }}
                          disabled={generateMut.isPending && activeId === m.id}
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          {generateMut.isPending && activeId === m.id ? 'Running…' : 'Generate ↓'}
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => { if (confirm(`Delete "${m.name}"?`)) deleteMut.mutate(m.id); }}
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Lint panel (slides up after generate) ── */}
      {lastResult?.lintReport && (
        <LintPanel
          report={lastResult.lintReport}
          artifacts={lastResult.artifacts}
          onDownload={downloadArtifact}
          onClose={() => setLastResult(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ onNew, onTemplates }: { onNew: () => void; onTemplates: () => void }) {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <div style={{
        display: 'inline-block',
        padding: '1px 8px',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        fontSize: 11,
        color: 'var(--text-dim)',
        marginBottom: 16,
        fontFamily: 'monospace',
      }}>
        $ cpi-map --list → (empty)
      </div>
      <p style={{ color: 'var(--text-mid)', marginBottom: 20 }}>
        No mappings yet. Create one from scratch or start from a template.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onNew}>New mapping</button>
        <button className="btn btn-ghost" onClick={onTemplates}>Browse templates</button>
      </div>
    </div>
  );
}

function LintPanel({
  report,
  artifacts,
  onDownload,
  onClose,
}: {
  report: LintReport;
  artifacts: { filename: string; content: string }[];
  onDownload: (f: string, c: string) => void;
  onClose: () => void;
}) {
  const scoreBg =
    report.score >= 80 ? '#022c22' :
    report.score >= 50 ? '#1c1a08' :
    '#1f0707';
  const scoreColor =
    report.score >= 80 ? 'var(--green)' :
    report.score >= 50 ? 'var(--amber)' :
    'var(--red)';

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      padding: '14px 24px',
      maxHeight: 260,
      overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: scoreBg,
            color: scoreColor,
            padding: '3px 10px',
            borderRadius: 3,
            fontWeight: 700,
            fontSize: 15,
          }}>
            {report.score}/100
          </div>
          <span style={{ color: 'var(--text-mid)', fontSize: 12 }}>
            CPI Readiness — {report.passed ? 'ready to deploy' : 'issues found'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {artifacts.map((a) => (
            <button
              key={a.filename}
              className="btn btn-ghost"
              onClick={() => onDownload(a.filename, a.content)}
              style={{ fontSize: 11 }}
            >
              ↓ {a.filename}
            </button>
          ))}
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 11 }}>close</button>
        </div>
      </div>

      {report.issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {report.issues.map((issue, i) => (
            <div
              key={i}
              className="mono"
              style={{
                display: 'flex',
                gap: 10,
                padding: '5px 10px',
                background: 'var(--bg-raised)',
                borderLeft: `3px solid ${issue.severity === 'error' ? 'var(--red)' : issue.severity === 'warning' ? 'var(--amber)' : 'var(--blue)'}`,
                fontSize: 11,
                color: 'var(--text-mid)',
              }}
            >
              <span style={{ color: issue.severity === 'error' ? 'var(--red)' : issue.severity === 'warning' ? 'var(--amber)' : 'var(--blue)', minWidth: 60 }}>
                {issue.code}
              </span>
              <span>{issue.message}</span>
              {issue.location && (
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>{issue.location}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {report.issues.length === 0 && (
        <div style={{ color: 'var(--green)', fontSize: 12 }}>✓ All checks passed — no issues found.</div>
      )}
    </div>
  );
}
