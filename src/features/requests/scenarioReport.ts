import type { Language, Request, Response, Scenario } from '../../types';

type SchemaRow = { path: string; type: string };
export type ScenarioReportExportFormat = 'pdf' | 'markdown' | 'yaml' | 'json';

export interface ScenarioReportEntry {
  request: Request;
  response: Response;
  requestHeadersSchema: SchemaRow[];
  requestParamsSchema: SchemaRow[];
  requestBodySchema: SchemaRow[];
  responseHeadersSchema: SchemaRow[];
  responseBodySchema: SchemaRow[];
}

export interface ScenarioReportResult {
  scenario: Pick<Scenario, 'title' | 'description' | 'tag' | 'version'>;
  entries: ScenarioReportEntry[];
}

interface ScenarioReportDocumentEntry {
  order: number;
  title: string;
  description: string | null;
  method: string;
  url: string;
  notes: string | null;
  request: {
    headersSchema: SchemaRow[];
    paramsSchema: SchemaRow[];
    bodySchema: SchemaRow[];
  };
  response: {
    headersSchema: SchemaRow[];
    bodySchema: SchemaRow[];
  };
}

interface ScenarioReportDocument {
  scenario: {
    title: string;
    description: string | null;
    tag: string | null;
    version: string | null;
  };
  entries: ScenarioReportDocumentEntry[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function inferPrimitiveType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function collectSchemaRows(value: unknown, prefix = ''): SchemaRow[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ path: prefix || 'root', type: 'array<empty>' }];
    const sample = value[0];
    const sampleType = inferPrimitiveType(sample);
    if (sampleType !== 'object' && sampleType !== 'array') {
      return [{ path: prefix || 'root', type: `array<${sampleType}>` }];
    }
    return [
      { path: prefix || 'root', type: 'array<object>' },
      ...collectSchemaRows(sample, prefix ? `${prefix}[]` : '[]'),
    ];
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return [{ path: prefix || 'root', type: 'object' }];
    return [
      ...(prefix ? [{ path: prefix, type: 'object' }] : []),
      ...entries.flatMap(([key, nested]) => {
        const next = prefix ? `${prefix}.${key}` : key;
        const nestedType = inferPrimitiveType(nested);
        if (nestedType === 'object' || nestedType === 'array') {
          return collectSchemaRows(nested, next);
        }
        return [{ path: next, type: nestedType }];
      }),
    ];
  }

  return [{ path: prefix || 'root', type: inferPrimitiveType(value) }];
}

function uniqueRows(rows: SchemaRow[]): SchemaRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.path}:${row.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildKeyValueSchema(keys: string[], type = 'string'): SchemaRow[] {
  if (keys.length === 0) return [];
  return keys.map((key) => ({ path: key, type }));
}

function renderSchema(rows: SchemaRow[], emptyLabel: string): string {
  if (rows.length === 0) return emptyLabel;
  return rows.map((row) => `${row.path}: ${row.type}`).join('\n');
}

function getScenarioReportLabels(language: Language) {
  const isIt = language === 'it';
  return {
    requestLabel: isIt ? 'Request' : 'Request',
    responseLabel: isIt ? 'Response' : 'Response',
    headersLabel: isIt ? 'Schema headers' : 'Headers schema',
    paramsLabel: isIt ? 'Schema parametri query' : 'Query params schema',
    bodyLabel: isIt ? 'Schema body' : 'Body schema',
    notesLabel: isIt ? 'Note' : 'Notes',
    descriptionLabel: isIt ? 'Descrizione' : 'Description',
    noSchemaLabel: isIt ? 'Nessun campo rilevato' : 'No fields detected',
    noNotesLabel: isIt ? 'Nessuna nota' : 'No notes',
    noDescriptionLabel: isIt ? 'Nessuna descrizione' : 'No description',
    reportTitle: isIt ? 'Scenario Reference' : 'Scenario Reference',
    tagLabel: isIt ? 'Tag' : 'Tag',
    versionLabel: isIt ? 'Versione' : 'Version',
  };
}

function buildScenarioReportDocument(result: ScenarioReportResult): ScenarioReportDocument {
  return {
    scenario: {
      title: result.scenario.title,
      description: result.scenario.description?.trim() || null,
      tag: result.scenario.tag?.trim() || null,
      version: result.scenario.version?.trim() || null,
    },
    entries: result.entries.map((entry, index) => ({
      order: index + 1,
      title: entry.request.title,
      description: entry.request.description?.trim() || null,
      method: entry.request.method,
      url: entry.request.url,
      notes: entry.request.notes?.trim() || null,
      request: {
        headersSchema: entry.requestHeadersSchema,
        paramsSchema: entry.requestParamsSchema,
        bodySchema: entry.requestBodySchema,
      },
      response: {
        headersSchema: entry.responseHeadersSchema,
        bodySchema: entry.responseBodySchema,
      },
    })),
  };
}

function yamlScalar(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value) return '""';
  if (/[\n\r]/.test(value)) return `|-\n${value.split('\n').map((line) => `  ${line}`).join('\n')}`;
  return JSON.stringify(value);
}

function toYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value.map((item) => {
      if (item && typeof item === 'object') {
        const nested = toYaml(item, indent + 1);
        const nestedLines = nested.split('\n');
        return [`${pad}- ${nestedLines[0].trimStart()}`, ...nestedLines.slice(1)].join('\n');
      }
      return `${pad}- ${yamlScalar(item as string | number | boolean | null)}`;
    }).join('\n');
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';

    return entries.map(([key, nested]) => {
      if (Array.isArray(nested)) {
        const rendered = toYaml(nested, indent + 1);
        return rendered === '[]' ? `${pad}${key}: []` : `${pad}${key}:\n${rendered}`;
      }

      if (nested && typeof nested === 'object') {
        return `${pad}${key}:\n${toYaml(nested, indent + 1)}`;
      }

      return `${pad}${key}: ${yamlScalar(nested as string | number | boolean | null)}`;
    }).join('\n');
  }

  return yamlScalar(value as string | number | boolean | null);
}

function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'scenario-reference';
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function createDownloadFilename(result: ScenarioReportResult, extension: string): string {
  return `${slugifyFilename(result.scenario.title)}-reference.${extension}`;
}

function joinSchemaLines(rows: SchemaRow[], fallback: string): string[] {
  return rows.length > 0 ? rows.map((row) => `${row.path}: ${row.type}`) : [fallback];
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function appendPdfBlock(
  doc: { text: (value: string | string[], x: number, y: number) => void; setFont: (fontName: string, fontStyle?: string) => void; setFontSize: (size: number) => void; splitTextToSize: (text: string, maxWidth: number) => string[]; addPage: () => void; internal: { pageSize: { getHeight: () => number; getWidth: () => number } } },
  text: string,
  options: { x: number; y: number; maxWidth: number; lineHeight: number; pageMargin: number }
): number {
  const lines = doc.splitTextToSize(normalizeText(text), options.maxWidth);
  let cursorY = options.y;
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (cursorY > pageHeight - options.pageMargin) {
      doc.addPage();
      cursorY = options.pageMargin;
    }
    doc.text(line, options.x, cursorY);
    cursorY += options.lineHeight;
  }

  return cursorY;
}

export function buildScenarioReport(
  scenario: Pick<Scenario, 'title' | 'description' | 'tag' | 'version'>,
  pairs: Array<{ request: Request; response: Response }>
): ScenarioReportResult {
  const entries = pairs.map(({ request, response }) => {
    const requestHeadersSchema = buildKeyValueSchema(
      request.headers.filter((header) => header.enabled && header.key.trim()).map((header) => header.key.trim())
    );
    const requestParamsSchema = buildKeyValueSchema(
      (request.params ?? []).filter((param) => param.enabled && param.key.trim()).map((param) => param.key.trim())
    );
    const requestBodySchema = uniqueRows(
      request.body?.trim() ? collectSchemaRows(parseJson(request.body) ?? request.body.trim(), '') : []
    );
    const responseHeadersSchema = buildKeyValueSchema(Object.keys(response.headers ?? {}));
    const responseBodySchema = uniqueRows(
      response.body?.trim() ? collectSchemaRows(parseJson(response.body) ?? response.body.trim(), '') : []
    );

    return {
      request,
      response,
      requestHeadersSchema,
      requestParamsSchema,
      requestBodySchema,
      responseHeadersSchema,
      responseBodySchema,
    };
  });

  return {
    scenario,
    entries,
  };
}

