import type { Request, Response } from '../../types';
import type { ExplainResponseResult } from './explainResponse';
import { useApp } from '../../context/AppContext';

interface ExplainResponsePanelProps {
  currentRequest: Request | null;
  currentResponse: Response;
  insight: ExplainResponseResult;
  onRegenerate: () => void;
  mode: 'smart' | 'fallback';
  errorMessage?: string;
}

function metricToneCls(tone: 'good' | 'neutral' | 'warning') {
  if (tone === 'good') return 'bg-[#89f5e7] text-[#00201d]';
  if (tone === 'warning') return 'bg-[#ffdad6] text-[#93000a]';
  return 'bg-[#e6e8ea] text-[#191c1e]';
}

function highlightBadgeCls(badge: string) {
  if (badge === 'Object') return 'bg-[#d5e3fc] text-[#0d1c2e]';
  if (badge === 'List') return 'bg-[#89f5e7] text-[#00201d]';
  if (badge === 'Boolean') return 'bg-[#e3dfff] text-[#100069]';
  if (badge === 'Number') return 'bg-[#ffdad6] text-[#93000a]';
  return 'bg-[#e0e3e5] text-[#464554]';
}

export function ExplainResponsePanel({
  currentRequest,
  currentResponse,
  insight,
  onRegenerate,
  mode,
  errorMessage,
}: ExplainResponsePanelProps) {
  const { t } = useApp();
  return (
    <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#005c54] flex items-center justify-center">
          <span className="material-symbols-outlined text-[#69d6c9]" style={{ fontVariationSettings: "'FILL' 1" }}>
            psychology
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">{t('explainResponseTitle')}</h2>
          <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">
            {t('explainRequestLabel')}: {currentRequest?.title ?? currentResponse.statusText}
          </p>
        </div>
        <div className="ml-auto">
          <span className={`font-mono text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${
            mode === 'smart'
              ? 'bg-[#89f5e7] text-[#00201d]'
              : 'bg-[#ffdad6] text-[#93000a]'
          }`}>
            {mode === 'smart' ? t('smartBadge') : t('fallbackBadge')}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {mode === 'fallback' && errorMessage && (
          <div className="rounded-lg border border-[#ffdad6] bg-[#fff4f2] px-4 py-3 text-xs text-[#93000a] leading-relaxed">
            {t('smartFallbackMessage')} {errorMessage}
          </div>
        )}

        <div className="p-4 rounded bg-[#f2f4f6] border-l-4 border-[#005c54]">
          <h3 className="text-xs font-bold text-[#005c54] uppercase tracking-wider mb-2">{t('smartSummary')}</h3>
          <p className="text-sm leading-relaxed text-[#191c1e]">{insight.summary}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[insight.statusSemantic, insight.latencyTier].map((metric) => (
            <div key={metric.label} className="p-4 bg-[#eceef0] rounded-lg">
              <span className="block text-[10px] text-[#777586] uppercase font-bold tracking-widest mb-2">
                {metric.label}
              </span>
              <div className="flex items-center gap-2">
                {metric.icon && (
                  <span className="material-symbols-outlined text-sm text-[#464554]">{metric.icon}</span>
                )}
                {!metric.icon && <span className={`w-2 h-2 rounded-full ${metric.tone === 'good' ? 'bg-green-500' : metric.tone === 'warning' ? 'bg-[#ba1a1a]' : 'bg-[#515f74]'}`} />}
                <span className={`text-sm font-bold px-2 py-1 rounded ${metricToneCls(metric.tone)}`}>{metric.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {insight.highlights.length === 0 ? (
            <div className="p-4 rounded-lg bg-[#f2f4f6]">
              <p className="text-sm text-[#464554]">
                {t('noStructuredExplain')}
              </p>
            </div>
          ) : (
            insight.highlights.map((highlight) => (
              <div key={highlight.label} className="bg-[#ffffff] p-4 rounded-xl border border-[#c7c4d7]/10 hover:bg-[#f7f9fb] transition-colors">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <h4 className="font-mono text-sm font-bold text-[#2a14b4] break-all">{highlight.label}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest shrink-0 ${highlightBadgeCls(highlight.badge)}`}>
                    {highlight.badge}
                  </span>
                </div>
                <p className="text-xs text-[#464554] leading-relaxed">{highlight.description}</p>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRegenerate}
            className="px-5 py-2.5 bg-[#2a14b4] text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-[#2a14b4]/20"
          >
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            {t('regenerateInsight')}
          </button>
        </div>
      </div>
    </section>
  );
}
