"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const groovy_generator_1 = require("../src/core/groovy-generator");
const baseSpec = {
    id: 'test-001',
    name: 'Test Mapping',
    sourceFormat: 'JSON',
    targetFormat: 'JSON',
    outputType: 'GROOVY',
    sourceSchema: [],
    targetSchema: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    rules: [
        { id: 'r1', sourcePaths: ['orderId'], targetPath: 'id', description: 'Order ID' },
        { id: 'r2', sourcePaths: ['amount'], targetPath: 'total', transformation: { type: 'number_format', params: { decimals: '2' } } },
        { id: 'r3', sourcePaths: ['orderDate'], targetPath: 'date', transformation: { type: 'date_format', params: { fromFormat: 'yyyyMMdd', toFormat: 'yyyy-MM-dd' } } },
        { id: 'r4', sourcePaths: ['status'], targetPath: 'statusUpper', transformation: { type: 'upper_case' } },
    ],
};
describe('groovy-generator', () => {
    test('generates a Groovy artifact', () => {
        const artifact = (0, groovy_generator_1.generateGroovy)(baseSpec);
        expect(artifact.type).toBe('GROOVY');
        expect(artifact.filename).toContain('.groovy');
        expect(artifact.content).toContain('import com.sap.gateway');
    });
    test('includes try/catch in generated script', () => {
        const artifact = (0, groovy_generator_1.generateGroovy)(baseSpec);
        expect(artifact.content).toContain('try {');
        expect(artifact.content).toContain('catch');
    });
    test('includes date helper when date_format transform is used', () => {
        const artifact = (0, groovy_generator_1.generateGroovy)(baseSpec);
        expect(artifact.content).toContain('formatDate');
        expect(artifact.content).toContain('SimpleDateFormat');
    });
    test('includes number helper when number_format transform is used', () => {
        const artifact = (0, groovy_generator_1.generateGroovy)(baseSpec);
        expect(artifact.content).toContain('formatNumber');
        expect(artifact.content).toContain('BigDecimal');
    });
    test('upper_case transform renders toUpperCase', () => {
        const artifact = (0, groovy_generator_1.generateGroovy)(baseSpec);
        expect(artifact.content).toContain('toUpperCase');
    });
    test('CSV source generates rows.collect loop', () => {
        const spec = { ...baseSpec, sourceFormat: 'CSV', rules: [{ id: 'r1', sourcePaths: ['MATNR'], targetPath: 'materialId' }] };
        const artifact = (0, groovy_generator_1.generateGroovy)(spec);
        expect(artifact.content).toContain('rows.collect');
    });
    test('XML target generates MarkupBuilder', () => {
        const spec = { ...baseSpec, targetFormat: 'XML', targetSchema: [{ path: 'Invoice.Id', name: 'Id', type: 'string', required: true }], rules: [{ id: 'r1', sourcePaths: ['invoiceId'], targetPath: 'Invoice.Id' }] };
        const artifact = (0, groovy_generator_1.generateGroovy)(spec);
        expect(artifact.content).toContain('MarkupBuilder');
    });
});
