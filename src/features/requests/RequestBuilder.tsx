// Request Builder — request editor al centro, contextual tools a destra, response inline sotto
import { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import { useApp } from '../../context/AppContext';
import { executeRequest } from '../../services/httpService';
import type { HttpMethod, Header, QueryParam, Request, Response, ScenarioExecutionLink } from '../../types';
import { explainResponse, type ExplainResponseResult } from './explainResponse';
import { debugResponse, type DebugResponseResult } from './debugResponse';
import { compareResponses, type CompareResponseResult } from './compareResponse';
import { buildScenarioHealthReport, type ScenarioHealthReportResult } from './scenarioHealthReport';
import {
  executeScenarioRequests,
  type ScenarioExecutionReport,
  type ScenarioExecutionStepResult,
} from './scenarioExecution';
import { JsonCodeBlock, getJsonLineCount, getJsonValidationIssues } from '../../components/JsonCodeBlock';
import type { JsonValidationIssue } from '../../components/JsonCodeBlock';
import { CardMenu, type CardMenuItem } from '../../components/CardMenu';
import {
  deriveSensitiveUrlParamIds,
  syncParamsWithUrl,
  syncUrlWithParams,
} from './requestSensitive';
import {
  buildScenarioReport,
  exportScenarioReport,
  type ScenarioReportResult,
} from './scenarioReport';
import { isSafeHttpUrl } from '../../services/security';

const ExplainResponsePanel = lazy(() =>
  import('./ExplainResponsePanel').then((module) => ({ default: module.ExplainResponsePanel }))
);
const DebugAssistantPanel = lazy(() =>
  import('./DebugAssistantPanel').then((module) => ({ default: module.DebugAssistantPanel }))
);
const CompareResponsePanel = lazy(() =>
  import('./CompareResponsePanel').then((module) => ({ default: module.CompareResponsePanel }))
);
const ScenarioHealthReportPanel = lazy(() =>
  import('./ScenarioHealthReportPanel').then((module) => ({ default: module.ScenarioHealthReportPanel }))
);
const ScenarioReportPanel = lazy(() =>
  import('./ScenarioReportPanel').then((module) => ({ default: module.ScenarioReportPanel }))
);
const ScenarioReportExportModal = lazy(() =>
  import('./ScenarioReportExportModal').then((module) => ({ default: module.ScenarioReportExportModal }))
);
const ScenarioExecutionPanel = lazy(() =>
  import('./ScenarioExecutionPanel').then((module) => ({ default: module.ScenarioExecutionPanel }))
);

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-[#e3dfff] text-[#100069]',
  POST: 'bg-[#d5e3fc] text-[#0d1c2e]',
  PUT: 'bg-[#89f5e7] text-[#00201d]',
  PATCH: 'bg-[#6bd8cb] text-[#005049]',
  DELETE: 'bg-[#ffdad6] text-[#93000a]',
  HEAD: 'bg-[#e0e3e5] text-[#464554]',
  OPTIONS: 'bg-[#e0e3e5] text-[#464554]',
};

type Tab = 'body' | 'headers' | 'params' | 'sensitive-data' | 'notes';
type RespTab = 'preview' | 'raw' | 'headers';
type ContextualTool = 'none' | 'scenario-execution' | 'explain' | 'debug' | 'compare' | 'health' | 'scenario-report';
type ScenarioExecutionState = {
  key: string;
  steps: ScenarioExecutionStepResult[];
  report: ScenarioExecutionReport | null;
  running: boolean;
};
const DEFAULT_JSON_HEADER: Header = { key: 'Content-Type', value: 'application/json', enabled: true };

function hasContentTypeHeader(headers: Header[]): boolean {
  return headers.some((header) => header.key.trim().toLowerCase() === 'content-type');
}

function ensureJsonContentTypeHeader(headers: Header[]): Header[] {
  return hasContentTypeHeader(headers) ? headers : [...headers, DEFAULT_JSON_HEADER];
}

function prettifyJson(raw: string): string {
  return JSON.stringify(JSON.parse(raw), null, 2);
}

function minifyJson(raw: string): string {
  return JSON.stringify(JSON.parse(raw));
}

function quoteShellArgument(value: string): string {
  if (value.length === 0) return "''";
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildCurlCommand(args: {
  method: HttpMethod;
  url: string;
  headers: Header[];
  body: string;
  timeoutSeconds?: number;
}): string {
  const trimmedUrl = args.url.trim();
  if (!trimmedUrl) {
    return 'curl <request-url>';
  }

  const lines = ['curl \\', `  --request ${args.method} \\`, `  --url ${quoteShellArgument(trimmedUrl)}`];
  const enabledHeaders = args.headers.filter((header) => header.enabled && header.key.trim());

  for (const header of enabledHeaders) {
    lines.push(`  --header ${quoteShellArgument(`${header.key.trim()}: ${header.value}`)} \\`);
  }

  if (args.timeoutSeconds && Number.isFinite(args.timeoutSeconds) && args.timeoutSeconds > 0) {
    lines.push(`  --max-time ${Math.trunc(args.timeoutSeconds)} \\`);
  }

  if (['POST', 'PUT', 'PATCH'].includes(args.method) && args.body) {
    lines.push(`  --data-raw ${quoteShellArgument(args.body)}`);
  }

  if (lines[lines.length - 1].endsWith(' \\')) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, -2);
  }

  return lines.join('\n');
}

type JsonLeaf = {
  pointer: string;
  label: string;
  structuralPointer: string;
};

function encodeJsonPointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function formatJsonPath(segments: string[]): string {
  return segments.reduce((path, segment) => {
    if (/^\d+$/.test(segment)) return `${path}[${segment}]`;
    return path ? `${path}.${segment}` : segment;
  }, '');
}

function collectJsonLeafNodes(
  value: unknown,
  segments: string[] = [],
  structuralSegments: string[] = []
): JsonLeaf[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectJsonLeafNodes(item, [...segments, String(index)], [...structuralSegments, `a:${index}`])
    );
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child], index) =>
      collectJsonLeafNodes(child, [...segments, key], [...structuralSegments, `o:${index}`])
    );
  }

  if (segments.length === 0) return [];

  return [{
    pointer: `/${segments.map(encodeJsonPointerToken).join('/')}`,
    label: formatJsonPath(segments),
    structuralPointer: `/${structuralSegments.join('/')}`,
  }];
}

