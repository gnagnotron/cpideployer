import { MappingRule, MappingSpec, GeneratedArtifact, TransformationDef } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Groovy Script Generator for SAP CPI
// Generates a CPI-ready Groovy script from a MappingSpec
// ─────────────────────────────────────────────────────────────────────────────

function toGroovyPath(dotPath: string): string {
  // Convert "Order.Header.OrderDate" → source['Order']?['Header']?['OrderDate']
  return dotPath
    .split('.')
    .map((seg) => {
      const clean = seg.replace(/\[\]$/, '');
      return `['${clean}']`;
    })
    .join('?');
}

function toXmlGroovyPath(dotPath: string): string {
  // Convert "Order.Header.OrderDate" → xml.Order.Header.OrderDate.text()
  return dotPath
    .split('.')
    .map((seg) => seg.replace(/\[\]$/, ''))
    .join('.');
}

function renderTransform(
  transform: TransformationDef | undefined,
  expr: string
): string {
  if (!transform || transform.type === 'direct') return expr;

  const p = transform.params ?? {};
  switch (transform.type) {
    case 'constant':
      return `'${p['value'] ?? ''}'`;
    case 'upper_case':
      return `${expr}?.toUpperCase()`;
    case 'lower_case':
      return `${expr}?.toLowerCase()`;
    case 'trim':
      return `${expr}?.trim()`;
    case 'concat': {
      const fields = (p['fields'] ?? '').split(',').map((f) => f.trim());
      const sep = p['separator'] ?? '';
      return fields.map((f) => `source${toGroovyPath(f)}`).join(` + '${sep}' + `);
    }
    case 'split': {
      const sep = p['separator'] ?? ',';
      const idx = p['index'] ?? '0';
      return `${expr}?.split('${sep}')?.getAt(${idx})`;
    }
    case 'date_format': {
      const fromFmt = p['fromFormat'] ?? 'yyyyMMdd';
      const toFmt = p['toFormat'] ?? 'yyyy-MM-dd';
      return `formatDate(${expr}, '${fromFmt}', '${toFmt}')`;
    }
    case 'number_format': {
      const decimals = p['decimals'] ?? '2';
      return `formatNumber(${expr}, ${decimals})`;
    }
    case 'conditional': {
      const cond = p['condition'] ?? `${expr} != null`;
      const ifTrue = p['ifTrue'] ?? expr;
      const ifFalse = p['ifFalse'] ?? 'null';
      return `(${cond}) ? ${ifTrue} : ${ifFalse}`;
    }
    case 'custom_groovy':
      return p['snippet'] ?? expr;
    default:
      return expr;
  }
}

function rulesForJsonTarget(rules: MappingRule[], spec: MappingSpec): string {
  const lines: string[] = [];

  for (const rule of rules) {
    const [primary] = rule.sourcePaths;
    const comment = rule.description ? `    // ${rule.description}` : `    // ${rule.targetPath}`;
    const targetKey = rule.targetPath.split('.').pop() ?? rule.targetPath;

    let sourceExpr: string;
    if (spec.sourceFormat === 'XML') {
      sourceExpr = `xml.${toXmlGroovyPath(primary)}.text()`;
    } else if (spec.sourceFormat === 'CSV') {
      sourceExpr = `row['${primary}']`;
    } else {
      sourceExpr = `source${toGroovyPath(primary)}`;
    }

    const transformedExpr = renderTransform(rule.transformation, sourceExpr);
    lines.push(comment);
    lines.push(`    target['${targetKey}'] = ${transformedExpr}`);
  }
  return lines.join('\n');
}

function rulesForXmlTarget(rules: MappingRule[], spec: MappingSpec): string {
  const lines: string[] = [];

  for (const rule of rules) {
    const [primary] = rule.sourcePaths;
    const targetKey = rule.targetPath.split('.').pop() ?? rule.targetPath;
    const comment = rule.description ? `    // ${rule.description}` : `    // ${rule.targetPath}`;

    let sourceExpr: string;
    if (spec.sourceFormat === 'JSON') {
      sourceExpr = `source${toGroovyPath(primary)}`;
    } else if (spec.sourceFormat === 'CSV') {
      sourceExpr = `row['${primary}']`;
    } else {
      sourceExpr = `xml.${toXmlGroovyPath(primary)}.text()`;
    }

    const transformedExpr = renderTransform(rule.transformation, sourceExpr);
    lines.push(comment);
    lines.push(`    builder.'${targetKey}'(${transformedExpr})`);
  }
  return lines.join('\n');
}

function rulesForCsvTarget(rules: MappingRule[], spec: MappingSpec): string {
  const lines: string[] = [];
  const headers = rules.map((r) => r.targetPath);
  
  // CSV header row
  lines.push(`    def csvLines = []`);
  lines.push(`    csvLines << '${headers.join(',')}'`);
  
  // Data row generation
  lines.push(`    def dataRow = []`);
  for (const rule of rules) {
    const [primary] = rule.sourcePaths;
    const comment = rule.description ? `    // ${rule.description}` : '';
    
    let sourceExpr: string;
    if (spec.sourceFormat === 'JSON') {
      sourceExpr = `source${toGroovyPath(primary)}`;
    } else if (spec.sourceFormat === 'XML') {
      sourceExpr = `xml.${toXmlGroovyPath(primary)}.text()`;
    } else {
      sourceExpr = `row['${primary}']`;
    }

    const transformedExpr = renderTransform(rule.transformation, sourceExpr);
    if (comment) lines.push(comment);
    lines.push(`    dataRow << (${transformedExpr} ?: '')`);
  }
  lines.push(`    csvLines << dataRow.join(',')`);
  
  return lines.join('\n');
}

