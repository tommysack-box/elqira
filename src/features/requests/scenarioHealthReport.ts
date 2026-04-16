import type { Request, Response } from '../../types';
import type { Language } from '../../types';

export interface HealthApiConsistency {
  consistent: boolean;
  issues: Array<{ requestTitles: string[]; description: string }>;
}

export interface HealthErrorPattern {
  hasErrors: boolean;
  patterns: Array<{ statusCode: number; requests: string[]; note: string }>;
}

export interface HealthImplicitDependency {
  dependencies: Array<{ sourceRequest: string; targetRequest: string; field: string; note: string }>;
}

export interface HealthLatencyProfile {
  avgMs: number;
  minMs: number;
  maxMs: number;
  bottleneck: string | null;
  tier: 'optimal' | 'stable' | 'slow';
  entries: Array<{ title: string; duration: number; tier: 'optimal' | 'stable' | 'slow' }>;
}

export interface ScenarioHealthReportResult {
  scenarioTitle: string;
  executedAt: string;
  consistency: HealthApiConsistency;
  errorPatterns: HealthErrorPattern;
  implicitDependencies: HealthImplicitDependency;
  latencyProfile: HealthLatencyProfile;
  summary: string;
}

type Pair = { request: Request; response: Response };
type Primitive = string | number | boolean | null;
type LeafEntry = { path: string; leaf: string; value: Primitive };

const IGNORED_HTTP_FIELD_NAMES = new Set([
  'accept',
  'accept_encoding',
  'accept_language',
  'cache_control',
  'connection',
  'content_encoding',
  'content_language',
  'content_length',
  'content_type',
  'cookie',
  'host',
  'origin',
  'pragma',
  'referer',
  'referrer',
  'user_agent',
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function parseAnyJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    keys.push(full);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full));
    }
  }
  return keys;
}

function normalizeFieldName(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}

function leafName(path: string): string {
  const parts = path.split('.').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function collectLeafEntries(value: unknown, prefix = ''): LeafEntry[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectLeafEntries(item, prefix ? `${prefix}[${index}]` : `[${index}]`));
  }

  if (isObject(value)) {
    return Object.entries(value).flatMap(([key, nested]) => {
      const next = prefix ? `${prefix}.${key}` : key;
      return collectLeafEntries(nested, next);
    });
  }

  if (prefix) {
    return [{
      path: prefix,
      leaf: normalizeFieldName(leafName(prefix)),
      value: (value as Primitive) ?? null,
    }];
  }

  return [];
}

function collectPrimitiveStrings(value: unknown): string[] {
  return collectLeafEntries(value)
    .map((entry) => String(entry.value).trim())
    .filter(Boolean);
}

function isLikelyDependencyField(field: string): boolean {
  return !IGNORED_HTTP_FIELD_NAMES.has(field)
    && /(id|token|key|code|cursor|slug|uuid|guid|session|reference|ref|url|uri)$/i.test(field);
}

function shouldIgnoreImplicitDependencyField(field: string): boolean {
  return !field || IGNORED_HTTP_FIELD_NAMES.has(field);
}

function looksLikePlaceholder(segment: string): boolean {
  return /^:/.test(segment) || /^\{[^}]+\}$/.test(segment) || /^<[^>]+>$/.test(segment);
}

function cleanPlaceholder(segment: string): string {
  return normalizeFieldName(segment.replace(/^:/, '').replace(/[{}<>]/g, ''));
}

function dedupeDependencies(items: HealthImplicitDependency['dependencies']): HealthImplicitDependency['dependencies'] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sourceRequest}|${item.targetRequest}|${item.field}|${item.note}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function collectRequestTextFragments(request: Request): string[] {
  const headerFragments = request.headers
    .filter((header) => header.enabled)
    .flatMap((header) => [header.key, header.value]);

  const paramFragments = (request.params ?? [])
    .filter((param) => param.enabled)
    .flatMap((param) => [param.key, param.value]);

  return uniqueStrings([
    request.url,
    request.body ?? '',
    ...headerFragments,
    ...paramFragments,
  ]);
}

function collectRequestFieldNames(request: Request, requestBodyLeaves: LeafEntry[]): Set<string> {
  const fields = new Set<string>();

  for (const entry of requestBodyLeaves) {
    if (!IGNORED_HTTP_FIELD_NAMES.has(entry.leaf)) fields.add(entry.leaf);
  }

  for (const header of request.headers) {
    if (!header.enabled) continue;
    if (!header.key.trim()) continue;
    const field = normalizeFieldName(header.key);
    if (!IGNORED_HTTP_FIELD_NAMES.has(field)) fields.add(field);
  }

  for (const param of request.params ?? []) {
    if (!param.enabled) continue;
    if (!param.key.trim()) continue;
    const field = normalizeFieldName(param.key);
    if (!IGNORED_HTTP_FIELD_NAMES.has(field)) fields.add(field);
  }

  return fields;
}

