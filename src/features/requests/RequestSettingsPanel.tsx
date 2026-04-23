import { useEffect, useState, type ReactNode } from 'react';
import type {
  Header,
  QueryParam,
} from '../../types';
import { useApp } from '../../context/AppContext';

type BodyLeafNode = {
  pointer: string;
  label: string;
};

interface Props {
  timeoutSeconds?: number;
  globalTimeoutSeconds?: number;
  onSaveTimeout: (timeoutSeconds?: number) => string | null;
  bodyLeafNodes: BodyLeafNode[];
  sensitiveBodyPaths: string[];
  onToggleBodyPath: (pointer: string, checked: boolean) => void;
  headers: Array<{ header: Header; index: number }>;
  onToggleHeader: (index: number, checked: boolean) => void;
  params: Array<{ param: QueryParam; index: number }>;
  onToggleParam: (index: number, checked: boolean) => void;
  onClose: () => void;
}

function SectionCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-[#c7c4d7]/10 bg-white overflow-hidden">
      {title && (
        <div className="border-b border-[#c7c4d7]/10 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">{title}</p>
        </div>
      )}
      <div className="p-3 space-y-2">{children}</div>
    </section>
  );
}

function ToggleRow({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-[#c7c4d7]/10 bg-white px-2.5 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#2a14b4]"
      />
      <span className="min-w-0">
        <span className="block font-mono text-[10px] text-[#191c1e] break-all leading-tight">{label}</span>
        {description && (
          <span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-[#777586] break-all">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export function RequestSettingsPanel({
  timeoutSeconds,
  globalTimeoutSeconds,
  onSaveTimeout,
  bodyLeafNodes,
  sensitiveBodyPaths,
  onToggleBodyPath,
  headers,
  onToggleHeader,
  params,
  onToggleParam,
  onClose,
}: Props) {
  const { t } = useApp();
  const [timeoutInput, setTimeoutInput] = useState(timeoutSeconds?.toString() ?? '');
  const [timeoutError, setTimeoutError] = useState('');

  useEffect(() => {
    setTimeoutInput(timeoutSeconds?.toString() ?? '');
    setTimeoutError('');
  }, [timeoutSeconds]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="bg-[#ffffff] rounded-xl p-5 shadow-sm border border-[#c7c4d7]/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2a14b4]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#2a14b4]" style={{ fontVariationSettings: "'FILL' 1" }}>
              tune
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-[#191c1e]">{t('requestSettingsTitle')}</h2>
            <p className="text-[10px] text-[#777586] font-mono uppercase tracking-widest">
              {t('requestSettingsHelp')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#464554] bg-[#e6e8ea] rounded-lg hover:bg-[#e0e3e5] transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            {t('requestSettingsClose')}
          </button>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-[#f2f4f6] border-l-4 border-[#2a14b4]">
          <p className="text-sm leading-relaxed text-[#191c1e]">{t('requestSettingsNotice')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 px-1 pt-1">
        <span className="material-symbols-outlined text-[#2a14b4]" style={{ fontVariationSettings: "'FILL' 1" }}>
          shield_lock
        </span>
        <div>
          <p className="text-sm font-semibold text-[#191c1e]">{t('requestSettingsSensitiveTitle')}</p>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#777586]">
            {t('requestSensitiveHelp')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
        <SectionCard title={t('requestSensitiveBody')}>
          {bodyLeafNodes.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('requestSensitiveNoBody')}</p>
          ) : (
            bodyLeafNodes.map((leaf) => (
              <ToggleRow
                key={leaf.pointer}
                checked={sensitiveBodyPaths.includes(leaf.pointer)}
                label={leaf.label}
                onChange={(checked) => onToggleBodyPath(leaf.pointer, checked)}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title={t('requestSensitiveHeaders')}>
          {headers.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('requestSensitiveNoHeaders')}</p>
          ) : (
            headers.map(({ header, index }) => (
              <ToggleRow
                key={`${header.key}-${index}`}
                checked={Boolean(header.sensitive)}
                label={header.key}
                onChange={(checked) => onToggleHeader(index, checked)}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title={t('requestSensitiveParams')}>
          {params.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">{t('requestSensitiveNoParams')}</p>
          ) : (
            params.map(({ param, index }) => (
              <ToggleRow
                key={`${param.key}-${index}`}
                checked={Boolean(param.sensitive)}
                label={param.key}
                onChange={(checked) => onToggleParam(index, checked)}
              />
            ))
          )}
        </SectionCard>
      </div>

      <div className="flex items-center gap-3 px-1 pt-1">
        <span className="material-symbols-outlined text-[#2a14b4]" style={{ fontVariationSettings: "'FILL' 1" }}>
          timer
        </span>
        <div>
          <p className="text-sm font-semibold text-[#191c1e]">{t('requestSettingsTimeoutTitle')}</p>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#777586]">
            {t('requestSettingsTimeoutHelp')}
          </p>
        </div>
      </div>

      <SectionCard>
        <div className="space-y-2">
          <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#464554]">
            {t('requestTimeout')}
            <span className="ml-1 normal-case font-normal text-[#777586]">({t('optional')})</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={timeoutInput}
            onChange={(e) => {
              setTimeoutInput(e.target.value);
              if (timeoutError) setTimeoutError('');
            }}
            onBlur={() => {
              const nextError = onSaveTimeout(timeoutInput.trim() ? Number(timeoutInput) : undefined);
              setTimeoutError(nextError ?? '');
            }}
            placeholder={t('requestTimeoutPlaceholder')}
            className={`w-full rounded-lg bg-[#f2f4f6] px-3 py-2.5 text-sm text-[#191c1e] outline-none transition-colors placeholder:text-[#c7c4d7] focus:ring-2 focus:ring-[#2a14b4]/20 ${
              timeoutError ? 'ring-2 ring-[#ba1a1a]/30' : ''
            }`}
          />
          <p className={`text-xs leading-relaxed ${timeoutError ? 'text-[#ba1a1a]' : 'text-[#777586]'}`}>
            {timeoutError
              || (timeoutInput.trim()
                ? t('requestTimeoutOverrideHelp')
                : globalTimeoutSeconds
                  ? `${t('requestTimeoutUsingGlobal')}: ${globalTimeoutSeconds}s.`
                  : t('requestTimeoutNoAbortHelp'))}
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
