import { MappingSpec, TransformResult } from './types';
import { generateGroovy } from './groovy-generator';
import { generateXslt } from './xslt-generator';
import { validateMapping } from './cpi-validator';

// ─────────────────────────────────────────────────────────────────────────────
// Mapping Engine – orchestrates generation + validation
// ─────────────────────────────────────────────────────────────────────────────

export function runMapping(spec: MappingSpec): TransformResult {
  const artifacts = [];
  const errors: string[] = [];

  try {
    if (spec.outputType === 'GROOVY' || spec.outputType === 'BOTH') {
      artifacts.push(generateGroovy(spec));
    }
    if (spec.outputType === 'XSLT' || spec.outputType === 'BOTH') {
      artifacts.push(generateXslt(spec));
    }
  } catch (e) {
    errors.push(`Generation error: ${(e as Error).message}`);
    return { success: false, artifacts: [], errors };
  }

  const groovyArtifact = artifacts.find((a) => a.type === 'GROOVY');
  const lintReport = validateMapping(spec, groovyArtifact?.content);

  return {
    success: lintReport.passed,
    artifacts,
    lintReport,
    errors: lintReport.issues
      .filter((i) => i.severity === 'error')
      .map((i) => i.message),
  };
}
