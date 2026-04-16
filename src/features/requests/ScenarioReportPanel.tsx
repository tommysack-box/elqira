import { EntityTag } from '../../components/EntityTag';
import { useApp } from '../../context/AppContext';
import type { ScenarioReportEntry, ScenarioReportResult } from './scenarioReport';

interface Props {
  result: ScenarioReportResult;
  onRegenerate: () => void;
  onClose: () => void;
  onOpenPrintable: () => void;
}

function renderSchema(rows: Array<{ path: string; type: string }>): string {
  return rows.length > 0 ? rows.map((row) => `${row.path}: ${row.type}`).join('\n') : '—';
}

function schemaFor(entry: ScenarioReportEntry) {
  return entry;
}

export function ScenarioReportPanel({ result, onRegenerate, onClose, onOpenPrintable }: Props) {
  const { t } = useApp();
  const scenarioDescription = result.scenario.description?.trim();
  const scenarioTag = result.scenario.tag?.trim();
  const scenarioVersion = result.scenario.version?.trim();

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
        {(scenarioTag || scenarioVersion) && (
          <div className="flex items-start gap-3 mb-4">
            {scenarioTag && <EntityTag tag={scenarioTag} fallback={t('scenario')} className="self-start" />}
            {scenarioVersion && (
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-widest uppercase bg-[#e3dfff] text-[#100069]">
                {scenarioVersion}
              </span>
            )}
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2a14b4]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#2a14b4]" style={{ fontVariationSettings: "'FILL' 1" }}>
              description
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-[#191c1e]">{t('scenarioReportTitle')}</h2>
            <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest truncate">
              {result.scenario.title}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenPrintable}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2a14b4] bg-[#e3dfff] rounded-lg hover:bg-[#d8d0ff] transition-colors"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              {t('scenarioReportPrintable')}
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#464554] bg-[#e6e8ea] rounded-lg hover:bg-[#e0e3e5] transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              {t('scenarioReportClose')}
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-[#f2f4f6] border-l-4 border-[#2a14b4]">
          <p className="text-sm leading-relaxed text-[#191c1e]">{scenarioDescription || '—'}</p>
        </div>
      </div>

      <div className="space-y-4">
        {result.entries.map((entry, index) => {
          const { request } = entry;
          const schema = schemaFor(entry);
          return (
            <section key={request.id} className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
              <div className="flex items-start gap-4 justify-between mb-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">
                    {t('request')} {index + 1}
                  </p>
                  <h3 className="text-base font-bold text-[#191c1e] truncate">{request.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#464554] whitespace-pre-wrap break-words">
                    {request.description?.trim() ? request.description : '—'}
                  </p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-[#e3dfff] text-[#2a14b4]">
                      {request.method}
                    </span>
                    <span className="font-mono text-[11px] text-[#464554] break-all">{request.url}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <article className="rounded-xl border border-[#c7c4d7]/10 bg-[#fafbfd] p-4">
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-[#2a14b4] mb-3">{t('request')}</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">URL</p>
                      <pre className="mt-1 text-[11px] font-mono text-[#464554] whitespace-pre-wrap break-all bg-[#f2f4f6] rounded-lg p-3">{request.url}</pre>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('scenarioReportHeadersSchema')}</p>
                      <pre className="mt-1 text-[11px] font-mono text-[#464554] whitespace-pre-wrap break-all bg-[#f2f4f6] rounded-lg p-3">{renderSchema(schema.requestHeadersSchema)}</pre>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('scenarioReportParamsSchema')}</p>
                      <pre className="mt-1 text-[11px] font-mono text-[#464554] whitespace-pre-wrap break-all bg-[#f2f4f6] rounded-lg p-3">{renderSchema(schema.requestParamsSchema)}</pre>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('scenarioReportBodySchema')}</p>
                      <pre className="mt-1 text-[11px] font-mono text-[#464554] whitespace-pre-wrap break-all bg-[#f2f4f6] rounded-lg p-3">{renderSchema(schema.requestBodySchema)}</pre>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('requestNotes')}</p>
                      <pre className="mt-1 text-[11px] font-mono text-[#464554] whitespace-pre-wrap break-all bg-[#f2f4f6] rounded-lg p-3">{request.notes?.trim() ? request.notes : '—'}</pre>
                    </div>
                  </div>
                </article>

                <article className="rounded-xl border border-[#c7c4d7]/10 bg-[#fafbfd] p-4">
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-[#2a14b4] mb-3">{t('response')}</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('scenarioReportHeadersSchema')}</p>
                      <pre className="mt-1 text-[11px] font-mono text-[#464554] whitespace-pre-wrap break-all bg-[#f2f4f6] rounded-lg p-3">{renderSchema(schema.responseHeadersSchema)}</pre>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('scenarioReportBodySchema')}</p>
                      <pre className="mt-1 text-[11px] font-mono text-[#464554] whitespace-pre-wrap break-all bg-[#f2f4f6] rounded-lg p-3">{renderSchema(schema.responseBodySchema)}</pre>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onRegenerate}
          className="px-5 py-2.5 bg-[#2a14b4] text-white text-sm font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-[#2a14b4]/20"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          {t('scenarioReportRegenerate')}
        </button>
      </div>
    </div>
  );
}
