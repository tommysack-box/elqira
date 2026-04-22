import { useState } from 'react';
import type { ScenarioHealthReportResult } from './scenarioHealthReport';
import { useApp } from '../../context/AppContext';

interface Props {
  result: ScenarioHealthReportResult;
  onRegenerate: () => void;
  onClose: () => void;
}

function LatencyBar({ duration, max }: { duration: number; max: number }) {
  const pct = max > 0 ? Math.round((duration / max) * 100) : 0;
  const tier = duration < 300 ? 'optimal' : duration < 1000 ? 'stable' : 'slow';
  const color = tier === 'optimal' ? 'bg-[#005c54]' : tier === 'stable' ? 'bg-[#2a14b4]' : 'bg-[#ba1a1a]';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-[#e0e3e5] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-[10px] font-bold w-14 text-right ${
        tier === 'optimal' ? 'text-[#005c54]' : tier === 'stable' ? 'text-[#2a14b4]' : 'text-[#ba1a1a]'
      }`}>{duration}ms</span>
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        type="button"
        aria-label="Info"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex items-center justify-center w-4 h-4 rounded-full text-[#777586] hover:text-[#2a14b4] focus:outline-none transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 px-3 py-2.5 bg-[#191c1e] text-white text-[11px] leading-relaxed rounded-lg shadow-xl pointer-events-none"
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#191c1e]" />
        </div>
      )}
    </span>
  );
}

function SectionHeader({ icon, label, tooltip, tone = 'neutral' }: {
  icon: string;
  label: string;
  tooltip?: string;
  tone?: 'good' | 'warning' | 'neutral';
}) {
  const color = tone === 'good' ? 'text-[#005c54]' : tone === 'warning' ? 'text-[#ba1a1a]' : 'text-[#2a14b4]';
  return (
    <div className={`flex items-center gap-2 mb-3 ${color}`}>
      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <h3 className="font-mono text-[10px] font-black uppercase tracking-widest">{label}</h3>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
  );
}

export function ScenarioHealthReportPanel({ result, onRegenerate, onClose }: Props) {
  const { t } = useApp();
  const latencyTierColor = result.latencyProfile.tier === 'optimal'
    ? 'text-[#005c54] bg-[#89f5e7]/30'
    : result.latencyProfile.tier === 'stable'
      ? 'text-[#2a14b4] bg-[#e3dfff]/50'
      : 'text-[#ba1a1a] bg-[#ffdad6]/50';

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header */}
      <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2a14b4]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#2a14b4]" style={{ fontVariationSettings: "'FILL' 1" }}>
              health_metrics
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-[#191c1e]">{t('scenarioHealthReport')}</h2>
            <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest truncate">
              {result.scenarioTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#464554] bg-[#e6e8ea] rounded-lg hover:bg-[#e0e3e5] transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            {t('scenarioHealthClose')}
          </button>
        </div>

        {/* Summary */}
        <div className="mt-4 p-4 rounded-lg bg-[#f2f4f6] border-l-4 border-[#2a14b4]">
          <p className="text-sm leading-relaxed text-[#191c1e]">{result.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* API Consistency */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
          <SectionHeader
            icon="schema"
            label={t('scenarioHealthConsistency')}
            tooltip={t('scenarioHealthConsistencyTooltip')}
            tone={result.consistency.consistent ? 'good' : 'warning'}
          />
          {result.consistency.consistent ? (
            <div className="flex items-center gap-2 text-[#005c54]">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="text-xs">{t('scenarioHealthConsistencyOk')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {result.consistency.issues.map((issue, i) => (
                <div key={i} className="px-3 py-2.5 bg-[#fff4f2] rounded-lg border-l-2 border-[#ba1a1a]">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {issue.requestTitles.map((t) => (
                      <span key={t} className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-[#ffdad6] text-[#93000a] rounded uppercase tracking-widest">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-[#464554] leading-relaxed">{issue.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Patterns */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
          <SectionHeader
            icon="error"
            label={t('scenarioHealthErrors')}
            tooltip={t('scenarioHealthErrorsTooltip')}
            tone={result.errorPatterns.hasErrors ? 'warning' : 'good'}
          />
          {!result.errorPatterns.hasErrors ? (
            <div className="flex items-center gap-2 text-[#005c54]">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="text-xs">{t('scenarioHealthNoErrors')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {result.errorPatterns.patterns.map((p, i) => (
                <div key={i} className="px-3 py-2.5 bg-[#fff4f2] rounded-lg border-l-2 border-[#ba1a1a]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-[10px] font-black px-1.5 py-0.5 bg-[#ffdad6] text-[#93000a] rounded">
                      {p.statusCode === 0 ? 'ERR' : p.statusCode}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {p.requests.map((r) => (
                        <span key={r} className="font-mono text-[9px] text-[#777586] px-1 py-0.5 bg-[#f2f4f6] rounded">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[#464554] leading-relaxed">{p.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Implicit Dependencies */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
          <SectionHeader icon="account_tree" label={t('scenarioHealthDeps')} tooltip={t('scenarioHealthDepsTooltip')} tone="neutral" />
          {result.implicitDependencies.dependencies.length === 0 ? (
            <div className="flex items-center gap-2 text-[#005c54]">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="text-xs">{t('scenarioHealthNoDeps')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {result.implicitDependencies.dependencies.map((d, i) => (
                <div key={i} className="px-3 py-2.5 bg-[#f7f6ff] rounded-lg border-l-2 border-[#2a14b4]">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-[#e3dfff] text-[#2a14b4] rounded uppercase tracking-widest">
                      {d.sourceRequest}
                    </span>
                    <span className="material-symbols-outlined text-sm text-[#777586]">arrow_forward</span>
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-[#e3dfff] text-[#2a14b4] rounded uppercase tracking-widest">
                      {d.targetRequest}
                    </span>
                    <span className="font-mono text-[9px] text-[#777586] ml-auto">
                      {d.field}
                    </span>
                  </div>
                  <p className="text-xs text-[#464554] leading-relaxed">{d.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latency Profile */}
        <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
          <SectionHeader icon="timer" label={t('scenarioHealthLatency')} tooltip={t('scenarioHealthLatencyTooltip')} tone="neutral" />
          <div className="flex items-center gap-3 mb-4">
            <span className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${latencyTierColor}`}>
              {t('scenarioHealthAvg')} {result.latencyProfile.avgMs}ms
            </span>
            {result.latencyProfile.bottleneck && (
              <span className="font-mono text-[10px] text-[#ba1a1a]">
                <span className="font-bold">{t('scenarioHealthBottleneck')}:</span> {result.latencyProfile.bottleneck}
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {result.latencyProfile.entries.map((e, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-[#464554] truncate max-w-[60%]">{e.title}</span>
                </div>
                <LatencyBar duration={e.duration} max={result.latencyProfile.maxMs} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end">
        <button
          onClick={onRegenerate}
          className="px-5 py-2.5 bg-[#2a14b4] text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-[#2a14b4]/20"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          {t('scenarioHealthRegenerate')}
        </button>
      </div>
    </div>
  );
}
