import { useEffect, useState } from 'react';
import { JsonCodeBlock } from '../../components/JsonCodeBlock';
import type {
  Request,
  RequestVariableSourceType,
  RequestVariableTargetType,
  Scenario,
  ScenarioExecutionLink,
} from '../../types';
import type { ScenarioExecutionReport, ScenarioExecutionStepResult } from './scenarioExecution';

interface Props {
  scenario: Pick<Scenario, 'title' | 'description' | 'tag' | 'version'>;
  requests: Array<Pick<Request, 'id' | 'title' | 'requestOrder'>>;
  requestsCount: number;
  executionLinks: ScenarioExecutionLink[];
  steps: ScenarioExecutionStepResult[];
  running: boolean;
  report: ScenarioExecutionReport | null;
  onAddLink: () => void;
  onUpdateLink: (linkId: string, patch: Partial<ScenarioExecutionLink>) => void;
  onRemoveLink: (linkId: string) => void;
  onRun: () => void;
  onClose: () => void;
}

const SOURCE_TYPES: Array<{ value: RequestVariableSourceType; label: string; placeholder: string }> = [
  { value: 'response-body', label: 'Response Body', placeholder: 'result.accessToken or /result/accessToken' },
  { value: 'response-header', label: 'Response Header', placeholder: 'set-cookie' },
];

