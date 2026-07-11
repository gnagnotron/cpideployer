import { MappingSpec, LintReport, LintIssue } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CPI Readiness Validator
// Checks a MappingSpec and generated Groovy content against CPI best practices
// ─────────────────────────────────────────────────────────────────────────────

const GROOVY_FORBIDDEN_CLASSES = [
  'System.exit',
  'Runtime.getRuntime',
  'Thread.sleep',
  'new File(',
  'ProcessBuilder',
  'ClassLoader',
];

const NAMING_PATTERN = /^[a-zA-Z][a-zA-Z0-9_\-\s]*$/;

function checkNaming(spec: MappingSpec, issues: LintIssue[]): void {
  if (!NAMING_PATTERN.test(spec.name)) {
    issues.push({
      severity: 'warning',
      code: 'CPI-LINT-001',
      message: `Mapping name "${spec.name}" contains characters that may cause issues in CPI package naming. Use alphanumeric, hyphens, or underscores.`,
      location: 'spec.name',
    });
  }
}

function checkEmptyRules(spec: MappingSpec, issues: LintIssue[]): void {
  if (spec.rules.length === 0) {
    issues.push({
      severity: 'error',
      code: 'CPI-LINT-002',
      message: 'Mapping has no rules defined. The generated script will not transform any data. Add at least one field mapping rule.',
      location: 'spec.rules',
    });
  }
}

function checkDuplicateTargets(spec: MappingSpec, issues: LintIssue[]): void {
  const seen = new Set<string>();
  for (const rule of spec.rules) {
    if (seen.has(rule.targetPath)) {
      issues.push({
        severity: 'warning',
        code: 'CPI-LINT-003',
        message: `Target path "${rule.targetPath}" is mapped multiple times. Only the last value will be used.`,
        location: `rule:${rule.id}`,
      });
    }
    seen.add(rule.targetPath);
  }
}

function checkMissingSourcePaths(spec: MappingSpec, issues: LintIssue[]): void {
  for (const rule of spec.rules) {
    if (!rule.sourcePaths || rule.sourcePaths.length === 0) {
      issues.push({
        severity: 'error',
        code: 'CPI-LINT-004',
        message: `Rule targeting "${rule.targetPath}" has no source path defined.`,
        location: `rule:${rule.id}`,
      });
    }
  }
}

function checkDateTransformParams(spec: MappingSpec, issues: LintIssue[]): void {
  for (const rule of spec.rules) {
    if (rule.transformation?.type === 'date_format') {
      const { fromFormat, toFormat } = rule.transformation.params ?? {};
      if (!fromFormat || !toFormat) {
        issues.push({
          severity: 'warning',
          code: 'CPI-LINT-005',
          message: `Date format rule for "${rule.targetPath}" is missing fromFormat or toFormat params. Defaults will be used.`,
          location: `rule:${rule.id}`,
        });
      }
    }
  }
}

function checkFormatCompatibility(spec: MappingSpec, issues: LintIssue[]): void {
  if (spec.sourceFormat === 'CSV' && spec.targetFormat === 'XML') {
    issues.push({
      severity: 'info',
      code: 'CPI-LINT-006',
      message:
        'CSV→XML mapping: ensure the source CSV uses consistent delimiters. The generated script assumes comma-separation.',
      location: 'spec.sourceFormat',
    });
  }
  if (spec.sourceFormat === 'XML' && spec.outputType === 'GROOVY') {
    issues.push({
      severity: 'info',
      code: 'CPI-LINT-007',
      message:
        'XML source with Groovy output: XmlSlurper is used. If the XML uses namespaces, add namespace handling in the generated script.',
      location: 'spec.sourceFormat',
    });
  }
}

function checkGroovyContent(groovyScript: string, issues: LintIssue[]): void {
  for (const forbidden of GROOVY_FORBIDDEN_CLASSES) {
    if (groovyScript.includes(forbidden)) {
      issues.push({
        severity: 'error',
        code: 'CPI-LINT-008',
        message: `Generated script contains forbidden Groovy construct "${forbidden}". SAP CPI restricts this class.`,
        location: 'groovy:content',
      });
    }
  }

  if (!groovyScript.includes('try {') || !groovyScript.includes('catch')) {
    issues.push({
      severity: 'warning',
      code: 'CPI-LINT-009',
      message: 'Script lacks try/catch error handling. CPI best practice requires wrapping logic in try/catch.',
      location: 'groovy:error-handling',
    });
  }

  if (!groovyScript.includes('import com.sap.gateway')) {
    issues.push({
      severity: 'warning',
      code: 'CPI-LINT-010',
      message: 'Script missing SAP CPI Message import. Ensure "com.sap.gateway.ip.core.customdev.util.Message" is imported.',
      location: 'groovy:imports',
    });
  }

  // Check null-safety
  const unsafeAccess = groovyScript.match(/source\['[^']+'\]\['[^']+'\]/g);
  if (unsafeAccess && unsafeAccess.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'CPI-LINT-011',
      message: 'Some field accesses may not use null-safe operator (?.). If source field is absent, a NullPointerException may occur.',
      location: 'groovy:null-safety',
    });
  }
}

function checkLargePayloadRisk(spec: MappingSpec, issues: LintIssue[]): void {
  if (spec.rules.length > 50) {
    issues.push({
      severity: 'info',
      code: 'CPI-LINT-012',
      message: `Mapping has ${spec.rules.length} rules. For large payloads, consider splitting into multiple iFlow steps to stay within CPI memory limits.`,
      location: 'spec.rules',
    });
  }
}

export function validateMapping(spec: MappingSpec, groovyScript?: string): LintReport {
  const issues: LintIssue[] = [];

  checkNaming(spec, issues);
  checkEmptyRules(spec, issues);
  checkDuplicateTargets(spec, issues);
  checkMissingSourcePaths(spec, issues);
  checkDateTransformParams(spec, issues);
  checkFormatCompatibility(spec, issues);
  checkLargePayloadRisk(spec, issues);

  if (groovyScript) {
    checkGroovyContent(groovyScript, issues);
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  // Score: 100 - 20*errors - 5*warnings, min 0
  const score = Math.max(0, 100 - errors * 20 - warnings * 5);
  const passed = errors === 0;

  return { passed, issues, score };
}
