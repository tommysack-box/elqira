import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { exportAppData, importAppData } from '../../services/dataService';
import type { AppSettings } from '../../types';

export function SettingsView() {
  const { t, settings, saveSettings, reloadAppData } = useApp();
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateLanguage = (language: AppSettings['language']) => {
    const next = { ...form, language };
    setForm(next);
    saveSettings(next);
  };

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleExport = () => {
    const snapshot = exportAppData();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');

    link.href = url;
    link.download = `elqira-data-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDataMessage('Data exported');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const snapshot = JSON.parse(raw);
      importAppData(snapshot);
      reloadAppData();
      setForm({ ...snapshot.settings });
      setDataMessage('Data imported');
    } catch {
      setDataMessage('Invalid import file');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fb]">
      <main className="pt-10 pb-20 px-6 max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tighter text-[#191c1e] mb-2">
            Application Settings
          </h1>
          <p className="text-[#464554] max-w-2xl text-lg leading-relaxed">
            Configure localization and import or export your local workspace data.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <section className="p-8 bg-[#ffffff] rounded-xl border border-[#c7c4d7]/10">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-[#2a14b4]">language</span>
              <h2 className="font-semibold text-lg tracking-tight text-[#191c1e]">{t('general')}</h2>
            </div>

            <div className="space-y-4">
              <label className="font-mono text-xs font-bold uppercase tracking-widest text-[#777586] block">
                {t('language')}
              </label>
              <div className="bg-[#f2f4f6] p-1.5 rounded-lg flex gap-1">
                <button
                  type="button"
                  onClick={() => updateLanguage('en')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
                    form.language === 'en'
                      ? 'bg-[#ffffff] shadow-sm text-[#2a14b4]'
                      : 'text-[#464554] hover:bg-[#e6e8ea]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => updateLanguage('it')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
                    form.language === 'it'
                      ? 'bg-[#ffffff] shadow-sm text-[#2a14b4]'
                      : 'text-[#464554] hover:bg-[#e6e8ea]'
                  }`}
                >
                  Italiano
                </button>
              </div>
            </div>
          </section>

          <section className="p-8 bg-[#ffffff] rounded-xl border border-[#c7c4d7]/10">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-[#2a14b4]">import_export</span>
              <h2 className="font-semibold text-lg tracking-tight text-[#191c1e]">Data Transfer</h2>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleExport}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#f2f4f6] rounded-lg text-sm font-semibold text-[#191c1e] hover:bg-[#e6e8ea] transition-colors"
              >
                <span>Export JSON</span>
                <span className="material-symbols-outlined text-base text-[#2a14b4]">download</span>
              </button>

              <button
                type="button"
                onClick={handleImportClick}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#f2f4f6] rounded-lg text-sm font-semibold text-[#191c1e] hover:bg-[#e6e8ea] transition-colors"
              >
                <span>Import JSON</span>
                <span className="material-symbols-outlined text-base text-[#2a14b4]">upload</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImport}
                className="hidden"
              />

              <p className="text-xs text-[#777586] leading-relaxed">
                Import replaces the current local workspace data with the content of the selected JSON file.
              </p>
              {dataMessage && <p className="text-xs font-semibold text-[#2a14b4]">{dataMessage}</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
