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

function latencyTier(ms: number): 'optimal' | 'stable' | 'slow' {
  if (ms < 300) return 'optimal';
  if (ms < 1000) return 'stable';
  return 'slow';
}

function getResourceGroup(url: string): string {
  try {
    const parsed = new URL(url);
    // Group by hostname + first non-empty path segment (e.g. "api.example.com/users")
    const firstSegment = parsed.pathname.split('/').filter(Boolean)[0];
    return firstSegment ? `${parsed.hostname}/${firstSegment}` : parsed.hostname;
  } catch {
    // Relative URL fallback — use first path segment
    const segments = url.split('/').filter(Boolean);
    return segments[0] ?? 'root';
  }
}

// ─── 1. API Consistency ──────────────────────────────────────────────────────

function analyzeConsistency(pairs: Pair[], language: Language): HealthApiConsistency {
  const isIt = language === 'it';
  const issues: HealthApiConsistency['issues'] = [];

  // Group by resource hint (same URL prefix, e.g. /users)
  const resourceGroups = new Map<string, Pair[]>();
  for (const pair of pairs) {
    const resource = getResourceGroup(pair.request.url);
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
    const resource = getResourceGroup(pair.request.url);
    const codes = statusGroups.get(resource) ?? [];
    codes.push(pair.response.statusCode);
    statusGroups.set(resource, codes);
  }
  for (const [resource, codes] of statusGroups) {
    const families = new Set(codes.map((c) => Math.floor(c / 100)));
    if (families.size > 1) {
      issues.push({
        requestTitles: pairs.filter((p) => getResourceGroup(p.request.url) === resource).map((p) => p.request.title),
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

  const responseBodies = pairs.map((p) => ({
    title: p.request.title,
    flat: flattenKeys(parseJson(p.response.body) ?? {}),
    body: parseJson(p.response.body) ?? {},
  }));

  const requestBodies = pairs.map((p) => ({
    title: p.request.title,
    flat: flattenKeys(parseJson(p.request.body ?? '') ?? {}),
    body: parseJson(p.request.body ?? '') ?? {},
  }));

  // For each request body field, check if a previous response contains the same leaf key
  for (let i = 1; i < pairs.length; i++) {
    const reqFields = requestBodies[i].flat;
    for (let j = 0; j < i; j++) {
      const respFields = responseBodies[j].flat;
      const shared = reqFields.filter((f) => respFields.includes(f));
      for (const field of shared.slice(0, 2)) {
        dependencies.push({
          sourceRequest: responseBodies[j].title,
          targetRequest: requestBodies[i].title,
          field,
          note: isIt
            ? `Il campo "${field}" presente nella response di "${responseBodies[j].title}" potrebbe essere richiesto nel body di "${requestBodies[i].title}".`
            : `Field "${field}" from "${responseBodies[j].title}" response may be required in "${requestBodies[i].title}" request body.`,
        });
      }
    }
  }

  // Also check URL path segments against response values (e.g. /users/123 where 123 = response.id)
  for (let i = 1; i < pairs.length; i++) {
    const urlSegments = pairs[i].request.url.split('/').filter(Boolean);
    for (const segment of urlSegments) {
      if (/^\d+$/.test(segment) || (segment.length > 8 && /^[a-z0-9-_]+$/i.test(segment))) {
        for (let j = 0; j < i; j++) {
          const respJson = parseJson(pairs[j].response.body);
          if (!respJson) continue;
          const values = Object.values(respJson).map(String);
          if (values.includes(segment)) {
            dependencies.push({
              sourceRequest: pairs[j].request.title,
              targetRequest: pairs[i].request.title,
              field: 'id / path segment',
              note: isIt
                ? `Il valore "${segment}" nell'URL di "${pairs[i].request.title}" corrisponde a un campo nella response di "${pairs[j].request.title}".`
                : `Value "${segment}" in "${pairs[i].request.title}" URL matches a field in "${pairs[j].request.title}" response.`,
            });
          }
        }
      }
    }
  }

  return { dependencies: dependencies.slice(0, 6) };
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
