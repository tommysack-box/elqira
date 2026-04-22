import type { Response } from '../../types';
import type { CompareResponseResult, SemanticNote } from './compareResponse';
import { useApp } from '../../context/AppContext';

interface CompareResponsePanelProps {
  baseline: Response;
  current: Response;
  result: CompareResponseResult;
  onRegenerate: () => void;
  onClearBaseline: () => void;
}

function riskColors(risk: CompareResponseResult['regressionRisk']) {
  if (risk === 'high') return { badge: 'bg-[#ffdad6] text-[#93000a]', dot: 'bg-[#ba1a1a]' };
  if (risk === 'medium') return { badge: 'bg-[#ffdad6] text-[#464554]', dot: 'bg-[#515f74]' };
  if (risk === 'low') return { badge: 'bg-[#e3dfff] text-[#372abf]', dot: 'bg-[#2a14b4]' };
  return { badge: 'bg-[#89f5e7] text-[#00201d]', dot: 'bg-green-500' };
}

function noteColors(severity: SemanticNote['severity']) {
  if (severity === 'critical') return 'border-[#ba1a1a] bg-[#fff4f2]';
  if (severity === 'warning') return 'border-[#2a14b4] bg-[#f7f6ff]';
  return 'border-[#005c54] bg-[#f0fffe]';
}

function noteIconColor(severity: SemanticNote['severity']) {
  if (severity === 'critical') return 'text-[#ba1a1a]';
  if (severity === 'warning') return 'text-[#2a14b4]';
  return 'text-[#005c54]';
}

