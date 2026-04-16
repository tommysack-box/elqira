import type { Language, Request, Response, Scenario } from '../../types';

type SchemaRow = { path: string; type: string };

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
  const isIt = language === 'it';
  const requestLabel = isIt ? 'Request' : 'Request';
  const responseLabel = isIt ? 'Response' : 'Response';
  const headersLabel = isIt ? 'Headers schema' : 'Headers schema';
  const paramsLabel = isIt ? 'Schema parametri query' : 'Query params schema';
  const bodyLabel = isIt ? 'Schema body' : 'Body schema';
  const notesLabel = isIt ? 'Note' : 'Notes';
  const noSchemaLabel = isIt ? 'Nessun campo rilevato' : 'No fields detected';
  const noNotesLabel = isIt ? 'Nessuna nota' : 'No notes';
  const noDescriptionLabel = isIt ? 'Nessuna descrizione' : 'No description';
  const reportTitle = isIt ? 'Scenario Reference' : 'Scenario Reference';
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
    <title>${escapeHtml(result.scenario.title)} - Scenario Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
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
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
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
      }
      .material-symbols-outlined {
        font-family: "Material Symbols Outlined";
        font-size: 20px;
        line-height: 1;
        display: inline-block;
        -webkit-font-smoothing: antialiased;
        font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24;
      }
      .hero-heading { flex: 1; min-width: 0; }
      .hero-heading h1 {
        font: 700 18px/1.2 "Inter", sans-serif;
        letter-spacing: -0.02em;
        color: var(--ink);
      }
      .hero-kicker {
        margin-top: 4px;
        color: var(--muted);
        font: 700 10px/1.4 "JetBrains Mono", monospace;
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
        font-family: "Inter", sans-serif;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .meta-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        padding: 4px 8px;
        font: 700 10px/1 "JetBrains Mono", monospace;
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
        font: 700 16px/1.2 "Inter", sans-serif;
        margin-top: 8px;
        letter-spacing: -0.02em;
      }
      .entry-description {
        margin-top: 8px;
        color: #464554;
        font-size: 14px;
        line-height: 1.55;
        font-family: "Inter", sans-serif;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .method { display: inline-flex; align-items: center; justify-content: center; padding: 4px 8px; font: 700 10px/1 "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: 0.12em; border-radius: 4px; }
      .method { background: var(--accent-soft); color: var(--accent); margin-right: 8px; }
      .meta-row {
        margin-top: 12px;
        color: var(--muted);
        font: 11px/1.5 "JetBrains Mono", monospace;
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
      .card h3 { font: 700 17px/1.2 "Inter", sans-serif; letter-spacing: -0.01em; }
      .card-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 5px 10px;
        font: 700 10px/1 "JetBrains Mono", monospace;
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
        font: 700 11px/1.2 "JetBrains Mono", monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        margin-bottom: 8px;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        font: 12px/1.55 "JetBrains Mono", monospace;
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
          <div class="hero-icon"><span class="material-symbols-outlined">description</span></div>
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
