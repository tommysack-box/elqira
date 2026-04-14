import type { Request, Response } from '../../types';
import type { DebugResponseResult, DebugRootCause } from './debugResponse';
import { useApp } from '../../context/AppContext';

interface DebugAssistantPanelProps {
  currentRequest: Request | null;
  currentResponse: Response;
  result: DebugResponseResult;
  onRegenerate: () => void;
  mode: 'smart' | 'fallback';
  errorMessage?: string;
}

function severityBorderCls(severity: DebugRootCause['severity']) {
  if (severity === 'high') return 'border-[#ba1a1a]';
  if (severity === 'medium') return 'border-[#005c54]';
  return 'border-[#c7c4d7]';
}

function severityBadgeCls(severity: DebugRootCause['severity']) {
  if (severity === 'high') return 'bg-[#ffdad6] text-[#93000a]';
  if (severity === 'medium') return 'bg-[#89f5e7] text-[#00201d]';
  return 'bg-[#e0e3e5] text-[#464554]';
}

export function DebugAssistantPanel({
  currentRequest,
  currentResponse,
  result,
  onRegenerate,
  mode,
  errorMessage,
}: DebugAssistantPanelProps) {
  const { t } = useApp();

  const statusBadge =
    currentResponse.statusCode === 0
      ? 'ERR'
      : `${currentResponse.statusCode} ${currentResponse.statusText}`;

  return (
    <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#93000a]/10 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[#ba1a1a]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            bug_report
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">
            {t('debugAssistantTitle')}
          </h2>
          <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">
            {t('debugRequestLabel')}: {currentRequest?.title ?? currentResponse.statusText}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest bg-[#ffdad6] text-[#93000a]">
            {statusBadge}
          </span>
          <span
            className={`font-mono text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${
              mode === 'smart'
                ? 'bg-[#89f5e7] text-[#00201d]'
                : 'bg-[#e0e3e5] text-[#464554]'
            }`}
          >
            {mode === 'smart' ? t('smartBadge') : t('fallbackBadge')}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Fallback warning */}
        {mode === 'fallback' && errorMessage && (
          <div className="rounded-lg border border-[#ffdad6] bg-[#fff4f2] px-4 py-3 text-xs text-[#93000a] leading-relaxed">
            {t('debugFallbackMessage')} {errorMessage}
          </div>
        )}

        {/* Summary */}
        <div className="p-4 rounded bg-[#f2f4f6] border-l-4 border-[#ba1a1a]">
          <h3 className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider mb-2">
            {t('debugSummary')}
          </h3>
          <p className="text-sm leading-relaxed text-[#191c1e]">{result.summary}</p>
        </div>

        {/* Root Causes */}
        <div>
          <h3 className="text-[10px] font-bold text-[#777586] uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#ba1a1a]">hub</span>
            {t('debugRootCausesLabel')}
          </h3>
          <div className="space-y-3">
            {result.rootCauses.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#f2f4f6]">
                <p className="text-sm text-[#464554]">{t('debugNoRootCauses')}</p>
              </div>
            ) : (
              result.rootCauses.map((cause, i) => (
                <div
                  key={i}
                  className={`p-4 bg-[#f2f4f6] rounded-lg border-l-4 ${severityBorderCls(cause.severity)}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h4 className="text-sm font-bold text-[#191c1e]">{cause.title}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest shrink-0 ${severityBadgeCls(cause.severity)}`}
                    >
                      {t(`debugSeverity_${cause.severity}` as Parameters<typeof t>[0])}
                    </span>
                  </div>
                  <p className="text-xs text-[#464554] leading-relaxed">{cause.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Suggested Fixes */}
        {result.suggestedFixes.length > 0 && (
          <div className="rounded-xl bg-[#2a14b4] p-5 shadow-lg shadow-[#2a14b4]/20">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
              <span className="text-white text-[10px] font-bold uppercase tracking-widest">
                {t('debugSuggestedFixes')}
              </span>
            </div>
            <ul className="space-y-3">
              {result.suggestedFixes.map((fix, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="material-symbols-outlined text-[#89f5e7] text-sm mt-0.5 shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <span className="text-xs text-white leading-relaxed font-medium">
                    {fix.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Regenerate button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRegenerate}
            className="px-5 py-2.5 bg-[#ba1a1a] text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-[#ba1a1a]/20"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            {t('debugRegenerate')}
          </button>
        </div>
      </div>
    </section>
  );
}
