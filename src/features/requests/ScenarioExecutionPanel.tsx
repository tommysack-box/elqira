import { useState } from 'react';
import { JsonCodeBlock } from '../../components/JsonCodeBlock';
import type {
  Request,
  RequestVariableSourceType,
  RequestVariableTargetType,
  Response,
  Scenario,
  ScenarioExecutionLink,
} from '../../types';
import type { ScenarioExecutionReport, ScenarioExecutionStepResult } from './scenarioExecution';

interface Props {
  scenario: Pick<Scenario, 'title' | 'description' | 'tag' | 'version'>;
  requests: Array<Pick<Request, 'id' | 'title' | 'requestOrder' | 'headers' | 'params' | 'body'>>;
  requestsCount: number;
  executionLinks: ScenarioExecutionLink[];
  responseCatalog: Array<{ requestId: string; response: Response }>;
  steps: ScenarioExecutionStepResult[];
  running: boolean;
  report: ScenarioExecutionReport | null;
  onAddLink: () => void;
  onUpdateLink: (linkId: string, patch: Partial<ScenarioExecutionLink>) => void;
  onRemoveLink: (linkId: string) => void;
  onRun: () => void;
  onClose: () => void;
}

const SOURCE_TYPES: Array<{ value: RequestVariableSourceType; label: string }> = [
  { value: 'response-body', label: 'Response Body' },
  { value: 'response-header', label: 'Response Header' },
];

const TARGET_TYPES: Array<{ value: RequestVariableTargetType; label: string }> = [
  { value: 'header', label: 'Header' },
  { value: 'param', label: 'Query Param' },
  { value: 'body', label: 'Body Field' },
];

function statusTone(status: ScenarioExecutionStepResult['status']) {
  switch (status) {
    case 'running':
      return 'bg-[#e3dfff] text-[#2a14b4]';
    case 'success':
      return 'bg-[#ddfbf6] text-[#005c54]';
    case 'warning':
      return 'bg-[#fff1c2] text-[#7a4b00]';
    case 'failed':
      return 'bg-[#ffdad6] text-[#93000a]';
    case 'skipped':
      return 'bg-[#eceef0] text-[#777586]';
    default:
      return 'bg-[#f2f4f6] text-[#464554]';
  }
}

function statusLabel(status: ScenarioExecutionStepResult['status']) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'success':
      return 'Success';
    case 'warning':
      return 'Warning';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Queued';
  }
}

function isStepInspectable(status: ScenarioExecutionStepResult['status']) {
  return status === 'success' || status === 'warning' || status === 'failed';
}

function isJsonPayload(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function getOrderedRequests(
  requests: Array<Pick<Request, 'id' | 'title' | 'requestOrder' | 'headers' | 'params' | 'body'>>,
) {
  return [...requests].sort((a, b) => {
    const aOrder = a.requestOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.requestOrder ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

function getRequestLabel(
  requestId: string | undefined,
  requests: Array<Pick<Request, 'id' | 'title' | 'requestOrder' | 'headers' | 'params' | 'body'>>,
) {
  const request = requests.find((entry) => entry.id === requestId);
  if (!request) return requestId ? 'Unknown Request' : 'Select Request';

  return typeof request.requestOrder === 'number'
    ? `${request.requestOrder + 1}. ${request.title}`
    : request.title;
}

function reportTone(result?: ScenarioExecutionReport['result']) {
  switch (result) {
    case 'success':
      return 'text-[#005c54]';
    case 'warning':
      return 'text-[#7a4b00]';
    case 'failed':
      return 'text-[#93000a]';
    default:
      return 'text-[#464554]';
  }
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString();
}

function uniqueFieldOptions(values: string[]) {
  return Array.from(new Set(
    values
      .map((value) => value.trim())
      .filter(Boolean)
  )).map((value) => ({ value, label: value }));
}

function collectJsonFieldPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => {
      const nextPrefix = prefix ? `${prefix}.${index}` : String(index);
      return collectJsonFieldPaths(entry, nextPrefix);
    });
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return collectJsonFieldPaths(entry, nextPrefix);
    });
  }

  return prefix ? [prefix] : [];
}

function getJsonFieldOptions(raw: string | undefined) {
  if (!raw?.trim()) return [];

  try {
    return uniqueFieldOptions(collectJsonFieldPaths(JSON.parse(raw) as unknown));
  } catch {
    return [];
  }
}

