// Request Builder — fedele al mockup request_builder/code.html
import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { executeRequest } from '../../services/httpService';
import type { HttpMethod, Header } from '../../types';

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

type Tab = 'body' | 'headers' | 'params' | 'auth' | 'notes';

export function RequestBuilder() {
  const { t, currentRequest, currentScenario, updateRequest, refreshRequests, setCurrentResponse } = useApp();

  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<Header[]>([]);
  const [body, setBody] = useState('');
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState<Tab>('body');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showMethodMenu, setShowMethodMenu] = useState(false);

  useEffect(() => {
    if (currentRequest) {
      setMethod(currentRequest.method);
      setUrl(currentRequest.url ?? '');
      setHeaders(currentRequest.headers ?? []);
      setBody(currentRequest.body ?? '');
      setNotes(currentRequest.notes ?? '');
      setError('');
      setTab('body');
    }
  }, [currentRequest]);

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

  const handleSend = async () => {
    if (!currentRequest) return;
    if (!url.trim()) { setError('URL is required'); return; }
    setError('');
    setSending(true);
    try {
      const req = { ...currentRequest, method, url: url.trim(), headers, body, notes };
      const response = await executeRequest(req);
      setCurrentResponse(response);
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f7f9fb]">
      {/* Page title */}
      <div className="px-8 pt-8 pb-6">
        <h1 className="text-3xl font-extrabold text-[#191c1e] tracking-tight mb-2">
          {t('requestBuilder')}: {currentRequest.title}
        </h1>
        <p className="text-[#464554] text-sm">
          {t('requestBuilderDesc') || 'Configure and execute technical requests against your service layer.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
        {/* URL bar */}
        <div className="bg-[#ffffff] rounded-xl shadow-sm p-2 flex items-center gap-2 hover:shadow-md transition-shadow border border-[#c7c4d7]/10">
          {/* Method dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMethodMenu(!showMethodMenu)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-mono font-semibold text-sm transition-colors ${methodCls}`}
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
              className={`w-full bg-transparent border-none focus:ring-0 font-mono text-sm text-[#191c1e] py-2 outline-none placeholder:text-[#c7c4d7] ${
                error ? 'text-[#ba1a1a]' : ''
              }`}
            />
          </div>

          {/* Run button */}
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-6 py-3 bg-[#2a14b4] text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm shadow-[#2a14b4]/20"
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              play_arrow
            </span>
            {sending ? t('sending') : 'RUN REQUEST'}
          </button>
        </div>
        {error && <p className="text-xs text-[#ba1a1a] -mt-4">{error}</p>}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: tabs + editor */}
          <div className="lg:col-span-8 bg-[#ffffff] rounded-xl overflow-hidden border border-[#c7c4d7]/10">
            {/* Tab bar */}
            <div className="flex border-b border-[#c7c4d7]/10 bg-[#f2f4f6]/30">
              {tabBtn('body', 'Body (JSON)')}
              {tabBtn('headers', `Headers${headers.filter((h) => h.enabled && h.key).length > 0 ? ` (${headers.filter((h) => h.enabled && h.key).length})` : ''}`)}
              {tabBtn('params', 'Params')}
              {tabBtn('auth', 'Auth')}
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
            <div className="relative">
              {tab === 'body' && (
                <div className="flex">
                  {/* Line numbers gutter */}
                  <div className="w-12 bg-[#e0e3e5] flex flex-col items-center py-4 select-none border-r border-[#c7c4d7]/10">
                    {Array.from({ length: 15 }, (_, i) => (
                      <span key={i} className="font-mono text-[10px] text-[#777586] leading-6">{i + 1}</span>
                    ))}
                  </div>
                  <div className="flex-1 p-4 bg-[#e0e3e5] min-h-[300px]">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onBlur={() => persist({ body })}
                      placeholder={'{\n  "key": "value"\n}'}
                      className="w-full h-full min-h-[280px] bg-transparent border-none focus:ring-0 font-mono text-sm text-[#464554] resize-none outline-none leading-6"
                    />
                  </div>
                </div>
              )}

              {tab === 'headers' && (
                <div className="p-6 space-y-3">
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
                        className="flex-1 px-3 py-2 font-mono text-xs bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 text-[#191c1e] placeholder:text-[#c7c4d7]"
                      />
                      <input
                        value={h.value}
                        onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-3 py-2 font-mono text-xs bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 text-[#191c1e] placeholder:text-[#c7c4d7]"
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

              {(tab === 'params' || tab === 'auth') && (
                <div className="p-8 flex flex-col items-center justify-center text-center opacity-40">
                  <span className="material-symbols-outlined text-4xl mb-3">construction</span>
                  <p className="font-mono text-xs uppercase tracking-widest">Coming Soon</p>
                </div>
              )}

              {tab === 'notes' && (
                <div className="p-4">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => persist({ notes })}
                    placeholder={t('addNote')}
                    rows={10}
                    className="w-full px-4 py-3 text-sm bg-[#f2f4f6] border border-[#c7c4d7]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2a14b4]/20 resize-none text-[#191c1e] placeholder:text-[#c7c4d7]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: metadata + smart suggest */}
          <div className="lg:col-span-4 space-y-6">
            {/* Request metadata */}
            <div className="bg-[#ffffff] rounded-xl p-6 border border-[#c7c4d7]/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#464554] mb-4 flex items-center justify-between">
                Request Metadata
                <span className="material-symbols-outlined text-sm text-[#777586]">info</span>
              </h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-[#777586] uppercase">Content-Type</span>
                  <span className="font-mono text-sm text-[#191c1e]">application/json</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-[#777586] uppercase">Method</span>
                  <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-sm w-fit uppercase ${methodCls}`}>
                    {method}
                  </span>
                </div>
                {url && (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] text-[#777586] uppercase">Endpoint</span>
                    <span className="font-mono text-xs text-[#464554] break-all">{url}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Smart suggest card */}
            <div className="bg-gradient-to-br from-[#4338ca] to-[#2a14b4] p-6 rounded-xl text-white shadow-lg overflow-hidden relative group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    bolt
                  </span>
                  <span className="font-mono text-xs font-bold uppercase tracking-widest opacity-80">
                    Smart Suggest
                  </span>
                </div>
                <p className="text-sm leading-relaxed mb-4 opacity-90">
                  Add an <code className="bg-white/20 px-1 rounded font-mono text-xs">X-Request-ID</code> header to enable better request tracing and debugging.
                </p>
                <button
                  onClick={handleAddHeader}
                  className="w-full py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded font-mono text-[10px] font-bold uppercase tracking-widest transition-colors"
                >
                  Apply Auto-Fix
                </button>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[100px]">code_blocks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
