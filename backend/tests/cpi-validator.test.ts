import { validateMapping } from '../src/core/cpi-validator';
import { MappingSpec } from '../src/core/types';

const goodSpec: MappingSpec = {
  id: 'v-001',
  name: 'Good Mapping',
  sourceFormat: 'JSON',
  targetFormat: 'JSON',
  outputType: 'GROOVY',
  sourceSchema: [],
  targetSchema: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  rules: [
    { id: 'r1', sourcePaths: ['orderId'], targetPath: 'id' },
  ],
};

describe('cpi-validator', () => {
  test('passes a valid minimal spec', () => {
    const report = validateMapping(goodSpec);
    expect(report.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(report.score).toBeGreaterThan(0);
  });

  test('error on empty rules', () => {
    const spec = { ...goodSpec, rules: [] };
    const report = validateMapping(spec);
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.code === 'CPI-LINT-002')).toBe(true);
  });

  test('warning on duplicate target paths', () => {
    const spec: MappingSpec = {
      ...goodSpec,
      rules: [
        { id: 'r1', sourcePaths: ['a'], targetPath: 'x' },
        { id: 'r2', sourcePaths: ['b'], targetPath: 'x' },
      ],
    };
    const report = validateMapping(spec);
    expect(report.issues.some((i) => i.code === 'CPI-LINT-003')).toBe(true);
  });

  test('error on missing source paths', () => {
    const spec: MappingSpec = { ...goodSpec, rules: [{ id: 'r1', sourcePaths: [], targetPath: 'id' }] };
    const report = validateMapping(spec);
    expect(report.issues.some((i) => i.code === 'CPI-LINT-004')).toBe(true);
  });

  test('error on forbidden Groovy class', () => {
    const report = validateMapping(goodSpec, 'def x = System.exit(0)');
    expect(report.issues.some((i) => i.code === 'CPI-LINT-008')).toBe(true);
  });

  test('score is 100 for clean spec and clean groovy', () => {
    const groovy = `import com.sap.gateway.ip.core.customdev.util.Message
def Message processData(Message message) {
    try {
        def body = message.getBody(String.class)
    } catch (Exception e) {
        throw e
    }
    return message
}`;
    const report = validateMapping(goodSpec, groovy);
    expect(report.score).toBe(100);
  });
});