function parseJsonLeafNodes(raw: string): JsonLeaf[] | null {
  if (!raw.trim()) return [];

  try {
    return collectJsonLeafNodes(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function getStatusColor(code: number) {
  if (code === 0) return { badge: 'bg-[#ffdad6] text-[#93000a]', dot: 'bg-[#ba1a1a]' };
  if (code >= 500) return { badge: 'bg-[#ffdad6] text-[#ba1a1a]', dot: 'bg-[#ba1a1a]' };
  if (code >= 400) return { badge: 'bg-[#d5e3fc] text-[#3a485b]', dot: 'bg-[#515f74]' };
  if (code >= 300) return { badge: 'bg-[#e3dfff] text-[#372abf]', dot: 'bg-[#2a14b4]' };
  if (code >= 200) return { badge: 'bg-[#89f5e7] text-[#00201d]', dot: 'bg-green-500' };
  return { badge: 'bg-[#e0e3e5] text-[#464554]', dot: 'bg-[#777586]' };
}

function PanelChunkFallback({ minHeight = 'min-h-[520px]' }: { minHeight?: string }) {
  return (
    <section className={`bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10 ${minHeight}`} aria-hidden="true">
      <div className="space-y-3 animate-pulse">
        <div className="h-16 rounded-lg bg-[#f2f4f6]" />
        <div className="h-24 rounded-lg bg-[#f2f4f6]" />
        <div className="h-24 rounded-lg bg-[#f2f4f6]" />
        <div className="h-24 rounded-lg bg-[#f2f4f6]" />
      </div>
    </section>
  );
}

function SidebarToolCard({
  title,
  description,
  icon,
  tone,
  active,
  disabled,
  menuItems,
}: {
  title: string;
  description: string;
  icon: string;
  tone: 'indigo' | 'danger';
  active: boolean;
  disabled: boolean;
  menuItems: CardMenuItem[];
}) {
  const accentClass = tone === 'danger' ? 'text-[#ba1a1a]' : 'text-[#2a14b4]';
  const triggerClass = active ? (tone === 'danger' ? 'bg-[#ffdad6]/70 text-[#ba1a1a]' : 'bg-[#e3dfff]/50 text-[#2a14b4]') : '';

  return (
    <div className={`rounded-xl border border-[#c7c4d7]/10 p-3 ${active ? 'bg-white shadow-sm' : 'bg-transparent'} ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex items-center gap-3 ${disabled ? 'text-[#777586]' : accentClass}`}>
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          <span className="font-mono text-xs font-bold uppercase tracking-wider">{title}</span>
        </div>
        <CardMenu items={menuItems} className={triggerClass} />
      </div>
      <p className="ml-8 mt-2 font-mono text-[11px] leading-relaxed text-[#777586]">
        {description}
      </p>
    </div>
  );
}

function createAssociationId(): string {
  return `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createScenarioExecutionSteps(requests: Request[]): ScenarioExecutionStepResult[] {
  return [...requests]
    .sort((a, b) => {
      const aOrder = a.requestOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.requestOrder ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    })
    .map((request) => ({
      requestId: request.id,
      requestTitle: request.title,
      method: request.method,
      url: request.url,
      status: 'queued',
      appliedBindings: [],
    }));
}

function cloneRuntimeHeaders(headers: Header[]): Header[] {
  return headers.map((header) => ({ ...header }));
}

function cloneRuntimeParams(params: QueryParam[] | undefined): QueryParam[] {
  return (params ?? []).map((param) => ({ ...param }));
}

function cloneRuntimeRequest(request: Request): Request {
  return {
    ...request,
    headers: cloneRuntimeHeaders(request.headers ?? []),
    params: cloneRuntimeParams(request.params),
    sensitiveBodyPaths: [...(request.sensitiveBodyPaths ?? [])],
    sensitiveUrlParamIds: [...(request.sensitiveUrlParamIds ?? [])],
    responseCaptures: [...(request.responseCaptures ?? [])],
    scenarioInputs: [...(request.scenarioInputs ?? [])],
  };
}

type EditableRequestState = Pick<
  Request,
  'method' | 'url' | 'headers' | 'params' | 'body' | 'sensitiveBodyPaths' | 'sensitiveUrlParamIds' | 'notes'
>;

function normalizeEditableRequestState(request: Request): EditableRequestState {
  const headers = ensureJsonContentTypeHeader(cloneRuntimeHeaders(request.headers ?? []));
  const params = syncParamsWithUrl(request.url ?? '', cloneRuntimeParams(request.params));
  const sensitiveUrlParamIds = deriveSensitiveUrlParamIds(params);

  return {
    method: request.method,
    url: request.url ?? '',
    headers,
    params,
    body: request.body ?? '',
    sensitiveBodyPaths: [...(request.sensitiveBodyPaths ?? [])],
    sensitiveUrlParamIds,
    notes: request.notes ?? '',
  };
}

function areEditableRequestStatesEqual(left: EditableRequestState, right: EditableRequestState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

interface RequestBuilderProps {
  onToolExpansionChange?: (expanded: boolean) => void;
}

export function RequestBuilder({ onToolExpansionChange }: RequestBuilderProps) {
  const {
    t,
    settings,
    currentRequest,
    currentScenario,
    updateScenario,
    updateRequest,
    saveCurrentRequest,
    setCurrentResponse,
    currentResponse,
    setResponseForRequest,
    getScenarioResponses,
    requests,
  } = useApp();

  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<Header[]>([]);
  const [params, setParams] = useState<QueryParam[]>([]);
  const [body, setBody] = useState('');
  const [sensitiveBodyPaths, setSensitiveBodyPaths] = useState<string[]>([]);
  const [sensitiveUrlParamIds, setSensitiveUrlParamIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState<Tab>('body');
  const [respTab, setRespTab] = useState<RespTab>('preview');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showMethodMenu, setShowMethodMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTool, setActiveTool] = useState<ContextualTool>('none');
  const [explainInsight, setExplainInsight] = useState<ExplainResponseResult | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [debugInsight, setDebugInsight] = useState<DebugResponseResult | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [baselineResponse, setBaselineResponse] = useState<Response | null>(null);
  const [compareInsight, setCompareInsight] = useState<CompareResponseResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [scenarioReport, setScenarioReport] = useState<ScenarioReportResult | null>(null);
  const [scenarioReportLoading, setScenarioReportLoading] = useState(false);
  const [showScenarioReportExportModal, setShowScenarioReportExportModal] = useState(false);
  const [healthReport, setHealthReport] = useState<ScenarioHealthReportResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [scenarioExecutionState, setScenarioExecutionState] = useState<ScenarioExecutionState>({
    key: '',
    steps: [],
    report: null,
    running: false,
  });
  const [bodyValidationIssues, setBodyValidationIssues] = useState<JsonValidationIssue[]>([]);
  const [bodySensitiveResetNotice, setBodySensitiveResetNotice] = useState(false);
  const [bodyScrollTop, setBodyScrollTop] = useState(0);
  const [runtimeRequests, setRuntimeRequests] = useState<Map<string, Request>>(new Map());
  const initializedRequestIdRef = useRef<string | null>(null);
  const previousRequestRef = useRef<Request | null>(null);
  const previousBodyLeafNodesRef = useRef<JsonLeaf[]>([]);
  const requestTopology = useMemo(
    () => requests.map((request) => `${request.id}:${request.requestOrder ?? ''}`).join('|'),
    [requests]
  );
  const scenarioExecutionKey = useMemo(
    () => `${currentScenario?.id ?? 'no-scenario'}:${requestTopology}`,
    [currentScenario?.id, requestTopology]
  );
  const scenarioExecutionDefaultSteps = useMemo(
    () => createScenarioExecutionSteps(requests),
    [requests]
  );
  const scenarioExecutionSteps = scenarioExecutionState.key === scenarioExecutionKey
    ? scenarioExecutionState.steps
    : scenarioExecutionDefaultSteps;
  const scenarioExecutionReport = scenarioExecutionState.key === scenarioExecutionKey
    ? scenarioExecutionState.report
    : null;
  const scenarioExecutionRunning = scenarioExecutionState.key === scenarioExecutionKey
    ? scenarioExecutionState.running
    : false;

  const getRuntimeRequest = useCallback((request: Request): Request => {
    return runtimeRequests.get(request.id) ?? request;
  }, [runtimeRequests]);

  const updateRuntimeRequest = useCallback((requestId: string, updater: (current: Request) => Request) => {
    setRuntimeRequests((prev) => {
      const requestFromList = requests.find((entry) => entry.id === requestId);
      const current = prev.get(requestId) ?? requestFromList;
      if (!current) return prev;

      const nextRequest = cloneRuntimeRequest(updater(cloneRuntimeRequest(current)));
      const next = new Map(prev);
      next.set(requestId, nextRequest);
      return next;
    });
  }, [requests]);

  useEffect(() => {
    if (!currentRequest) {
      initializedRequestIdRef.current = null;
      previousRequestRef.current = null;
      return;
    }

    const previousRequest = previousRequestRef.current;
    let migratedRuntimeRequest: Request | null = null;
    if (
      previousRequest?.isDraft
      && previousRequest.id !== currentRequest.id
      && previousRequest.scenarioId === currentRequest.scenarioId
      && previousRequest.title === currentRequest.title
      && !runtimeRequests.has(currentRequest.id)
    ) {
      const draftRuntimeRequest = runtimeRequests.get(previousRequest.id);
      if (draftRuntimeRequest) {
        migratedRuntimeRequest = {
          ...cloneRuntimeRequest(draftRuntimeRequest),
          id: currentRequest.id,
          isDraft: currentRequest.isDraft,
        };
        setRuntimeRequests((prev) => {
          const next = new Map(prev);
          next.set(currentRequest.id, migratedRuntimeRequest!);
          next.delete(previousRequest.id);
          return next;
        });
      }
    }

    if (initializedRequestIdRef.current === currentRequest.id) {
      previousRequestRef.current = currentRequest;
      return;
    }

    initializedRequestIdRef.current = currentRequest.id;
    const runtimeRequest = migratedRuntimeRequest ?? getRuntimeRequest(currentRequest);
    const nextHeaders = ensureJsonContentTypeHeader(runtimeRequest.headers ?? []);
    const nextParams = syncParamsWithUrl(runtimeRequest.url ?? '', runtimeRequest.params ?? []);
    const nextSensitiveUrlParamIds = deriveSensitiveUrlParamIds(nextParams);

    setMethod(runtimeRequest.method);
    setUrl(runtimeRequest.url ?? '');
    setHeaders(nextHeaders);
    setParams(nextParams);
    setBody(runtimeRequest.body ?? '');
    setSensitiveBodyPaths(runtimeRequest.sensitiveBodyPaths ?? []);
    setSensitiveUrlParamIds(nextSensitiveUrlParamIds);
    setNotes(runtimeRequest.notes ?? '');
    setError('');
    setTab('body');
    setActiveTool('none');
    setExplainInsight(null);
    setExplainLoading(false);
    setDebugInsight(null);
    setDebugLoading(false);
    setBaselineResponse(null);
    setCompareInsight(null);
    setCompareLoading(false);
    setScenarioReport(null);
    setScenarioReportLoading(false);
    setHealthReport(null);
    setHealthLoading(false);
    setScenarioExecutionState({
      key: scenarioExecutionKey,
      steps: scenarioExecutionDefaultSteps,
      report: null,
      running: false,
    });
    setBodyValidationIssues([]);
    setBodySensitiveResetNotice(false);
    setBodyScrollTop(0);
    previousBodyLeafNodesRef.current = parseJsonLeafNodes(runtimeRequest.body ?? '') ?? [];

    previousRequestRef.current = currentRequest;
  }, [currentRequest, getRuntimeRequest, requests, runtimeRequests, scenarioExecutionDefaultSteps, scenarioExecutionKey]);

  const handleAddHeader = () => {
    const updated = [...headers, { key: '', value: '', enabled: true, sensitive: false }];
    setHeaders(updated);
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, headers: updated }));
    }
  };

  const handleHeaderChange = (index: number, field: keyof Header, value: string | boolean) => {
    const updated = headers.map((h, i) => (i === index ? { ...h, [field]: value } : h));
    setHeaders(updated);
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, headers: updated }));
    }
  };

  const handleRemoveHeader = (index: number) => {
    const updated = headers.filter((_, i) => i !== index);
    setHeaders(updated);
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, headers: updated }));
    }
  };

  const handleAddParam = () => {
    const updated = [...params, { key: '', value: '', enabled: true, sensitive: false }];
    setParams(updated);
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({
        ...request,
        params: updated,
        url: syncUrlWithParams(request.url, updated),
      }));
    }
  };

  const handleParamChange = (index: number, field: keyof QueryParam, value: string | boolean) => {
    const updated = params.map((p, i) => {
      if (i !== index) return p;

      const nextParam = { ...p, [field]: value };
      if (field === 'sensitive' && value === true) {
        nextParam.value = '';
      }

      return nextParam;
    });
    const syncedUrl = syncUrlWithParams(url, updated);
    const syncedParams = syncParamsWithUrl(syncedUrl, updated);
    const nextSensitiveUrlParamIds = deriveSensitiveUrlParamIds(syncedParams);

    setParams(syncedParams);
    setSensitiveUrlParamIds(nextSensitiveUrlParamIds);
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({
        ...request,
        params: syncedParams,
        url: syncedUrl,
        sensitiveUrlParamIds: nextSensitiveUrlParamIds,
      }));
    }
    if (syncedUrl !== url) {
      setUrl(syncedUrl);
      return;
    }
  };

  const handleRemoveParam = (index: number) => {
    const updated = params.filter((_, i) => i !== index);
    const syncedUrl = syncUrlWithParams(url, updated);
    const syncedParams = syncParamsWithUrl(syncedUrl, updated);
    const nextSensitiveUrlParamIds = deriveSensitiveUrlParamIds(syncedParams);
    setParams(syncedParams);
    setSensitiveUrlParamIds(nextSensitiveUrlParamIds);
    setUrl(syncedUrl);
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({
        ...request,
        params: syncedParams,
        url: syncedUrl,
        sensitiveUrlParamIds: nextSensitiveUrlParamIds,
      }));
    }
  };

  const handleUrlChange = (value: string) => {
    const syncedParams = syncParamsWithUrl(value, params);
    setUrl(value);
    setError('');
    setParams(syncedParams);
    setSensitiveUrlParamIds(deriveSensitiveUrlParamIds(syncedParams));
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({
        ...request,
        url: value,
        params: syncedParams,
        sensitiveUrlParamIds: deriveSensitiveUrlParamIds(syncedParams),
      }));
    }
  };

  const handleUrlBlur = () => {
    const syncedParams = syncParamsWithUrl(url, params);
    const nextSensitiveUrlParamIds = deriveSensitiveUrlParamIds(syncedParams);
    setParams(syncedParams);
    setSensitiveUrlParamIds(nextSensitiveUrlParamIds);
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({
        ...request,
        url,
        params: syncedParams,
        sensitiveUrlParamIds: nextSensitiveUrlParamIds,
      }));
    }
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    if (bodySensitiveResetNotice) {
      setBodySensitiveResetNotice(false);
    }
    if (bodyValidationIssues.length > 0) {
      setBodyValidationIssues([]);
    }
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, body: value }));
    }
  };

  const handleBodyBlur = () => {
    setBodyValidationIssues(getJsonValidationIssues(body));
  };

  const handleSensitiveBodyPathToggle = (pointer: string, checked: boolean) => {
    if (bodySensitiveResetNotice) {
      setBodySensitiveResetNotice(false);
    }
    const updated = checked
      ? [...sensitiveBodyPaths, pointer]
      : sensitiveBodyPaths.filter((item) => item !== pointer);
    setSensitiveBodyPaths(updated);
    if (currentRequest) {
      updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, sensitiveBodyPaths: updated }));
    }
  };

  const handlePrettifyBody = () => {
    try {
      const prettified = prettifyJson(body);
      setBody(prettified);
      setBodyValidationIssues([]);
      if (currentRequest) {
        updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, body: prettified }));
      }
    } catch {
      setBodyValidationIssues(getJsonValidationIssues(body));
    }
  };

  const handleMinifyBody = () => {
    try {
      const minified = minifyJson(body);
      setBody(minified);
      setBodyValidationIssues([]);
      if (currentRequest) {
        updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, body: minified }));
      }
    } catch {
      setBodyValidationIssues(getJsonValidationIssues(body));
    }
  };

  const handleSend = async () => {
    if (!currentRequest) return;
    if (!url.trim()) { setError('URL is required'); return; }
    if (!isSafeHttpUrl(url.trim())) {
      setError('Only http:// and https:// URLs are allowed.');
      return;
    }
    setError('');
    setSending(true);
    let req = { ...currentRequest, method, url: url.trim(), headers, params, body, notes };
    try {
      const shouldAttachJsonHeader = body.trim().length > 0 && ['POST', 'PUT', 'PATCH'].includes(method);
      const requestHeaders = shouldAttachJsonHeader ? ensureJsonContentTypeHeader(headers) : headers;

      if (requestHeaders !== headers) {
        setHeaders(requestHeaders);
        if (currentRequest) {
          updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, headers: requestHeaders }));
        }
      }

      const resolvedTimeoutMs = (currentRequest.timeoutMs ?? settings.requestTimeoutMs);
      req = { ...currentRequest, method, url: url.trim(), headers: requestHeaders, params, body, notes };

      const response = await executeRequest(req, resolvedTimeoutMs ? resolvedTimeoutMs * 1000 : undefined);
      setCurrentResponse(response);
      setResponseForRequest(currentRequest.id, response, req);
      if (activeTool === 'explain') {
        setExplainInsight(null);
        void handleExplainResponse(response);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      const failedDuration = typeof (e as { duration?: unknown })?.duration === 'number'
        ? ((e as { duration: number }).duration)
        : 0;
      const timedOut = errorMessage.startsWith('Request timed out after ');
      const responseTooLarge = errorMessage.startsWith('Response body exceeds the safe limit of ');
      const failedResponse = {
        statusCode: 0,
        statusText: timedOut ? 'Request Timeout' : responseTooLarge ? 'Response Too Large' : 'Network Error',
        duration: failedDuration,
        body: errorMessage,
        headers: {},
        timestamp: new Date().toISOString(),
      };
      setCurrentResponse(failedResponse);
      if (currentRequest) {
        setResponseForRequest(currentRequest.id, failedResponse, req);
      }
    } finally {
      setSending(false);
    }
  };

  const handleCopy = useCallback(() => {
    if (!currentResponse) return;
    navigator.clipboard.writeText(currentResponse.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [currentResponse]);

  const scenarioResponses = useMemo(() => getScenarioResponses(), [getScenarioResponses]);
  const resolvedRequests = useMemo(
    () => requests.map((request) => getRuntimeRequest(request)),
    [getRuntimeRequest, requests]
  );
  const parsedBodyLeafNodes = useMemo(() => parseJsonLeafNodes(body), [body]);
  const bodyLeafNodes = parsedBodyLeafNodes ?? [];
  const requestHeadersForCurl = useMemo(() => {
    const shouldAttachJsonHeader = body.trim().length > 0 && ['POST', 'PUT', 'PATCH'].includes(method);
    return shouldAttachJsonHeader ? ensureJsonContentTypeHeader(headers) : headers;
  }, [body, headers, method]);
  const curlCommand = useMemo(() => buildCurlCommand({
    method,
    url,
    headers: requestHeadersForCurl,
    body,
    timeoutSeconds: currentRequest?.timeoutMs ?? settings.requestTimeoutMs,
  }), [body, currentRequest?.timeoutMs, method, requestHeadersForCurl, settings.requestTimeoutMs, url]);
  const editableRequestState = useMemo<EditableRequestState>(() => ({
    method,
    url,
    headers: cloneRuntimeHeaders(headers),
    params: cloneRuntimeParams(params),
    body,
    sensitiveBodyPaths: [...sensitiveBodyPaths],
    sensitiveUrlParamIds: [...sensitiveUrlParamIds],
    notes,
  }), [body, headers, method, notes, params, sensitiveBodyPaths, sensitiveUrlParamIds, url]);
  const persistedEditableState = useMemo(
    () => (currentRequest ? normalizeEditableRequestState(currentRequest) : null),
    [currentRequest]
  );
  const hasUnsavedRequestChanges = useMemo(
    () => Boolean(currentRequest && persistedEditableState && !areEditableRequestStatesEqual(editableRequestState, persistedEditableState)),
    [currentRequest, editableRequestState, persistedEditableState]
  );

  const handleSaveRequest = useCallback(() => {
    if (!currentRequest) return;

    const nextRequest: Request = {
      ...getRuntimeRequest(currentRequest),
      ...editableRequestState,
    };

    if (currentRequest.isDraft) {
      saveCurrentRequest(nextRequest);
      return;
    }

    const { id: _id, ...persistedRequest } = nextRequest;
    void _id;
    updateRequest(currentRequest.id, persistedRequest);
    setRuntimeRequests((prev) => {
      if (!prev.has(currentRequest.id)) return prev;
      const next = new Map(prev);
      next.delete(currentRequest.id);
      return next;
    });
  }, [currentRequest, editableRequestState, getRuntimeRequest, saveCurrentRequest, updateRequest]);

  useEffect(() => {
    if (parsedBodyLeafNodes === null) {
      return;
    }

    const previousBodyLeafNodes = previousBodyLeafNodesRef.current;
    const nextLeafByPointer = new Map(parsedBodyLeafNodes.map((leaf) => [leaf.pointer, leaf]));
    const nextPointerByStructuralPointer = new Map(
      parsedBodyLeafNodes.map((leaf) => [leaf.structuralPointer, leaf.pointer])
    );

    const reconciled = Array.from(new Set(
      sensitiveBodyPaths.flatMap((pointer) => {
        if (nextLeafByPointer.has(pointer)) return [pointer];

        const previousLeaf = previousBodyLeafNodes.find((leaf) => leaf.pointer === pointer);
        if (!previousLeaf) return [];

        const remappedPointer = nextPointerByStructuralPointer.get(previousLeaf.structuralPointer);
        return remappedPointer ? [remappedPointer] : [];
      })
    ));

    previousBodyLeafNodesRef.current = parsedBodyLeafNodes;
    const removedSensitiveCount = sensitiveBodyPaths.length - reconciled.length;

    const unchanged = reconciled.length === sensitiveBodyPaths.length
      && reconciled.every((pointer, index) => pointer === sensitiveBodyPaths[index]);

    if (removedSensitiveCount > 0) {
      setBodySensitiveResetNotice(true);
    }

    if (!unchanged) {
      setSensitiveBodyPaths(reconciled);
      if (currentRequest) {
        updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, sensitiveBodyPaths: reconciled }));
      }
    }
  }, [currentRequest, parsedBodyLeafNodes, sensitiveBodyPaths, updateRuntimeRequest]);

  const handleExplainResponse = async (responseOverride?: typeof currentResponse) => {
    const responseToExplain = responseOverride ?? currentResponse;
    if (!currentRequest || !responseToExplain) return;

    setActiveTool('explain');
    setExplainLoading(true);
    setExplainInsight(explainResponse(currentRequest, responseToExplain));
    setExplainLoading(false);
  };

  const handleDebugResponse = async (responseOverride?: typeof currentResponse) => {
    const responseToDebug = responseOverride ?? currentResponse;
    if (!currentRequest || !responseToDebug) return;

    // Solo per risposte di errore
    const isError = responseToDebug.statusCode === 0 || responseToDebug.statusCode >= 400;
    if (!isError) return;

    setActiveTool('debug');
    setDebugLoading(true);
    setDebugInsight(debugResponse(currentRequest, responseToDebug, settings.language));
    setDebugLoading(false);
  };

  const handleSaveBaseline = () => {
    if (!currentResponse) return;
    setBaselineResponse(currentResponse);
    setCompareInsight(null);
  };

  const handleCompareResponse = async () => {
    if (!currentRequest || !baselineResponse || !currentResponse) return;

    setActiveTool('compare');
    setCompareLoading(true);
    setCompareInsight(null);
    setCompareInsight(compareResponses(baselineResponse, currentResponse, settings.language));
    setCompareLoading(false);
  };

  const handleClearBaseline = () => {
    setBaselineResponse(null);
    setCompareInsight(null);
    if (activeTool === 'compare') setActiveTool('none');
  };

  const handleScenarioHealth = async () => {
    if (scenarioResponses.length === 0 || scenarioResponses.length < requests.length) return;
    setHealthLoading(true);
    setActiveTool('health' as ContextualTool);
    const report = buildScenarioHealthReport(
      currentScenario?.title ?? 'Scenario',
      scenarioResponses,
      settings.language
    );
    setHealthReport(report);
    setHealthLoading(false);
  };

  const handleScenarioReport = async () => {
    if (scenarioResponses.length === 0 || scenarioResponses.length < requests.length) return;
    setScenarioReportLoading(true);
    setActiveTool('scenario-report');
    const report = buildScenarioReport({
      title: currentScenario?.title ?? 'Scenario',
      description: currentScenario?.description,
      tag: currentScenario?.tag,
      version: currentScenario?.version,
    }, scenarioResponses);
    setScenarioReport(report);
    setScenarioReportLoading(false);
  };

  const handleOpenScenarioReportExport = () => {
    if (!scenarioReport) return;
    setShowScenarioReportExportModal(true);
  };

  const handleExportScenarioReport = async (format: 'pdf' | 'markdown' | 'yaml' | 'json') => {
    if (!scenarioReport) return;
    await exportScenarioReport(scenarioReport, settings.language, format);
    setShowScenarioReportExportModal(false);
  };

  const handleCloseTool = () => {
    setActiveTool('none');
    setShowScenarioReportExportModal(false);
  };

  const handleAddScenarioLink = () => {
    if (!currentScenario) return;

    const nextLinks: ScenarioExecutionLink[] = [
      ...(currentScenario.executionLinks ?? []),
      {
        id: createAssociationId(),
        required: true,
        valueTemplate: '',
      },
    ];

    updateScenario(currentScenario.id, { executionLinks: nextLinks });
  };

  const handleUpdateScenarioLink = (linkId: string, patch: Partial<ScenarioExecutionLink>) => {
    if (!currentScenario) return;

    const nextLinks = (currentScenario.executionLinks ?? []).map((link) =>
      link.id === linkId
        ? { ...link, ...patch }
        : link
    );

    updateScenario(currentScenario.id, { executionLinks: nextLinks });
  };

  const handleRemoveScenarioLink = (linkId: string) => {
    if (!currentScenario) return;
    updateScenario(currentScenario.id, {
      executionLinks: (currentScenario.executionLinks ?? []).filter((link) => link.id !== linkId),
    });
  };

  const handleScenarioExecution = async () => {
    if (!currentScenario || resolvedRequests.length === 0 || scenarioExecutionRunning) return;

    setActiveTool('scenario-execution');
    setScenarioExecutionState({
      key: scenarioExecutionKey,
      running: true,
      report: null,
      steps: createScenarioExecutionSteps(resolvedRequests),
    });

    try {
      const report = await executeScenarioRequests({
        scenario: {
          id: currentScenario.id,
          title: currentScenario.title,
          description: currentScenario.description,
          tag: currentScenario.tag,
          version: currentScenario.version,
        },
        requests: resolvedRequests,
        scenarioLinks: currentScenario.executionLinks ?? [],
        settings,
        onStepUpdate: (steps) => {
          setScenarioExecutionState((prev) => ({
            ...prev,
            key: scenarioExecutionKey,
            steps,
          }));
        },
        onRequestCompleted: (requestId, response, requestSnapshot) => {
          setResponseForRequest(requestId, response, requestSnapshot);
          setCurrentResponse(response);
        },
      });

      setScenarioExecutionState((prev) => ({
        ...prev,
        key: scenarioExecutionKey,
        report,
      }));
    } finally {
      setScenarioExecutionState((prev) => ({
        ...prev,
        key: scenarioExecutionKey,
        running: false,
      }));
    }
  };

  useEffect(() => {
    onToolExpansionChange?.((!currentRequest && activeTool !== 'scenario-execution' ? 'none' : activeTool) !== 'none');
  }, [activeTool, currentRequest, onToolExpansionChange]);

  const isErrorResponse = Boolean(currentResponse && (currentResponse.statusCode === 0 || currentResponse.statusCode >= 400));
  const canCompare = Boolean(baselineResponse && currentResponse && baselineResponse !== currentResponse);
  const canRunScenarioTools = requests.length > 0 && scenarioResponses.length >= requests.length;
  const effectiveActiveTool = !currentRequest && activeTool !== 'scenario-execution' ? 'none' : activeTool;
  const showScenarioExecutionLayout = effectiveActiveTool === 'scenario-execution';
  const showScenarioReportLayout = effectiveActiveTool === 'scenario-report';
  const showHealthLayout = effectiveActiveTool === 'health';
  const responseToolsDisabled = showHealthLayout || showScenarioReportLayout || showScenarioExecutionLayout;
  const scenarioExecutionDisabled = !currentScenario;
  const scenarioActionsDisabled = !currentRequest || !canRunScenarioTools;
  const explainDisabled = !currentRequest || !currentResponse || responseToolsDisabled;
  const debugDisabled = !currentRequest || !isErrorResponse || responseToolsDisabled;
  const compareDisabled = !currentRequest || !canCompare || responseToolsDisabled;

  const scenarioExecutionSidebarItems = [
    {
      key: 'open-scenario-execution',
      label: 'Open panel',
      icon: 'open_in_new',
      hidden: scenarioExecutionDisabled,
      onClick: () => setActiveTool('scenario-execution'),
    },
    {
      key: 'close-scenario-execution',
      label: 'Close panel',
      icon: 'close',
      hidden: effectiveActiveTool !== 'scenario-execution',
      onClick: () => handleCloseTool(),
    },
  ];

  const scenarioHealthSidebarItems = [
    {
      key: 'open-scenario-health',
      label: 'Open panel',
      icon: 'open_in_new',
      hidden: scenarioActionsDisabled,
      onClick: () => void handleScenarioHealth(),
    },
    {
      key: 'close-scenario-health',
      label: 'Close panel',
      icon: 'close',
      hidden: effectiveActiveTool !== 'health',
      onClick: () => handleCloseTool(),
    },
  ];

  const scenarioReportSidebarItems = [
    {
      key: 'open-scenario-report',
      label: 'Open panel',
      icon: 'open_in_new',
      hidden: scenarioActionsDisabled,
      onClick: () => void handleScenarioReport(),
    },
    {
      key: 'close-scenario-report',
      label: 'Close panel',
      icon: 'close',
      hidden: effectiveActiveTool !== 'scenario-report',
      onClick: () => handleCloseTool(),
    },
  ];

  const explainSidebarItems = [
    {
      key: 'open-explain',
      label: 'Open panel',
      icon: 'open_in_new',
      hidden: explainDisabled,
      onClick: () => void handleExplainResponse(),
    },
    {
      key: 'close-explain',
      label: 'Close panel',
      icon: 'close',
      hidden: effectiveActiveTool !== 'explain',
      onClick: () => handleCloseTool(),
    },
  ];

  const debugSidebarItems = [
    {
      key: 'open-debug',
      label: 'Open panel',
      icon: 'open_in_new',
      hidden: debugDisabled,
      onClick: () => void handleDebugResponse(),
    },
    {
      key: 'close-debug',
      label: 'Close panel',
      icon: 'close',
      hidden: effectiveActiveTool !== 'debug',
      onClick: () => handleCloseTool(),
    },
  ];

  const compareSidebarItems = [
    {
      key: 'open-compare',
      label: 'Open panel',
      icon: 'open_in_new',
      hidden: compareDisabled,
      onClick: () => void handleCompareResponse(),
    },
    {
      key: 'close-compare',
      label: 'Close panel',
      icon: 'close',
      hidden: effectiveActiveTool !== 'compare',
      onClick: () => handleCloseTool(),
    },
  ];

  const contextualToolsSidebar = (
    <aside className="w-72 shrink-0 flex flex-col bg-[#f2f4f6] border-l border-[#c7c4d7]/15 overflow-y-auto min-h-0">
      <div className="flex-1 px-4 py-6 space-y-3">
        <SidebarToolCard
          title="Scenario Execution"
          description={requests.length > 0
            ? 'Run scenario requests sequentially with persisted associations and a volatile execution report.'
            : 'Open the scenario execution panel to configure associations before adding requests.'}
          icon="account_tree"
          tone="indigo"
          active={effectiveActiveTool === 'scenario-execution'}
          disabled={scenarioExecutionDisabled}
          menuItems={scenarioExecutionSidebarItems}
        />

        <SidebarToolCard
          title={t('scenarioHealthReport')}
          description={!currentRequest ? t('selectRequest') : !canRunScenarioTools ? t('scenarioHealthNotReady') : t('scenarioHealthHelp')}
          icon="health_metrics"
          tone="indigo"
          active={effectiveActiveTool === 'health'}
          disabled={scenarioActionsDisabled}
          menuItems={scenarioHealthSidebarItems}
        />

        <SidebarToolCard
          title={t('scenarioReportTitle')}
          description={!currentRequest ? t('selectRequest') : !canRunScenarioTools ? t('scenarioReportNotReady') : t('scenarioReportHelp')}
          icon="description"
          tone="indigo"
          active={effectiveActiveTool === 'scenario-report'}
          disabled={scenarioActionsDisabled}
          menuItems={scenarioReportSidebarItems}
        />

        <SidebarToolCard
          title={t('explainResponseAction')}
          description={t('explainResponseHelp')}
          icon="psychology"
          tone="indigo"
          active={effectiveActiveTool === 'explain'}
          disabled={explainDisabled}
          menuItems={explainSidebarItems}
        />

        <SidebarToolCard
          title={t('debugAssistant')}
          description={t('debugAssistantHelp')}
          icon="bug_report"
          tone="danger"
          active={effectiveActiveTool === 'debug'}
          disabled={debugDisabled}
          menuItems={debugSidebarItems}
        />

        <SidebarToolCard
          title={t('responseComparison')}
          description={!currentRequest
            ? t('selectRequest')
            : !baselineResponse
              ? t('compareNoBaseline')
              : !currentResponse
                ? t('compareNoCurrent')
                : t('responseComparisonHelp')}
          icon="compare_arrows"
          tone="indigo"
          active={effectiveActiveTool === 'compare'}
          disabled={compareDisabled}
          menuItems={compareSidebarItems}
        />
      </div>
    </aside>
  );

  if (!currentRequest && effectiveActiveTool !== 'scenario-execution') {
    return (
      <div className="flex-1 flex min-h-0 bg-[#f7f9fb] overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-[#f7f9fb]">
          <div className="p-0 relative w-full max-w-sm">
            <div className="bg-[#eceef0] rounded-xl p-12 flex flex-col items-center">
              <span className="material-symbols-outlined text-5xl text-[#c7c4d7] mb-5">terminal</span>
              <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest mb-2">
                Awaiting Command Execution
              </p>
              <p className="text-xs text-[#777586] mt-1">
                {currentScenario
                  ? t('selectRequest')
                  : 'Select a scenario first.'}
              </p>
            </div>
          </div>
        </div>
        {contextualToolsSidebar}
      </div>
    );
  }

  if (!currentRequest && effectiveActiveTool === 'scenario-execution' && currentScenario) {
    return (
      <div className="flex-1 flex min-h-0 bg-[#f7f9fb] overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 gap-4">
          <Suspense fallback={<PanelChunkFallback minHeight="min-h-[420px]" />}>
            <ScenarioExecutionPanel
              scenario={{
                title: currentScenario.title,
                description: currentScenario.description,
                tag: currentScenario.tag,
                version: currentScenario.version,
              }}
              requests={requests}
              requestsCount={requests.length}
              executionLinks={currentScenario.executionLinks ?? []}
              responseCatalog={scenarioResponses.map(({ request, response }) => ({ requestId: request.id, response }))}
              steps={scenarioExecutionSteps}
              running={scenarioExecutionRunning}
              report={scenarioExecutionReport}
              onAddLink={handleAddScenarioLink}
              onUpdateLink={handleUpdateScenarioLink}
              onRemoveLink={handleRemoveScenarioLink}
              onRun={() => void handleScenarioExecution()}
              onClose={handleCloseTool}
            />
          </Suspense>
        </div>

        {contextualToolsSidebar}
      </div>
    );
  }

  const methodCls = METHOD_COLORS[method] ?? 'bg-[#e0e3e5] text-[#464554]';
  const activeHeaderCount = headers.filter((h) => h.enabled && h.key).length;
  const activeParamCount = params.filter((p) => p.enabled && p.key).length;
  const namedHeaders = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.key.trim());
  const namedParams = params
    .map((param, index) => ({ param, index }))
    .filter(({ param }) => param.key.trim());
  const sensitiveHeaderCount = namedHeaders.filter(({ header }) => Boolean(header.sensitive)).length;
  const sensitiveParamCount = namedParams.filter(({ param }) => Boolean(param.sensitive)).length;
  const sensitiveDataCount = sensitiveBodyPaths.length + sensitiveHeaderCount + sensitiveParamCount;
  const respStatus = currentResponse ? getStatusColor(currentResponse.statusCode) : null;
  const respHeaders = currentResponse ? Object.entries(currentResponse.headers ?? {}) : [];
  const showExplainLayout = effectiveActiveTool === 'explain' && currentResponse;
  const showDebugLayout = effectiveActiveTool === 'debug' && currentResponse && isErrorResponse;
  const showCompareLayout = effectiveActiveTool === 'compare' && canCompare;
  const jsonBodyIssues = bodyValidationIssues;

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-5 py-3 text-[13px] font-medium tracking-[0.03em] transition-colors ${
        tab === id
          ? id === 'body' && jsonBodyIssues.length > 0
            ? 'text-[#ba1a1a] border-b-2 border-[#ba1a1a]'
            : 'text-[#2a14b4] border-b-2 border-[#2a14b4]'
          : id === 'body' && jsonBodyIssues.length > 0
            ? 'text-[#ba1a1a] hover:text-[#93000a]'
            : 'text-[#464554] hover:text-[#191c1e]'
      }`}
    >
      {label}
    </button>
  );

  const requestToolsMenuItems = [
    {
      key: 'copy-curl',
      label: 'Copy cURL command',
      icon: 'terminal',
      onClick: () => navigator.clipboard.writeText(curlCommand),
    },
    {
      key: 'minify-json',
      label: 'Minify JSON',
      icon: 'vertical_align_center',
      onClick: () => handleMinifyBody(),
    },
    {
      key: 'prettify-json',
      label: 'Prettify JSON',
      icon: 'auto_fix_high',
      onClick: () => handlePrettifyBody(),
    },
    {
      key: 'copy-body',
      label: 'Copy body',
      icon: 'content_copy',
      onClick: () => navigator.clipboard.writeText(body),
    },
  ];

  const responseActionsMenuItems = [
    {
      key: 'baseline',
      label: baselineResponse ? t('compareClearBaseline') : t('compareSaveBaseline'),
      icon: baselineResponse ? 'bookmark_remove' : 'bookmark',
      active: Boolean(baselineResponse),
      activeIcon: baselineResponse ? 'bookmark_remove' : 'bookmark',
      onClick: () => {
        if (baselineResponse) {
          handleClearBaseline();
          return;
        }
        handleSaveBaseline();
      },
    },
    {
      key: 'copy-response',
      label: copied ? t('copied') : t('copyResponse'),
      icon: copied ? 'check' : 'content_copy',
      onClick: () => handleCopy(),
    },
  ];

  const copyResponseMenuItems = [
    {
      key: 'copy-response',
      label: copied ? t('copied') : t('copyResponse'),
      icon: copied ? 'check' : 'content_copy',
      onClick: () => handleCopy(),
    },
  ];

  return (
    <div className="flex-1 flex min-h-0 bg-[#f7f9fb] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 gap-4">
        {!showHealthLayout && !showScenarioReportLayout && !showScenarioExecutionLayout && (
        <div className="bg-[#ffffff] rounded-xl shadow-sm p-2 hover:shadow-md transition-shadow border border-[#c7c4d7]/10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowMethodMenu(!showMethodMenu)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono font-semibold text-xs transition-colors ${methodCls}`}
              >
                {method}
                <span className="material-symbols-outlined text-sm">arrow_drop_down</span>
              </button>
              {showMethodMenu && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-[#ffffff] rounded-xl shadow-xl border border-[#c7c4d7]/20 overflow-hidden min-w-[120px]">
                  {HTTP_METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMethod(m);
                        if (currentRequest) {
                          updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, method: m }));
                        }
                        setShowMethodMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest hover:bg-[#f2f4f6] transition-colors ${
                        method === m ? 'text-[#2a14b4]' : 'text-[#464554]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center px-4">
              <input
                type="text"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="Enter request URL..."
                className={`w-full bg-transparent border-none focus:ring-0 font-mono text-xs text-[#191c1e] py-2 outline-none placeholder:text-[#c7c4d7] ${
                  error ? 'text-[#ba1a1a]' : ''
                }`}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#2a14b4] text-white rounded-lg font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm shadow-[#2a14b4]/20"
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                play_arrow
              </span>
              {sending ? t('sending') : 'RUN'}
            </button>
            {currentRequest && (currentRequest.isDraft || hasUnsavedRequestChanges) && (
              <button
                onClick={handleSaveRequest}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#005c54] text-white rounded-lg font-bold text-xs hover:opacity-90 transition-opacity shadow-sm shadow-[#005c54]/20"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {t('saveRequestAction')}
              </button>
            )}
          </div>

        </div>
        )}
        {!showHealthLayout && !showScenarioReportLayout && !showScenarioExecutionLayout && error && <p className="text-xs text-[#ba1a1a] -mt-4">{error}</p>}

        <div className="flex flex-col gap-4">
          {!showHealthLayout && !showScenarioReportLayout && !showScenarioExecutionLayout && (
          <div className="bg-[#ffffff] rounded-xl overflow-hidden border border-[#c7c4d7]/10">
            {/* Tab bar */}
            <div className="flex border-b border-[#c7c4d7]/10 bg-[#f2f4f6]/30">
              {tabBtn('body', 'Body (JSON)')}
              {tabBtn('headers', `Headers${activeHeaderCount > 0 ? ` (${activeHeaderCount})` : ''}`)}
              {tabBtn('params', `Params${activeParamCount > 0 ? ` (${activeParamCount})` : ''}`)}
              {tabBtn('sensitive-data', `Sensitive Data${sensitiveDataCount > 0 ? ` (${sensitiveDataCount})` : ''}`)}
              {tabBtn('notes', 'Notes')}
              <div className="ml-auto flex items-center px-4">
                <CardMenu items={requestToolsMenuItems} />
              </div>
            </div>

            {/* Tab content */}
            <div className={tab === 'sensitive-data' ? 'relative min-h-[152px]' : 'relative h-[152px]'}>
              {tab === 'body' && (
                <div className="flex h-[152px]">
                  <div className={`w-10 shrink-0 bg-white flex flex-col items-center py-4 select-none overflow-hidden ${jsonBodyIssues.length > 0 ? 'border-r border-[#ba1a1a]/30' : 'border-r border-[#c7c4d7]/10'}`}>
                    <div style={{ transform: `translateY(-${bodyScrollTop}px)` }}>
                      {Array.from({ length: Math.max(getJsonLineCount(body) + 2, 6) }, (_, i) => (
                        <span key={i} className={`block font-mono text-[10px] leading-5 ${jsonBodyIssues.length > 0 ? 'text-[#ba1a1a]' : 'text-[#777586]'}`}>{i + 1}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-white h-full overflow-hidden">
                    {bodySensitiveResetNotice && (
                      <div className="border-b border-[#ffdad6] bg-[#fff4f2] px-3 py-1.5">
                        <p className="text-[10px] font-medium text-[#93000a] leading-tight">
                          Some sensitive fields were reset after structural JSON changes.
                        </p>
                      </div>
                    )}
                    <JsonCodeBlock
                      raw={body}
                      editable
                      onChange={handleBodyChange}
                      onBlur={handleBodyBlur}
                      errorOffsets={jsonBodyIssues.map((issue) => issue.offset)}
                      onScrollPositionChange={setBodyScrollTop}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {tab === 'headers' && (
                <div className="h-full p-5 space-y-3 overflow-y-auto">
                  {headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => handleHeaderChange(i, 'enabled', e.target.checked)}
                        className="w-4 h-4 accent-[#2a14b4] shrink-0"
                      />
                      <input
                        value={h.key}
                        onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                        placeholder="Header name"
                        className="flex-1 px-3 py-2 font-mono text-[11px] bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 text-[#191c1e] placeholder:text-[#c7c4d7]"
                      />
                      <input
                        value={h.value}
                        onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-3 py-2 font-mono text-[11px] bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 text-[#191c1e] placeholder:text-[#c7c4d7]"
                      />
                      <button
                        onClick={() => handleRemoveHeader(i)}
                        className="material-symbols-outlined text-sm text-[#777586] hover:text-[#ba1a1a] p-1 rounded transition-colors"
                      >
                        close
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddHeader}
                    className="flex items-center gap-2 text-xs text-[#2a14b4] hover:text-[#2a14b4]/80 mt-2 font-semibold"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    {t('addHeader')}
                  </button>
                  {headers.length === 0 && (
                    <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest">
                      No headers. Click "+ Add Header" to add one.
                    </p>
                  )}
                </div>
              )}

              {tab === 'params' && (
                <div className="h-full p-5 space-y-3 overflow-y-auto">
                  {params.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) => handleParamChange(i, 'enabled', e.target.checked)}
                        className="w-4 h-4 accent-[#2a14b4] shrink-0"
                      />
                      <input
                        value={p.key}
                        onChange={(e) => handleParamChange(i, 'key', e.target.value)}
                        placeholder="Parameter name"
                        className="flex-1 px-3 py-2 font-mono text-[11px] bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 text-[#191c1e] placeholder:text-[#c7c4d7]"
                      />
                      <input
                        value={p.value}
                        onChange={(e) => handleParamChange(i, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-3 py-2 font-mono text-[11px] bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 text-[#191c1e] placeholder:text-[#c7c4d7]"
                      />
                      <button
                        onClick={() => handleRemoveParam(i)}
                        className="material-symbols-outlined text-sm text-[#777586] hover:text-[#ba1a1a] p-1 rounded transition-colors"
                      >
                        close
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddParam}
                    className="flex items-center gap-2 text-xs text-[#2a14b4] hover:text-[#2a14b4]/80 mt-2 font-semibold"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Param
                  </button>
                  {params.length === 0 && (
                    <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest">
                      No query params. Click "Add Param" to add one.
                    </p>
                  )}
                </div>
              )}

              {tab === 'notes' && (
                <div className="h-full p-4">
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      const nextNotes = e.target.value;
                      setNotes(nextNotes);
                      if (currentRequest) {
                        updateRuntimeRequest(currentRequest.id, (request) => ({ ...request, notes: nextNotes }));
                      }
                    }}
                    placeholder={t('addNote')}
                    className="w-full h-full px-4 py-3 text-xs bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 resize-none text-[#191c1e] placeholder:text-[#c7c4d7] overflow-y-auto"
                  />
                </div>
              )}

              {tab === 'sensitive-data' && (
                <div className="p-5">
                  <div className="mb-4 rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">
                      {t('requestSettingsSensitiveTitle')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#777586]">
                      {t('requestSensitiveHelp')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <section className="overflow-hidden rounded-xl border border-[#c7c4d7]/10 bg-white">
                      <div className="border-b border-[#c7c4d7]/10 px-4 py-3">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">
                          {t('requestSensitiveBody')}
                        </p>
                      </div>
                      <div className="max-h-64 space-y-2 overflow-y-auto p-4">
                        {bodyLeafNodes.length === 0 ? (
                          <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('requestSensitiveNoBody')}</p>
                        ) : (
                          bodyLeafNodes.map((leaf) => (
                            <label key={leaf.pointer} className="flex items-start gap-2 rounded-lg border border-[#c7c4d7]/10 bg-[#f7f9fb] px-3 py-2">
                              <input
                                type="checkbox"
                                checked={sensitiveBodyPaths.includes(leaf.pointer)}
                                onChange={(e) => handleSensitiveBodyPathToggle(leaf.pointer, e.target.checked)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[#2a14b4]"
                              />
                              <span className="font-mono text-[10px] leading-tight text-[#191c1e] break-all">{leaf.label}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-xl border border-[#c7c4d7]/10 bg-white">
                      <div className="border-b border-[#c7c4d7]/10 px-4 py-3">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">
                          {t('requestSensitiveHeaders')}
                        </p>
                      </div>
                      <div className="max-h-64 space-y-2 overflow-y-auto p-4">
                        {namedHeaders.length === 0 ? (
                          <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('requestSensitiveNoHeaders')}</p>
                        ) : (
                          namedHeaders.map(({ header, index }) => (
                            <label key={`${header.key}-${index}`} className="flex items-start gap-2 rounded-lg border border-[#c7c4d7]/10 bg-[#f7f9fb] px-3 py-2">
                              <input
                                type="checkbox"
                                checked={Boolean(header.sensitive)}
                                onChange={(e) => handleHeaderChange(index, 'sensitive', e.target.checked)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[#2a14b4]"
                              />
                              <span className="font-mono text-[10px] leading-tight text-[#191c1e] break-all">{header.key}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-xl border border-[#c7c4d7]/10 bg-white">
                      <div className="border-b border-[#c7c4d7]/10 px-4 py-3">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">
                          {t('requestSensitiveParams')}
                        </p>
                      </div>
                      <div className="max-h-64 space-y-2 overflow-y-auto p-4">
                        {namedParams.length === 0 ? (
                          <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('requestSensitiveNoParams')}</p>
                        ) : (
                          namedParams.map(({ param, index }) => (
                            <label key={`${param.key}-${index}`} className="flex items-start gap-2 rounded-lg border border-[#c7c4d7]/10 bg-[#f7f9fb] px-3 py-2">
                              <input
                                type="checkbox"
                                checked={Boolean(param.sensitive)}
                                onChange={(e) => handleParamChange(index, 'sensitive', e.target.checked)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[#2a14b4]"
                              />
                              <span className="font-mono text-[10px] leading-tight text-[#191c1e] break-all">{param.key}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}{/* end !showHealthLayout request panel */}

          {!showExplainLayout && !showDebugLayout && !showCompareLayout && !showHealthLayout && !showScenarioReportLayout && !showScenarioExecutionLayout && (
          <div className="bg-[#ffffff] rounded-xl overflow-hidden border border-[#c7c4d7]/10 flex flex-col min-h-0">
            <div className="px-5 py-3 flex items-center justify-between border-b border-[#c7c4d7]/10 bg-[#f2f4f6]/30">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[11px] font-bold text-[#464554] uppercase tracking-widest">
                  {t('responseOutput')}
                </span>
                {currentResponse && (
                  <>
                    <div className="h-4 w-px bg-[#c7c4d7]/30" />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block w-2 h-2 rounded-full ${respStatus!.dot}`} />
                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${respStatus!.badge}`}>
                        {currentResponse.statusCode === 0 ? 'ERR' : `${currentResponse.statusCode} ${currentResponse.statusText}`}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[#777586]">{currentResponse.duration}ms</span>
                    <span className="font-mono text-[10px] text-[#777586]">
                      {(new Blob([currentResponse.body]).size / 1024).toFixed(1)} KB
                    </span>
                  </>
                )}
              </div>
              {currentResponse && (
                <div className="flex items-center gap-2 shrink-0">
                  {(['preview', 'raw', 'headers'] as RespTab[]).map((rt) => (
                    <button
                      key={rt}
                      onClick={() => setRespTab(rt)}
                      className={`px-2.5 py-1 font-mono text-[10px] font-bold rounded uppercase tracking-widest transition-colors ${
                        respTab === rt
                          ? 'bg-[#2a14b4]/10 text-[#2a14b4] border border-[#2a14b4]/20'
                          : 'border border-[#c7c4d7]/20 text-[#464554] hover:bg-[#f2f4f6]'
                      }`}
                    >
                      {rt}
                    </button>
                  ))}
                  <CardMenu items={responseActionsMenuItems} />
                </div>
              )}
            </div>

            {!currentResponse ? (
              <div className="p-12 flex flex-col items-center justify-center text-center opacity-40 min-h-[220px]">
                <span className="material-symbols-outlined text-4xl mb-4 text-[#777586]">terminal</span>
                <p className="font-mono text-xs uppercase tracking-widest text-[#777586]">Awaiting Command Execution</p>
                <p className="text-[11px] mt-2 text-[#777586]">Click &apos;Run Request&apos; to see live API responses here.</p>
              </div>
            ) : (
              <>
                {(respTab === 'preview' || respTab === 'raw') && (
                  <div className="min-h-[280px] max-h-[calc(100vh-18rem)] overflow-auto">
                    <div className="flex min-h-full min-w-0">
                      <div className="w-10 shrink-0 bg-[#f2f4f6] flex flex-col items-center py-4 select-none border-r border-[#c7c4d7]/10">
                        {Array.from({ length: getJsonLineCount(currentResponse.body) }, (_, i) => (
                          <span key={i} className="font-mono text-[10px] text-[#c7c4d7] leading-5">{i + 1}</span>
                        ))}
                      </div>
                      {respTab === 'raw' ? (
                        <pre className="flex-1 min-w-0 max-w-full p-4 font-mono text-xs leading-5 text-[#464554] whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
                          {currentResponse.body}
                        </pre>
                      ) : (
                        <JsonCodeBlock raw={currentResponse.body} className="flex-1 min-w-0 max-w-full p-4" />
                      )}
                    </div>
                  </div>
                )}
                {respTab === 'headers' && (
                  <div className="p-5 space-y-3 max-h-[calc(100vh-18rem)] overflow-auto">
                    {respHeaders.length === 0 ? (
                      <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest">No response headers</p>
                    ) : (
                      respHeaders.map(([k, v]) => (
                        <div key={k}>
                          <span className="block font-mono text-[10px] text-[#777586]">{k}</span>
                          <span className="font-mono text-[11px] text-[#464554] break-all">{v}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          )}

          {showExplainLayout && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,420px)_1fr] gap-4 items-start">
              {explainLoading ? (
                <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-[#005c54] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#69d6c9]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        psychology
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">{t('explainResponseTitle')}</h2>
                      <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">ANALYSIS IN PROGRESS</p>
                    </div>
                  </div>
                  <div className="space-y-3 animate-pulse">
                    <div className="h-24 rounded-lg bg-[#f2f4f6]" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-18 rounded-lg bg-[#f2f4f6]" />
                      <div className="h-18 rounded-lg bg-[#f2f4f6]" />
                    </div>
                    <div className="h-24 rounded-lg bg-[#f2f4f6]" />
                    <div className="h-24 rounded-lg bg-[#f2f4f6]" />
                  </div>
                </section>
              ) : explainInsight ? (
                <Suspense fallback={<PanelChunkFallback />}>
                  <ExplainResponsePanel
                    currentRequest={currentRequest}
                    currentResponse={currentResponse}
                    insight={explainInsight}
                    onRegenerate={() => void handleExplainResponse()}
                    onClose={handleCloseTool}
                  />
                </Suspense>
              ) : (
                <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#005c54] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#69d6c9]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        psychology
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">{t('explainResponseTitle')}</h2>
                      <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">LOCAL ANALYSIS</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#464554] leading-relaxed">
                    Run a request to generate a local explanation of the current response.
                  </p>
                </section>
              )}

              <div className="bg-[#ffffff] rounded-xl overflow-hidden border border-[#c7c4d7]/10 flex flex-col min-h-0">
                <div className="px-5 py-3 flex items-center justify-between border-b border-[#c7c4d7]/10 bg-[#f2f4f6]/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#464554] uppercase tracking-widest">
                      {t('responseOutput')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(['preview', 'raw', 'headers'] as RespTab[]).map((rt) => (
                      <button
                        key={rt}
                        onClick={() => setRespTab(rt)}
                        className={`px-2.5 py-1 font-mono text-[10px] font-bold rounded uppercase tracking-widest transition-colors ${
                          respTab === rt
                            ? 'bg-[#2a14b4]/10 text-[#2a14b4] border border-[#2a14b4]/20'
                            : 'border border-[#c7c4d7]/20 text-[#464554] hover:bg-[#f2f4f6]'
                        }`}
                      >
                        {rt}
                      </button>
                    ))}
                    <CardMenu items={copyResponseMenuItems} />
                  </div>
                </div>

                {(respTab === 'preview' || respTab === 'raw') && (
                  <div className="min-h-[520px] max-h-[calc(100vh-18rem)] overflow-auto">
                    <div className="flex min-h-full min-w-0">
                      <div className="w-10 shrink-0 bg-[#f2f4f6] flex flex-col items-center py-4 select-none border-r border-[#c7c4d7]/10">
                        {Array.from({ length: getJsonLineCount(currentResponse.body) }, (_, i) => (
                          <span key={i} className="font-mono text-[10px] text-[#c7c4d7] leading-5">{i + 1}</span>
                        ))}
                      </div>
                      {respTab === 'raw' ? (
                        <pre className="flex-1 min-w-0 max-w-full p-4 font-mono text-xs leading-5 text-[#464554] whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
                          {currentResponse.body}
                        </pre>
                      ) : (
                        <JsonCodeBlock raw={currentResponse.body} className="flex-1 min-w-0 max-w-full p-4" />
                      )}
                    </div>
                  </div>
                )}

                {respTab === 'headers' && (
                  <div className="p-5 space-y-3 min-h-[520px] max-h-[calc(100vh-18rem)] overflow-auto">
                    {respHeaders.length === 0 ? (
                      <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest">No response headers</p>
                    ) : (
                      respHeaders.map(([k, v]) => (
                        <div key={k}>
                          <span className="block font-mono text-[10px] text-[#777586]">{k}</span>
                          <span className="font-mono text-[11px] text-[#464554] break-all">{v}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {showDebugLayout && (
            /* ── SMART DEBUG LAYOUT ── */
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,420px)_1fr] gap-4 items-start">
              {debugLoading ? (
                <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-[#93000a]/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#ba1a1a]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        bug_report
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">{t('debugAssistantTitle')}</h2>
                      <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">ANALYSIS IN PROGRESS</p>
                    </div>
                  </div>
                  <div className="space-y-3 animate-pulse">
                    <div className="h-24 rounded-lg bg-[#f2f4f6]" />
                    <div className="h-20 rounded-lg bg-[#f2f4f6]" />
                    <div className="h-20 rounded-lg bg-[#f2f4f6]" />
                    <div className="h-28 rounded-lg bg-[#2a14b4]/10" />
                  </div>
                </section>
              ) : debugInsight ? (
                <Suspense fallback={<PanelChunkFallback />}>
                  <DebugAssistantPanel
                    currentRequest={currentRequest}
                    currentResponse={currentResponse}
                    result={debugInsight}
                    onRegenerate={() => void handleDebugResponse()}
                    onClose={handleCloseTool}
                  />
                </Suspense>
              ) : (
                <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#93000a]/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#ba1a1a]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        bug_report
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">{t('debugAssistantTitle')}</h2>
                      <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">LOCAL ANALYSIS</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#464554] leading-relaxed">
                    Run a failing request to generate a local debugging analysis.
                  </p>
                </section>
              )}

              {/* Response body panel (shared between explain and debug layouts) */}
              <div className="bg-[#ffffff] rounded-xl overflow-hidden border border-[#c7c4d7]/10 flex flex-col min-h-0">
                <div className="px-5 py-3 flex items-center justify-between border-b border-[#c7c4d7]/10 bg-[#f2f4f6]/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#464554] uppercase tracking-widest">
                      {t('responseOutput')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(['preview', 'raw', 'headers'] as RespTab[]).map((rt) => (
                      <button
                        key={rt}
                        onClick={() => setRespTab(rt)}
                        className={`px-2.5 py-1 font-mono text-[10px] font-bold rounded uppercase tracking-widest transition-colors ${
                          respTab === rt
                            ? 'bg-[#2a14b4]/10 text-[#2a14b4] border border-[#2a14b4]/20'
                            : 'border border-[#c7c4d7]/20 text-[#464554] hover:bg-[#f2f4f6]'
                        }`}
                      >
                        {rt}
                      </button>
                    ))}
                    <CardMenu items={copyResponseMenuItems} />
                  </div>
                </div>

                {(respTab === 'preview' || respTab === 'raw') && (
                  <div className="min-h-[520px] max-h-[calc(100vh-18rem)] overflow-auto">
                    <div className="flex min-h-full min-w-0">
                      <div className="w-10 shrink-0 bg-[#f2f4f6] flex flex-col items-center py-4 select-none border-r border-[#c7c4d7]/10">
                        {Array.from({ length: getJsonLineCount(currentResponse.body) }, (_, i) => (
                          <span key={i} className="font-mono text-[10px] text-[#c7c4d7] leading-5">{i + 1}</span>
                        ))}
                      </div>
                      {respTab === 'raw' ? (
                        <pre className="flex-1 min-w-0 max-w-full p-4 font-mono text-xs leading-5 text-[#464554] whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
                          {currentResponse.body}
                        </pre>
                      ) : (
                        <JsonCodeBlock raw={currentResponse.body} className="flex-1 min-w-0 max-w-full p-4" />
                      )}
                    </div>
                  </div>
                )}
                {respTab === 'headers' && (
                  <div className="p-5 space-y-3 min-h-[520px] max-h-[calc(100vh-18rem)] overflow-auto">
                    {respHeaders.length === 0 ? (
                      <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest">No response headers</p>
                    ) : (
                      respHeaders.map(([k, v]) => (
                        <div key={k}>
                          <span className="block font-mono text-[10px] text-[#777586]">{k}</span>
                          <span className="font-mono text-[11px] text-[#464554] break-all">{v}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {showCompareLayout && (
            /* ── RESPONSE COMPARISON LAYOUT ── */
            <Suspense fallback={<PanelChunkFallback minHeight="min-h-[420px]" />}>
              <CompareResponsePanel
                baseline={baselineResponse!}
                current={currentResponse!}
                result={compareInsight ?? compareResponses(baselineResponse!, currentResponse!, settings.language)}
                onRegenerate={() => void handleCompareResponse()}
                onClearBaseline={handleClearBaseline}
                onClose={handleCloseTool}
              />
            </Suspense>
          )}

          {!showCompareLayout && effectiveActiveTool === 'compare' && compareLoading && (
            <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#372abf]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#2a14b4]" style={{ fontVariationSettings: "'FILL' 1" }}>compare_arrows</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">{t('compareResponseTitle')}</h2>
                  <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">ANALYSIS IN PROGRESS</p>
                </div>
              </div>
              <div className="space-y-3 animate-pulse">
                <div className="h-16 rounded-lg bg-[#f2f4f6]" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-14 rounded-lg bg-[#f2f4f6]" />
                  <div className="h-14 rounded-lg bg-[#f2f4f6]" />
                </div>
                <div className="h-20 rounded-lg bg-[#f2f4f6]" />
                <div className="h-24 rounded-lg bg-[#f2f4f6]" />
              </div>
            </section>
          )}

          {showScenarioReportLayout && (
            scenarioReportLoading ? (
              <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
                <div className="space-y-3 animate-pulse">
                  <div className="h-20 rounded-lg bg-[#f2f4f6]" />
                  <div className="h-48 rounded-lg bg-[#f2f4f6]" />
                  <div className="h-48 rounded-lg bg-[#f2f4f6]" />
                </div>
              </section>
            ) : scenarioReport ? (
              <Suspense fallback={<PanelChunkFallback minHeight="min-h-[420px]" />}>
                <ScenarioReportPanel
                  result={scenarioReport}
                  onRegenerate={handleScenarioReport}
                  onClose={handleCloseTool}
                  onOpenExport={handleOpenScenarioReportExport}
                />
              </Suspense>
            ) : null
          )}

          {showScenarioExecutionLayout && currentScenario && (
            <Suspense fallback={<PanelChunkFallback minHeight="min-h-[420px]" />}>
              <ScenarioExecutionPanel
                scenario={{
                  title: currentScenario.title,
                  description: currentScenario.description,
                  tag: currentScenario.tag,
                  version: currentScenario.version,
                }}
                requests={requests}
                requestsCount={requests.length}
                executionLinks={currentScenario.executionLinks ?? []}
                responseCatalog={scenarioResponses.map(({ request, response }) => ({ requestId: request.id, response }))}
                steps={scenarioExecutionSteps}
                running={scenarioExecutionRunning}
                report={scenarioExecutionReport}
                onAddLink={handleAddScenarioLink}
                onUpdateLink={handleUpdateScenarioLink}
                onRemoveLink={handleRemoveScenarioLink}
                onRun={() => void handleScenarioExecution()}
                onClose={handleCloseTool}
              />
            </Suspense>
          )}

          {/* ── SCENARIO HEALTH LAYOUT — sostituisce request editor + response ── */}
          {showHealthLayout && (
            healthLoading ? (
              <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
                <div className="space-y-3 animate-pulse">
                  <div className="h-20 rounded-lg bg-[#f2f4f6]" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-32 rounded-lg bg-[#f2f4f6]" />
                    <div className="h-32 rounded-lg bg-[#f2f4f6]" />
                    <div className="h-32 rounded-lg bg-[#f2f4f6]" />
                    <div className="h-32 rounded-lg bg-[#f2f4f6]" />
                  </div>
                </div>
              </section>
            ) : healthReport ? (
              <Suspense fallback={<PanelChunkFallback minHeight="min-h-[420px]" />}>
                <ScenarioHealthReportPanel
                  result={healthReport}
                  onRegenerate={handleScenarioHealth}
                  onClose={handleCloseTool}
                />
              </Suspense>
            ) : null
          )}
        </div>{/* end flex flex-col gap-4 */}
      </div>{/* end flex-1 flex flex-col scroll */}

      {contextualToolsSidebar}

      {showScenarioReportExportModal && scenarioReport && (
        <Suspense fallback={null}>
          <ScenarioReportExportModal
            onClose={() => setShowScenarioReportExportModal(false)}
            onSelect={handleExportScenarioReport}
          />
        </Suspense>
      )}
    </div>
  );
}
