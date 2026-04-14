import type { Response } from '../../types';
import type { Language } from '../../types';

export interface DiffEntry {
  path: string;
  baselineValue: string;
  currentValue: string;
  kind: 'changed';
}

export interface DiffField {
  path: string;
  value: string;
  kind: 'added' | 'removed';
}

export interface SemanticNote {
  text: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface CompareResponseResult {
  summary: string;
  statusChanged: boolean;
  latencyDelta: number; // ms: positive = slower, negative = faster
  addedFields: DiffField[];
  removedFields: DiffField[];
  changedFields: DiffEntry[];
  semanticNotes: SemanticNote[];
  regressionRisk: 'none' | 'low' | 'medium' | 'high';
}

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function stringify(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

function diffJsonBodies(
  baseline: string,
  current: string
): { added: DiffField[]; removed: DiffField[]; changed: DiffEntry[] } {
  const baseObj = parseJson(baseline);
  const currObj = parseJson(current);

  if (!baseObj || !currObj) {
    return { added: [], removed: [], changed: [] };
  }

  const flatBase = flattenObject(baseObj);
  const flatCurr = flattenObject(currObj);

  const added: DiffField[] = [];
  const removed: DiffField[] = [];
  const changed: DiffEntry[] = [];

  // Fields in current but not in baseline → added
  for (const [path, value] of Object.entries(flatCurr)) {
    if (!(path in flatBase)) {
      added.push({ path, value: stringify(value), kind: 'added' });
    }
  }

  // Fields in baseline but not in current → removed
  for (const [path, value] of Object.entries(flatBase)) {
    if (!(path in flatCurr)) {
      removed.push({ path, value: stringify(value), kind: 'removed' });
    }
  }

  // Fields in both but with different values → changed
  for (const [path, baseVal] of Object.entries(flatBase)) {
    if (path in flatCurr) {
      const currVal = flatCurr[path];
      if (stringify(baseVal) !== stringify(currVal)) {
        changed.push({
          path,
          baselineValue: stringify(baseVal),
          currentValue: stringify(currVal),
          kind: 'changed',
        });
      }
    }
  }

  return { added, removed, changed };
}

function buildSemanticNotes(
  baseline: Response,
  current: Response,
  diff: { added: DiffField[]; removed: DiffField[]; changed: DiffEntry[] },
  language: Language
): SemanticNote[] {
  const notes: SemanticNote[] = [];
  const isItalian = language === 'it';

  // Status code transition
  if (baseline.statusCode !== current.statusCode) {
    const wasOk = baseline.statusCode >= 200 && baseline.statusCode < 300;
    const nowOk = current.statusCode >= 200 && current.statusCode < 300;
    const wasError = baseline.statusCode >= 400 || baseline.statusCode === 0;
    const nowError = current.statusCode >= 400 || current.statusCode === 0;

    if (wasOk && nowError) {
      notes.push({
        text: isItalian
          ? `Lo stato è peggiorato da ${baseline.statusCode} a ${current.statusCode}: la response attuale è un errore, quella baseline era un successo. Probabile regressione.`
          : `Status degraded from ${baseline.statusCode} to ${current.statusCode}: the current response is an error while the baseline was successful. Likely regression.`,
        severity: 'critical',
      });
    } else if (wasError && nowOk) {
      notes.push({
        text: isItalian
          ? `Lo stato è migliorato da ${baseline.statusCode} a ${current.statusCode}: la response è passata da errore a successo.`
          : `Status improved from ${baseline.statusCode} to ${current.statusCode}: the response went from error to success.`,
        severity: 'info',
      });
    } else {
      notes.push({
        text: isItalian
          ? `Lo status code è cambiato da ${baseline.statusCode} a ${current.statusCode}.`
          : `Status code changed from ${baseline.statusCode} to ${current.statusCode}.`,
        severity: 'warning',
      });
    }
  }

  // Latency change
  const latencyDelta = current.duration - baseline.duration;
  if (Math.abs(latencyDelta) > 100) {
    notes.push({
      text: isItalian
        ? `La latenza è ${latencyDelta > 0 ? 'aumentata' : 'diminuita'} di ${Math.abs(latencyDelta)}ms (${baseline.duration}ms → ${current.duration}ms).`
        : `Latency ${latencyDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(latencyDelta)}ms (${baseline.duration}ms → ${current.duration}ms).`,
      severity: latencyDelta > 500 ? 'warning' : 'info',
    });
  }

  // Auth-sensitive fields removed
  const sensitiveRemoved = diff.removed.filter(
    (f) =>
      f.path.toLowerCase().includes('token') ||
      f.path.toLowerCase().includes('auth') ||
      f.path.toLowerCase().includes('session') ||
      f.path.toLowerCase().includes('key')
  );
  if (sensitiveRemoved.length > 0) {
    notes.push({
      text: isItalian
        ? `Campi sensibili rimossi nella response corrente: ${sensitiveRemoved.map((f) => f.path).join(', ')}. Verificare se è intenzionale.`
        : `Sensitive fields removed in the current response: ${sensitiveRemoved.map((f) => f.path).join(', ')}. Verify if this is intentional.`,
      severity: 'warning',
    });
  }

  // Role/permission fields changed
  const permChanged = diff.changed.filter(
    (f) =>
      f.path.toLowerCase().includes('role') ||
      f.path.toLowerCase().includes('permission') ||
      f.path.toLowerCase().includes('scope') ||
      f.path.toLowerCase().includes('access')
  );
  if (permChanged.length > 0) {
    notes.push({
      text: isItalian
        ? `Campi di autorizzazione modificati: ${permChanged.map((f) => `${f.path} (${f.baselineValue} → ${f.currentValue})`).join(', ')}. Potrebbe avere implicazioni di sicurezza.`
        : `Authorization-related fields changed: ${permChanged.map((f) => `${f.path} (${f.baselineValue} → ${f.currentValue})`).join(', ')}. This may have security implications.`,
      severity: 'critical',
    });
  }

  if (notes.length === 0) {
    notes.push({
      text: isItalian
        ? 'Nessuna anomalia semantica rilevata. Le differenze sembrano di natura strutturale o di dati, senza implicazioni funzionali evidenti.'
        : 'No semantic anomalies detected. The differences appear structural or data-level without obvious functional implications.',
      severity: 'info',
    });
  }

  return notes;
}

function assessRegressionRisk(
  baseline: Response,
  current: Response,
  diff: { added: DiffField[]; removed: DiffField[]; changed: DiffEntry[] }
): CompareResponseResult['regressionRisk'] {
  // Status degraded to error
  const wasOk = baseline.statusCode >= 200 && baseline.statusCode < 300;
  const nowError = current.statusCode >= 400 || current.statusCode === 0;
  if (wasOk && nowError) return 'high';

  // Sensitive fields removed
  const sensitiveLoss = diff.removed.some(
    (f) =>
      f.path.toLowerCase().includes('token') ||
      f.path.toLowerCase().includes('auth') ||
      f.path.toLowerCase().includes('session')
  );
  if (sensitiveLoss) return 'high';

  // Auth/permission fields changed
  const permChanged = diff.changed.some(
    (f) =>
      f.path.toLowerCase().includes('role') ||
      f.path.toLowerCase().includes('permission') ||
      f.path.toLowerCase().includes('scope')
  );
  if (permChanged) return 'medium';

  // Significant diff
  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;
  if (totalChanges > 5) return 'medium';
  if (totalChanges > 0) return 'low';

  // Status changed but not to error
  if (baseline.statusCode !== current.statusCode) return 'low';

  return 'none';
}

function buildSummary(
  baseline: Response,
  current: Response,
  diff: { added: DiffField[]; removed: DiffField[]; changed: DiffEntry[] },
  language: Language
): string {
  const isItalian = language === 'it';
  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;

  if (totalChanges === 0 && baseline.statusCode === current.statusCode) {
    return isItalian
      ? 'Le due response sono strutturalmente identiche. Nessuna differenza rilevata nel payload o nello status code.'
      : 'Both responses are structurally identical. No differences detected in the payload or status code.';
  }

  const parts: string[] = [];

  if (baseline.statusCode !== current.statusCode) {
    parts.push(
      isItalian
        ? `lo status code è cambiato da ${baseline.statusCode} a ${current.statusCode}`
        : `status code changed from ${baseline.statusCode} to ${current.statusCode}`
    );
  }

  if (diff.added.length > 0) {
    parts.push(
      isItalian
        ? `${diff.added.length} campo${diff.added.length > 1 ? 'i' : ''} aggiunto${diff.added.length > 1 ? 'i' : ''}`
        : `${diff.added.length} field${diff.added.length > 1 ? 's' : ''} added`
    );
  }

  if (diff.removed.length > 0) {
    parts.push(
      isItalian
        ? `${diff.removed.length} campo${diff.removed.length > 1 ? 'i' : ''} rimosso${diff.removed.length > 1 ? 'i' : ''}`
        : `${diff.removed.length} field${diff.removed.length > 1 ? 's' : ''} removed`
    );
  }

  if (diff.changed.length > 0) {
    parts.push(
      isItalian
        ? `${diff.changed.length} campo${diff.changed.length > 1 ? 'i' : ''} modificato${diff.changed.length > 1 ? 'i' : ''}`
        : `${diff.changed.length} field${diff.changed.length > 1 ? 's' : ''} changed`
    );
  }

  return isItalian
    ? `Confronto completato: ${parts.join(', ')}.`
    : `Comparison completed: ${parts.join(', ')}.`;
}

export function compareResponses(
  baseline: Response,
  current: Response,
  language: Language = 'en'
): CompareResponseResult {
  const diff = diffJsonBodies(baseline.body, current.body);
  const semanticNotes = buildSemanticNotes(baseline, current, diff, language);
  const regressionRisk = assessRegressionRisk(baseline, current, diff);
  const summary = buildSummary(baseline, current, diff, language);

  return {
    summary,
    statusChanged: baseline.statusCode !== current.statusCode,
    latencyDelta: current.duration - baseline.duration,
    addedFields: diff.added.slice(0, 5),
    removedFields: diff.removed.slice(0, 5),
    changedFields: diff.changed.slice(0, 5),
    semanticNotes,
    regressionRisk,
  };
}
