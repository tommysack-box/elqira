import type {
  AppSettings,
  Header,
  QueryParam,
  Request,
  Response,
  Scenario,
  ScenarioExecutionLink,
} from '../../types';
import { executeRequest } from '../../services/httpService';
import { syncUrlWithParams } from './requestSensitive';

export type ScenarioExecutionStepStatus = 'queued' | 'running' | 'success' | 'warning' | 'failed' | 'skipped';

export interface ScenarioExecutionAppliedBinding {
  bindingId: string;
  sourceRequestId: string;
  sourceLabel: string;
  targetLabel: string;
  valuePreview: string;
}

export interface ScenarioExecutionStepResult {
  requestId: string;
  requestTitle: string;
  method: string;
  url: string;
  status: ScenarioExecutionStepStatus;
  response?: Response;
  statusCode?: number;
  statusText?: string;
  durationMs?: number;
  errorMessage?: string;
  appliedBindings: ScenarioExecutionAppliedBinding[];
}

export interface ScenarioExecutionReport {
  scenario: Pick<Scenario, 'id' | 'title' | 'description' | 'tag' | 'version'>;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  result: 'success' | 'warning' | 'failed';
  steps: ScenarioExecutionStepResult[];
}

interface ExecuteScenarioOptions {
  scenario: Pick<Scenario, 'id' | 'title' | 'description' | 'tag' | 'version'>;
  requests: Request[];
  scenarioLinks: ScenarioExecutionLink[];
  settings: AppSettings;
  onStepUpdate?: (steps: ScenarioExecutionStepResult[]) => void;
  onRequestCompleted?: (requestId: string, response: Response, requestSnapshot: Request) => void;
}

type RuntimeVariable = {
  value: string;
  sourceRequestId: string;
  sourceLabel: string;
};

type RuntimeVariables = Map<string, RuntimeVariable>;
type RuntimeResponses = Map<string, Response>;

const VARIABLE_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g;

function cloneHeaders(headers: Header[]): Header[] {
  return headers.map((header) => ({ ...header }));
}

function cloneParams(params: QueryParam[] | undefined): QueryParam[] {
  return (params ?? []).map((param) => ({ ...param }));
}

function cloneResponse(response: Response): Response {
  return {
    ...response,
    headers: { ...(response.headers ?? {}) },
  };
}

function cloneStep(step: ScenarioExecutionStepResult): ScenarioExecutionStepResult {
  return {
    ...step,
    response: step.response ? cloneResponse(step.response) : undefined,
    appliedBindings: [...step.appliedBindings],
  };
}

function getStepStatusFromHttpCode(statusCode: number): ScenarioExecutionStepStatus {
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 300 && statusCode < 400) return 'warning';
  return 'failed';
}

function getScenarioReportResult(steps: ScenarioExecutionStepResult[]): ScenarioExecutionReport['result'] {
  if (steps.some((step) => step.status === 'failed')) return 'failed';
  if (steps.some((step) => step.status === 'warning')) return 'warning';
  return 'success';
}

function decodeJsonPointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function parseBodySelectorSegments(selector: string): string[] {
  if (selector.startsWith('/')) {
    return selector
      .split('/')
      .slice(1)
      .map(decodeJsonPointerToken);
  }

  return selector
    .split('.')
    .flatMap((segment) => segment.split(/\[(\d+)\]/).filter(Boolean))
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractBodyValue(body: unknown, selector: string): unknown {
  const segments = parseBodySelectorSegments(selector);
  let cursor = body;

  for (const segment of segments) {
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
        return undefined;
      }
      cursor = cursor[index];
      continue;
    }

    if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
}

