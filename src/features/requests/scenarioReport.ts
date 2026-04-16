import type { Language, Request, Response } from '../../types';

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
  scenarioTitle: string;
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
  scenarioTitle: string,
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
    scenarioTitle,
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
  const summaryLabel = isIt ? 'Schema inferito senza valori runtime' : 'Inferred schema without runtime values';

  const sections = result.entries.map((entry, index) => {
    const { request } = entry;

    return `
      <section class="entry">
        <div class="entry-header">
          <div class="entry-heading">
            <div class="eyebrow">${requestLabel} ${index + 1}</div>
            <h2>${escapeHtml(request.title)}</h2>
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
    <title>${escapeHtml(result.scenarioTitle)} - Scenario Report</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #191c1e;
        --muted: #5b5f63;
        --line: #d8dce0;
        --panel: #f7f9fb;
        --panel-strong: #eef2f7;
        --accent: #2a14b4;
        --accent-soft: #ebe7ff;
        --success: #005c54;
        --success-soft: #ddfbf6;
        --paper-shadow: 0 18px 45px rgba(25, 28, 30, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(42, 20, 180, 0.08), transparent 28%),
          linear-gradient(180deg, #f4f6fb 0%, #ffffff 180px);
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        line-height: 1.45;
      }
      .page { max-width: 1180px; margin: 0 auto; padding: 40px 32px 56px; }
      .hero {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(42, 20, 180, 0.14);
        background: linear-gradient(135deg, #fbf9ff 0%, #f2fffc 100%);
        border-radius: 24px;
        padding: 28px 30px;
        margin-bottom: 28px;
        box-shadow: var(--paper-shadow);
      }
      .hero::after {
        content: "";
        position: absolute;
        inset: auto -40px -40px auto;
        width: 180px;
        height: 180px;
        background: radial-gradient(circle, rgba(42, 20, 180, 0.12), transparent 68%);
        pointer-events: none;
      }
      .eyebrow { font: 700 11px/1.2 "IBM Plex Mono", monospace; text-transform: uppercase; letter-spacing: 0.16em; color: var(--accent); }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 34px; line-height: 1.05; margin-top: 10px; letter-spacing: -0.03em; max-width: 720px; }
      .hero-meta { margin-top: 12px; color: var(--muted); font-size: 14px; max-width: 760px; }
      .entry {
        page-break-inside: avoid;
        margin-bottom: 24px;
        padding: 22px;
        border: 1px solid rgba(25, 28, 30, 0.08);
        border-radius: 22px;
        background: #fff;
        box-shadow: 0 10px 32px rgba(25, 28, 30, 0.05);
      }
      .entry-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
      .entry-heading { min-width: 0; }
      .entry h2 { font-size: 24px; line-height: 1.1; margin-top: 8px; letter-spacing: -0.02em; }
      .method { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 6px 10px; font: 700 11px/1 "IBM Plex Mono", monospace; text-transform: uppercase; letter-spacing: 0.12em; }
      .method { background: var(--success-soft); color: var(--success); margin-right: 8px; box-shadow: inset 0 0 0 1px rgba(0, 92, 84, 0.08); }
      .meta-row {
        margin-top: 12px;
        color: var(--muted);
        font-size: 13px;
        word-break: break-word;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .card {
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: white;
      }
      .request-card { background: linear-gradient(180deg, #ffffff 0%, #fafbff 100%); }
      .response-card { background: linear-gradient(180deg, #ffffff 0%, #f8fffd 100%); }
      .card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .card h3 { font-size: 17px; letter-spacing: -0.01em; }
      .card-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 5px 10px;
        font: 700 10px/1 "IBM Plex Mono", monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        background: var(--accent-soft);
        color: var(--accent);
      }
      .response-card .card-badge {
        background: var(--success-soft);
        color: var(--success);
      }
      .block { margin-top: 14px; }
      .label {
        display: block;
        color: var(--muted);
        font: 700 11px/1.2 "IBM Plex Mono", monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        margin-bottom: 8px;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        font: 12px/1.55 "IBM Plex Mono", monospace;
        background: var(--panel);
        border-radius: 14px;
        padding: 14px;
        border: 1px solid #e5e8eb;
      }
      @media print {
        body { background: white; }
        .page { padding: 16px; }
        .hero, .entry { break-inside: avoid; box-shadow: none; }
        .entry { border-color: #dfe3e7; }
      }
      @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="eyebrow">Scenario Documentation</div>
        <h1>${escapeHtml(result.scenarioTitle)}</h1>
        <p class="hero-meta">${summaryLabel}</p>
      </section>
      ${sections}
    </main>
  </body>
</html>`;
}
