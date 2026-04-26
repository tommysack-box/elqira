import { Modal } from '../../components/Modal';
import { useApp } from '../../context/AppContext';
import type { ScenarioReportExportFormat } from './scenarioReport';

interface Props {
  onClose: () => void;
  onSelect: (format: ScenarioReportExportFormat) => void | Promise<void>;
}

const FORMAT_OPTIONS: Array<{
  format: ScenarioReportExportFormat;
  icon: string;
  extension: string;
  accent: string;
  titleKey: 'scenarioReportFormatPdf' | 'scenarioReportFormatMarkdown' | 'scenarioReportFormatYaml' | 'scenarioReportFormatJson';
  helpKey: 'scenarioReportFormatPdfHelp' | 'scenarioReportFormatMarkdownHelp' | 'scenarioReportFormatYamlHelp' | 'scenarioReportFormatJsonHelp';
}> = [
  {
    format: 'pdf',
    icon: 'picture_as_pdf',
    extension: '.pdf',
    accent: 'text-[#ba1a1a] bg-[#ffdad6]',
    titleKey: 'scenarioReportFormatPdf',
    helpKey: 'scenarioReportFormatPdfHelp',
  },
  {
    format: 'markdown',
    icon: 'article',
    extension: '.md',
    accent: 'text-[#005c54] bg-[#ddfbf6]',
    titleKey: 'scenarioReportFormatMarkdown',
    helpKey: 'scenarioReportFormatMarkdownHelp',
  },
  {
    format: 'yaml',
    icon: 'data_object',
    extension: '.yaml',
    accent: 'text-[#2a14b4] bg-[#e3dfff]',
    titleKey: 'scenarioReportFormatYaml',
    helpKey: 'scenarioReportFormatYamlHelp',
  },
  {
    format: 'json',
    icon: 'code',
    extension: '.json',
    accent: 'text-[#0d47a1] bg-[#d5e3fc]',
    titleKey: 'scenarioReportFormatJson',
    helpKey: 'scenarioReportFormatJsonHelp',
  },
];

export function ScenarioReportExportModal({ onClose, onSelect }: Props) {
  const { t } = useApp();

  return (
    <Modal title={t('scenarioReportExportTitle')} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div>
          <p className="text-sm leading-relaxed text-[#464554]">
            {t('scenarioReportExportHelp')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.format}
              type="button"
              onClick={() => void onSelect(option.format)}
              className="text-left rounded-2xl border border-[#c7c4d7]/20 bg-[#f7f9fb] p-5 hover:bg-white hover:border-[#2a14b4]/20 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${option.accent}`}>
                    <span className="material-symbols-outlined text-[22px]">{option.icon}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold tracking-tight text-[#191c1e]">
                      {t(option.titleKey)}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#777586]">
                      {option.extension}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#464554]">
                    {t(option.helpKey)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