function setBodyValue(body: unknown, selector: string, nextValue: string): unknown {
  const segments = parseBodySelectorSegments(selector);
  if (segments.length === 0) {
    throw new Error(`Invalid body field selector "${selector}"`);
  }

  const root = body ?? (/^\d+$/.test(segments[0] ?? '') ? [] : {});
  let cursor = root as unknown;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    const nextSegment = segments[index + 1];
    const shouldCreateArray = /^\d+$/.test(nextSegment ?? '');

    if (Array.isArray(cursor)) {
      const arrayIndex = Number(segment);
      if (!Number.isInteger(arrayIndex) || arrayIndex < 0) {
        throw new Error(`Invalid array index "${segment}" in body field selector "${selector}"`);
      }

      if (isLast) {
        cursor[arrayIndex] = nextValue;
        return root;
      }

      if (cursor[arrayIndex] === undefined || cursor[arrayIndex] === null || typeof cursor[arrayIndex] !== 'object') {
        cursor[arrayIndex] = shouldCreateArray ? [] : {};
      }

      cursor = cursor[arrayIndex];
      continue;
    }

    if (!cursor || typeof cursor !== 'object') {
      throw new Error(`Cannot set body field selector "${selector}" on a non-object value`);
    }

    const record = cursor as Record<string, unknown>;
    if (isLast) {
      record[segment] = nextValue;
      return root;
    }

    if (record[segment] === undefined || record[segment] === null || typeof record[segment] !== 'object') {
      record[segment] = shouldCreateArray ? [] : {};
    }

    cursor = record[segment];
  }

  return root;
}

function parseResponseBody(response: Response): unknown {
  if (!response.body.trim()) return {};

  try {
    return JSON.parse(response.body) as unknown;
  } catch {
    throw new Error('Response body is not valid JSON for scenario association');
  }
}

function findHeaderValue(headers: Record<string, string>, selector: string): string | undefined {
  const normalized = selector.trim().toLowerCase();
  const key = Object.keys(headers).find((entry) => entry.toLowerCase() === normalized);
  return key ? headers[key] : undefined;
}

function serializeRuntimeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function resolveTemplate(
  raw: string,
  variables: RuntimeVariables,
  requestTitle: string,
  appliedBindings: ScenarioExecutionAppliedBinding[],
  targetLabel: string,
): string {
  return raw.replace(VARIABLE_PATTERN, (_match, variableName: string) => {
    const runtimeVariable = variables.get(variableName);
    if (!runtimeVariable) {
      throw new Error(`Missing required scenario variable "${variableName}" while resolving ${targetLabel} for "${requestTitle}"`);
    }

    appliedBindings.push({
      bindingId: `var-${variableName}-${targetLabel}`,
      sourceRequestId: runtimeVariable.sourceRequestId,
      sourceLabel: runtimeVariable.sourceLabel,
      targetLabel,
      valuePreview: '[hidden]',
    });

    return runtimeVariable.value;
  });
}

function applyResolvedValue(
  request: Request,
  link: ScenarioExecutionLink,
  resolvedValue: string,
): Request {
  if (!link.targetType) {
    throw new Error(`An association for "${request.title}" has no target type`);
  }

  if (!link.targetSelector?.trim()) {
    throw new Error(`An association for "${request.title}" has no target field`);
  }

  const nextRequest: Request = {
    ...request,
    headers: cloneHeaders(request.headers ?? []),
    params: cloneParams(request.params),
    body: request.body ?? '',
  };

  if (link.targetType === 'header') {
    const key = link.targetSelector.trim();
    const existingIndex = nextRequest.headers.findIndex((header) => header.key.trim().toLowerCase() === key.toLowerCase());

    if (existingIndex === -1) {
      nextRequest.headers.push({ key, value: resolvedValue, enabled: true });
    } else {
      nextRequest.headers[existingIndex] = {
        ...nextRequest.headers[existingIndex],
        key,
        value: resolvedValue,
        enabled: true,
      };
    }

    return nextRequest;
  }

  if (link.targetType === 'param') {
    const key = link.targetSelector.trim();
    const existingIndex = (nextRequest.params ?? []).findIndex((param) => param.key.trim() === key);

    if (existingIndex === -1) {
      nextRequest.params = [...(nextRequest.params ?? []), { key, value: resolvedValue, enabled: true }];
    } else {
      const nextParams = cloneParams(nextRequest.params);
      nextParams[existingIndex] = {
        ...nextParams[existingIndex],
        key,
        value: resolvedValue,
        enabled: true,
      };
      nextRequest.params = nextParams;
    }

    nextRequest.url = syncUrlWithParams(nextRequest.url, nextRequest.params ?? []);
    return nextRequest;
  }

  let parsedBody: unknown;
  if (nextRequest.body?.trim()) {
    try {
      parsedBody = JSON.parse(nextRequest.body) as unknown;
    } catch {
      throw new Error(`Association target "${link.targetSelector}" in "${request.title}" requires a valid JSON body`);
    }
  } else {
    parsedBody = undefined;
  }

  const updatedBody = setBodyValue(parsedBody, link.targetSelector, resolvedValue);
  nextRequest.body = JSON.stringify(updatedBody, null, 2);
  return nextRequest;
}

