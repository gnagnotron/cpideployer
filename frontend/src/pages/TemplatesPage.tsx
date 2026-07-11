import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTemplates, createMapping } from '../api/client';
import { useNavigate } from 'react-router-dom';
import type { Template, DataFormat, OutputType } from '../types';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: listTemplates,
  });

  const importMut = useMutation({
    mutationFn: (tpl: Template) =>
      createMapping({
        name: tpl.name,
        description: tpl.description,
        sourceFormat: tpl.sourceFormat,
        targetFormat: tpl.targetFormat,
        outputType: tpl.outputType,
        sourceSchema: tpl.sourceSchema,
        targetSchema: tpl.targetSchema,
        rules: tpl.rules,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mappings'] });
      navigate('/');
    },
  });

  const allTags = Array.from(new Set(templates.flatMap((t) => t.tags)));

  const visible = activeTag
    ? templates.filter((t) => t.tags.includes(activeTag))
    : templates;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Toolbar ── */}
      <div style={{
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-hi)' }}>Templates</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          Built-in patterns for common SAP CPI scenarios
        </span>

        {/* Tag filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <TagBtn label="all" active={activeTag === null} onClick={() => setActiveTag(null)} />
          {allTags.map((tag) => (
            <TagBtn key={tag} label={tag} active={activeTag === tag} onClick={() => setActiveTag(tag === activeTag ? null : tag)} />
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {isLoading && <div style={{ color: 'var(--text-dim)' }}>Loading…</div>}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 1,
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          {visible.map((tpl, i) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              onImport={() => importMut.mutate(tpl)}
              isImporting={importMut.isPending}
              index={i}
            />
          ))}
        </div>

        {visible.length === 0 && !isLoading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
            No templates match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  tpl, onImport, isImporting, index,
}: {
  tpl: Template;
  onImport: () => void;
  isImporting: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '18px 20px',
        background: hovered ? 'var(--bg-raised)' : index % 2 === 0 ? 'var(--bg-surface)' : 'rgba(255,255,255,0.012)',
        border: '1px solid var(--border-dim)',
        cursor: 'default',
        transition: 'background 0.1s',
        position: 'relative',
      }}
    >
      {/* Format badge row */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 10, alignItems: 'center' }}>
        <span className="mono badge badge-gray" style={{ fontSize: 9 }}>{tpl.sourceFormat}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>→</span>
        <span className="mono badge badge-gray" style={{ fontSize: 9 }}>{tpl.targetFormat}</span>
        <span className={`badge badge-${tpl.outputType === 'GROOVY' ? 'amber' : tpl.outputType === 'XSLT' ? 'blue' : 'green'}`} style={{ marginLeft: 4, fontSize: 9 }}>
          {tpl.outputType}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 500, color: 'var(--text-hi)', marginBottom: 6, fontSize: 13 }}>
        {tpl.name}
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 14, minHeight: 36 }}>
        {tpl.description}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
        {tpl.tags.map((tag) => (
          <span key={tag} style={{
            fontSize: 9,
            padding: '1px 6px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            color: 'var(--text-dim)',
            borderRadius: 2,
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {tpl.rules.length} rules · {tpl.sourceSchema.length + tpl.targetSchema.length} fields
        </span>
        <button
          className="btn btn-primary"
          onClick={onImport}
          disabled={isImporting}
          style={{ fontSize: 11, padding: '4px 12px' }}
        >
          {isImporting ? '…' : 'Use template →'}
        </button>
      </div>
    </div>
  );
}

function TagBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        fontSize: 11,
        borderRadius: 2,
        border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
        background: active ? '#451a03' : 'transparent',
        color: active ? 'var(--amber)' : 'var(--text-dim)',
        cursor: 'pointer',
        transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  );
}
