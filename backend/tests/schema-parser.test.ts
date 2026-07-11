import { parseJsonSample, parseXmlSample, parseCsvHeader } from '../src/core/schema-parser';

describe('schema-parser', () => {
  test('parses flat JSON', () => {
    const json = JSON.stringify({ orderId: 'O001', amount: 100.5, date: '2024-01-15' });
    const result = parseJsonSample(json);
    expect(result.errors).toHaveLength(0);
    expect(result.fields.map((f) => f.name)).toEqual(['orderId', 'amount', 'date']);
    expect(result.fields.find((f) => f.name === 'amount')?.type).toBe('number');
    expect(result.fields.find((f) => f.name === 'date')?.type).toBe('date');
  });

  test('parses nested JSON', () => {
    const json = JSON.stringify({ order: { id: '001', header: { date: '20240115' } } });
    const result = parseJsonSample(json);
    expect(result.errors).toHaveLength(0);
    const orderField = result.fields.find((f) => f.name === 'order');
    expect(orderField?.type).toBe('object');
    expect(orderField?.children?.map((c) => c.name)).toContain('id');
  });

  test('parses JSON array', () => {
    const json = JSON.stringify({ items: [{ sku: 'A1', qty: 2 }] });
    const result = parseJsonSample(json);
    const itemsField = result.fields.find((f) => f.name === 'items');
    expect(itemsField?.type).toBe('array');
    expect(itemsField?.isArray).toBe(true);
  });

  test('returns error on invalid JSON', () => {
    const result = parseJsonSample('not json');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('parses XML sample', () => {
    const xml = `<Order><Header><OrderId>001</OrderId><Date>20240115</Date></Header></Order>`;
    const result = parseXmlSample(xml);
    expect(result.errors).toHaveLength(0);
    expect(result.fields.length).toBeGreaterThan(0);
  });

  test('parses CSV header with comma delimiter', () => {
    const csv = 'MATNR,MAKTX,MEINS\nMAT001,Steel Plate,KG';
    const result = parseCsvHeader(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.fields.map((f) => f.name)).toEqual(['MATNR', 'MAKTX', 'MEINS']);
  });

  test('parses CSV header with semicolon delimiter', () => {
    const csv = 'MATNR;MAKTX;MEINS\nMAT001;Steel Plate;KG';
    const result = parseCsvHeader(csv);
    expect(result.fields.map((f) => f.name)).toEqual(['MATNR', 'MAKTX', 'MEINS']);
  });
});