function resolveAssociationValue(
  link: ScenarioExecutionLink,
  sourceRequest: Request,
  sourceResponse: Response,
): string {
  if (!link.sourceType) {
    throw new Error(`Association "${sourceRequest.title}" -> target has no source type`);
  }

  if (!link.sourceSelector?.trim()) {
    throw new Error(`Association "${sourceRequest.title}" -> target has no source field`);
  }

  if (link.sourceType === 'response-header') {
    const headerValue = findHeaderValue(sourceResponse.headers ?? {}, link.sourceSelector);
    if (!headerValue) {
      throw new Error(`Unable to resolve response header "${link.sourceSelector}" from "${sourceRequest.title}"`);
    }
    return headerValue;
  }

  const parsedBody = parseResponseBody(sourceResponse);
  const extracted = extractBodyValue(parsedBody, link.sourceSelector);
  if (extracted === undefined || extracted === null) {
    throw new Error(`Unable to resolve response field "${link.sourceSelector}" from "${sourceRequest.title}"`);
  }

  return serializeRuntimeValue(extracted);
}

function resolveRequestAssociations(args: {
  request: Request;
  scenarioLinks: ScenarioExecutionLink[];
  variables: RuntimeVariables;
  responsesByRequestId: RuntimeResponses;
  requestById: Map<string, Request>;
  requestIndexById: Map<string, number>;
}): { request: Request; appliedBindings: ScenarioExecutionAppliedBinding[] } {
  const { request, scenarioLinks, variables, responsesByRequestId, requestById, requestIndexById } = args;
  const appliedBindings: ScenarioExecutionAppliedBinding[] = [];
  let nextRequest: Request = {
    ...request,
    headers: cloneHeaders(request.headers ?? []),
    params: cloneParams(request.params),
    body: request.body ?? '',
  };

  const targetLinks = scenarioLinks.filter((link) => link.targetRequestId === request.id);

  for (const link of targetLinks) {
    if (!link.sourceRequestId) {
      throw new Error(`An association targeting "${request.title}" has no source request`);
    }

    if (!link.targetRequestId) {
      throw new Error(`An association targeting "${request.title}" has no target request`);
    }

    if (!link.variableName?.trim()) {
      throw new Error(`An association targeting "${request.title}" has no variable name`);
    }

    if (!link.valueTemplate?.trim()) {
      throw new Error(`An association targeting "${request.title}" has no value template`);
    }

    const sourceRequest = requestById.get(link.sourceRequestId);
    if (!sourceRequest) {
      throw new Error(`Association source request "${link.sourceRequestId}" is missing`);
    }

    const sourceIndex = requestIndexById.get(link.sourceRequestId) ?? Number.MAX_SAFE_INTEGER;
    const targetIndex = requestIndexById.get(request.id) ?? Number.MAX_SAFE_INTEGER;
    if (sourceIndex >= targetIndex) {
      throw new Error(`Association "${sourceRequest.title}" -> "${request.title}" must point to a previous request`);
    }

    const sourceResponse = responsesByRequestId.get(link.sourceRequestId);
    if (!sourceResponse) {
      throw new Error(`Association "${sourceRequest.title}" -> "${request.title}" could not find a completed source response`);
    }

    const sourceValue = resolveAssociationValue(link, sourceRequest, sourceResponse);
    const variableName = link.variableName.trim();
    const sourceLabel = `${sourceRequest.title} ${link.sourceType === 'response-body' ? 'body' : 'header'} ${link.sourceSelector}`;

    variables.set(variableName, {
      value: sourceValue,
      sourceRequestId: sourceRequest.id,
      sourceLabel,
    });

    const targetLabel = `${request.title} ${link.targetType ?? 'target'} ${link.targetSelector ?? ''}`.trim();
    const resolvedValue = resolveTemplate(link.valueTemplate, variables, request.title, appliedBindings, targetLabel);
    nextRequest = applyResolvedValue(nextRequest, link, resolvedValue);
  }

  return {
    request: nextRequest,
    appliedBindings,
  };
}

