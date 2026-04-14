// Application Settings view — fedele al mockup application_settings/code.html
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { AppSettings } from '../../types';

export function SettingsView() {
  const { t, settings, saveSettings } = useApp();
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const update = (patch: Partial<AppSettings>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const configPreview = JSON.stringify(
    {
      engine: 'elqira-smart-v1',
      localization: form.language === 'it' ? 'it-IT' : 'en-US',
      provider: form.smartProvider ?? 'none',
      model: form.smartModel ?? 'none',
      features: form.smartEnabled ? ['smart_explain', 'contextual_debug'] : [],
    },
    null,
    2
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fb]">
      <main className="pt-10 pb-20 px-6 max-w-6xl mx-auto">
        {/* Editorial header */}
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tighter text-[#191c1e] mb-2">
            Application Settings
          </h1>
          <p className="text-[#464554] max-w-2xl text-lg leading-relaxed">
            Configure your project environment, manage localization preferences, and architect your AI integration parameters.
          </p>
        </div>

        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* General section (col-4) */}
            <section className="md:col-span-4 flex flex-col gap-6">
              <div className="p-8 bg-[#ffffff] rounded-xl shadow-[−4px_0_12px_rgba(0,0,0,0.03)] border border-[#c7c4d7]/10">
                <div className="flex items-center gap-3 mb-8">
                  <span className="material-symbols-outlined text-[#2a14b4]">language</span>
                  <h2 className="font-semibold text-lg tracking-tight text-[#191c1e]">{t('general')}</h2>
                </div>
                <div className="space-y-8">
                  {/* Language toggle */}
                  <div className="space-y-4">
                    <label className="font-mono text-xs font-bold uppercase tracking-widest text-[#777586] block">
                      {t('language')}
                    </label>
                    <div className="bg-[#f2f4f6] p-1.5 rounded-lg flex gap-1">
                      <button
                        type="button"
                        onClick={() => update({ language: 'en' })}
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
                        onClick={() => update({ language: 'it' })}
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

                  {/* Auto-update toggle */}
                  <div className="pt-6 border-t border-[#c7c4d7]/20">
                    <label className="font-mono text-xs font-bold uppercase tracking-widest text-[#777586] block mb-4">
                      Environment
                    </label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#191c1e]">Auto-Update</span>
                      <button
                        type="button"
                        className="w-10 h-5 bg-[#4338ca] rounded-full relative"
                      >
                        <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative tech insight card */}
              <div className="p-6 bg-[#e0e3e5] rounded-xl">
                <span className="font-mono text-[10px] text-[#777586] block mb-2">SYS_LOG_V7.2</span>
                <p className="text-sm text-[#515f74] font-medium italic">
                  "Precision is the only objective reality."
                </p>
              </div>
            </section>

            {/* Smart Features section (col-8) */}
            <section className="md:col-span-8">
              <div className="relative p-8 bg-[#ffffff] rounded-xl border border-[#c7c4d7]/10 overflow-hidden">
                {/* Subtle AI background accent */}
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
                        form.smartEnabled && form.smartApiKey
                          ? 'bg-[#89f5e7] text-[#00201d]'
                          : 'bg-[#e0e3e5] text-[#464554]'
                      }`}
                    >
                      {form.smartEnabled && form.smartApiKey ? 'ACTIVE_ENGINE' : 'INACTIVE'}
                    </span>
                  </div>

                  {/* Enable toggle */}
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
                      {/* Provider */}
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
                            <option value="openai">OpenAI (Standard)</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="gemini">Google (Gemini)</option>
                            <option value="mistral">Mistral AI</option>
                            <option value="custom">Custom</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-3 top-3 text-[#777586] pointer-events-none">
                            expand_more
                          </span>
                        </div>
                      </div>

                      {/* Model */}
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

                      {/* API Key */}
                      <div className="md:col-span-2 space-y-3">
                        <label className="font-mono text-xs font-bold uppercase tracking-widest text-[#777586] block">
                          {t('smartApiKey')}
                        </label>
                        <div className="relative">
                          <input
                            type={showKey ? 'text' : 'password'}
                            value={form.smartApiKey ?? ''}
                            onChange={(e) => update({ smartApiKey: e.target.value })}
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
                        <p className="font-mono text-[11px] text-[#c7c4d7]">
                          Keys are encrypted using AES-256 before being stored in your local vault.
                        </p>
                      </div>

                      {/* Custom endpoint */}
                      <div className="md:col-span-2 mt-4 p-5 bg-[#f2f4f6] rounded-lg border border-[#c7c4d7]/10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#89f5e7] flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#00201d]">hub</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#191c1e]">Custom Inference Endpoint</p>
                            <p className="text-xs text-[#464554]">Bypass default gateways for enterprise proxying.</p>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={form.smartEndpoint ?? ''}
                          onChange={(e) => update({ smartEndpoint: e.target.value })}
                          placeholder="https://api.openai.com/v1"
                          className="font-mono text-xs bg-[#ffffff] border border-[#c7c4d7]/20 rounded-lg py-2 px-3 w-64 focus:ring-2 focus:ring-[#00423c]/20 text-[#191c1e] placeholder:text-[#c7c4d7]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Action bar */}
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

              {/* Config preview */}
              <div className="mt-8">
                <div className="bg-[#e0e3e5] rounded-lg overflow-hidden border border-[#c7c4d7]/10">
                  <div className="px-4 py-2 bg-[#f2f4f6] flex items-center justify-between border-b border-[#c7c4d7]/10">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#777586]">
                      Configuration Preview (JSON)
                    </span>
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#ba1a1a]/40" />
                      <div className="w-2 h-2 rounded-full bg-[#6bd8cb]" />
                      <div className="w-2 h-2 rounded-full bg-[#c3c0ff]" />
                    </div>
                  </div>
                  <div className="p-6 overflow-x-auto">
                    <pre className="font-mono text-xs leading-relaxed text-[#b9c7df] whitespace-pre">
                      {configPreview}
                    </pre>
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
