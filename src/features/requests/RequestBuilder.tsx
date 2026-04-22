// Request Builder — request editor al centro, contextual tools a destra, response inline sotto
import { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import { useApp } from '../../context/AppContext';
import { executeRequest } from '../../services/httpService';
import type { HttpMethod, Header, QueryParam, Request, Response } from '../../types';
import { explainResponse, type ExplainResponseResult } from './explainResponse';
import { debugResponse, type DebugResponseResult } from './debugResponse';
import { compareResponses, type CompareResponseResult } from './compareResponse';
import { buildScenarioHealthReport, type ScenarioHealthReportResult } from './scenarioHealthReport';
import { JsonCodeBlock, getJsonLineCount, getJsonValidationIssues } from '../../components/JsonCodeBlock';
import type { JsonValidationIssue } from '../../components/JsonCodeBlock';
import {
  deriveSensitiveUrlParamIds,
  extractUrlParamEntries,
  reconcileSensitiveUrlParamIds,
  syncParamsWithUrl,
  syncUrlWithParams,
} from './requestSensitive';
import {
  buildScenarioReport,
  buildScenarioReportPrintableHtml,
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
const RequestSettingsPanel = lazy(() =>
  import('./RequestSettingsPanel').then((module) => ({ default: module.RequestSettingsPanel }))
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

type Tab = 'body' | 'headers' | 'params' | 'notes';
type RespTab = 'preview' | 'raw' | 'headers';
type ContextualTool = 'none' | 'request-settings' | 'explain' | 'debug' | 'compare' | 'health' | 'scenario-report';
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

export function RequestBuilder() {
  const {
    t,
    settings,
    currentRequest,
    currentScenario,
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
  const [healthReport, setHealthReport] = useState<ScenarioHealthReportResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [bodyValidationIssues, setBodyValidationIssues] = useState<JsonValidationIssue[]>([]);
  const [bodySensitiveResetNotice, setBodySensitiveResetNotice] = useState(false);
  const [bodyScrollTop, setBodyScrollTop] = useState(0);
  const initializedRequestIdRef = useRef<string | null>(null);
  const previousBodyLeafNodesRef = useRef<JsonLeaf[]>([]);

  useEffect(() => {
    if (!currentRequest) {
      initializedRequestIdRef.current = null;
      return;
    }

    if (initializedRequestIdRef.current === currentRequest.id) {
      return;
    }

    initializedRequestIdRef.current = currentRequest.id;
    const nextHeaders = ensureJsonContentTypeHeader(currentRequest.headers ?? []);
    const nextParams = syncParamsWithUrl(currentRequest.url ?? '', currentRequest.params ?? []);
    const nextSensitiveUrlParamIds = deriveSensitiveUrlParamIds(nextParams);

    setMethod(currentRequest.method);
    setUrl(currentRequest.url ?? '');
    setHeaders(nextHeaders);
    setParams(nextParams);
    setBody(currentRequest.body ?? '');
    setSensitiveBodyPaths(currentRequest.sensitiveBodyPaths ?? []);
    setSensitiveUrlParamIds(nextSensitiveUrlParamIds);
    setNotes(currentRequest.notes ?? '');
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
    setBodyValidationIssues([]);
    setBodySensitiveResetNotice(false);
    setBodyScrollTop(0);
    previousBodyLeafNodesRef.current = parseJsonLeafNodes(currentRequest.body ?? '') ?? [];

    const paramsChanged = nextParams.some((param, index) => {
      const currentParam = currentRequest.params?.[index];
      return !currentParam || currentParam.value !== param.value;
    });

    const sensitiveIdsChanged = (currentRequest.sensitiveUrlParamIds ?? []).join('|') !== nextSensitiveUrlParamIds.join('|');

    if (paramsChanged || sensitiveIdsChanged) {
      updateRequest(currentRequest.id, {
        params: nextParams,
        sensitiveUrlParamIds: nextSensitiveUrlParamIds,
      });
    }
  }, [currentRequest]);

  const persist = useCallback((patch: Partial<Request>) => {
    if (!currentRequest) return;
    updateRequest(currentRequest.id, patch);
  }, [currentRequest, updateRequest]);

  const handleAddHeader = () => {
    const updated = [...headers, { key: '', value: '', enabled: true, sensitive: false }];
    setHeaders(updated);
    persist({ headers: updated });
  };

  const handleHeaderChange = (index: number, field: keyof Header, value: string | boolean) => {
    const updated = headers.map((h, i) => (i === index ? { ...h, [field]: value } : h));
    setHeaders(updated);
    persist({ headers: updated });
  };

  const handleRemoveHeader = (index: number) => {
    const updated = headers.filter((_, i) => i !== index);
    setHeaders(updated);
    persist({ headers: updated });
  };

  const handleAddParam = () => {
    const updated = [...params, { key: '', value: '', enabled: true, sensitive: false }];
    setParams(updated);
    persist({ params: updated });
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
    if (syncedUrl !== url) {
      setUrl(syncedUrl);
      persist({ params: syncedParams, url: syncedUrl, sensitiveUrlParamIds: nextSensitiveUrlParamIds });
      return;
    }

    persist({ params: syncedParams, sensitiveUrlParamIds: nextSensitiveUrlParamIds });
  };

  const handleRemoveParam = (index: number) => {
    const updated = params.filter((_, i) => i !== index);
    const syncedUrl = syncUrlWithParams(url, updated);
    const syncedParams = syncParamsWithUrl(syncedUrl, updated);
    const nextSensitiveUrlParamIds = deriveSensitiveUrlParamIds(syncedParams);
    setParams(syncedParams);
    setSensitiveUrlParamIds(nextSensitiveUrlParamIds);
    setUrl(syncedUrl);
    persist({ params: syncedParams, url: syncedUrl, sensitiveUrlParamIds: nextSensitiveUrlParamIds });
  };

  const handleUrlChange = (value: string) => {
    const syncedParams = syncParamsWithUrl(value, params);
    setUrl(value);
    setError('');
    setParams(syncedParams);
    setSensitiveUrlParamIds(deriveSensitiveUrlParamIds(syncedParams));
  };

  const handleUrlBlur = () => {
    const syncedParams = syncParamsWithUrl(url, params);
    const nextSensitiveUrlParamIds = deriveSensitiveUrlParamIds(syncedParams);
    setParams(syncedParams);
    setSensitiveUrlParamIds(nextSensitiveUrlParamIds);
    persist({ url, params: syncedParams, sensitiveUrlParamIds: nextSensitiveUrlParamIds });
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    if (bodySensitiveResetNotice) {
      setBodySensitiveResetNotice(false);
    }
    if (bodyValidationIssues.length > 0) {
      setBodyValidationIssues([]);
    }
  };

  const handleBodyBlur = () => {
    setBodyValidationIssues(getJsonValidationIssues(body));
    persist({ body });
  };

  const handleSensitiveBodyPathToggle = (pointer: string, checked: boolean) => {
    if (bodySensitiveResetNotice) {
      setBodySensitiveResetNotice(false);
    }
    const updated = checked
      ? [...sensitiveBodyPaths, pointer]
      : sensitiveBodyPaths.filter((item) => item !== pointer);
    setSensitiveBodyPaths(updated);
    persist({ sensitiveBodyPaths: updated });
  };

  const handlePrettifyBody = () => {
    try {
      const prettified = prettifyJson(body);
      setBody(prettified);
      setBodyValidationIssues([]);
      persist({ body: prettified });
    } catch {
      setBodyValidationIssues(getJsonValidationIssues(body));
    }
  };

  const handleMinifyBody = () => {
    try {
      const minified = minifyJson(body);
      setBody(minified);
      setBodyValidationIssues([]);
      persist({ body: minified });
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
    try {
      const shouldAttachJsonHeader = body.trim().length > 0 && ['POST', 'PUT', 'PATCH'].includes(method);
      const requestHeaders = shouldAttachJsonHeader ? ensureJsonContentTypeHeader(headers) : headers;

      if (requestHeaders !== headers) {
        setHeaders(requestHeaders);
        persist({ headers: requestHeaders });
      }

      const resolvedTimeoutMs = (currentRequest.timeoutMs ?? settings.requestTimeoutMs);
      const req = { ...currentRequest, method, url: url.trim(), headers: requestHeaders, params, body, notes };

      const response = await executeRequest(req, resolvedTimeoutMs ? resolvedTimeoutMs * 1000 : undefined);
      updateRequest(currentRequest.id, {
        lastStatusCode: response.statusCode,
        lastStatusText: response.statusText,
      });
      setCurrentResponse(response);
      setResponseForRequest(currentRequest.id, response);
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
      updateRequest(currentRequest.id, {
        lastStatusCode: failedResponse.statusCode,
        lastStatusText: failedResponse.statusText,
      });
      setCurrentResponse(failedResponse);
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
  const parsedBodyLeafNodes = useMemo(() => parseJsonLeafNodes(body), [body]);
  const bodyLeafNodes = parsedBodyLeafNodes ?? [];
  const urlParamEntries = useMemo(() => extractUrlParamEntries(url), [url]);

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
      persist({ sensitiveBodyPaths: reconciled });
    }
  }, [parsedBodyLeafNodes, persist, sensitiveBodyPaths]);

  useEffect(() => {
    if (urlParamEntries === null) {
      return;
    }

    const reconciled = reconcileSensitiveUrlParamIds(sensitiveUrlParamIds, urlParamEntries);
    const unchanged = reconciled.length === sensitiveUrlParamIds.length
      && reconciled.every((id, index) => id === sensitiveUrlParamIds[index]);

    if (!unchanged) {
      setSensitiveUrlParamIds(reconciled);
      persist({ sensitiveUrlParamIds: reconciled });
    }
  }, [persist, sensitiveUrlParamIds, urlParamEntries]);

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

  const handleOpenScenarioReportPrintable = () => {
    if (!scenarioReport) return;

    const printableWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printableWindow) return;

    printableWindow.document.open();
    printableWindow.document.write(buildScenarioReportPrintableHtml(scenarioReport, settings.language));
    printableWindow.document.close();
    printableWindow.focus();
  };

  const handleRequestSettings = () => {
    setActiveTool('request-settings');
  };

  const handleSaveTimeout = (timeoutSeconds?: number) => {
    if (timeoutSeconds !== undefined && (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0)) {
      return t('requestTimeoutInvalid');
    }

    persist({ timeoutMs: timeoutSeconds });
    return null;
  };

  if (!currentRequest) {
    return (
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
  const respStatus = currentResponse ? getStatusColor(currentResponse.statusCode) : null;
  const respHeaders = currentResponse ? Object.entries(currentResponse.headers ?? {}) : [];
  const showRequestSettingsLayout = activeTool === 'request-settings';
  const showExplainLayout = activeTool === 'explain' && currentResponse;
  const isErrorResponse = Boolean(currentResponse && (currentResponse.statusCode === 0 || currentResponse.statusCode >= 400));
  const showDebugLayout = activeTool === 'debug' && currentResponse && isErrorResponse;
  const canCompare = Boolean(baselineResponse && currentResponse && baselineResponse !== currentResponse);
  const showCompareLayout = activeTool === 'compare' && canCompare;
  const canRunScenarioTools = requests.length > 0 && scenarioResponses.length >= requests.length;
  const showScenarioReportLayout = activeTool === 'scenario-report';
  const showHealthLayout = activeTool === 'health';
  const responseToolsDisabled = showHealthLayout || showScenarioReportLayout || showRequestSettingsLayout;
  const jsonBodyIssues = bodyValidationIssues;

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-5 py-3 text-xs tracking-[0.18em] font-bold uppercase transition-colors ${
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

  return (
    <div className="flex-1 flex min-h-0 bg-[#f7f9fb] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 gap-4">
        {!showHealthLayout && !showScenarioReportLayout && !showRequestSettingsLayout && (
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
                        persist({ method: m });
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
            {currentRequest.isDraft && (
              <button
                onClick={saveCurrentRequest}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#005c54] text-white rounded-lg font-bold text-xs hover:opacity-90 transition-opacity shadow-sm shadow-[#005c54]/20"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {t('saveRequestAction')}
              </button>
            )}
          </div>
        </div>
        )}
        {!showHealthLayout && !showScenarioReportLayout && !showRequestSettingsLayout && error && <p className="text-xs text-[#ba1a1a] -mt-4">{error}</p>}

        <div className="flex flex-col gap-4">
          {!showHealthLayout && !showScenarioReportLayout && !showRequestSettingsLayout && (
          <div className="bg-[#ffffff] rounded-xl overflow-hidden border border-[#c7c4d7]/10">
            {/* Tab bar */}
            <div className="flex border-b border-[#c7c4d7]/10 bg-[#f2f4f6]/30">
              {tabBtn('body', 'Body (JSON)')}
              {tabBtn('headers', `Headers${activeHeaderCount > 0 ? ` (${activeHeaderCount})` : ''}`)}
              {tabBtn('params', `Params${activeParamCount > 0 ? ` (${activeParamCount})` : ''}`)}
              {tabBtn('notes', 'Notes')}
              <div className="ml-auto flex items-center px-4 gap-4">
                <button
                  className="material-symbols-outlined text-[#777586] hover:text-[#191c1e] text-sm cursor-pointer"
                  onClick={handleMinifyBody}
                  title="Minify JSON"
                  aria-label="Minify JSON"
                >
                  vertical_align_center
                </button>
                <button
                  className="material-symbols-outlined text-[#777586] hover:text-[#191c1e] text-sm cursor-pointer"
                  onClick={handlePrettifyBody}
                  title="Prettify JSON"
                  aria-label="Prettify JSON"
                >
                  auto_fix_high
                </button>
                <button
                  className="material-symbols-outlined text-[#777586] hover:text-[#191c1e] text-sm cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(body)}
                >
                  content_copy
                </button>
              </div>
            </div>

            {/* Tab content */}
            <div className="relative h-[152px]">
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
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => persist({ notes })}
                    placeholder={t('addNote')}
                    className="w-full h-full px-4 py-3 text-xs bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 resize-none text-[#191c1e] placeholder:text-[#c7c4d7] overflow-y-auto"
                  />
                </div>
              )}
            </div>
          </div>
          )}{/* end !showHealthLayout request panel */}

          {!showExplainLayout && !showDebugLayout && !showCompareLayout && !showHealthLayout && !showScenarioReportLayout && !showRequestSettingsLayout && (
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
                  <button
                    onClick={baselineResponse ? handleClearBaseline : handleSaveBaseline}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      baselineResponse
                        ? 'text-[#ba1a1a] bg-[#ffdad6] hover:bg-[#ffcac5]'
                        : 'text-[#464554] bg-[#e6e8ea] hover:bg-[#e0e3e5]'
                    }`}
                    title={baselineResponse ? t('compareClearBaseline') : t('compareSaveBaseline')}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {baselineResponse ? 'bookmark_remove' : 'bookmark'}
                    </span>
                    {baselineResponse ? t('compareClearBaseline') : t('compareSaveBaseline')}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#464554] bg-[#e6e8ea] rounded-lg hover:bg-[#e0e3e5] transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copied ? 'check' : 'content_copy'}
                    </span>
                    {copied ? t('copied') : t('copyResponse')}
                  </button>
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
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#464554] bg-[#e6e8ea] rounded-lg hover:bg-[#e0e3e5] transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {copied ? 'check' : 'content_copy'}
                      </span>
                      {copied ? t('copied') : t('copyResponse')}
                    </button>
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
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#464554] bg-[#e6e8ea] rounded-lg hover:bg-[#e0e3e5] transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {copied ? 'check' : 'content_copy'}
                      </span>
                      {copied ? t('copied') : t('copyResponse')}
                    </button>
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
              />
            </Suspense>
          )}

          {!showCompareLayout && activeTool === 'compare' && compareLoading && (
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
                  onClose={() => setActiveTool('none')}
                  onOpenPrintable={handleOpenScenarioReportPrintable}
                />
              </Suspense>
            ) : null
          )}

          {showRequestSettingsLayout && (
            <Suspense fallback={<PanelChunkFallback minHeight="min-h-[420px]" />}>
              <RequestSettingsPanel
                timeoutSeconds={currentRequest.timeoutMs}
                globalTimeoutSeconds={settings.requestTimeoutMs}
                onSaveTimeout={handleSaveTimeout}
                bodyLeafNodes={bodyLeafNodes}
                sensitiveBodyPaths={sensitiveBodyPaths}
                onToggleBodyPath={handleSensitiveBodyPathToggle}
                headers={namedHeaders}
                onToggleHeader={(index, checked) => handleHeaderChange(index, 'sensitive', checked)}
                params={namedParams}
                onToggleParam={(index, checked) => handleParamChange(index, 'sensitive', checked)}
                onClose={() => setActiveTool('none')}
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
                  onClose={() => setActiveTool('none')}
                />
              </Suspense>
            ) : null
          )}
        </div>{/* end flex flex-col gap-4 */}
      </div>{/* end flex-1 flex flex-col scroll */}

      <aside className="w-72 shrink-0 flex flex-col bg-[#f2f4f6] border-l border-[#c7c4d7]/15 overflow-y-auto min-h-0">
        <div className="flex-1 px-4 py-6 space-y-2">
          <button
            type="button"
            onClick={handleRequestSettings}
            className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all group ${
              activeTool === 'request-settings'
                ? 'bg-[#ffffff]'
                : 'hover:bg-[#ffffff]'
            }`}
          >
            <div className="flex items-center gap-3 text-[#2a14b4]">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('requestSettingsAction')}</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-[#777586] ml-8">
              {t('requestSettingsHelp')}
            </p>
          </button>

          <div className="h-px bg-[#c7c4d7]/20 my-1" />

          {/* Scenario Health Report */}
          <button
            type="button"
            onClick={handleScenarioHealth}
            disabled={!canRunScenarioTools}
            title={!canRunScenarioTools ? t('scenarioHealthNotReady') : undefined}
            className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all group ${
              canRunScenarioTools
                ? 'hover:bg-[#ffffff]'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div className={`flex items-center gap-3 ${canRunScenarioTools ? 'text-[#2a14b4]' : 'text-[#777586]'}`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>health_metrics</span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('scenarioHealthReport')}</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-[#777586] ml-8">
              {!canRunScenarioTools ? t('scenarioHealthNotReady') : t('scenarioHealthHelp')}
            </p>
          </button>

          <div className="h-px bg-[#c7c4d7]/20 my-1" />

          <button
            type="button"
            onClick={handleScenarioReport}
            disabled={!canRunScenarioTools}
            title={!canRunScenarioTools ? t('scenarioReportNotReady') : undefined}
            className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all group ${
              activeTool === 'scenario-report'
                ? 'bg-[#ffffff]'
                : canRunScenarioTools
                  ? 'hover:bg-[#ffffff]'
                  : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div className={`flex items-center gap-3 ${activeTool === 'scenario-report' || canRunScenarioTools ? 'text-[#2a14b4]' : 'text-[#777586]'}`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('scenarioReportTitle')}</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-[#777586] ml-8">
              {!canRunScenarioTools ? t('scenarioReportNotReady') : t('scenarioReportHelp')}
            </p>
          </button>

          <div className="h-px bg-[#c7c4d7]/20 my-1" />

          {/* Explain Response */}
          <button
            type="button"
            onClick={() => void handleExplainResponse()}
            disabled={!currentResponse || responseToolsDisabled}
            className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all group ${
              activeTool === 'explain'
                ? 'bg-[#ffffff] text-[#2a14b4]'
                : currentResponse && !responseToolsDisabled
                  ? 'hover:bg-[#ffffff]'
                  : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div className={`flex items-center gap-3 ${activeTool === 'explain' ? 'text-[#2a14b4]' : 'text-[#2a14b4]'}`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('explainResponseAction')}</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-[#777586] ml-8">
              {t('explainResponseHelp')}
            </p>
          </button>

          {/* Debug Assistant */}
          <button
            type="button"
            onClick={() => void handleDebugResponse()}
            disabled={!isErrorResponse || responseToolsDisabled}
            title={!isErrorResponse ? t('debugOnlyOnError') : undefined}
            className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all group ${
              activeTool === 'debug'
                ? 'bg-[#ffffff] text-[#ba1a1a]'
                : isErrorResponse && !responseToolsDisabled
                  ? 'hover:bg-[#ffffff]'
                  : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div className={`flex items-center gap-3 ${activeTool === 'debug' ? 'text-[#ba1a1a]' : isErrorResponse && !responseToolsDisabled ? 'text-[#ba1a1a] group-hover:text-[#ba1a1a]' : 'text-[#777586]'}`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>bug_report</span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('debugAssistant')}</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-[#777586] ml-8">
              {t('debugAssistantHelp')}
            </p>
          </button>

          {/* Response Comparison */}
          <div>
            <button
              type="button"
              onClick={() => void handleCompareResponse()}
              disabled={!canCompare || responseToolsDisabled}
              title={!baselineResponse ? t('compareNoBaseline') : !currentResponse ? t('compareNoCurrent') : undefined}
              className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all group ${
                activeTool === 'compare'
                  ? 'bg-[#ffffff] text-[#2a14b4]'
                  : canCompare && !responseToolsDisabled
                    ? 'hover:bg-[#ffffff]'
                    : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <div className={`flex items-center gap-3 ${activeTool === 'compare' ? 'text-[#2a14b4]' : canCompare && !responseToolsDisabled ? 'text-[#2a14b4]' : 'text-[#777586]'}`}>
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>compare_arrows</span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('responseComparison')}</span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-[#777586] ml-8">
                {!baselineResponse
                  ? t('compareNoBaseline')
                  : !currentResponse
                    ? t('compareNoCurrent')
                    : t('responseComparisonHelp')}
              </p>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