function latencyTier(ms: number): 'optimal' | 'stable' | 'slow' {
  if (ms < 300) return 'optimal';
  if (ms < 1000) return 'stable';
  return 'slow';
}

function normalizePathSegment(segment: string): string {
  if (!segment) return segment;
  if (looksLikePlaceholder(segment)) return ':param';
  if (/^\d+$/.test(segment)) return ':id';
  if (/^[0-9a-f]{8,}$/i.test(segment)) return ':id';
  if (/^[A-Za-z0-9_-]{16,}$/.test(segment)) return ':id';
  return segment.toLowerCase();
}

function getResourceGroup(url: string, method: string): string {
  try {
    const parsed = new URL(url);
    const normalizedPath = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map(normalizePathSegment)
      .join('/');
    return `${method.toUpperCase()} ${parsed.hostname}/${normalizedPath || 'root'}`;
  } catch {
    const cleanUrl = url.split('?')[0];
    const normalizedPath = cleanUrl
      .split('/')
      .filter(Boolean)
      .map(normalizePathSegment)
      .join('/');
    return `${method.toUpperCase()} ${normalizedPath || 'root'}`;
  }
}

// ─── 1. API Consistency ──────────────────────────────────────────────────────

function analyzeConsistency(pairs: Pair[], language: Language): HealthApiConsistency {
  const isIt = language === 'it';
  const issues: HealthApiConsistency['issues'] = [];

  // Group by resource hint (same URL prefix, e.g. /users)
  const resourceGroups = new Map<string, Pair[]>();
  for (const pair of pairs) {
    const resource = getResourceGroup(pair.request.url, pair.request.method);
    const group = resourceGroups.get(resource) ?? [];
    group.push(pair);
    resourceGroups.set(resource, group);
  }

  for (const [resource, group] of resourceGroups) {
    if (group.length < 2) continue;
    const keysets = group
      .map((p) => ({ title: p.request.title, keys: new Set(flattenKeys(parseJson(p.response.body) ?? {})) }))
      .filter((x) => x.keys.size > 0);

    if (keysets.length < 2) continue;

    // Find fields present in some but not all
    const allKeys = new Set(keysets.flatMap((x) => [...x.keys]));
    const inconsistent: string[] = [];
    for (const key of allKeys) {
      const presentIn = keysets.filter((x) => x.keys.has(key));
      if (presentIn.length > 0 && presentIn.length < keysets.length) {
        inconsistent.push(key);
      }
    }

    if (inconsistent.length > 0) {
      issues.push({
        requestTitles: group.map((p) => p.request.title),
        description: isIt
          ? `Le response del gruppo "${resource}" hanno campi inconsistenti: ${inconsistent.slice(0, 4).join(', ')}${inconsistent.length > 4 ? ' …' : ''}.`
          : `Responses in the "${resource}" group have inconsistent fields: ${inconsistent.slice(0, 4).join(', ')}${inconsistent.length > 4 ? ' …' : ''}.`,
      });
    }
  }

  // Status code inconsistency — mixed 2xx across same-prefix requests
  const statusGroups = new Map<string, number[]>();
  for (const pair of pairs) {
    const resource = getResourceGroup(pair.request.url, pair.request.method);
    const codes = statusGroups.get(resource) ?? [];
    codes.push(pair.response.statusCode);
    statusGroups.set(resource, codes);
  }
  for (const [resource, codes] of statusGroups) {
    const families = new Set(codes.map((c) => Math.floor(c / 100)));
    if (families.size > 1) {
      issues.push({
        requestTitles: pairs.filter((p) => getResourceGroup(p.request.url, p.request.method) === resource).map((p) => p.request.title),
        description: isIt
          ? `Le response del gruppo "${resource}" restituiscono status code di famiglie diverse: ${[...families].map((f) => `${f}xx`).join(', ')}.`
          : `Responses in the "${resource}" group return status codes from different families: ${[...families].map((f) => `${f}xx`).join(', ')}.`,
      });
    }
  }

  return { consistent: issues.length === 0, issues };
}

// ─── 2. Error Patterns ───────────────────────────────────────────────────────

