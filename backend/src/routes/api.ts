import { Router, Request, Response } from 'express';
import { parseSchema } from '../core/schema-parser';
import { runMapping } from '../core/mapping-engine';
import { validateMapping } from '../core/cpi-validator';
import {
  saveMapping,
  updateMapping,
  getMapping,
  listMappings,
  deleteMapping,
} from '../store/mapping-store';
import { MappingSpec } from '../core/types';

const router = Router();

// ── POST /api/parse-schema ────────────────────────────────────────────────────
// Body: { content: string, hint?: 'XML'|'JSON'|'CSV' }
router.post('/parse-schema', (req: Request, res: Response) => {
  const { content, hint } = req.body as { content?: string; hint?: string };
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content is required' });
  }
  const result = parseSchema(content, hint);
  return res.json(result);
});

// ── GET /api/mappings ─────────────────────────────────────────────────────────
router.get('/mappings', (_req: Request, res: Response) => {
  return res.json(listMappings());
});

// ── POST /api/mappings ────────────────────────────────────────────────────────
// Body: MappingSpec without id/createdAt/updatedAt
router.post('/mappings', (req: Request, res: Response) => {
  const body = req.body as Omit<MappingSpec, 'id' | 'createdAt' | 'updatedAt'>;
  if (!body.name || !body.sourceFormat || !body.targetFormat) {
    return res.status(400).json({ error: 'name, sourceFormat, targetFormat are required' });
  }
  const spec = saveMapping(body);
  return res.status(201).json(spec);
});

// ── GET /api/mappings/:id ─────────────────────────────────────────────────────
router.get('/mappings/:id', (req: Request, res: Response) => {
  const spec = getMapping(req.params.id);
  if (!spec) return res.status(404).json({ error: 'Mapping not found' });
  return res.json(spec);
});

// ── PUT /api/mappings/:id ─────────────────────────────────────────────────────
router.put('/mappings/:id', (req: Request, res: Response) => {
  const updated = updateMapping(req.params.id, req.body as Partial<MappingSpec>);
  if (!updated) return res.status(404).json({ error: 'Mapping not found' });
  return res.json(updated);
});

