// Response Inspector — fedele al mockup response_inspector/code.html
import { useState } from 'react';
import { useApp } from '../../context/AppContext';

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function getStatusColor(code: number): string {
  if (code === 0) return 'bg-[#ffdad6] text-[#93000a]';
  if (code >= 500) return 'bg-[#ffdad6] text-[#ba1a1a]';
  if (code >= 400) return 'bg-[#d5e3fc] text-[#3a485b]';
  if (code >= 300) return 'bg-[#e3dfff] text-[#372abf]';
  if (code >= 200) return 'bg-[#89f5e7] text-[#00201d]';
  return 'bg-[#e0e3e5] text-[#464554]';
}

function getDotColor(code: number): string {
  if (code === 0) return 'bg-[#ba1a1a]';
  if (code >= 500) return 'bg-[#ba1a1a]';
  if (code >= 400) return 'bg-[#515f74]';
  if (code >= 300) return 'bg-[#2a14b4]';
  if (code >= 200) return 'bg-green-500';
  return 'bg-[#777586]';
}

type RespTab = 'preview' | 'raw' | 'headers';

export function ResponseInspector() {
  const { t, currentResponse } = useApp();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<RespTab>('preview');

  const handleCopy = () => {
    if (!currentResponse) return;
    navigator.clipboard.writeText(formatJson(currentResponse.body));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!currentResponse) {
    return (
      <div className="flex-1 flex flex-col bg-[#f2f4f6] rounded-xl overflow-hidden border border-[#c7c4d7]/10">
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#c7c4d7]/10">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs font-bold text-[#464554] uppercase tracking-widest">
              Response Output
            </span>
          </div>
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center opacity-40 py-20 flex-1">
          <span className="material-symbols-outlined text-4xl mb-4 text-[#777586]">terminal</span>
          <p className="font-mono text-sm uppercase tracking-widest text-[#777586]">
            Awaiting Command Execution
          </p>
          <p className="text-xs mt-2 text-[#777586]">
            Click 'Run Request' to see live API responses here.
          </p>
        </div>
      </div>
    );
  }

  const bodyFormatted = formatJson(currentResponse.body);
  const isError = currentResponse.statusCode === 0;
  const statusCls = getStatusColor(currentResponse.statusCode);
  const dotCls = getDotColor(currentResponse.statusCode);

  const responseHeaders = Object.entries(currentResponse.headers ?? {});

  return (
    <div className="flex-1 flex flex-col bg-[#f2f4f6] rounded-xl overflow-hidden border border-[#c7c4d7]/10">
      {/* Stats bar (4 cards) */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-[#c7c4d7]/10">
        <div className="bg-[#ffffff] p-3 rounded-xl border border-[#c7c4d7]/10 flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold text-[#777586] uppercase tracking-widest">Status</span>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${dotCls}`} />
            <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${statusCls}`}>
              {isError ? 'ERR' : currentResponse.statusCode}
            </span>
          </div>
        </div>
        <div className="bg-[#ffffff] p-3 rounded-xl border border-[#c7c4d7]/10 flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold text-[#777586] uppercase tracking-widest">Time</span>
          <span className="font-mono text-sm font-bold text-[#191c1e]">{currentResponse.duration}{t('ms')}</span>
        </div>
        <div className="bg-[#ffffff] p-3 rounded-xl border border-[#c7c4d7]/10 flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold text-[#777586] uppercase tracking-widest">Size</span>
          <span className="font-mono text-sm font-bold text-[#191c1e]">
            {(new TextEncoder().encode(currentResponse.body).length / 1024).toFixed(1)} KB
          </span>
        </div>
        <div className="bg-[#ffffff] p-3 rounded-xl border border-[#c7c4d7]/10 flex items-center justify-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#464554] bg-[#f2f4f6] rounded-lg hover:bg-[#e6e8ea] transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? t('copied') : t('copyResponse')}
          </button>
        </div>
      </div>

      {/* Tab bar + body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#c7c4d7]/10 bg-[#ffffff]">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs font-bold text-[#464554] uppercase tracking-widest">
              Response Output
            </span>
            <div className="h-4 w-px bg-[#c7c4d7]/20" />
            <span className={`font-mono text-xs font-semibold ${isError ? 'text-[#ba1a1a]' : 'text-[#00423c]'}`}>
              {isError ? 'Network Error' : `${currentResponse.statusCode} ${currentResponse.statusText}`}
            </span>
            <span className="font-mono text-xs text-[#777586]">{currentResponse.duration}{t('ms')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('raw')}
              className={`px-3 py-1 font-mono text-[10px] font-bold border rounded transition-colors ${
                tab === 'raw'
                  ? 'bg-[#e3dfff]/30 text-[#2a14b4] border-[#2a14b4]/20'
                  : 'border-[#c7c4d7]/20 text-[#464554] hover:bg-[#f2f4f6]'
              }`}
            >
              RAW
            </button>
            <button
              onClick={() => setTab('preview')}
              className={`px-3 py-1 font-mono text-[10px] font-bold border rounded transition-colors ${
                tab === 'preview'
                  ? 'bg-[#2a14b4]/10 text-[#2a14b4] border-[#2a14b4]/20'
                  : 'border-[#c7c4d7]/20 text-[#464554] hover:bg-[#f2f4f6]'
              }`}
            >
              PREVIEW
            </button>
            {responseHeaders.length > 0 && (
              <button
                onClick={() => setTab('headers')}
                className={`px-3 py-1 font-mono text-[10px] font-bold border rounded transition-colors ${
                  tab === 'headers'
                    ? 'bg-[#2a14b4]/10 text-[#2a14b4] border-[#2a14b4]/20'
                    : 'border-[#c7c4d7]/20 text-[#464554] hover:bg-[#f2f4f6]'
                }`}
              >
                HEADERS
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {tab !== 'headers' && (
            <>
              {/* Gutter */}
              <div className="w-10 bg-[#e6e8ea] flex flex-col items-center py-4 select-none border-r border-[#c7c4d7]/15">
                {bodyFormatted.split('\n').map((_, i) => (
                  <span key={i} className="font-mono text-[10px] text-[#777586] leading-6">{i + 1}</span>
                ))}
              </div>
              {/* Code */}
              <div className="flex-1 overflow-auto p-4 bg-[#e6e8ea]">
                {tab === 'preview' ? (
                  <pre className="max-w-full font-mono text-xs leading-6 text-[#464554] whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
                    {bodyFormatted}
                  </pre>
                ) : (
                  <pre className="max-w-full font-mono text-xs leading-6 text-[#464554] whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
                    {currentResponse.body}
                  </pre>
                )}
              </div>
            </>
          )}

          {tab === 'headers' && (
            <div className="flex-1 overflow-auto p-6">
              {responseHeaders.length === 0 ? (
                <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest">No headers</p>
              ) : (
                <div className="space-y-3">
                  {responseHeaders.map(([k, v]) => (
                    <div key={k}>
                      <span className="block font-mono text-[10px] text-[#777586]">{k}</span>
                      <span className="text-xs font-medium text-[#464554] break-all [overflow-wrap:anywhere]">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
