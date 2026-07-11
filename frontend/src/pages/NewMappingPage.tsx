import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseSchema, createMapping, generatePreview } from '../api/client';
import { useNavigate } from 'react-router-dom';
import type {
  DataFormat,
  OutputType,
  SchemaField,
  MappingRule,
  TransformationDef,
  TransformationType,
  TransformResult,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2;

const STEPS = ['1. Source schema', '2. Map fields', '3. Generate'];

const FORMAT_OPTIONS: DataFormat[] = ['JSON', 'XML', 'CSV'];
const OUTPUT_OPTIONS: OutputType[] = ['GROOVY', 'XSLT', 'BOTH'];
const TRANSFORM_TYPES: TransformationType[] = [
  'direct', 'constant', 'upper_case', 'lower_case', 'trim',
  'date_format', 'number_format', 'concat', 'split', 'conditional', 'custom_groovy',
];

// ─────────────────────────────────────────────────────────────────────────────

export default function NewMappingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceFormat, setSourceFormat] = useState<DataFormat>('JSON');
  const [targetFormat, setTargetFormat] = useState<DataFormat>('JSON');
  const [outputType, setOutputType] = useState<OutputType>('GROOVY');

  const [sourceSample, setSourceSample] = useState('');
  const [targetSample, setTargetSample] = useState('');
  const [sourceFields, setSourceFields] = useState<SchemaField[]>([]);
  const [targetFields, setTargetFields] = useState<SchemaField[]>([]);

  const [rules, setRules] = useState<MappingRule[]>([]);
  const [result, setResult] = useState<TransformResult | null>(null);

  const parseMut = useMutation({ mutationFn: ({ content, hint }: { content: string; hint: string }) => parseSchema(content, hint) });
  const saveMut = useMutation({
    mutationFn: createMapping,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mappings'] }),
  });
  const generateMut = useMutation({ mutationFn: generatePreview });

  // ── Step 0: parse schemas ──────────────────────────────────────────────────

  async function handleParseSchemas() {
    if (!sourceSample.trim() || !targetSample.trim()) return;
    const [src, tgt] = await Promise.all([
      parseMut.mutateAsync({ content: sourceSample, hint: sourceFormat }),
      parseMut.mutateAsync({ content: targetSample, hint: targetFormat }),
    ]);
    setSourceFields(src.fields);
    setTargetFields(tgt.fields);
    // Auto-create direct rules for fields with matching names
    const auto: MappingRule[] = [];
    for (const tf of flattenFields(tgt.fields)) {
      const match = flattenFields(src.fields).find((sf) => sf.name.toLowerCase() === tf.name.toLowerCase());
      if (match) {
        auto.push({ id: uuidv4(), sourcePaths: [match.path], targetPath: tf.path, description: 'auto-matched' });
      }
    }
    setRules(auto);
    setStep(1);
  }

  // ── Step 1: rule editor ────────────────────────────────────────────────────

  function addRule() {
    const firstSrc = flattenFields(sourceFields)[0]?.path ?? '';
    const firstTgt = flattenFields(targetFields)[0]?.path ?? '';
    setRules((r) => [...r, { id: uuidv4(), sourcePaths: [firstSrc], targetPath: firstTgt }]);
  }

  function updateRule(id: string, partial: Partial<MappingRule>) {
    setRules((r) => r.map((rule) => (rule.id === id ? { ...rule, ...partial } : rule)));
  }

  function removeRule(id: string) {
    setRules((r) => r.filter((rule) => rule.id !== id));
  }

  // ── Step 2: generate ───────────────────────────────────────────────────────

  async function handleGenerate() {
    const spec = buildSpec();
    const res = await generateMut.mutateAsync(spec as Parameters<typeof generatePreview>[0]);
    setResult(res);
    setStep(2);
  }

  async function handleSaveAndGenerate() {
    const spec = buildSpec();
    await saveMut.mutateAsync({
      name,
      description,
      sourceFormat,
      targetFormat,
      outputType,
      sourceSchema: sourceFields,
      targetSchema: targetFields,
      rules,
    });
    navigate('/');
  }

  function buildSpec() {
    return {
      id: 'preview',
      name: name || 'Untitled',
      description,
      sourceFormat,
      targetFormat,
      outputType,
      sourceSchema: sourceFields,
      targetSchema: targetFields,
      rules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function downloadArtifact(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ fontSize: 11, padding: '4px 8px' }}>
          ← Back
        </button>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  fontSize: 11,
                  padding: '3px 12px',
                  color: step === i ? 'var(--amber)' : step > i ? 'var(--green)' : 'var(--text-dim)',
                  borderBottom: step === i ? '2px solid var(--amber)' : '2px solid transparent',
                  cursor: step > i ? 'pointer' : 'default',
                  transition: 'color 0.15s',
                  fontWeight: step === i ? 500 : 400,
                }}
                onClick={() => { if (step > i) setStep(i as Step); }}
              >
                {step > i ? '✓ ' : ''}{label}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {step === 0 && (
          <StepOne
            name={name} setName={setName}
            description={description} setDescription={setDescription}
            sourceFormat={sourceFormat} setSourceFormat={setSourceFormat}
            targetFormat={targetFormat} setTargetFormat={setTargetFormat}
            outputType={outputType} setOutputType={setOutputType}
            sourceSample={sourceSample} setSourceSample={setSourceSample}
            targetSample={targetSample} setTargetSample={setTargetSample}
            onNext={handleParseSchemas}
            isParsing={parseMut.isPending}
            errors={parseMut.isError ? ['Parse failed. Check input format.'] : []}
          />
        )}
        {step === 1 && (
          <StepTwo
            sourceFields={flattenFields(sourceFields)}
            targetFields={flattenFields(targetFields)}
            rules={rules}
            onAdd={addRule}
            onUpdate={updateRule}
            onRemove={removeRule}
            onNext={handleGenerate}
            onBack={() => setStep(0)}
            isGenerating={generateMut.isPending}
          />
        )}
        {step === 2 && result && (
          <StepThree
            result={result}
            onDownload={downloadArtifact}
            onSave={handleSaveAndGenerate}
            isSaving={saveMut.isPending}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step components
// ─────────────────────────────────────────────────────────────────────────────

function StepOne({
  name, setName, description, setDescription,
  sourceFormat, setSourceFormat, targetFormat, setTargetFormat,
  outputType, setOutputType,
  sourceSample, setSourceSample, targetSample, setTargetSample,
  onNext, isParsing, errors,
}: {
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  sourceFormat: DataFormat; setSourceFormat: (v: DataFormat) => void;
  targetFormat: DataFormat; setTargetFormat: (v: DataFormat) => void;
  outputType: OutputType; setOutputType: (v: OutputType) => void;
  sourceSample: string; setSourceSample: (v: string) => void;
  targetSample: string; setTargetSample: (v: string) => void;
  onNext: () => void; isParsing: boolean; errors: string[];
}) {
  return (
    <div style={{ maxWidth: 900 }}>
      {/* Metadata row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ gridColumn: '1 / 3' }}>
          <FieldLabel>Mapping name</FieldLabel>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PO XML to JSON" />
        </div>
        <div>
          <FieldLabel>Output</FieldLabel>
          <select className="field" value={outputType} onChange={(e) => setOutputType(e.target.value as OutputType)}>
            {OUTPUT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onNext} disabled={isParsing || !name.trim() || !sourceSample.trim() || !targetSample.trim()}>
            {isParsing ? 'Parsing…' : 'Parse schemas →'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <FieldLabel>Description (optional)</FieldLabel>
        <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this mapping" />
      </div>

      {errors.length > 0 && (
        <div style={{ marginBottom: 14, padding: '8px 12px', background: '#1f0707', border: '1px solid #7f1d1d', borderRadius: 4 }}>
          {errors.map((e, i) => <div key={i} className="mono" style={{ color: 'var(--red)', fontSize: 11 }}>{e}</div>)}
        </div>
      )}

      {/* Split-pane editors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SchemaPane
          label="Source schema"
          format={sourceFormat}
          setFormat={setSourceFormat}
          sample={sourceSample}
          setSample={setSourceSample}
          placeholder={getPlaceholder(sourceFormat)}
        />
        <SchemaPane
          label="Target schema"
          format={targetFormat}
          setFormat={setTargetFormat}
          sample={targetSample}
          setSample={setTargetSample}
          placeholder={getPlaceholder(targetFormat)}
        />
      </div>

      <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)' }}>
        Paste a sample payload or CSV header. Fields are inferred automatically. Matching field names will be mapped directly.
      </p>
    </div>
  );
}

function SchemaPane({ label, format, setFormat, sample, setSample, placeholder }: {
  label: string; format: DataFormat; setFormat: (v: DataFormat) => void;
  sample: string; setSample: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <FieldLabel>{label}</FieldLabel>
        <div style={{ display: 'flex', gap: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 3, padding: 2 }}>
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                borderRadius: 2,
                border: 'none',
                cursor: 'pointer',
                fontWeight: format === f ? 600 : 400,
                background: format === f ? 'var(--amber)' : 'transparent',
                color: format === f ? '#000' : 'var(--text-mid)',
                transition: 'background 0.1s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="field mono"
        value={sample}
        onChange={(e) => setSample(e.target.value)}
        placeholder={placeholder}
        style={{ height: 280, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StepTwo({
  sourceFields, targetFields, rules, onAdd, onUpdate, onRemove, onNext, onBack, isGenerating,
}: {
  sourceFields: SchemaField[]; targetFields: SchemaField[];
  rules: MappingRule[];
  onAdd: () => void; onUpdate: (id: string, p: Partial<MappingRule>) => void; onRemove: (id: string) => void;
  onNext: () => void; onBack: () => void; isGenerating: boolean;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ color: 'var(--text-mid)', fontSize: 12 }}>
          {rules.length} rule{rules.length !== 1 ? 's' : ''} defined
          {rules.filter((r) => r.description === 'auto-matched').length > 0 &&
            <span style={{ marginLeft: 8, color: 'var(--amber)', fontSize: 11 }}>
              ({rules.filter((r) => r.description === 'auto-matched').length} auto-matched)
            </span>
          }
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <button className="btn btn-ghost" onClick={onAdd}>+ Add rule</button>
          <button className="btn btn-primary" onClick={onNext} disabled={isGenerating || rules.length === 0}>
            {isGenerating ? 'Generating…' : 'Generate →'}
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 110px 1fr 30px',
        gap: 8,
        padding: '6px 10px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        borderRadius: '4px 4px 0 0',
      }}>
        {['Source field', 'Transform', 'Target field', ''].map((h) => (
          <div key={h} style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
        ))}
      </div>

      {rules.length === 0 && (
        <div style={{
          padding: '30px',
          border: '1px solid var(--border)',
          borderRadius: '0 0 4px 4px',
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: 12,
        }}>
          No rules. Click "+ Add rule" or go back to re-parse with matching field names.
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
        {rules.map((rule, i) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            sourceFields={sourceFields}
            targetFields={targetFields}
            onUpdate={onUpdate}
            onRemove={onRemove}
            even={i % 2 === 0}
          />
        ))}
      </div>
    </div>
  );
}

function RuleRow({ rule, sourceFields, targetFields, onUpdate, onRemove, even }: {
  rule: MappingRule;
  sourceFields: SchemaField[];
  targetFields: SchemaField[];
  onUpdate: (id: string, p: Partial<MappingRule>) => void;
  onRemove: (id: string) => void;
  even: boolean;
}) {
  const [showParams, setShowParams] = useState(false);

  function setTransform(type: TransformationType) {
    const def: TransformationDef = { type, params: {} };
    onUpdate(rule.id, { transformation: def });
  }

  function setParam(key: string, value: string) {
    onUpdate(rule.id, {
      transformation: { ...rule.transformation!, params: { ...(rule.transformation?.params ?? {}), [key]: value } },
    });
  }

  const t = rule.transformation;

  return (
    <div style={{
      background: even ? 'transparent' : 'rgba(255,255,255,0.014)',
      borderTop: '1px solid var(--border-dim)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 110px 1fr 30px',
        gap: 8,
        padding: '6px 10px',
        alignItems: 'center',
      }}>
        {/* Source */}
        <select
          className="field mono"
          value={rule.sourcePaths[0] ?? ''}
          onChange={(e) => onUpdate(rule.id, { sourcePaths: [e.target.value] })}
          style={{ fontSize: 11, padding: '3px 6px' }}
        >
          {sourceFields.map((f) => (
            <option key={f.path} value={f.path}>{f.path}</option>
          ))}
        </select>

        {/* Transform type */}
        <select
          className="field"
          value={t?.type ?? 'direct'}
          onChange={(e) => { setTransform(e.target.value as TransformationType); setShowParams(e.target.value !== 'direct'); }}
          style={{ fontSize: 11, padding: '3px 6px' }}
        >
          {TRANSFORM_TYPES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
        </select>

        {/* Target */}
        <select
          className="field mono"
          value={rule.targetPath}
          onChange={(e) => onUpdate(rule.id, { targetPath: e.target.value })}
          style={{ fontSize: 11, padding: '3px 6px' }}
        >
          {targetFields.map((f) => (
            <option key={f.path} value={f.path}>{f.path}</option>
          ))}
        </select>

        {/* Delete */}
        <button
          onClick={() => onRemove(rule.id)}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
        >
          ×
        </button>
      </div>

      {/* Params row */}
      {t && t.type !== 'direct' && (
        <div style={{ padding: '0 10px 8px 10px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TransformParams transform={t} setParam={setParam} />
        </div>
      )}
    </div>
  );
}

function TransformParams({ transform, setParam }: { transform: TransformationDef; setParam: (k: string, v: string) => void }) {
  const p = transform.params ?? {};
  switch (transform.type) {
    case 'constant':
      return <ParamInput label="value" value={p['value'] ?? ''} onChange={(v) => setParam('value', v)} />;
    case 'date_format':
      return <>
        <ParamInput label="from" value={p['fromFormat'] ?? 'yyyyMMdd'} onChange={(v) => setParam('fromFormat', v)} width={100} />
        <ParamInput label="to" value={p['toFormat'] ?? 'yyyy-MM-dd'} onChange={(v) => setParam('toFormat', v)} width={100} />
      </>;
    case 'number_format':
      return <ParamInput label="decimals" value={p['decimals'] ?? '2'} onChange={(v) => setParam('decimals', v)} width={60} />;
    case 'concat':
      return <>
        <ParamInput label="fields (comma-sep)" value={p['fields'] ?? ''} onChange={(v) => setParam('fields', v)} width={200} />
        <ParamInput label="separator" value={p['separator'] ?? ''} onChange={(v) => setParam('separator', v)} width={60} />
      </>;
    case 'split':
      return <>
        <ParamInput label="separator" value={p['separator'] ?? ','} onChange={(v) => setParam('separator', v)} width={60} />
        <ParamInput label="index" value={p['index'] ?? '0'} onChange={(v) => setParam('index', v)} width={50} />
      </>;
    case 'conditional':
      return <>
        <ParamInput label="condition" value={p['condition'] ?? ''} onChange={(v) => setParam('condition', v)} width={180} />
        <ParamInput label="if true" value={p['ifTrue'] ?? ''} onChange={(v) => setParam('ifTrue', v)} width={120} />
        <ParamInput label="if false" value={p['ifFalse'] ?? ''} onChange={(v) => setParam('ifFalse', v)} width={120} />
      </>;
    case 'custom_groovy':
      return <ParamInput label="groovy snippet" value={p['snippet'] ?? ''} onChange={(v) => setParam('snippet', v)} width={320} mono />;
    default:
      return null;
  }
}

function ParamInput({ label, value, onChange, width = 140, mono = false }: {
  label: string; value: string; onChange: (v: string) => void; width?: number; mono?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <input
        className={`field ${mono ? 'mono' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width, fontSize: 11, padding: '2px 6px' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StepThree({
  result, onDownload, onSave, isSaving, onBack,
}: {
  result: TransformResult;
  onDownload: (f: string, c: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const artifact = result.artifacts[activeTab];
  const report = result.lintReport;

  const scoreColor =
    (report?.score ?? 0) >= 80 ? 'var(--green)' :
    (report?.score ?? 0) >= 50 ? 'var(--amber)' :
    'var(--red)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, height: '100%' }}>
      {/* ── Code pane ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Tabs + actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          borderRadius: '4px 4px 0 0',
          padding: '0 10px',
        }}>
          <div style={{ display: 'flex' }}>
            {result.artifacts.map((a, i) => (
              <button
                key={a.filename}
                onClick={() => setActiveTab(i)}
                style={{
                  padding: '8px 14px',
                  fontSize: 11,
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === i ? '2px solid var(--amber)' : '2px solid transparent',
                  color: activeTab === i ? 'var(--text-hi)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {a.filename}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" onClick={onBack} style={{ fontSize: 11 }}>← Edit rules</button>
            <button className="btn btn-ghost" onClick={() => onDownload(artifact.filename, artifact.content)} style={{ fontSize: 11 }}>
              ↓ Download
            </button>
            <button className="btn btn-primary" onClick={onSave} disabled={isSaving} style={{ fontSize: 11 }}>
              {isSaving ? 'Saving…' : '✓ Save mapping'}
            </button>
          </div>
        </div>

        {/* Code */}
        <pre
          className="mono"
          style={{
            flex: 1,
            margin: 0,
            padding: '16px',
            background: '#0a0d13',
            border: '1px solid var(--border)',
            borderRadius: '0 0 4px 4px',
            overflowY: 'auto',
            fontSize: 11,
            lineHeight: 1.7,
            color: '#c9d1d9',
            minHeight: 400,
            maxHeight: 'calc(100vh - 260px)',
          }}
        >
          {artifact?.content ?? ''}
        </pre>
      </div>

      {/* ── Lint sidebar ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {report && (
          <>
            {/* Score */}
            <div style={{
              padding: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                CPI Readiness
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{report.score}</span>
                <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>/100</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-raised)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${report.score}%`, height: '100%', background: scoreColor, transition: 'width 0.4s' }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: report.passed ? 'var(--green)' : 'var(--red)' }}>
                {report.passed ? '✓ Ready to deploy' : '✗ Fix issues before deploy'}
              </div>
            </div>

            {/* Issues */}
            <div style={{
              flex: 1,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Issues ({report.issues.length})
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {report.issues.length === 0 && (
                  <div style={{ padding: '16px 14px', color: 'var(--green)', fontSize: 12 }}>✓ All checks passed</div>
                )}
                {report.issues.map((issue, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 14px',
                      borderBottom: '1px solid var(--border-dim)',
                      borderLeft: `3px solid ${issue.severity === 'error' ? 'var(--red)' : issue.severity === 'warning' ? 'var(--amber)' : 'var(--blue)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{issue.code}</span>
                      <span className={`badge badge-${issue.severity === 'error' ? 'red' : issue.severity === 'warning' ? 'amber' : 'blue'}`} style={{ fontSize: 9 }}>
                        {issue.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-mid)', lineHeight: 1.4 }}>{issue.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function flattenFields(fields: SchemaField[], prefix = ''): SchemaField[] {
  const result: SchemaField[] = [];
  for (const f of fields) {
    const path = prefix ? `${prefix}.${f.name}` : f.path;
    if (f.children && f.children.length > 0) {
      result.push(...flattenFields(f.children, path));
    } else {
      result.push({ ...f, path });
    }
  }
  return result;
}

function getPlaceholder(format: DataFormat): string {
  if (format === 'JSON') return `{\n  "OrderId": "PO-001",\n  "OrderDate": "20240115",\n  "Vendor": "ACME Corp"\n}`;
  if (format === 'XML') return `<Order>\n  <Header>\n    <OrderId>PO-001</OrderId>\n    <OrderDate>20240115</OrderDate>\n  </Header>\n</Order>`;
  return `MATNR,MAKTX,MEINS\nMAT001,Steel Plate,KG`;
}