const TARGET_TYPES: Array<{ value: RequestVariableTargetType; label: string; placeholder: string }> = [
  { value: 'header', label: 'Header', placeholder: 'Authorization' },
  { value: 'param', label: 'Query Param', placeholder: 'access_token' },
  { value: 'body', label: 'Body Field', placeholder: 'auth.token or /auth/token' },
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

function getOrderedRequests(requests: Array<Pick<Request, 'id' | 'title' | 'requestOrder'>>) {
  return [...requests].sort((a, b) => {
    const aOrder = a.requestOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.requestOrder ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

function getRequestLabel(
  requestId: string | undefined,
  requests: Array<Pick<Request, 'id' | 'title' | 'requestOrder'>>,
) {
  const request = requests.find((entry) => entry.id === requestId);
  if (!request) return requestId ? 'Unknown Request' : 'Select Request';

  return typeof request.requestOrder === 'number'
    ? `${request.requestOrder + 1}. ${request.title}`
    : request.title;
}

export function ScenarioExecutionPanel({
  scenario,
  requests,
  requestsCount,
  executionLinks,
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
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const reportResultTone = report?.result === 'success'
    ? 'text-[#005c54]'
    : report?.result === 'warning'
      ? 'text-[#7a4b00]'
      : 'text-[#93000a]';

  useEffect(() => {
    if (running) {
      setExpandedStepId(null);
      return;
    }

    if (!expandedStepId) return;

    const expandedStep = steps.find((step) => step.requestId === expandedStepId);
    if (!expandedStep || !isStepInspectable(expandedStep.status)) {
      setExpandedStepId(null);
    }
  }, [expandedStepId, running, steps]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <section className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2a14b4]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#2a14b4]" style={{ fontVariationSettings: "'FILL' 1" }}>
              account_tree
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-[#191c1e]">Scenario Execution</h2>
            <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">
              Sequential execution with explicit request-to-request associations
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#464554] bg-[#e6e8ea] rounded-lg hover:bg-[#e0e3e5] transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Close Panel
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
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
        </div>
      </section>

      <section className="rounded-xl border border-[#c7c4d7]/10 bg-[#ffffff] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#c7c4d7]/10 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Scenario Associations</p>
            <p className="mt-1 text-xs text-[#777586]">
              Each row links one source request to one target request and defines exactly where the resolved value is injected.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddLink}
            className="inline-flex items-center gap-2 rounded-lg bg-[#e3dfff] px-3 py-2 text-xs font-semibold text-[#2a14b4] hover:bg-[#d8d0ff] transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add_link</span>
            Add Association
          </button>
        </div>

        <div className="p-4 space-y-3">
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
              const sourceTypeConfig = SOURCE_TYPES.find((entry) => entry.value === link.sourceType);
              const targetTypeConfig = TARGET_TYPES.find((entry) => entry.value === link.targetType);
              const sourceLabel = getRequestLabel(link.sourceRequestId, orderedRequests);
              const targetLabel = getRequestLabel(link.targetRequestId, orderedRequests);

              return (
                <div key={link.id} className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">
                        Association {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#191c1e] break-words">
                        {sourceLabel} -&gt; {targetLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveLink(link.id)}
                      className="material-symbols-outlined text-sm text-[#777586] hover:text-[#ba1a1a] transition-colors"
                      aria-label={`Remove association ${index + 1}`}
                      title="Remove association"
                    >
                      delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Source Request</span>
                      <select
                        value={link.sourceRequestId ?? ''}
                        onChange={(e) => onUpdateLink(link.id, { sourceRequestId: e.target.value || undefined })}
                        className="rounded-lg bg-white px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20"
                      >
                        <option value="">Select source request</option>
                        {orderedRequests.map((request) => (
                          <option key={request.id} value={request.id}>{getRequestLabel(request.id, orderedRequests)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Target Request</span>
                      <select
                        value={link.targetRequestId ?? ''}
                        onChange={(e) => onUpdateLink(link.id, { targetRequestId: e.target.value || undefined })}
                        className="rounded-lg bg-white px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20"
                      >
                        <option value="">Select target request</option>
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
                        className="rounded-lg bg-white px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20"
                      >
                        <option value="">Select source type</option>
                        {SOURCE_TYPES.map((entry) => (
                          <option key={entry.value} value={entry.value}>{entry.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Source Field</span>
                      <input
                        value={link.sourceSelector ?? ''}
                        onChange={(e) => onUpdateLink(link.id, { sourceSelector: e.target.value })}
                        placeholder={sourceTypeConfig?.placeholder ?? 'result.accessToken'}
                        className="rounded-lg bg-white px-3 py-2.5 text-sm text-[#191c1e] outline-none placeholder:text-[#c7c4d7] focus:ring-2 focus:ring-[#2a14b4]/20"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Variable Name</span>
                      <input
                        value={link.variableName ?? ''}
                        onChange={(e) => onUpdateLink(link.id, { variableName: e.target.value })}
                        placeholder="access_token"
                        className="rounded-lg bg-white px-3 py-2.5 text-sm text-[#191c1e] outline-none placeholder:text-[#c7c4d7] focus:ring-2 focus:ring-[#2a14b4]/20"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Target Type</span>
                      <select
                        value={link.targetType ?? ''}
                        onChange={(e) => onUpdateLink(link.id, { targetType: (e.target.value || undefined) as RequestVariableTargetType | undefined })}
                        className="rounded-lg bg-white px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:ring-2 focus:ring-[#2a14b4]/20"
                      >
                        <option value="">Select target type</option>
                        {TARGET_TYPES.map((entry) => (
                          <option key={entry.value} value={entry.value}>{entry.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Target Field</span>
                      <input
                        value={link.targetSelector ?? ''}
                        onChange={(e) => onUpdateLink(link.id, { targetSelector: e.target.value })}
                        placeholder={targetTypeConfig?.placeholder ?? 'Authorization'}
                        className="rounded-lg bg-white px-3 py-2.5 text-sm text-[#191c1e] outline-none placeholder:text-[#c7c4d7] focus:ring-2 focus:ring-[#2a14b4]/20"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 xl:col-span-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">Value Template</span>
                      <input
                        value={link.valueTemplate ?? ''}
                        onChange={(e) => onUpdateLink(link.id, { valueTemplate: e.target.value })}
                        placeholder="Bearer {access_token}"
                        className="rounded-lg bg-white px-3 py-2.5 text-sm text-[#191c1e] outline-none placeholder:text-[#c7c4d7] focus:ring-2 focus:ring-[#2a14b4]/20"
                      />
                      <span className="text-xs leading-relaxed text-[#777586]">
                        Example: source `result.accessToken`, variable `access_token`, target `Authorization`, template `Bearer {'{access_token}'}`.
                      </span>
                    </label>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {runningStep && (
        <section className="rounded-xl border border-[#c7c4d7]/10 bg-[#ffffff] p-4 shadow-sm">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#777586]">Current Step</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#191c1e]">{runningStep.requestTitle}</p>
              <p className="font-mono text-[11px] text-[#777586] break-all">{runningStep.method} {runningStep.url}</p>
            </div>
            <span className="inline-flex rounded-full bg-[#e3dfff] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#2a14b4]">
              Running
            </span>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[#c7c4d7]/10 bg-[#ffffff] shadow-sm overflow-hidden">
        <div className="border-b border-[#c7c4d7]/10 px-4 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Execution Steps</p>
        </div>
        <div className="divide-y divide-[#c7c4d7]/10">
          {steps.length === 0 ? (
            <div className="px-4 py-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">
                No requests available in this scenario.
              </p>
            </div>
          ) : (
            steps.map((step, index) => {
              const inspectable = !running && isStepInspectable(step.status);
              const expanded = expandedStepId === step.requestId;
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
                        <p className="mt-2 text-xs text-[#93000a] leading-relaxed">
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
                              <p className="mt-1 text-sm font-semibold text-[#191c1e]">{new Date(step.response.timestamp).toLocaleTimeString()}</p>
                            </div>
                          </div>

                          {step.appliedBindings.length > 0 && (
                            <div className="space-y-2">
                              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Applied Associations</p>
                              {step.appliedBindings.map((binding) => (
                                <div key={binding.bindingId} className="rounded-lg border border-[#c7c4d7]/10 bg-[#f7f9fb] px-3 py-2">
                                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">Association Applied</p>
                                  <p className="mt-1 text-xs text-[#191c1e]">{binding.sourceLabel}</p>
                                  <p className="text-xs text-[#464554]">{binding.targetLabel}</p>
                                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#777586]">{binding.valuePreview}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(220px,280px)_1fr]">
                            <div className="rounded-xl border border-[#c7c4d7]/10 bg-white overflow-hidden">
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
                                      <p className="mt-1 font-mono text-[11px] text-[#191c1e] break-all">{value}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="rounded-xl border border-[#c7c4d7]/10 bg-white overflow-hidden">
                              <div className="border-b border-[#c7c4d7]/10 px-3 py-2">
                                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Response Body</p>
                              </div>
                              <div className="max-h-80 overflow-auto bg-white">
                                {!step.response.body.trim() ? (
                                  <div className="p-4">
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">Empty response body</p>
                                  </div>
                                ) : hasJsonBody ? (
                                  <JsonCodeBlock raw={step.response.body} className="p-4" />
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
                <div key={step.requestId} className="px-4 py-3">
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

      {report && (
        <section className="rounded-xl border border-[#c7c4d7]/10 bg-[#ffffff] shadow-sm overflow-hidden">
          <div className="border-b border-[#c7c4d7]/10 px-4 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">Execution Report</p>
          </div>
          <div className="grid gap-3 px-4 py-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Result</p>
              <p className={`mt-1 text-sm font-semibold ${reportResultTone}`}>
                {report.result === 'success' ? 'Success' : report.result === 'warning' ? 'Warning' : 'Failed'}
              </p>
            </div>
            <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Started</p>
              <p className="mt-1 text-sm font-semibold text-[#191c1e]">{new Date(report.startedAt).toLocaleTimeString()}</p>
            </div>
            <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Finished</p>
              <p className="mt-1 text-sm font-semibold text-[#191c1e]">{new Date(report.finishedAt).toLocaleTimeString()}</p>
            </div>
            <div className="rounded-xl border border-[#c7c4d7]/10 bg-[#f7f9fb] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777586]">Duration</p>
              <p className="mt-1 text-sm font-semibold text-[#191c1e]">{report.totalDurationMs}ms</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