function getHeaderFieldOptions(headers: Array<Pick<Request['headers'][number], 'key'>>) {
  return uniqueFieldOptions(headers.map((header) => header.key));
}

function getParamFieldOptions(params: Request['params']) {
  return uniqueFieldOptions((params ?? []).map((param) => param.key));
}

function withCurrentFieldOption(
  options: Array<{ value: string; label: string }>,
  currentValue: string | undefined,
) {
  const trimmedValue = currentValue?.trim();
  if (!trimmedValue) return options;
  if (options.some((option) => option.value === trimmedValue)) return options;
  return [{ value: trimmedValue, label: `${trimmedValue} (current)` }, ...options];
}

function getSourceFieldPlaceholder(link: ScenarioExecutionLink, hasResponse: boolean, hasOptions: boolean) {
  if (!link.sourceRequestId) return 'Select source request first';
  if (!link.sourceType) return 'Select source type first';
  if (!hasResponse) return 'Run the source request to load fields';
  if (!hasOptions) {
    return link.sourceType === 'response-body'
      ? 'No response body fields available'
      : 'No response headers available';
  }
  return 'Select source field';
}

function getDestinationFieldPlaceholder(link: ScenarioExecutionLink, hasRequest: boolean, hasOptions: boolean) {
  if (!link.targetRequestId) return 'Select destination request first';
  if (!link.targetType) return 'Select destination type first';
  if (!hasRequest) return 'Destination request unavailable';
  if (!hasOptions) {
    if (link.targetType === 'body') return 'No request body fields available';
    if (link.targetType === 'param') return 'No request params available';
    return 'No request headers available';
  }
  return 'Select destination field';
}

