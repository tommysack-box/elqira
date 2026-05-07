import type { AppSettings, Header, Project, QueryParam, Request, RequestVariableCapture, RequestVariableInput, Scenario, ScenarioExecutionLink } from '../types';

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
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

function sanitizeHttpMethod(value: unknown): Request['method'] {
  return typeof value === 'string' && HTTP_METHODS.has(value)
    ? value as Request['method']
    : 'GET';
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

function sanitizeRequestVariableCapture(input: unknown): RequestVariableCapture | null {
  if (!input || typeof input !== 'object') return null;
  const capture = input as Partial<RequestVariableCapture>;
  const id = asOptionalString(capture.id);

  if (!id) return null;

  const sourceType = capture.sourceType === 'response-header'
    ? 'response-header'
    : capture.sourceType === 'response-body'
      ? 'response-body'
      : undefined;

  return {
    id,
    sourceType,
    sourceSelector: asOptionalString(capture.sourceSelector),
    variableName: asOptionalString(capture.variableName),
    required: capture.required !== false,
  };
}

function sanitizeRequestVariableCaptures(value: unknown): RequestVariableCapture[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizeRequestVariableCapture)
    .filter((entry): entry is RequestVariableCapture => Boolean(entry));
}

function sanitizeRequestVariableInput(input: unknown): RequestVariableInput | null {
  if (!input || typeof input !== 'object') return null;
  const variableInput = input as Partial<RequestVariableInput>;
  const id = asOptionalString(variableInput.id);

  if (!id) return null;

  const targetType = variableInput.targetType === 'header' || variableInput.targetType === 'param' || variableInput.targetType === 'body'
    ? variableInput.targetType
    : undefined;

  return {
    id,
    targetType,
    targetSelector: asOptionalString(variableInput.targetSelector),
    valueTemplate: typeof variableInput.valueTemplate === 'string' ? variableInput.valueTemplate : '',
    required: variableInput.required !== false,
  };
}

function sanitizeRequestVariableInputs(value: unknown): RequestVariableInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizeRequestVariableInput)
    .filter((entry): entry is RequestVariableInput => Boolean(entry));
}

function sanitizeScenarioExecutionLink(input: unknown): ScenarioExecutionLink | null {
  if (!input || typeof input !== 'object') return null;
  const link = input as Partial<ScenarioExecutionLink>;
  const id = asOptionalString(link.id);

  if (!id) return null;

  return {
    id,
    sourceRequestId: asOptionalString(link.sourceRequestId),
    targetRequestId: asOptionalString(link.targetRequestId),
    sourceType: link.sourceType === 'response-body' || link.sourceType === 'response-header'
      ? link.sourceType
      : undefined,
    sourceSelector: asOptionalString(link.sourceSelector),
    variableName: asOptionalString(link.variableName),
    targetType: link.targetType === 'header' || link.targetType === 'param' || link.targetType === 'body'
      ? link.targetType
      : undefined,
    targetSelector: asOptionalString(link.targetSelector),
    valueTemplate: asOptionalString(link.valueTemplate),
    required: typeof link.required === 'boolean' ? link.required : true,
  };
}

function sanitizeScenarioExecutionLinks(value: unknown): ScenarioExecutionLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizeScenarioExecutionLink)
    .filter((entry): entry is ScenarioExecutionLink => Boolean(entry));
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
    icon: asOptionalString(project.icon),
    referenceUrl: sanitizeReferenceUrl(project.referenceUrl),
    isFeatured: asBoolean(project.isFeatured),
    isArchived: asBoolean(project.isArchived),
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
    isArchived: asBoolean(scenario.isArchived),
    executionLinks: sanitizeScenarioExecutionLinks(scenario.executionLinks),
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
    requestOrder: typeof request.requestOrder === 'number' && Number.isFinite(request.requestOrder)
      ? Math.trunc(request.requestOrder)
      : undefined,
    title,
    description: asOptionalString(request.description),
    timeoutMs: sanitizeTimeoutMs(request.timeoutMs),
    method: sanitizeHttpMethod(request.method),
    url: sanitizeRequestUrl(request.url),
    headers: Array.isArray(request.headers) ? request.headers.map(sanitizeHeader).filter((entry): entry is Header => Boolean(entry)) : [],
    params: Array.isArray(request.params) ? request.params.map(sanitizeParam).filter((entry): entry is QueryParam => Boolean(entry)) : [],
    body: typeof request.body === 'string' ? request.body : '',
    sensitiveBodyPaths: sanitizeStringArray(request.sensitiveBodyPaths),
    sensitiveUrlParamIds: sanitizeStringArray(request.sensitiveUrlParamIds),
    responseCaptures: sanitizeRequestVariableCaptures(request.responseCaptures),
    scenarioInputs: sanitizeRequestVariableInputs(request.scenarioInputs),
    notes: typeof request.notes === 'string' ? request.notes : '',
    isDraft: asBoolean(request.isDraft),
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
