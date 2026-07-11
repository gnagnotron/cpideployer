import { XMLParser } from 'fast-xml-parser';
import { SchemaField, SchemaParseResult, FieldType } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Schema Parser: XML sample / JSON sample / CSV header → SchemaField[]
// ─────────────────────────────────────────────────────────────────────────────

function inferType(value: unknown): FieldType {
  if (Array.isArray(value)) return 'array';
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'object') return 'object';
  const str = String(value);
  // ISO date detection
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(str)) return 'date';
  // ABAP-style date YYYYMMDD
  if (/^\d{8}$/.test(str) && parseInt(str.substring(4, 6)) <= 12) return 'date';
  if (/^-?\d+(\.\d+)?$/.test(str)) return 'number';
  return 'string';
}

function flattenJsonFields(
  obj: Record<string, unknown>,
  prefix = '',
  depth = 0
): SchemaField[] {
  if (depth > 10) return [];
  const fields: SchemaField[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = inferType(value);

    if (type === 'object' && value !== null) {
      const nested = flattenJsonFields(value as Record<string, unknown>, path, depth + 1);
      fields.push({
        path,
        name: key,
        type: 'object',
        required: false,
        children: nested,
      });
    } else if (type === 'array') {
      const arr = value as unknown[];
      const firstItem = arr[0];
      const children =
        firstItem && typeof firstItem === 'object'
          ? flattenJsonFields(firstItem as Record<string, unknown>, `${path}[]`, depth + 1)
          : [];
      fields.push({
        path,
        name: key,
        type: 'array',
        required: false,
        isArray: true,
        children,
      });
    } else {
      fields.push({
        path,
        name: key,
        type,
        required: false,
      });
    }
  }
  return fields;
}

function flattenXmlFields(
  obj: Record<string, unknown>,
  prefix = '',
  depth = 0
): SchemaField[] {
  if (depth > 10) return [];
  const fields: SchemaField[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      const firstItem = value[0];
      const children =
        firstItem && typeof firstItem === 'object'
          ? flattenXmlFields(firstItem as Record<string, unknown>, `${path}[]`, depth + 1)
          : [];
      fields.push({ path, name: key, type: 'array', required: false, isArray: true, children });
    } else if (typeof value === 'object' && value !== null) {
      const nested = flattenXmlFields(value as Record<string, unknown>, path, depth + 1);
      fields.push({ path, name: key, type: 'object', required: false, children: nested });
    } else {
      fields.push({ path, name: key, type: inferType(value), required: false });
    }
  }
  return fields;
}

export function parseJsonSample(json: string): SchemaParseResult {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const root = Array.isArray(parsed) ? (parsed[0] as Record<string, unknown>) : parsed;
    const fields = flattenJsonFields(root);
    return { fields, format: 'JSON', errors: [] };
  } catch (e) {
    return { fields: [], format: 'JSON', errors: [`JSON parse error: ${(e as Error).message}`] };
  }
}

export function parseXmlSample(xml: string): SchemaParseResult {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: () => false,
    });
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const fields = flattenXmlFields(parsed);
    return { fields, format: 'XML', errors: [] };
  } catch (e) {
    return { fields: [], format: 'XML', errors: [`XML parse error: ${(e as Error).message}`] };
  }
}

export function parseCsvHeader(csv: string): SchemaParseResult {
  const lines = csv.trim().split('\n');
  if (lines.length === 0) {
    return { fields: [], format: 'CSV', errors: ['Empty CSV input'] };
  }
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const sampleRow = lines.length > 1 ? lines[1].split(delimiter).map((v) => v.trim()) : [];

  const fields: SchemaField[] = headers.map((header, i) => ({
    path: header,
    name: header,
    type: inferType(sampleRow[i] ?? ''),
    required: false,
  }));

  return { fields, format: 'CSV', errors: [] };
}

export function parseSchema(content: string, hint?: string): SchemaParseResult {
  const trimmed = content.trim();
  if (hint === 'JSON' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJsonSample(content);
  }
  if (hint === 'XML' || trimmed.startsWith('<')) {
    return parseXmlSample(content);
  }
  // Best-effort CSV detection
  return parseCsvHeader(content);
}
