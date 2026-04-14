import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { exportAppData, importAppData } from '../../services/dataService';
import type { AppSettings } from '../../types';

export function SettingsView() {
  const { t, settings, saveSettings, smartApiKey, setSmartApiKey, reloadAppData } = useApp();
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [apiKeyInput, setApiKeyInput] = useState(smartApiKey);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const update = (patch: Partial<AppSettings>) => setForm((f) => ({ ...f, ...patch }));

  const updateLanguage = (language: AppSettings['language']) => {
    const next = { ...form, language };
    setForm(next);
    saveSettings(next);
  };

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  useEffect(() => {
    setApiKeyInput(smartApiKey);
  }, [smartApiKey]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(form);
    setSmartApiKey(apiKeyInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

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
      setApiKeyInput('');
      setDataMessage('Data imported');
    } catch {
      setDataMessage('Invalid import file');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fb]">
      <main className="pt-10 pb-20 px-6 max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tighter text-[#191c1e] mb-2">
            Application Settings
          </h1>
          <p className="text-[#464554] max-w-2xl text-lg leading-relaxed">
            Configure localization, manage your smart provider, and import or export your local workspace data.
          </p>
        </div>

        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <section className="md:col-span-4 flex flex-col gap-6">
              <div className="p-8 bg-[#ffffff] rounded-xl border border-[#c7c4d7]/10">
                <div className="flex items-center gap-3 mb-8">
                  <span className="material-symbols-outlined text-[#2a14b4]">language</span>
                  <h2 className="font-semibold text-lg tracking-tight text-[#191c1e]">{t('general')}</h2>
                </div>

                <div className="space-y-8">
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
                </div>
              </div>

              <div className="p-8 bg-[#ffffff] rounded-xl border border-[#c7c4d7]/10">
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
              </div>
            </section>

            <section className="md:col-span-8">
              <div className="relative p-8 bg-[#ffffff] rounded-xl border border-[#c7c4d7]/10 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#00423c]/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[#00423c]">psychology</span>
                      <h2 className="font-semibold text-lg tracking-tight text-[#191c1e]">
                        {t('smartConfig')}
                      </h2>
                    </div>
                    <span
                      className={`font-mono text-[10px] font-black px-2 py-1 rounded ${
                        form.smartEnabled ? 'bg-[#89f5e7] text-[#00201d]' : 'bg-[#e0e3e5] text-[#464554]'
                      }`}
                    >
                      {form.smartEnabled ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div className="mb-8">
                    <label className="flex items-center gap-4 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => update({ smartEnabled: !form.smartEnabled })}
                        className={`w-12 h-6 rounded-full relative transition-colors ${
                          form.smartEnabled ? 'bg-[#2a14b4]' : 'bg-[#e0e3e5]'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            form.smartEnabled ? 'translate-x-6 left-1' : 'left-1'
                          }`}
                        />
                      </button>
                      <span className="text-sm font-medium text-[#191c1e]">Enable Smart features</span>
                    </label>
                  </div>

                  {form.smartEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="font-mono text-xs font-bold uppercase tracking-widest text-[#777586] block">
                          {t('smartProvider')}
                        </label>
                        <div className="relative">
                          <select
                            value={form.smartProvider ?? ''}
                            onChange={(e) => update({ smartProvider: e.target.value })}
                            className="w-full bg-[#f2f4f6] border-0 rounded-lg py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#00423c]/20 transition-all appearance-none text-[#191c1e]"
                          >
                            <option value="">Select provider…</option>
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="gemini">Google</option>
                            <option value="mistral">Mistral AI</option>
                            <option value="custom">Custom</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-3 top-3 text-[#777586] pointer-events-none">
                            expand_more
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="font-mono text-xs font-bold uppercase tracking-widest text-[#777586] block">
                          {t('smartModel')}
                        </label>
                        <input
                          type="text"
                          value={form.smartModel ?? ''}
                          onChange={(e) => update({ smartModel: e.target.value })}
                          placeholder="e.g. gpt-4o"
                          className="w-full bg-[#f2f4f6] border-0 rounded-lg py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#00423c]/20 transition-all text-[#191c1e] placeholder:text-[#c7c4d7] font-mono"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-3">
                        <label className="font-mono text-xs font-bold uppercase tracking-widest text-[#777586] block">
                          {t('smartApiKey')}
                        </label>
                        <div className="relative">
                          <input
                            type={showKey ? 'text' : 'password'}
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="sk-proj-••••••••••••••••••••••••"
                            className="font-mono w-full bg-[#f2f4f6] border-0 rounded-lg py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-[#00423c]/20 transition-all text-[#191c1e] placeholder:text-[#c7c4d7]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-2.5 p-1 hover:bg-[#e0e3e5] rounded-md transition-colors"
                          >
                            <span className="material-symbols-outlined text-[#777586] text-lg">
                              {showKey ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                        <p className="text-xs text-[#777586]">
                          The API key is kept in memory only and will be lost on page refresh.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-12 flex justify-end items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setForm({ ...settings })}
                      className="px-6 py-2.5 text-sm font-bold text-[#464554] hover:text-[#191c1e] transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-2.5 bg-[#2a14b4] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#2a14b4]/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      {saved ? '✓ Saved!' : 'Save Architecture'}
                    </button>
                  </div>
                </div>
              </div>

            </section>
          </div>
        </form>
      </main>
    </div>
  );
}