function analyzeErrorPatterns(pairs: Pair[], language: Language): HealthErrorPattern {
  const isIt = language === 'it';
  const errorPairs = pairs.filter((p) => p.response.statusCode === 0 || p.response.statusCode >= 400);

  if (errorPairs.length === 0) return { hasErrors: false, patterns: [] };

  const byCode = new Map<number, string[]>();
  for (const p of errorPairs) {
    const code = p.response.statusCode;
    const titles = byCode.get(code) ?? [];
    titles.push(p.request.title);
    byCode.set(code, titles);
  }

  const patterns: HealthErrorPattern['patterns'] = [];
  for (const [code, titles] of byCode) {
    let note = '';
    if (code === 0) {
      note = isIt ? 'Errore di rete: nessuna risposta ricevuta dal server.' : 'Network error: no response received from server.';
    } else if (code === 401) {
      note = isIt ? 'Autenticazione mancante o token scaduto.' : 'Missing authentication or expired token.';
    } else if (code === 403) {
      note = isIt ? 'Permessi insufficienti per questa operazione.' : 'Insufficient permissions for this operation.';
    } else if (code === 404) {
      note = isIt ? 'Risorsa non trovata. Verificare gli endpoint e gli ID.' : 'Resource not found. Verify endpoints and IDs.';
    } else if (code === 429) {
      note = isIt ? 'Rate limit superato. Attendere prima di riprovare.' : 'Rate limit exceeded. Wait before retrying.';
    } else if (code >= 500) {
      note = isIt ? 'Errore interno del server. Controllare i log lato server.' : 'Internal server error. Check server-side logs.';
    } else {
      note = isIt ? `Errore HTTP ${code}.` : `HTTP error ${code}.`;
    }
    patterns.push({ statusCode: code, requests: titles, note });
  }

  return { hasErrors: true, patterns };
}

// ─── 3. Implicit Dependencies ────────────────────────────────────────────────

function analyzeImplicitDependencies(pairs: Pair[], language: Language): HealthImplicitDependency {
  const isIt = language === 'it';
  const dependencies: HealthImplicitDependency['dependencies'] = [];

  const responseBodies = pairs.map((p) => {
    const parsed = parseAnyJson(p.response.body);
    const leaves = collectLeafEntries(parsed);
    return {
      title: p.request.title,
      leaves,
      primitiveValues: new Set(collectPrimitiveStrings(parsed)),
    };
  });

  const requestBodies = pairs.map((p) => {
    const parsed = parseAnyJson(p.request.body ?? '');
    return {
      title: p.request.title,
      leaves: collectLeafEntries(parsed),
      primitiveValues: new Set(collectPrimitiveStrings(parsed)),
    };
  });

  // Match request body/query/header fields against previous response leaf names.
  for (let i = 1; i < pairs.length; i++) {
    const reqFieldNames = collectRequestFieldNames(pairs[i].request, requestBodies[i].leaves);

    for (let j = 0; j < i; j++) {
      const respFields = new Set(
        responseBodies[j].leaves
          .map((entry) => entry.leaf)
          .filter((field) => isLikelyDependencyField(field))
      );
      const shared = [...reqFieldNames].filter((field) => respFields.has(field));
      for (const field of shared.slice(0, 3)) {
        if (shouldIgnoreImplicitDependencyField(field)) continue;
        dependencies.push({
          sourceRequest: responseBodies[j].title,
          targetRequest: requestBodies[i].title,
          field,
          note: isIt
            ? `Il campo "${field}" restituito da "${responseBodies[j].title}" sembra riutilizzato nella request "${requestBodies[i].title}".`
            : `Field "${field}" returned by "${responseBodies[j].title}" appears to be reused in "${requestBodies[i].title}".`,
        });
      }
    }
  }

  // Match literal values reused in URL segments, query params, or request body.
  for (let i = 1; i < pairs.length; i++) {
    const urlSegments = pairs[i].request.url.split('/').filter(Boolean);
    const requestTextFragments = collectRequestTextFragments(pairs[i].request);
    const requestValues = new Set<string>([
      ...urlSegments.filter((segment) => !looksLikePlaceholder(segment)),
      ...[...(pairs[i].request.params ?? [])]
        .filter((param) => param.enabled && param.value.trim())
        .map((param) => param.value.trim()),
      ...requestBodies[i].primitiveValues,
    ]);

    for (let j = 0; j < i; j++) {
      for (const entry of responseBodies[j].leaves) {
        const value = String(entry.value).trim();
        if (!value || value.length < 2) continue;
        const appearsAsLiteral = requestValues.has(value);
        const appearsInsideFragment = requestTextFragments.some((fragment) => fragment.includes(value));
        if (!appearsAsLiteral && !appearsInsideFragment) continue;

        dependencies.push({
          sourceRequest: responseBodies[j].title,
          targetRequest: requestBodies[i].title,
          field: entry.path,
          note: isIt
            ? `Il valore di "${entry.path}" nella response di "${responseBodies[j].title}" sembra riutilizzato nella request "${pairs[i].request.title}".`
            : `Value from "${entry.path}" in "${responseBodies[j].title}" response appears to be reused in "${pairs[i].request.title}".`,
        });
      }
    }
  }

  // Match URL placeholders against previous response fields.
  for (let i = 1; i < pairs.length; i++) {
    const placeholders = pairs[i].request.url
      .split('/')
      .filter(Boolean)
      .filter(looksLikePlaceholder)
      .map(cleanPlaceholder)
      .filter(Boolean);

    if (placeholders.length === 0) continue;

    for (let j = 0; j < i; j++) {
      const responseFields = new Set(responseBodies[j].leaves.map((entry) => entry.leaf));
      for (const placeholder of placeholders) {
        if (shouldIgnoreImplicitDependencyField(placeholder)) continue;
        if (responseFields.has(placeholder)) {
          dependencies.push({
            sourceRequest: responseBodies[j].title,
            targetRequest: pairs[i].request.title,
            field: placeholder,
            note: isIt
              ? `Il placeholder URL "${placeholder}" di "${pairs[i].request.title}" sembra dipendere da un valore restituito da "${responseBodies[j].title}".`
              : `URL placeholder "${placeholder}" in "${pairs[i].request.title}" appears to depend on a value returned by "${responseBodies[j].title}".`,
          });
        }
      }
    }
  }

  return { dependencies: dedupeDependencies(dependencies).slice(0, 6) };
}