function hasDateTransform(rules: MappingRule[]): boolean {
  return rules.some((r) => r.transformation?.type === 'date_format');
}
function hasNumberTransform(rules: MappingRule[]): boolean {
  return rules.some((r) => r.transformation?.type === 'number_format');
}

function buildHelpers(rules: MappingRule[]): string {
  const helpers: string[] = [];

  if (hasDateTransform(rules)) {
    helpers.push(`
def String formatDate(Object raw, String fromPattern, String toPattern) {
    if (raw == null || raw.toString().trim().isEmpty()) return ''
    try {
        def sdf = new java.text.SimpleDateFormat(fromPattern)
        def date = sdf.parse(raw.toString().trim())
        return new java.text.SimpleDateFormat(toPattern).format(date)
    } catch (Exception e) {
        return raw.toString()
    }
}`);
  }

  if (hasNumberTransform(rules)) {
    helpers.push(`
def String formatNumber(Object raw, int decimals) {
    if (raw == null) return '0'
    try {
        def val = new BigDecimal(raw.toString().trim())
        return val.setScale(decimals, BigDecimal.ROUND_HALF_UP).toPlainString()
    } catch (Exception e) {
        return raw.toString()
    }
}`);
  }

  return helpers.join('\n');
}

export function generateGroovy(spec: MappingSpec): GeneratedArtifact {
  const { sourceFormat, targetFormat, rules, name } = spec;
  const helpers = buildHelpers(rules);

  let imports = `import com.sap.gateway.ip.core.customdev.util.Message\n`;
  let parseBlock = '';
  let buildBlock = '';
  let returnBlock = '';

  // ── Source parsing ──────────────────────────────────────────────────────────
  if (sourceFormat === 'JSON') {
    imports += `import groovy.json.JsonSlurper\n`;
    parseBlock = `    def body = message.getBody(String.class)
    def source = new groovy.json.JsonSlurper().parseText(body)`;
  } else if (sourceFormat === 'XML') {
    parseBlock = `    def body = message.getBody(String.class)
    def xml = new XmlSlurper().parseText(body)`;
  } else if (sourceFormat === 'CSV') {
    parseBlock = `    def body = message.getBody(String.class)
    def lines = body.trim().split('\\n')
    def headers = lines[0].split(',')*.trim()
    def rows = lines.drop(1).collect { line ->
        def vals = line.split(',')
        headers.withIndex().collectEntries { h, i -> [h, i < vals.size() ? vals[i].trim() : ''] }
    }`;
  }

  // ── Target building ─────────────────────────────────────────────────────────
  if (targetFormat === 'JSON') {
    imports += `import groovy.json.JsonBuilder\n`;
    buildBlock =
      sourceFormat === 'CSV'
        ? `    def result = rows.collect { row ->
        def target = [:]
${rulesForJsonTarget(rules, spec)}
        target
    }`
        : `    def target = [:]
${rulesForJsonTarget(rules, spec)}`;
    returnBlock =
      sourceFormat === 'CSV'
        ? `    message.setBody(new groovy.json.JsonBuilder(result).toPrettyString())`
        : `    message.setBody(new groovy.json.JsonBuilder(target).toPrettyString())`;
  } else if (targetFormat === 'XML') {
    imports += `import groovy.xml.MarkupBuilder\n`;
    const rootElement = spec.targetSchema[0]?.path?.split('.')?.[0] ?? 'root';
    buildBlock =
      sourceFormat === 'CSV'
        ? `    def sw = new StringWriter()
    def builder = new groovy.xml.MarkupBuilder(sw)
    builder.'${rootElement}s'() {
        rows.each { row ->
            '${rootElement}'() {
${rulesForXmlTarget(rules, spec)}
            }
        }
    }`
        : `    def sw = new StringWriter()
    def builder = new groovy.xml.MarkupBuilder(sw)
    builder.'${rootElement}'() {
${rulesForXmlTarget(rules, spec)}
    }`;
    returnBlock = `    message.setBody(sw.toString())`;
  } else if (targetFormat === 'CSV') {
    buildBlock = 
      sourceFormat === 'CSV'
        ? `    def csvLines = []
    csvLines << lines[0]  // preserve header
    rows.each { row ->
        def dataRow = []
${rulesForCsvTarget(rules, spec).split('\n').slice(2).join('\n')}
        csvLines << dataRow.join(',')
    }`
        : `${rulesForCsvTarget(rules, spec)}`;
    returnBlock = `    message.setBody(csvLines.join('\\n'))`;
  }

  // Fallback if target format was not recognized
  if (!buildBlock) {
    buildBlock = `    // WARNING: target format ${targetFormat} is not yet supported in code generation`;
    returnBlock = `    message.setBody('ERROR: Unsupported target format')`;
  }

  const scriptContent = `${imports}
def Message processData(Message message) {
    try {
${parseBlock}

${buildBlock}

${returnBlock}
    } catch (Exception e) {
        message.setProperty('errorMessage', e.getMessage())
        throw e
    }
    return message
}
${helpers}
`;

  return {
    type: 'GROOVY',
    filename: `${name.replace(/\s+/g, '_')}_mapping.groovy`,
    content: scriptContent,
  };
}
