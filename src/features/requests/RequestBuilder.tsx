// Request Builder — request editor al centro, contextual tools a destra, response inline sotto
import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { executeRequest } from '../../services/httpService';
import type { HttpMethod, Header, QueryParam } from '../../types';
import { ExplainResponsePanel } from './ExplainResponsePanel';
import { explainResponse, type ExplainResponseResult } from './explainResponse';
import { DebugAssistantPanel } from './DebugAssistantPanel';
import { debugResponse, type DebugResponseResult } from './debugResponse';
import { runExplainResponse, runDebugResponse } from '../../services/smart/smartService';

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
type ContextualTool = 'none' | 'explain' | 'debug';

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
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

export function RequestBuilder() {
  const { t, settings, smartApiKey, currentRequest, currentScenario, updateRequest, refreshRequests, setCurrentResponse, currentResponse } = useApp();

  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<Header[]>([]);
  const [params, setParams] = useState<QueryParam[]>([]);
  const [body, setBody] = useState('');
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
  const [explainError, setExplainError] = useState('');
  const [explainMode, setExplainMode] = useState<'smart' | 'fallback'>('fallback');
  const [debugInsight, setDebugInsight] = useState<DebugResponseResult | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState('');
  const [debugMode, setDebugMode] = useState<'smart' | 'fallback'>('fallback');

  useEffect(() => {
    if (currentRequest) {
      setMethod(currentRequest.method);
      setUrl(currentRequest.url ?? '');
      setHeaders(currentRequest.headers ?? []);
      setParams(currentRequest.params ?? []);
      setBody(currentRequest.body ?? '');
      setNotes(currentRequest.notes ?? '');
      setError('');
      setTab('body');
      setActiveTool('none');
      setExplainInsight(null);
      setExplainLoading(false);
      setExplainError('');
      setExplainMode('fallback');
      setDebugInsight(null);
      setDebugLoading(false);
      setDebugError('');
      setDebugMode('fallback');
    }
  }, [currentRequest?.id]);

  const persist = (patch: Partial<typeof currentRequest>) => {
    if (!currentRequest) return;
    updateRequest(currentRequest.id, patch as Parameters<typeof updateRequest>[1]);
    refreshRequests();
  };

  const handleAddHeader = () => {
    const updated = [...headers, { key: '', value: '', enabled: true }];
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
    const updated = [...params, { key: '', value: '', enabled: true }];
    setParams(updated);
    persist({ params: updated });
  };

  const handleParamChange = (index: number, field: keyof QueryParam, value: string | boolean) => {
    const updated = params.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    setParams(updated);
    persist({ params: updated });
  };

  const handleRemoveParam = (index: number) => {
    const updated = params.filter((_, i) => i !== index);
    setParams(updated);
    persist({ params: updated });
  };

  const handleSend = async () => {
    if (!currentRequest) return;
    if (!url.trim()) { setError('URL is required'); return; }
    setError('');
    setSending(true);
    try {
      const req = { ...currentRequest, method, url: url.trim(), headers, params, body, notes };
      const response = await executeRequest(req);
      setCurrentResponse(response);
      if (activeTool === 'explain') {
        setExplainInsight(null);
        setExplainError('');
        void handleExplainResponse(response);
      }
    } catch (e) {
      setCurrentResponse({
        statusCode: 0,
        statusText: 'Network Error',
        duration: 0,
        body: e instanceof Error ? e.message : 'Unknown error',
        headers: {},
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  };

  const handleCopy = () => {
    if (!currentResponse) return;
    navigator.clipboard.writeText(formatJson(currentResponse.body));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExplainResponse = async (responseOverride?: typeof currentResponse) => {    const responseToExplain = responseOverride ?? currentResponse;
    if (!currentRequest || !responseToExplain) return;

    console.log('[RequestBuilder][ExplainResponse] Triggered', {
      requestId: currentRequest.id,
      requestTitle: currentRequest.title,
      responseStatus: responseToExplain.statusCode,
      smartEnabled: settings.smartEnabled,
      provider: settings.smartProvider,
      model: settings.smartModel,
      hasApiKey: Boolean(smartApiKey),
    });

    setActiveTool('explain');
    setExplainLoading(true);
    setExplainError('');

    try {
      const result = await runExplainResponse(
        { request: currentRequest, response: responseToExplain },
        { settings, apiKey: smartApiKey }
      );
      setExplainInsight(result);
      setExplainMode('smart');
      console.log('[RequestBuilder][ExplainResponse] Smart insight generated successfully');
    } catch (e) {
      console.error('[RequestBuilder][ExplainResponse] Falling back to local explanation', e);
      setExplainInsight(explainResponse(currentRequest, responseToExplain));
      setExplainError(e instanceof Error ? e.message : 'Unable to generate Smart Explain.');
      setExplainMode('fallback');
    } finally {
      setExplainLoading(false);
    }
  };

  const handleDebugResponse = async (responseOverride?: typeof currentResponse) => {
    const responseToDebug = responseOverride ?? currentResponse;
    if (!currentRequest || !responseToDebug) return;

    // Solo per risposte di errore
    const isError = responseToDebug.statusCode === 0 || responseToDebug.statusCode >= 400;
    if (!isError) return;

    setActiveTool('debug');
    setDebugLoading(true);
    setDebugError('');

    try {
      const result = await runDebugResponse(
        { request: currentRequest, response: responseToDebug },
        { settings, apiKey: smartApiKey }
      );
      setDebugInsight(result);
      setDebugMode('smart');
    } catch (e) {
      setDebugInsight(debugResponse(currentRequest, responseToDebug, settings.language));
      setDebugError(e instanceof Error ? e.message : 'Unable to generate Smart Debug.');
      setDebugMode('fallback');
    } finally {
      setDebugLoading(false);
    }
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

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${
        tab === id
          ? 'text-[#2a14b4] border-b-2 border-[#2a14b4]'
          : 'text-[#464554] hover:text-[#191c1e]'
      }`}
    >
      {label}
    </button>
  );

  const methodCls = METHOD_COLORS[method] ?? 'bg-[#e0e3e5] text-[#464554]';
  const activeHeaderCount = headers.filter((h) => h.enabled && h.key).length;
  const activeParamCount = params.filter((p) => p.enabled && p.key).length;
  const respStatus = currentResponse ? getStatusColor(currentResponse.statusCode) : null;
  const respHeaders = currentResponse ? Object.entries(currentResponse.headers ?? {}) : [];
  const showExplainLayout = activeTool === 'explain' && currentResponse;
  const isErrorResponse = Boolean(currentResponse && (currentResponse.statusCode === 0 || currentResponse.statusCode >= 400));
  const showDebugLayout = activeTool === 'debug' && currentResponse && isErrorResponse;

  return (
    <div className="flex-1 flex min-h-0 bg-[#f7f9fb] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 gap-4">
        {/* URL bar */}
        <div className="bg-[#ffffff] rounded-xl shadow-sm p-2 flex items-center gap-2 hover:shadow-md transition-shadow border border-[#c7c4d7]/10">
          {/* Method dropdown */}
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

          {/* URL input */}
          <div className="flex-1 flex items-center px-4">
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              onBlur={() => persist({ url })}
              placeholder="Enter request URL..."
              className={`w-full bg-transparent border-none focus:ring-0 font-mono text-xs text-[#191c1e] py-2 outline-none placeholder:text-[#c7c4d7] ${
                error ? 'text-[#ba1a1a]' : ''
              }`}
            />
          </div>

          {/* Run button */}
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
            {sending ? t('sending') : 'RUN REQUEST'}
          </button>
        </div>
        {error && <p className="text-xs text-[#ba1a1a] -mt-4">{error}</p>}

        <div className="flex flex-col gap-4">
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
                  onClick={() => navigator.clipboard.writeText(body)}
                >
                  content_copy
                </button>
              </div>
            </div>

            {/* Tab content */}
            <div className="relative h-[150px]">
              {tab === 'body' && (
                <div className="flex h-full">
                  {/* Line numbers gutter */}
                  <div className="w-10 shrink-0 bg-[#e0e3e5] flex flex-col items-center py-4 select-none border-r border-[#c7c4d7]/10 overflow-hidden">
                    {Array.from({ length: 15 }, (_, i) => (
                      <span key={i} className="font-mono text-[10px] text-[#777586] leading-6">{i + 1}</span>
                    ))}
                  </div>
                  <div className="flex-1 p-4 bg-[#e0e3e5] h-full overflow-hidden">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onBlur={() => persist({ body })}
                      className="w-full h-full bg-transparent border-none focus:ring-0 font-mono text-xs text-[#464554] resize-none outline-none leading-5 overflow-y-auto"
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

          {!showExplainLayout && !showDebugLayout && (
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
                        {formatJson(currentResponse.body).split('\n').map((_, i) => (
                          <span key={i} className="font-mono text-[10px] text-[#c7c4d7] leading-5">{i + 1}</span>
                        ))}
                      </div>
                      <pre className="flex-1 min-w-0 p-4 font-mono text-xs leading-5 text-[#464554] whitespace-pre-wrap break-words">
                        {respTab === 'raw' ? currentResponse.body : formatJson(currentResponse.body)}
                      </pre>
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
                      <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">{t('smartLoading')}</p>
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
                <ExplainResponsePanel
                  currentRequest={currentRequest}
                  currentResponse={currentResponse}
                  insight={explainInsight}
                  onRegenerate={() => void handleExplainResponse()}
                  mode={explainMode}
                  errorMessage={explainError}
                />
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
                      <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">{t('smartUnavailable')}</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#464554] leading-relaxed">
                    {t('smartUnavailableDesc')}
                  </p>
                </section>
              )}

              <div className="bg-[#ffffff] rounded-xl overflow-hidden border border-[#c7c4d7]/10 flex flex-col min-h-0">
                <div className="px-5 py-3 flex items-center justify-between border-b border-[#c7c4d7]/10 bg-[#f2f4f6]/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#464554] uppercase tracking-widest">
                      {t('responseBodyLabel')}
                    </span>
                    <div className="h-4 w-px bg-[#c7c4d7]/30" />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block w-2 h-2 rounded-full ${respStatus!.dot}`} />
                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${respStatus!.badge}`}>
                        {currentResponse.statusCode === 0 ? 'ERR' : `${currentResponse.statusCode} ${currentResponse.statusText}`}
                      </span>
                    </div>
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
                        {formatJson(currentResponse.body).split('\n').map((_, i) => (
                          <span key={i} className="font-mono text-[10px] text-[#c7c4d7] leading-5">{i + 1}</span>
                        ))}
                      </div>
                      <pre className="flex-1 min-w-0 p-4 font-mono text-xs leading-5 text-[#464554] whitespace-pre-wrap break-words">
                        {respTab === 'raw' ? currentResponse.body : formatJson(currentResponse.body)}
                      </pre>
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
                      <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">{t('smartLoading')}</p>
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
                <DebugAssistantPanel
                  currentRequest={currentRequest}
                  currentResponse={currentResponse}
                  result={debugInsight}
                  onRegenerate={() => void handleDebugResponse()}
                  mode={debugMode}
                  errorMessage={debugError}
                />
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
                      <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">{t('smartUnavailable')}</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#464554] leading-relaxed">
                    {t('smartUnavailableDesc')}
                  </p>
                </section>
              )}

              {/* Response body panel (shared between explain and debug layouts) */}
              <div className="bg-[#ffffff] rounded-xl overflow-hidden border border-[#c7c4d7]/10 flex flex-col min-h-0">
                <div className="px-5 py-3 flex items-center justify-between border-b border-[#c7c4d7]/10 bg-[#f2f4f6]/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#464554] uppercase tracking-widest">
                      {t('responseBodyLabel')}
                    </span>
                    <div className="h-4 w-px bg-[#c7c4d7]/30" />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block w-2 h-2 rounded-full ${respStatus!.dot}`} />
                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${respStatus!.badge}`}>
                        {currentResponse.statusCode === 0 ? 'ERR' : `${currentResponse.statusCode} ${currentResponse.statusText}`}
                      </span>
                    </div>
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
                        {formatJson(currentResponse.body).split('\n').map((_, i) => (
                          <span key={i} className="font-mono text-[10px] text-[#c7c4d7] leading-5">{i + 1}</span>
                        ))}
                      </div>
                      <pre className="flex-1 min-w-0 p-4 font-mono text-xs leading-5 text-[#464554] whitespace-pre-wrap break-words">
                        {respTab === 'raw' ? currentResponse.body : formatJson(currentResponse.body)}
                      </pre>
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
        </div>
      </div>

      <aside className="w-72 shrink-0 flex flex-col bg-[#f2f4f6] border-l border-[#c7c4d7]/15 overflow-y-auto min-h-0">
        <div className="p-6 pb-4 border-b border-[#c7c4d7]/15">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[#191c1e]">
            {t('contextualTools')}
          </h2>
          <p className="font-mono text-[10px] text-[#777586] mt-1 uppercase tracking-widest">
            {t('aiPoweredAnalysis')}
          </p>
        </div>

        <div className="flex-1 px-4 py-6 space-y-2">
          {/* Smart Explain */}
          <button
            type="button"
            onClick={() => void handleExplainResponse()}
            disabled={!currentResponse}
            className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all group ${
              activeTool === 'explain'
                ? 'bg-[#ffffff] text-[#2a14b4]'
                : 'hover:bg-[#ffffff] disabled:opacity-40 disabled:cursor-not-allowed'
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

          {/* Smart Debug */}
          <button
            type="button"
            onClick={() => void handleDebugResponse()}
            disabled={!isErrorResponse}
            title={!isErrorResponse ? t('debugOnlyOnError') : undefined}
            className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all group ${
              activeTool === 'debug'
                ? 'bg-[#ffffff] text-[#ba1a1a]'
                : isErrorResponse
                  ? 'hover:bg-[#ffffff]'
                  : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div className={`flex items-center gap-3 ${activeTool === 'debug' ? 'text-[#ba1a1a]' : isErrorResponse ? 'text-[#ba1a1a] group-hover:text-[#ba1a1a]' : 'text-[#777586]'}`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>bug_report</span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('debugAssistant')}</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-[#777586] ml-8">
              {t('debugAssistantHelp')}
            </p>
          </button>

          {/* Response Comparison (placeholder) */}
          <div className="flex flex-col gap-1 p-3 rounded-xl hover:bg-[#ffffff] transition-all group opacity-40">
            <div className="flex items-center gap-3 text-[#777586]">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>compare_arrows</span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('responseComparison')}</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-[#777586] ml-8">
              {t('responseComparisonHelp')}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}