function noteIcon(severity: SemanticNote['severity']) {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function statusLabel(resp: Response): string {
  return resp.statusCode === 0 ? 'ERR' : `${resp.statusCode} ${resp.statusText}`;
}

function getStatusColor(code: number) {
  if (code === 0) return 'bg-[#ffdad6] text-[#93000a]';
  if (code >= 500) return 'bg-[#ffdad6] text-[#ba1a1a]';
  if (code >= 400) return 'bg-[#d5e3fc] text-[#3a485b]';
  if (code >= 200) return 'bg-[#89f5e7] text-[#00201d]';
  return 'bg-[#e0e3e5] text-[#464554]';
}

export function CompareResponsePanel({
  baseline,
  current,
  result,
  onRegenerate,
  onClearBaseline,
}: CompareResponsePanelProps) {
  const { t } = useApp();
  const risk = riskColors(result.regressionRisk);
  const totalDiffs = result.addedFields.length + result.removedFields.length + result.changedFields.length;

  return (
    <section className="bg-[#ffffff] rounded-xl p-6 shadow-sm border border-[#c7c4d7]/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#372abf]/10 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[#2a14b4]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            compare_arrows
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">
            {t('compareResponseTitle')}
          </h2>
          <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">
            {t('compareBaselineLabel')} vs {t('compareCurrentLabel')}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Snapshot comparison strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#f2f4f6] rounded-lg border border-[#c7c4d7]/20">
            <p className="text-[10px] font-bold text-[#777586] uppercase tracking-widest mb-1.5">
              {t('compareBaselineLabel')}
            </p>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${getStatusColor(baseline.statusCode)}`}>
                {statusLabel(baseline)}
              </span>
              <span className="font-mono text-[10px] text-[#777586]">{baseline.duration}ms</span>
            </div>
          </div>
          <div className="p-3 bg-[#f2f4f6] rounded-lg border border-[#c7c4d7]/20">
            <p className="text-[10px] font-bold text-[#777586] uppercase tracking-widest mb-1.5">
              {t('compareCurrentLabel')}
            </p>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${getStatusColor(current.statusCode)}`}>
                {statusLabel(current)}
              </span>
              <span className="font-mono text-[10px] text-[#777586]">{current.duration}ms</span>
              {result.latencyDelta !== 0 && (
                <span className={`font-mono text-[10px] font-bold ${result.latencyDelta > 0 ? 'text-[#ba1a1a]' : 'text-[#005c54]'}`}>
                  {result.latencyDelta > 0 ? '+' : ''}{result.latencyDelta}ms
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 rounded bg-[#f2f4f6] border-l-4 border-[#2a14b4]">
          <h3 className="text-xs font-bold text-[#2a14b4] uppercase tracking-wider mb-2">
            {t('compareSummary')}
          </h3>
          <p className="text-sm leading-relaxed text-[#191c1e]">{result.summary}</p>
        </div>

        {/* Regression risk */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#f2f4f6] rounded-lg">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${risk.dot}`} />
          <span className="text-[10px] font-bold text-[#777586] uppercase tracking-widest">
            {t('compareRegressionRisk')}
          </span>
          <span className={`ml-auto font-mono text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${risk.badge}`}>
            {t(`compareRisk_${result.regressionRisk}` as Parameters<typeof t>[0])}
          </span>
        </div>

        {/* Diff sections */}
        {totalDiffs > 0 && (
          <div className="space-y-3">
            {/* Added fields */}
            {result.addedFields.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-[#005c54] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                  {t('compareAdded')} ({result.addedFields.length})
                </h4>
                <div className="space-y-1.5">
                  {result.addedFields.map((f) => (
                    <div key={f.path} className="flex items-start gap-3 px-3 py-2 bg-[#f0fffe] rounded-lg border-l-2 border-[#005c54]">
                      <span className="font-mono text-[11px] font-bold text-[#005c54] break-all">{f.path}</span>
                      <span className="font-mono text-[10px] text-[#464554] ml-auto shrink-0 max-w-[120px] truncate" title={f.value}>
                        {f.value.length > 20 ? `${f.value.slice(0, 20)}…` : f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Removed fields */}
            {result.removedFields.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>remove_circle</span>
                  {t('compareRemoved')} ({result.removedFields.length})
                </h4>
                <div className="space-y-1.5">
                  {result.removedFields.map((f) => (
                    <div key={f.path} className="flex items-start gap-3 px-3 py-2 bg-[#fff4f2] rounded-lg border-l-2 border-[#ba1a1a]">
                      <span className="font-mono text-[11px] font-bold text-[#ba1a1a] break-all">{f.path}</span>
                      <span className="font-mono text-[10px] text-[#464554] ml-auto shrink-0 max-w-[120px] truncate" title={f.value}>
                        {f.value.length > 20 ? `${f.value.slice(0, 20)}…` : f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Changed fields */}
            {result.changedFields.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-[#372abf] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>edit</span>
                  {t('compareChanged')} ({result.changedFields.length})
                </h4>
                <div className="space-y-2">
                  {result.changedFields.map((f) => (
                    <div key={f.path} className="px-3 py-2.5 bg-[#f7f6ff] rounded-lg border-l-2 border-[#2a14b4]">
                      <span className="font-mono text-[11px] font-bold text-[#2a14b4] block mb-1.5">{f.path}</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#ffdad6]/40 rounded px-2 py-1">
                          <span className="block text-[9px] text-[#777586] uppercase font-bold mb-0.5">before</span>
                          <span className="font-mono text-[10px] text-[#464554] break-all">
                            {f.baselineValue.length > 30 ? `${f.baselineValue.slice(0, 30)}…` : f.baselineValue}
                          </span>
                        </div>
                        <div className="bg-[#89f5e7]/40 rounded px-2 py-1">
                          <span className="block text-[9px] text-[#777586] uppercase font-bold mb-0.5">after</span>
                          <span className="font-mono text-[10px] text-[#464554] break-all">
                            {f.currentValue.length > 30 ? `${f.currentValue.slice(0, 30)}…` : f.currentValue}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {totalDiffs === 0 && (
          <div className="p-4 rounded-lg bg-[#89f5e7]/20 border border-[#005c54]/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#005c54]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="text-sm text-[#005c54] font-medium">{t('compareNoDiff')}</p>
          </div>
        )}

        {/* Semantic notes */}
        {result.semanticNotes.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold text-[#777586] uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">hub</span>
              {t('compareSemanticNotes')}
            </h4>
            <div className="space-y-2">
              {result.semanticNotes.map((note, i) => (
                <div key={i} className={`px-3 py-2.5 rounded-lg border-l-2 ${noteColors(note.severity)}`}>
                  <div className="flex items-start gap-2">
                    <span
                      className={`material-symbols-outlined text-sm shrink-0 mt-0.5 ${noteIconColor(note.severity)}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {noteIcon(note.severity)}
                    </span>
                    <p className="text-xs text-[#464554] leading-relaxed">{note.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onClearBaseline}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#777586] bg-[#f2f4f6] rounded-lg hover:bg-[#e6e8ea] transition-colors"
          >
            <span className="material-symbols-outlined text-sm">delete_outline</span>
            {t('compareClearBaseline')}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="px-5 py-2.5 bg-[#2a14b4] text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-[#2a14b4]/20"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            {t('compareRegenerate')}
          </button>
        </div>
      </div>
    </section>
  );
}