export function ScenarioExecutionPanel({
  scenario,
  requests,
  requestsCount,
  executionLinks,
  responseCatalog,
  steps,
  running,
  report,
  onAddLink,
  onUpdateLink,
  onRemoveLink,
  onRun,
  onClose,
}: Props) {
  const successCount = steps.filter((step) => step.status === 'success').length;
  const warningCount = steps.filter((step) => step.status === 'warning').length;
  const failedCount = steps.filter((step) => step.status === 'failed').length;
  const runningStep = steps.find((step) => step.status === 'running') ?? null;
  const orderedRequests = getOrderedRequests(requests);
  const requestById = new Map(orderedRequests.map((request) => [request.id, request]));
  const responseByRequestId = new Map(responseCatalog.map((entry) => [entry.requestId, entry.response]));
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const effectiveExpandedStepId = running
    ? null
    : steps.some((step) => step.requestId === expandedStepId && isStepInspectable(step.status))
      ? expandedStepId
      : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <section className="overflow-hidden rounded-xl border border-[#c7c4d7]/10 bg-[#ffffff] shadow-sm">
        <div className="border-b border-[#c7c4d7]/10 px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2a14b4]/10">
                <span className="material-symbols-outlined text-[#2a14b4]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  account_tree
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight text-[#191c1e]">Scenario Execution</h2>
                <p className="mt-2 text-sm font-semibold text-[#191c1e]">{scenario.title}</p>
                {scenario.description?.trim() && (
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#464554]">{scenario.description}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onRun}
                disabled={running || requestsCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2a14b4] px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-[#2a14b4]/20 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
                {running ? 'Running scenario' : 'Run Scenario'}
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-lg bg-[#e6e8ea] px-3 py-3 text-xs font-semibold text-[#464554] transition-colors hover:bg-[#e0e3e5]"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Close Panel
              </button>
            </div>
          </div>

        </div>

        {runningStep && (
          <div className="border-b border-[#c7c4d7]/10 bg-[#f7f6ff] px-5 py-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2a14b4]">Current Step</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#191c1e]">{runningStep.requestTitle}</p>
                <p className="font-mono text-[11px] text-[#777586] break-all">{runningStep.method} {runningStep.url}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e3dfff] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#2a14b4]">
                <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>
                Running
              </span>
            </div>
          </div>
        )}

        <div className="divide-y divide-[#c7c4d7]/10">
          {steps.length === 0 ? (
            <div className="px-5 py-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">
                No requests available in this scenario.
              </p>
            </div>
          ) : (
            steps.map((step, index) => {
              const inspectable = !running && isStepInspectable(step.status);
              const expanded = effectiveExpandedStepId === step.requestId;
              const responseHeaders = Object.entries(step.response?.headers ?? {});
              const hasJsonBody = step.response ? isJsonPayload(step.response.body) : false;
              const runningStyles = step.status === 'running'
                ? 'border-[#2a14b4]/30 bg-[#f7f6ff] shadow-[0_0_0_1px_rgba(42,20,180,0.08)]'
                : expanded
                  ? 'border-[#c7c4d7]/20 bg-[#fafbfd]'
                  : 'border-transparent bg-transparent';
              const inspectableStyles = inspectable
                ? 'cursor-pointer hover:border-[#2a14b4]/20 hover:bg-[#f7f6ff] hover:shadow-[0_10px_24px_rgba(42,20,180,0.08)]'
                : '';

              const summaryContent = (
                <div className={`rounded-xl border px-4 py-4 transition-all ${runningStyles} ${inspectableStyles}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                          step.status === 'running'
                            ? 'bg-[#2a14b4] text-white'
                            : 'bg-[#f2f4f6] text-[#464554]'
                        }`}>
                          {index + 1}
                        </span>
                        <p className="text-sm font-semibold text-[#191c1e]">{step.requestTitle}</p>
                        {step.status === 'running' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e3dfff] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#2a14b4]">
                            <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>
                            In Progress
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-mono text-[11px] text-[#777586] break-all">{step.method} {step.url}</p>
                      {step.errorMessage && (
                        <p className="mt-2 text-xs leading-relaxed text-[#93000a]">
                          {expanded ? step.errorMessage : step.errorMessage.slice(0, 140)}
                          {!expanded && step.errorMessage.length > 140 ? '…' : ''}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${statusTone(step.status)}`}>
                        {statusLabel(step.status)}
                      </span>
                      {(step.durationMs !== undefined || step.statusCode !== undefined) && (
                        <div className="mt-2 space-y-1">
                          {step.statusCode !== undefined && (
                            <div className="flex items-center justify-end gap-2">
                              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#777586]">HTTP Code</p>
                              <p className="font-mono text-[10px] text-[#777586]">
                                {step.statusCode === 0 ? `0 ${step.statusText ?? 'ERR'}` : `${step.statusCode} ${step.statusText ?? ''}`.trim()}
                              </p>
                            </div>
                          )}
                          {step.durationMs !== undefined && (
                            <p className="font-mono text-[10px] text-[#777586]">{step.durationMs}ms</p>
                          )}
                        </div>
                      )}
                      {inspectable && (
                        <span className={`mt-3 inline-flex items-center justify-center rounded-full border border-[#c7c4d7]/20 bg-white p-1 text-[#777586] transition-transform ${expanded ? 'rotate-180' : ''}`}>
                          <span className="material-symbols-outlined text-sm">expand_more</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${expanded ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      {step.response && (
                        <div className="space-y-4 border-t border-[#c7c4d7]/10 pt-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-lg border border-[#c7c4d7]/10 bg-white px-3 py-3">
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">HTTP Code</p>
                                <p className="text-sm font-semibold text-[#191c1e]">
                                  {step.response.statusCode === 0 ? `0 ${step.response.statusText}` : `${step.response.statusCode} ${step.response.statusText}`}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-lg border border-[#c7c4d7]/10 bg-white px-3 py-3">
                              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Duration</p>
                              <p className="mt-1 text-sm font-semibold text-[#191c1e]">{step.response.duration}ms</p>
                            </div>
                            <div className="rounded-lg border border-[#c7c4d7]/10 bg-white px-3 py-3">
                              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Finished</p>
                              <p className="mt-1 text-sm font-semibold text-[#191c1e]">{formatTimestamp(step.response.timestamp)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(220px,280px)_1fr]">
                            <div className="overflow-hidden rounded-xl border border-[#c7c4d7]/10 bg-white">
                              <div className="border-b border-[#c7c4d7]/10 px-3 py-2">
                                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Response Headers</p>
                              </div>
                              <div className="max-h-64 space-y-3 overflow-auto p-3">
                                {responseHeaders.length === 0 ? (
                                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">No response headers</p>
                                ) : (
                                  responseHeaders.map(([key, value]) => (
                                    <div key={key}>
                                      <p className="font-mono text-[10px] text-[#777586]">{key}</p>
                                      <p className="mt-1 font-mono text-[11px] break-all text-[#191c1e]">{value}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-[#c7c4d7]/10 bg-white">
                              <div className="border-b border-[#c7c4d7]/10 px-3 py-2">
                                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Response Body</p>
                              </div>
                              <div className="max-h-80 overflow-auto bg-white">
                                {!step.response.body.trim() ? (
                                  <div className="p-4">
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">Empty response body</p>
                                  </div>
                                ) : hasJsonBody ? (
                                  <JsonCodeBlock raw={step.response.body} className="p-4" showLineNumbers collapsible />
                                ) : (
                                  <pre className="p-4 font-mono text-xs leading-5 text-[#464554] whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
                                    {step.response.body}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );

              return (
                <div key={step.requestId} className="px-5 py-3">
                  {inspectable ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedStepId((current) => current === step.requestId ? null : step.requestId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setExpandedStepId((current) => current === step.requestId ? null : step.requestId);
                        }
                      }}
                      className="block w-full text-left"
                    >
                      {summaryContent}
                    </div>
                  ) : summaryContent}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#c7c4d7]/10 bg-[#ffffff] shadow-sm">
        <div className="border-b border-[#c7c4d7]/10 px-4 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Scenario Report</p>
        </div>

        {!report ? (
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Scenario</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{scenario.title}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Steps</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{requestsCount}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Associations</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{executionLinks.length}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Success</p>
                <p className="mt-1 text-sm font-semibold text-[#005c54]">{successCount}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Warning</p>
                <p className="mt-1 text-sm font-semibold text-[#7a4b00]">{warningCount}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Failed</p>
                <p className="mt-1 text-sm font-semibold text-[#93000a]">{failedCount}</p>
              </div>
            </div>

            {running ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">
                Scenario execution in progress. The report will appear here when the run completes.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Scenario</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{scenario.title}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Result</p>
                <p className={`mt-1 text-sm font-semibold ${reportTone(report.result)}`}>
                  {report.result === 'success' ? 'Success' : report.result === 'warning' ? 'Warning' : 'Failed'}
                </p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Steps</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{requestsCount}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Associations</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{executionLinks.length}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Success</p>
                <p className="mt-1 text-sm font-semibold text-[#005c54]">{successCount}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Warning</p>
                <p className="mt-1 text-sm font-semibold text-[#7a4b00]">{warningCount}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Failed</p>
                <p className="mt-1 text-sm font-semibold text-[#93000a]">{failedCount}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Started</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{formatTimestamp(report.startedAt)}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Finished</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{formatTimestamp(report.finishedAt)}</p>
              </div>
              <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Duration</p>
                <p className="mt-1 text-sm font-semibold text-[#191c1e]">{report.totalDurationMs}ms</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-[#c7c4d7]/10 bg-[#ffffff] shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#c7c4d7]/10 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Scenario Associations</p>
          </div>
          <button
            type="button"
            onClick={onAddLink}
            className="inline-flex items-center gap-2 rounded-lg bg-[#e3dfff] px-3 py-2 text-xs font-semibold text-[#2a14b4] transition-colors hover:bg-[#d8d0ff]"
          >
            <span className="material-symbols-outlined text-sm">add_link</span>
            Add Association
          </button>
        </div>

        <div className="space-y-3 p-4">
          {orderedRequests.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">
              Add requests to this scenario before defining associations.
            </p>
          ) : executionLinks.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">
              No associations yet. Example: Login -&gt; Get Profile, source result.accessToken, target header Authorization, template Bearer {'{access_token}'}.
            </p>
          ) : (
            executionLinks.map((link, index) => {
              const sourceLabel = getRequestLabel(link.sourceRequestId, orderedRequests);
              const targetLabel = getRequestLabel(link.targetRequestId, orderedRequests);
              const sourceResponse = link.sourceRequestId ? responseByRequestId.get(link.sourceRequestId) : undefined;
              const targetRequest = link.targetRequestId ? requestById.get(link.targetRequestId) : undefined;
              const sourceFieldOptions = withCurrentFieldOption(
                link.sourceType === 'response-body'
                  ? getJsonFieldOptions(sourceResponse?.body)
                  : link.sourceType === 'response-header'
                    ? uniqueFieldOptions(Object.keys(sourceResponse?.headers ?? {}))
                    : [],
                link.sourceSelector,
              );
              const destinationFieldOptions = withCurrentFieldOption(
                link.targetType === 'body'
                  ? getJsonFieldOptions(targetRequest?.body)
                  : link.targetType === 'header'
                    ? getHeaderFieldOptions(targetRequest?.headers ?? [])
                    : link.targetType === 'param'
                      ? getParamFieldOptions(targetRequest?.params)
                      : [],
                link.targetSelector,
              );

              return (
                <div key={link.id} className="space-y-3 rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">
                        Association {index + 1}
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold text-[#191c1e]">
                        {sourceLabel} -&gt; {targetLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveLink(link.id)}
                      className="material-symbols-outlined text-sm text-[#777586] transition-colors hover:text-[#ba1a1a]"
                      aria-label={`Remove association ${index + 1}`}
                      title="Remove association"
                    >
                      delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="space-y-3 rounded-xl border border-[#c7c4d7]/10 bg-white p-4">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2a14b4]">Source</p>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Source Request</span>
                        <select
                          value={link.sourceRequestId ?? ''}
                          onChange={(e) => onUpdateLink(link.id, { sourceRequestId: e.target.value || undefined })}
                          className="rounded-lg bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20"
                        >
                          <option value="">Select source request</option>
                          {orderedRequests.map((request) => (
                            <option key={request.id} value={request.id}>{getRequestLabel(request.id, orderedRequests)}</option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Source Type</span>
                        <select
                          value={link.sourceType ?? ''}
                          onChange={(e) => onUpdateLink(link.id, { sourceType: (e.target.value || undefined) as RequestVariableSourceType | undefined })}
                          className="rounded-lg bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20"
                        >
                          <option value="">Select source type</option>
                          {SOURCE_TYPES.map((entry) => (
                            <option key={entry.value} value={entry.value}>{entry.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Source Field</span>
                        <select
                          value={link.sourceSelector ?? ''}
                          onChange={(e) => onUpdateLink(link.id, { sourceSelector: e.target.value })}
                          disabled={!link.sourceRequestId || !link.sourceType || sourceFieldOptions.length === 0}
                          className="rounded-lg bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20 disabled:text-[#777586]"
                        >
                          <option value="">
                            {getSourceFieldPlaceholder(link, Boolean(sourceResponse), sourceFieldOptions.length > 0)}
                          </option>
                          {sourceFieldOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Source Variable Name</span>
                        <input
                          value={link.variableName ?? ''}
                          onChange={(e) => onUpdateLink(link.id, { variableName: e.target.value })}
                          placeholder="access_token"
                          className="rounded-lg bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#191c1e] outline-none placeholder:text-[#c7c4d7] focus:ring-2 focus:ring-[#2a14b4]/20"
                        />
                      </label>
                    </div>

                    <div className="space-y-3 rounded-xl border border-[#c7c4d7]/10 bg-white p-4">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2a14b4]">Destination</p>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Destination Request</span>
                        <select
                          value={link.targetRequestId ?? ''}
                          onChange={(e) => onUpdateLink(link.id, { targetRequestId: e.target.value || undefined })}
                          className="rounded-lg bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20"
                        >
                          <option value="">Select destination request</option>
                          {orderedRequests.map((request) => (
                            <option key={request.id} value={request.id}>{getRequestLabel(request.id, orderedRequests)}</option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Destination Type</span>
                        <select
                          value={link.targetType ?? ''}
                          onChange={(e) => onUpdateLink(link.id, { targetType: (e.target.value || undefined) as RequestVariableTargetType | undefined })}
                          className="rounded-lg bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20"
                        >
                          <option value="">Select destination type</option>
                          {TARGET_TYPES.map((entry) => (
                            <option key={entry.value} value={entry.value}>{entry.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Destination Field</span>
                        <select
                          value={link.targetSelector ?? ''}
                          onChange={(e) => onUpdateLink(link.id, { targetSelector: e.target.value })}
                          disabled={!link.targetRequestId || !link.targetType || destinationFieldOptions.length === 0}
                          className="rounded-lg bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20 disabled:text-[#777586]"
                        >
                          <option value="">
                            {getDestinationFieldPlaceholder(link, Boolean(targetRequest), destinationFieldOptions.length > 0)}
                          </option>
                          {destinationFieldOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Destination Template</span>
                        <input
                          value={link.valueTemplate ?? ''}
                          onChange={(e) => onUpdateLink(link.id, { valueTemplate: e.target.value })}
                          placeholder="Bearer {access_token}"
                          className="rounded-lg bg-[#f7f9fb] px-3 py-2.5 text-sm text-[#191c1e] outline-none placeholder:text-[#c7c4d7] focus:ring-2 focus:ring-[#2a14b4]/20"
                        />
                        <span className="text-xs leading-relaxed text-[#777586]">
                          Example: source `result.accessToken`, source variable `access_token`, destination `Authorization`, template `Bearer {'{access_token}'}`.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
