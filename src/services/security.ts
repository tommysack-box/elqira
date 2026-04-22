import type { AppSettings, Header, Project, QueryParam, Request, Scenario } from '../types';

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);
const DEFAULT_PROJECT_VERSION = 'v1.0.0';
const DEFAULT_SCENARIO_VERSION = 'v1.0.0';
const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asOptionalString(value: unknown): string | undefined {
  const trimmed = asString(value).trim();
  return trimmed || undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function sanitizeProtocolUrl(value: unknown): string | undefined {
  const raw = asOptionalString(value);
  if (!raw) return undefined;

  try {
    const parsed = new URL(raw);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function sanitizeHeader(input: unknown): Header | null {
  if (!input || typeof input !== 'object') return null;
  const header = input as Partial<Header>;

  return {
    key: asString(header.key),
    value: asString(header.value),
    enabled: header.enabled !== false,
    sensitive: asBoolean(header.sensitive) || undefined,
  };
}

function sanitizeParam(input: unknown): QueryParam | null {
  if (!input || typeof input !== 'object') return null;
  const param = input as Partial<QueryParam>;

  return {
    key: asString(param.key),
    value: asString(param.value),
    enabled: param.enabled !== false,
    sensitive: asBoolean(param.sensitive) || undefined,
  };
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function sanitizeTimeoutMs(value: unknown): number | undefined {
  const raw = typeof value === 'string' && value.trim() ? Number(value.trim()) : value;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  if (raw <= 0) return undefined;

  return Math.trunc(raw);
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return SAFE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function sanitizeReferenceUrl(value: unknown): string | undefined {
  return sanitizeProtocolUrl(value);
}

export function sanitizeRequestUrl(value: unknown): string {
  return sanitizeProtocolUrl(value) ?? '';
}

export function sanitizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;

  return {
    language: (value as Partial<AppSettings>).language === 'it' ? 'it' : 'en',
    requestTimeoutMs: sanitizeTimeoutMs((value as Partial<AppSettings>).requestTimeoutMs),
  };
}

export function sanitizeProjectRecord(input: unknown): Project | null {
  if (!input || typeof input !== 'object') return null;
  const project = input as Partial<Project>;
  const title = asOptionalString(project.title);
  const id = asOptionalString(project.id);

  if (!title || !id) return null;

  return {
    id,
    title,
    description: asOptionalString(project.description),
    tag: asOptionalString(project.tag),
    version: asOptionalString(project.version) || DEFAULT_PROJECT_VERSION,
    referenceUrl: sanitizeReferenceUrl(project.referenceUrl),
    isFeatured: asBoolean(project.isFeatured),
  };
}

export function sanitizeScenarioRecord(input: unknown): Scenario | null {
  if (!input || typeof input !== 'object') return null;
  const scenario = input as Partial<Scenario>;
  const projectId = asOptionalString(scenario.projectId);
  const title = asOptionalString(scenario.title);
  const id = asOptionalString(scenario.id);

  if (!projectId || !title || !id) return null;

  return {
    id,
    projectId,
    title,
    description: asOptionalString(scenario.description),
    tag: asOptionalString(scenario.tag),
    version: asOptionalString(scenario.version) || DEFAULT_SCENARIO_VERSION,
    referenceUrl: sanitizeReferenceUrl(scenario.referenceUrl),
    isFeatured: asBoolean(scenario.isFeatured),
  };
}

export function sanitizeRequestRecord(input: unknown): Request | null {
  if (!input || typeof input !== 'object') return null;
  const request = input as Partial<Request>;
  const scenarioId = asOptionalString(request.scenarioId);
  const title = asOptionalString(request.title);
  const id = asOptionalString(request.id);

  if (!scenarioId || !title || !id) return null;

  return {
    id,
    scenarioId,
    requestOrder: typeof request.requestOrder === 'number' ? request.requestOrder : undefined,
    title,
    description: asOptionalString(request.description),
    timeoutMs: sanitizeTimeoutMs(request.timeoutMs),
    method: request.method ?? 'GET',
    url: sanitizeRequestUrl(request.url),
    headers: Array.isArray(request.headers) ? request.headers.map(sanitizeHeader).filter((entry): entry is Header => Boolean(entry)) : [],
    params: Array.isArray(request.params) ? request.params.map(sanitizeParam).filter((entry): entry is QueryParam => Boolean(entry)) : [],
    body: typeof request.body === 'string' ? request.body : '',
    sensitiveBodyPaths: sanitizeStringArray(request.sensitiveBodyPaths),
    sensitiveUrlParamIds: sanitizeStringArray(request.sensitiveUrlParamIds),
    notes: typeof request.notes === 'string' ? request.notes : '',
    isDraft: asBoolean(request.isDraft),
    lastStatusCode: typeof request.lastStatusCode === 'number' ? request.lastStatusCode : undefined,
    lastStatusText: asOptionalString(request.lastStatusText),
  };
}

export function sanitizeProjectRecords(input: unknown): Project[] {
  if (!Array.isArray(input)) return [];
  return input.map(sanitizeProjectRecord).filter((entry): entry is Project => Boolean(entry));
}

export function sanitizeScenarioRecords(input: unknown): Scenario[] {
  if (!Array.isArray(input)) return [];
  return input.map(sanitizeScenarioRecord).filter((entry): entry is Scenario => Boolean(entry));
}

export function sanitizeRequestRecords(input: unknown): Request[] {
  if (!Array.isArray(input)) return [];
  return input.map(sanitizeRequestRecord).filter((entry): entry is Request => Boolean(entry));
}