// ─── 4. Latency Profile ──────────────────────────────────────────────────────

function analyzeLatency(pairs: Pair[]): HealthLatencyProfile {
  const durations = pairs.map((p) => p.response.duration);
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const bottleneckPair = pairs.find((p) => p.response.duration === max) ?? null;

  const entries = pairs.map((p) => ({
    title: p.request.title,
    duration: p.response.duration,
    tier: latencyTier(p.response.duration),
  }));

  return {
    avgMs: avg,
    minMs: min,
    maxMs: max,
    bottleneck: bottleneckPair && max > 500 ? bottleneckPair.request.title : null,
    tier: latencyTier(avg),
    entries,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function buildSummary(
  pairs: Pair[],
  consistency: HealthApiConsistency,
  errors: HealthErrorPattern,
  deps: HealthImplicitDependency,
  latency: HealthLatencyProfile,
  language: Language
): string {
  const isIt = language === 'it';
  const parts: string[] = [];

  const errorCount = errors.patterns.reduce((a, p) => a + p.requests.length, 0);
  if (errorCount > 0) {
    parts.push(isIt ? `${errorCount} request su ${pairs.length} hanno restituito errori` : `${errorCount} of ${pairs.length} requests returned errors`);
  }

  if (!consistency.consistent) {
    parts.push(isIt ? `${consistency.issues.length} problema/i di coerenza rilevati` : `${consistency.issues.length} consistency issue(s) detected`);
  }

  if (deps.dependencies.length > 0) {
    parts.push(isIt ? `${deps.dependencies.length} dipendenza/e implicita/e identificata/e` : `${deps.dependencies.length} implicit dependency/ies identified`);
  }

  if (latency.bottleneck) {
    parts.push(isIt ? `bottleneck di latenza su "${latency.bottleneck}"` : `latency bottleneck on "${latency.bottleneck}"`);
  }

  if (parts.length === 0) {
    return isIt
      ? `Lo scenario sembra in buona salute: nessun errore, schema coerente, latenza nella norma.`
      : `The scenario appears healthy: no errors, consistent schema, latency within normal range.`;
  }

  return isIt
    ? `Report completato su ${pairs.length} request: ${parts.join('; ')}.`
    : `Report completed on ${pairs.length} requests: ${parts.join('; ')}.`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function buildScenarioHealthReport(
  scenarioTitle: string,
  pairs: Pair[],
  language: Language = 'en'
): ScenarioHealthReportResult {
  const consistency = analyzeConsistency(pairs, language);
  const errorPatterns = analyzeErrorPatterns(pairs, language);
  const implicitDependencies = analyzeImplicitDependencies(pairs, language);
  const latencyProfile = analyzeLatency(pairs);
  const summary = buildSummary(pairs, consistency, errorPatterns, implicitDependencies, latencyProfile, language);

  return {
    scenarioTitle,
    executedAt: new Date().toISOString(),
    consistency,
    errorPatterns,
    implicitDependencies,
    latencyProfile,
    summary,
  };
}