export function buildScenarioReportPrintableHtml(result: ScenarioReportResult, language: Language): string {
  const {
    requestLabel,
    responseLabel,
    headersLabel,
    paramsLabel,
    bodyLabel,
    notesLabel,
    noSchemaLabel,
    noNotesLabel,
    noDescriptionLabel,
    reportTitle,
  } = getScenarioReportLabels(language);
  const printableTag = result.scenario.tag?.trim()
    ? `<span class="meta-tag meta-tag-neutral">${escapeHtml(result.scenario.tag)}</span>`
    : '';
  const printableVersion = result.scenario.version?.trim()
    ? `<span class="meta-tag meta-tag-accent">${escapeHtml(result.scenario.version)}</span>`
    : '';

  const sections = result.entries.map((entry, index) => {
    const { request } = entry;

    return `
      <section class="entry">
        <div class="entry-header">
          <div class="entry-heading">
            <div class="eyebrow">${requestLabel} ${index + 1}</div>
            <h2>${escapeHtml(request.title)}</h2>
            <p class="entry-description">${request.description?.trim() ? escapeHtml(request.description) : noDescriptionLabel}</p>
            <div class="meta-row">
              <span class="method">${escapeHtml(request.method)}</span>
              <span>${escapeHtml(request.url)}</span>
            </div>
          </div>
        </div>

        <div class="two-col">
          <article class="card request-card">
            <div class="card-top">
              <h3>${requestLabel}</h3>
              <span class="card-badge">INPUT</span>
            </div>
            <div class="block">
              <div class="label">${headersLabel}</div>
              <pre>${escapeHtml(renderSchema(entry.requestHeadersSchema, noSchemaLabel))}</pre>
            </div>
            <div class="block">
              <div class="label">${paramsLabel}</div>
              <pre>${escapeHtml(renderSchema(entry.requestParamsSchema, noSchemaLabel))}</pre>
            </div>
            <div class="block">
              <div class="label">${bodyLabel}</div>
              <pre>${escapeHtml(renderSchema(entry.requestBodySchema, noSchemaLabel))}</pre>
            </div>
            <div class="block">
              <div class="label">${notesLabel}</div>
              <pre>${request.notes?.trim() ? escapeHtml(request.notes) : noNotesLabel}</pre>
            </div>
          </article>

          <article class="card response-card">
            <div class="card-top">
              <h3>${responseLabel}</h3>
              <span class="card-badge">OUTPUT</span>
            </div>
            <div class="block">
              <div class="label">${headersLabel}</div>
              <pre>${escapeHtml(renderSchema(entry.responseHeadersSchema, noSchemaLabel))}</pre>
            </div>
            <div class="block">
              <div class="label">${bodyLabel}</div>
              <pre>${escapeHtml(renderSchema(entry.responseBodySchema, noSchemaLabel))}</pre>
            </div>
          </article>
        </div>
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    />
    <title>${escapeHtml(result.scenario.title)} - Scenario Report</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #191c1e;
        --muted: #777586;
        --line: rgba(199, 196, 215, 0.22);
        --panel: #f2f4f6;
        --panel-strong: #fafbfd;
        --accent: #2a14b4;
        --accent-soft: #ebe7ff;
        --success: #005c54;
        --success-soft: #ddfbf6;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        background: #f2f4f6;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.45;
      }
      .page { max-width: 1180px; margin: 0 auto; padding: 40px 32px 56px; }
      .hero {
        border: 1px solid var(--line);
        background: #ffffff;
        padding: 20px;
        margin-bottom: 16px;
        border-radius: 12px;
        box-shadow: 0 1px 2px rgba(25, 28, 30, 0.06);
      }
      h1, h2, h3, p { margin: 0; }
      .hero-top { display: flex; align-items: flex-start; gap: 12px; }
      .hero-tags {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .hero-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(42, 20, 180, 0.1);
        color: var(--accent);
        border-radius: 8px;
        flex-shrink: 0;
        font: 700 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .hero-heading { flex: 1; min-width: 0; }
      .hero-heading h1 {
        font: 700 18px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -0.02em;
        color: var(--ink);
      }
      .hero-kicker {
        margin-top: 4px;
        color: var(--muted);
        font: 700 10px/1.4 ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .hero-description {
        margin-top: 16px;
        padding: 16px;
        background: var(--panel);
        border-left: 4px solid var(--accent);
        border-radius: 4px;
      }
      .hero-description p {
        color: var(--ink);
        font-size: 14px;
        line-height: 1.6;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .meta-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        padding: 4px 8px;
        font: 700 10px/1 ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        width: fit-content;
        border-radius: 4px;
      }
      .meta-tag-neutral {
        background: #e0e3e5;
        color: #464554;
      }
      .meta-tag-accent {
        background: #e3dfff;
        color: #100069;
      }
      .entry {
        page-break-inside: avoid;
        margin-bottom: 16px;
        padding: 20px;
        border: 1px solid var(--line);
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 1px 2px rgba(25, 28, 30, 0.06);
      }
      .entry-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
      .entry-heading { min-width: 0; }
      .entry h2 {
        font: 700 16px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin-top: 8px;
        letter-spacing: -0.02em;
      }
      .entry-description {
        margin-top: 8px;
        color: #464554;
        font-size: 14px;
        line-height: 1.55;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .method { display: inline-flex; align-items: center; justify-content: center; padding: 4px 8px; font: 700 10px/1 ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; text-transform: uppercase; letter-spacing: 0.12em; border-radius: 4px; }
      .method { background: var(--accent-soft); color: var(--accent); margin-right: 8px; }
      .meta-row {
        margin-top: 12px;
        color: var(--muted);
        font: 11px/1.5 ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        word-break: break-word;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .card {
        padding: 16px;
        border: 1px solid var(--line);
        background: var(--panel-strong);
        border-radius: 12px;
      }
      .card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .card h3 { font: 700 17px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: -0.01em; }
      .card-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 5px 10px;
        font: 700 10px/1 ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        background: var(--accent-soft);
        color: var(--accent);
        border-radius: 4px;
      }
      .response-card .card-badge {
        background: var(--success-soft);
        color: var(--success);
      }
      .block { margin-top: 14px; }
      .label {
        display: block;
        color: var(--muted);
        font: 700 11px/1.2 ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        margin-bottom: 8px;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        font: 12px/1.55 ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        background: var(--panel);
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      @media print {
        body { background: white; }
        .page { padding: 16px; }
        .hero, .entry { break-inside: avoid; }
        .entry { border-color: #dfe3e7; }
      }
      @media (max-width: 900px) {
        .two-col { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        ${(printableTag || printableVersion) ? `<div class="hero-tags">${printableTag}${printableVersion}</div>` : ''}
        <div class="hero-top">
          <div class="hero-icon">SR</div>
          <div class="hero-heading">
            <h1>${reportTitle}</h1>
            <p class="hero-kicker">${escapeHtml(result.scenario.title)}</p>
          </div>
        </div>
        <div class="hero-description">
          <p>${result.scenario.description?.trim() ? escapeHtml(result.scenario.description) : '—'}</p>
        </div>
      </section>
      ${sections}
    </main>
  </body>
</html>`;
}

export function buildScenarioReportMarkdown(result: ScenarioReportResult, language: Language): string {
  const labels = getScenarioReportLabels(language);
  const document = buildScenarioReportDocument(result);
  const lines: string[] = [
    `# ${labels.reportTitle}`,
    '',
    `## ${document.scenario.title}`,
    '',
    `${labels.descriptionLabel}: ${document.scenario.description ?? labels.noDescriptionLabel}`,
  ];

  if (document.scenario.tag) lines.push(`${labels.tagLabel}: ${document.scenario.tag}`);
  if (document.scenario.version) lines.push(`${labels.versionLabel}: ${document.scenario.version}`);

  for (const entry of document.entries) {
    lines.push(
      '',
      `## ${labels.requestLabel} ${entry.order}: ${entry.title}`,
      '',
      `${labels.descriptionLabel}: ${entry.description ?? labels.noDescriptionLabel}`,
      '',
      `- Method: ${entry.method}`,
      `- URL: ${entry.url}`,
      `- ${labels.notesLabel}: ${entry.notes ?? labels.noNotesLabel}`,
      '',
      `### ${labels.requestLabel}`,
      '',
      `#### ${labels.headersLabel}`,
      '```text',
      renderSchema(entry.request.headersSchema, labels.noSchemaLabel),
      '```',
      '',
      `#### ${labels.paramsLabel}`,
      '```text',
      renderSchema(entry.request.paramsSchema, labels.noSchemaLabel),
      '```',
      '',
      `#### ${labels.bodyLabel}`,
      '```text',
      renderSchema(entry.request.bodySchema, labels.noSchemaLabel),
      '```',
      '',
      `### ${labels.responseLabel}`,
      '',
      `#### ${labels.headersLabel}`,
      '```text',
      renderSchema(entry.response.headersSchema, labels.noSchemaLabel),
      '```',
      '',
      `#### ${labels.bodyLabel}`,
      '```text',
      renderSchema(entry.response.bodySchema, labels.noSchemaLabel),
      '```',
    );
  }

  return lines.join('\n');
}

export function buildScenarioReportJson(result: ScenarioReportResult): string {
  return JSON.stringify(buildScenarioReportDocument(result), null, 2);
}

export function buildScenarioReportYaml(result: ScenarioReportResult): string {
  return toYaml(buildScenarioReportDocument(result));
}

export async function exportScenarioReport(
  result: ScenarioReportResult,
  language: Language,
  format: ScenarioReportExportFormat
): Promise<void> {
  if (format === 'markdown') {
    downloadTextFile(createDownloadFilename(result, 'md'), buildScenarioReportMarkdown(result, language), 'text/markdown');
    return;
  }

  if (format === 'yaml') {
    downloadTextFile(createDownloadFilename(result, 'yaml'), buildScenarioReportYaml(result), 'application/x-yaml');
    return;
  }

  if (format === 'json') {
    downloadTextFile(createDownloadFilename(result, 'json'), buildScenarioReportJson(result), 'application/json');
    return;
  }

  const { jsPDF } = await import('jspdf');
  const labels = getScenarioReportLabels(language);
  const document = buildScenarioReportDocument(result);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageMargin = 48;
  const contentWidth = pageWidth - pageMargin * 2;
  let y = pageMargin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  y = appendPdfBlock(doc, labels.reportTitle, { x: pageMargin, y, maxWidth: contentWidth, lineHeight: 24, pageMargin });
  y += 6;

  doc.setFontSize(14);
  y = appendPdfBlock(doc, document.scenario.title, { x: pageMargin, y, maxWidth: contentWidth, lineHeight: 18, pageMargin });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = appendPdfBlock(doc, `${labels.descriptionLabel}: ${document.scenario.description ?? labels.noDescriptionLabel}`, {
    x: pageMargin,
    y,
    maxWidth: contentWidth,
    lineHeight: 14,
    pageMargin,
  });

  if (document.scenario.tag) {
    y = appendPdfBlock(doc, `${labels.tagLabel}: ${document.scenario.tag}`, {
      x: pageMargin,
      y: y + 4,
      maxWidth: contentWidth,
      lineHeight: 14,
      pageMargin,
    });
  }

  if (document.scenario.version) {
    y = appendPdfBlock(doc, `${labels.versionLabel}: ${document.scenario.version}`, {
      x: pageMargin,
      y: y + 4,
      maxWidth: contentWidth,
      lineHeight: 14,
      pageMargin,
    });
  }

  for (const entry of document.entries) {
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    y = appendPdfBlock(doc, `${labels.requestLabel} ${entry.order}: ${entry.title}`, {
      x: pageMargin,
      y,
      maxWidth: contentWidth,
      lineHeight: 17,
      pageMargin,
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = appendPdfBlock(doc, `${labels.descriptionLabel}: ${entry.description ?? labels.noDescriptionLabel}`, {
      x: pageMargin,
      y: y + 4,
      maxWidth: contentWidth,
      lineHeight: 14,
      pageMargin,
    });
    y = appendPdfBlock(doc, `Method: ${entry.method}`, { x: pageMargin, y: y + 4, maxWidth: contentWidth, lineHeight: 14, pageMargin });
    y = appendPdfBlock(doc, `URL: ${entry.url}`, { x: pageMargin, y: y + 2, maxWidth: contentWidth, lineHeight: 14, pageMargin });
    y = appendPdfBlock(doc, `${labels.notesLabel}: ${entry.notes ?? labels.noNotesLabel}`, {
      x: pageMargin,
      y: y + 2,
      maxWidth: contentWidth,
      lineHeight: 14,
      pageMargin,
    });

    const sections = [
      {
        title: `${labels.requestLabel} / ${labels.headersLabel}`,
        rows: joinSchemaLines(entry.request.headersSchema, labels.noSchemaLabel),
      },
      {
        title: `${labels.requestLabel} / ${labels.paramsLabel}`,
        rows: joinSchemaLines(entry.request.paramsSchema, labels.noSchemaLabel),
      },
      {
        title: `${labels.requestLabel} / ${labels.bodyLabel}`,
        rows: joinSchemaLines(entry.request.bodySchema, labels.noSchemaLabel),
      },
      {
        title: `${labels.responseLabel} / ${labels.headersLabel}`,
        rows: joinSchemaLines(entry.response.headersSchema, labels.noSchemaLabel),
      },
      {
        title: `${labels.responseLabel} / ${labels.bodyLabel}`,
        rows: joinSchemaLines(entry.response.bodySchema, labels.noSchemaLabel),
      },
    ];

    for (const section of sections) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      y = appendPdfBlock(doc, section.title, { x: pageMargin, y: y + 10, maxWidth: contentWidth, lineHeight: 15, pageMargin });
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      y = appendPdfBlock(doc, section.rows.join('\n'), { x: pageMargin, y: y + 4, maxWidth: contentWidth, lineHeight: 12, pageMargin });
    }
  }

  doc.save(createDownloadFilename(result, 'pdf'));
}