function buildFailedResponse(error: unknown): Response {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const failedDuration = typeof (error as { duration?: unknown })?.duration === 'number'
    ? ((error as { duration: number }).duration)
    : 0;
  const timedOut = errorMessage.startsWith('Request timed out after ');
  const responseTooLarge = errorMessage.startsWith('Response body exceeds the safe limit of ');

  return {
    statusCode: 0,
    statusText: timedOut ? 'Request Timeout' : responseTooLarge ? 'Response Too Large' : 'Scenario Execution Error',
    duration: failedDuration,
    body: errorMessage,
    headers: {},
    timestamp: new Date().toISOString(),
  };
}

function createInitialStep(request: Request): ScenarioExecutionStepResult {
  return {
    requestId: request.id,
    requestTitle: request.title,
    method: request.method,
    url: request.url,
    status: 'queued',
    appliedBindings: [],
  };
}

export async function executeScenarioRequests({
  scenario,
  requests,
  scenarioLinks,
  settings,
  onStepUpdate,
  onRequestCompleted,
}: ExecuteScenarioOptions): Promise<ScenarioExecutionReport> {
  const startedAt = new Date();
  const orderedRequests = [...requests].sort((a, b) => (a.requestOrder ?? Number.MAX_SAFE_INTEGER) - (b.requestOrder ?? Number.MAX_SAFE_INTEGER));
  const requestById = new Map(orderedRequests.map((request) => [request.id, request]));
  const requestIndexById = new Map(orderedRequests.map((request, index) => [request.id, index]));
  const variables: RuntimeVariables = new Map();
  const responsesByRequestId: RuntimeResponses = new Map();
  const steps = orderedRequests.map(createInitialStep);

  onStepUpdate?.(steps.map(cloneStep));

  for (let index = 0; index < orderedRequests.length; index += 1) {
    const request = orderedRequests[index];
    let executedRequest = request;
    let appliedBindings: ScenarioExecutionAppliedBinding[] = [];
    steps[index] = { ...steps[index], status: 'running' };
    onStepUpdate?.(steps.map(cloneStep));

    try {
      const resolved = resolveRequestAssociations({
        request,
        scenarioLinks,
        variables,
        responsesByRequestId,
        requestById,
        requestIndexById,
      });
      const resolvedRequest = resolved.request;
      executedRequest = resolvedRequest;
      appliedBindings = resolved.appliedBindings;
      const timeoutSeconds = resolvedRequest.timeoutMs ?? settings.requestTimeoutMs;
      const response = await executeRequest(
        resolvedRequest,
        timeoutSeconds ? timeoutSeconds * 1000 : undefined,
      );

      responsesByRequestId.set(request.id, response);
      onRequestCompleted?.(request.id, response, resolvedRequest);

      steps[index] = {
        ...steps[index],
        status: getStepStatusFromHttpCode(response.statusCode),
        url: resolvedRequest.url,
        response: cloneResponse(response),
        statusCode: response.statusCode,
        statusText: response.statusText,
        durationMs: response.duration,
        appliedBindings,
      };
    } catch (error) {
      const failedResponse = buildFailedResponse(error);
      onRequestCompleted?.(request.id, failedResponse, executedRequest);

      steps[index] = {
        ...steps[index],
        status: 'failed',
        response: cloneResponse(failedResponse),
        errorMessage: failedResponse.body,
        statusCode: failedResponse.statusCode,
        statusText: failedResponse.statusText,
        durationMs: failedResponse.duration,
        appliedBindings,
      };

      for (let skippedIndex = index + 1; skippedIndex < steps.length; skippedIndex += 1) {
        steps[skippedIndex] = { ...steps[skippedIndex], status: 'skipped' };
      }

      onStepUpdate?.(steps.map(cloneStep));

      const finishedAt = new Date();
      return {
        scenario,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        totalDurationMs: finishedAt.getTime() - startedAt.getTime(),
        result: 'failed',
        steps,
      };
    }

    onStepUpdate?.(steps.map(cloneStep));
  }

  const finishedAt = new Date();
  return {
    scenario,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    totalDurationMs: finishedAt.getTime() - startedAt.getTime(),
    result: getScenarioReportResult(steps),
    steps,
  };
}