// ── DELETE /api/mappings/:id ──────────────────────────────────────────────────
router.delete('/mappings/:id', (req: Request, res: Response) => {
  const ok = deleteMapping(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Mapping not found' });
  return res.status(204).send();
});

// ── POST /api/mappings/:id/generate ──────────────────────────────────────────
// Generate artifacts from a saved mapping spec
router.post('/mappings/:id/generate', (req: Request, res: Response) => {
  const spec = getMapping(req.params.id);
  if (!spec) return res.status(404).json({ error: 'Mapping not found' });
  const result = runMapping(spec);
  return res.json(result);
});

// ── POST /api/generate ───────────────────────────────────────────────────────
// Generate artifacts from a spec in the request body (without saving)
router.post('/generate', (req: Request, res: Response) => {
  const body = req.body as MappingSpec;
  if (!body.rules || !body.sourceFormat || !body.targetFormat) {
    return res.status(400).json({ error: 'rules, sourceFormat, targetFormat are required' });
  }
  // Ensure id exists for in-flight generation
  if (!body.id) body.id = 'preview';
  if (!body.createdAt) body.createdAt = new Date().toISOString();
  if (!body.updatedAt) body.updatedAt = new Date().toISOString();
  const result = runMapping(body);
  return res.json(result);
});

// ── POST /api/validate ────────────────────────────────────────────────────────
// Validate a spec (with optional groovy content) without generating
router.post('/validate', (req: Request, res: Response) => {
  const { spec, groovyScript } = req.body as {
    spec?: MappingSpec;
    groovyScript?: string;
  };
  if (!spec) return res.status(400).json({ error: 'spec is required' });
  const report = validateMapping(spec, groovyScript);
  return res.json(report);
});

// ── GET /api/templates ────────────────────────────────────────────────────────
// Return built-in mapping templates
router.get('/templates', (_req: Request, res: Response) => {
  const templates = getBuiltInTemplates();
  return res.json(templates);
});

export default router;

// ─────────────────────────────────────────────────────────────────────────────
// Built-in templates (high-demand patterns from SAP Community research)
// ─────────────────────────────────────────────────────────────────────────────
function getBuiltInTemplates() {
  return [
    {
      id: 'tpl-xml-to-json-order',
      name: 'XML Purchase Order → JSON',
      description: 'Maps a standard SAP XML purchase order to a flat JSON structure',
      sourceFormat: 'XML',
      targetFormat: 'JSON',
      outputType: 'GROOVY',
      tags: ['order', 'purchase-order', 'xml', 'json'],
      sourceSchema: [
        { path: 'PurchaseOrder.Header.OrderId', name: 'OrderId', type: 'string', required: true },
        { path: 'PurchaseOrder.Header.OrderDate', name: 'OrderDate', type: 'date', required: true },
        { path: 'PurchaseOrder.Header.Vendor', name: 'Vendor', type: 'string', required: true },
        { path: 'PurchaseOrder.Header.TotalAmount', name: 'TotalAmount', type: 'number', required: false },
      ],
      targetSchema: [
        { path: 'orderId', name: 'orderId', type: 'string', required: true },
        { path: 'orderDate', name: 'orderDate', type: 'date', required: true },
        { path: 'vendorName', name: 'vendorName', type: 'string', required: true },
        { path: 'total', name: 'total', type: 'number', required: false },
      ],
      rules: [
        { id: 'r1', sourcePaths: ['PurchaseOrder.Header.OrderId'], targetPath: 'orderId', description: 'Order ID direct map' },
        { id: 'r2', sourcePaths: ['PurchaseOrder.Header.OrderDate'], targetPath: 'orderDate', transformation: { type: 'date_format', params: { fromFormat: 'yyyyMMdd', toFormat: 'yyyy-MM-dd' } } },
        { id: 'r3', sourcePaths: ['PurchaseOrder.Header.Vendor'], targetPath: 'vendorName' },
        { id: 'r4', sourcePaths: ['PurchaseOrder.Header.TotalAmount'], targetPath: 'total', transformation: { type: 'number_format', params: { decimals: '2' } } },
      ],
    },
    {
      id: 'tpl-json-to-xml-invoice',
      name: 'JSON Invoice → XML',
      description: 'Maps a REST API JSON invoice response to SAP XML format',
      sourceFormat: 'JSON',
      targetFormat: 'XML',
      outputType: 'GROOVY',
      tags: ['invoice', 'json', 'xml'],
      sourceSchema: [
        { path: 'invoiceId', name: 'invoiceId', type: 'string', required: true },
        { path: 'amount', name: 'amount', type: 'number', required: true },
        { path: 'currency', name: 'currency', type: 'string', required: true },
        { path: 'dueDate', name: 'dueDate', type: 'date', required: true },
      ],
      targetSchema: [
        { path: 'Invoice.InvoiceId', name: 'InvoiceId', type: 'string', required: true },
        { path: 'Invoice.Amount', name: 'Amount', type: 'number', required: true },
        { path: 'Invoice.Currency', name: 'Currency', type: 'string', required: true },
        { path: 'Invoice.DueDate', name: 'DueDate', type: 'date', required: true },
      ],
      rules: [
        { id: 'r1', sourcePaths: ['invoiceId'], targetPath: 'Invoice.InvoiceId' },
        { id: 'r2', sourcePaths: ['amount'], targetPath: 'Invoice.Amount', transformation: { type: 'number_format', params: { decimals: '2' } } },
        { id: 'r3', sourcePaths: ['currency'], targetPath: 'Invoice.Currency', transformation: { type: 'upper_case' } },
        { id: 'r4', sourcePaths: ['dueDate'], targetPath: 'Invoice.DueDate', transformation: { type: 'date_format', params: { fromFormat: 'yyyy-MM-dd', toFormat: 'yyyyMMdd' } } },
      ],
    },
    {
      id: 'tpl-csv-to-json-masterdata',
      name: 'CSV Material → JSON Master Data',
      description: 'Converts a CSV material master export to JSON for API ingestion',
      sourceFormat: 'CSV',
      targetFormat: 'JSON',
      outputType: 'GROOVY',
      tags: ['material', 'master-data', 'csv', 'json'],
      sourceSchema: [
        { path: 'MATNR', name: 'MATNR', type: 'string', required: true },
        { path: 'MAKTX', name: 'MAKTX', type: 'string', required: true },
        { path: 'MEINS', name: 'MEINS', type: 'string', required: false },
        { path: 'MSTAE', name: 'MSTAE', type: 'string', required: false },
      ],
      targetSchema: [
        { path: 'materialId', name: 'materialId', type: 'string', required: true },
        { path: 'description', name: 'description', type: 'string', required: true },
        { path: 'uom', name: 'uom', type: 'string', required: false },
        { path: 'status', name: 'status', type: 'string', required: false },
      ],
      rules: [
        { id: 'r1', sourcePaths: ['MATNR'], targetPath: 'materialId', description: 'SAP Material Number' },
        { id: 'r2', sourcePaths: ['MAKTX'], targetPath: 'description', description: 'Material Description' },
        { id: 'r3', sourcePaths: ['MEINS'], targetPath: 'uom', description: 'Unit of Measure' },
        { id: 'r4', sourcePaths: ['MSTAE'], targetPath: 'status', transformation: { type: 'upper_case' } },
      ],
    },
    {
      id: 'tpl-xml-to-xml-transform',
      name: 'XML → XML via XSLT',
      description: 'Structural XML-to-XML transformation using generated XSLT',
      sourceFormat: 'XML',
      targetFormat: 'XML',
      outputType: 'XSLT',
      tags: ['xml', 'xslt', 'structural'],
      sourceSchema: [
        { path: 'Source.Header.Id', name: 'Id', type: 'string', required: true },
        { path: 'Source.Header.Date', name: 'Date', type: 'date', required: true },
        { path: 'Source.Body.Value', name: 'Value', type: 'string', required: false },
      ],
      targetSchema: [
        { path: 'Target.ID', name: 'ID', type: 'string', required: true },
        { path: 'Target.DocDate', name: 'DocDate', type: 'date', required: true },
        { path: 'Target.Content', name: 'Content', type: 'string', required: false },
      ],
      rules: [
        { id: 'r1', sourcePaths: ['Source.Header.Id'], targetPath: 'Target.ID' },
        { id: 'r2', sourcePaths: ['Source.Header.Date'], targetPath: 'Target.DocDate' },
        { id: 'r3', sourcePaths: ['Source.Body.Value'], targetPath: 'Target.Content' },
      ],
    },
  ];
}
