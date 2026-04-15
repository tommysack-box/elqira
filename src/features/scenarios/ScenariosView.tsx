// Scenarios list for the current project — fedele al mockup project_scenarios/code.html
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/Modal';
import { EntityTag } from '../../components/EntityTag';
import { ScenarioForm } from './ScenarioForm';
import type { Scenario } from '../../types';

const APP_VERSION = __APP_VERSION__;

export function ScenariosView() {
  const { t, settings, currentProject, scenarios, setCurrentScenario, updateScenario, deleteScenario } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Scenario | null>(null);
  const smartEnabled = settings.smartEnabled;

  if (!currentProject) return null;

  const featured = scenarios[0] ?? null;
  const secondary = scenarios.slice(1, 3);
  const tertiary = scenarios.slice(3);

  const timeAgo = (iso: string) => {
    const now = new Date();
    const diff = now.getTime() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  const featuredActionLabel = (isFeatured?: boolean) => (isFeatured ? t('unfeature') : t('feature'));

  // Empty state
  if (scenarios.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f7f9fb]">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-8 pt-8 pb-4">
          <div className="mb-10">
            <h1 className="text-4xl font-extrabold text-[#191c1e] tracking-tight mb-2">{t('scenarios')}</h1>
            <p className="text-[#464554] max-w-2xl leading-relaxed">
              {t('scenariosSubtitle')}
            </p>
          </div>
        </div>

        {/* Empty state glassmorphic */}
        <div className="flex flex-col items-center justify-center py-16 px-6 max-w-3xl mx-auto">
          <div className="relative w-full mb-10">
            {/* bg pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none overflow-hidden">
              <svg width="100%" height="100%" viewBox="0 0 800 300" fill="none">
                <path d="M50 250L750 250M50 200L750 200M50 150L750 150M50 100L750 100" stroke="currentColor" strokeWidth="0.5" />
                <path d="M100 50L100 280M200 50L200 280M300 50L300 280M400 50L400 280M500 50L500 280M600 50L600 280M700 50L700 280" stroke="currentColor" strokeWidth="0.5" />
                <circle cx="400" cy="150" r="100" stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>
            <div className="glass-card rounded-xl border border-white/40 shadow-2xl p-12 text-center relative z-10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[#e3dfff]/30 rounded-2xl mb-8 ring-1 ring-[#2a14b4]/20">
                <span className="material-symbols-outlined text-4xl text-[#2a14b4]" style={{ fontVariationSettings: "'wght' 300" }}>
                  schema
                </span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-[#191c1e] mb-3">
                Getting Started with {currentProject.title}
              </h2>
              <p className="text-[#464554] text-lg leading-relaxed max-w-lg mx-auto mb-8">
                Group related API requests, execute them and get AI-powered insights on every response.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setShowNew(true)}
                  className="flex items-center gap-2 bg-[#2a14b4] text-white px-8 py-3 rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  {t('newScenario')}
                </button>
              </div>
            </div>
          </div>
          {/* Step hints */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {[
              { icon: 'schema', label: '1. Create a Scenario', desc: 'Give it a name and group your API requests' },
              { icon: 'api', label: '2. Add Requests', desc: 'Model HTTP calls with headers, body, and auth' },
              { icon: 'monitoring', label: '3. Inspect Responses', desc: 'Analyze and compare API responses' },
            ].map((s) => (
              <div key={s.label} className="bg-[#ffffff] p-5 rounded-xl border border-[#c7c4d7]/20 flex flex-col gap-3">
                <div className="p-2 bg-[#e3dfff]/40 rounded-lg w-fit">
                  <span className="material-symbols-outlined text-[#2a14b4] text-xl">{s.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#191c1e] uppercase tracking-widest mb-1">{s.label}</p>
                  <p className="text-xs text-[#464554]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showNew && (
          <Modal title={t('newScenario')} onClose={() => setShowNew(false)}>
            <ScenarioForm onClose={() => setShowNew(false)} />
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fb]">
      {/* Page header */}
      <section className="max-w-7xl mx-auto px-8 pt-8 pb-4">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-[#191c1e] tracking-tight mb-2">
              {t('scenarios')} <span className="text-[#2a14b4]">{t('overview')}</span>
            </h1>
            <p className="text-[#464554] max-w-2xl leading-relaxed">
              {t('scenariosSubtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center justify-center self-start rounded-lg bg-[#2a14b4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#2a14b4]/20 transition-transform hover:scale-[0.99] active:scale-95 md:self-end"
          >
            {t('createNewScenario')}
          </button>
        </div>
      </section>

      {/* Bento grid */}
      <section className="max-w-7xl mx-auto px-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Featured card (col-8) */}
          {featured && (
            <div
              className="md:col-span-8 group relative cursor-pointer"
              onClick={() => setCurrentScenario(featured)}
            >
              <div className="bg-[#ffffff] p-8 rounded-xl h-full border border-[#c7c4d7]/15 hover:bg-[#f7f9fb] transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-3">
                      <EntityTag tag={featured.tag} fallback={t('scenario')} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`material-symbols-outlined text-sm p-1.5 rounded transition-colors ${
                          featured.isFeatured
                            ? 'bg-[#e3dfff]/70 text-[#2a14b4] opacity-100'
                            : 'text-[#777586] opacity-0 group-hover:opacity-100 hover:text-[#2a14b4] hover:bg-[#e3dfff]/40'
                        }`}
                        onClick={(e) => { e.stopPropagation(); updateScenario(featured.id, { isFeatured: !featured.isFeatured }); }}
                        title={featuredActionLabel(featured.isFeatured)}
                        aria-label={featuredActionLabel(featured.isFeatured)}
                      >
                        keep
                      </button>
                      <button
                        className="material-symbols-outlined text-sm text-[#777586] hover:text-[#2a14b4] p-1.5 rounded hover:bg-[#e3dfff]/40 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); setEditing(featured); }}
                      >
                        edit
                      </button>
                      <button
                        className="material-symbols-outlined text-sm text-[#777586] hover:text-[#ba1a1a] p-1.5 rounded hover:bg-[#ffdad6]/40 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(featured); }}
                      >
                        delete
                      </button>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-[#191c1e] mb-3">{featured.title}</h3>
                  {featured.description && (
                    <p className="text-[#464554] text-base leading-relaxed mb-6">{featured.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 pt-6 border-t border-[#c7c4d7]/10">
                  <span className="font-mono text-[10px] text-[#777586] uppercase tracking-wider">
                    Updated: {timeAgo(featured.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="absolute inset-0 bg-[#2a14b4]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <div className="glass-panel px-6 py-2 rounded-full border border-white/20 shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                  <span className="text-[#2a14b4] font-bold text-sm">Open Scenario</span>
                  <span className="material-symbols-outlined text-[#2a14b4] text-sm">arrow_forward</span>
                </div>
              </div>
            </div>
          )}

          {/* Secondary cards (col-4) */}
          {secondary.length > 0 && (
            <div className="md:col-span-4 flex flex-col gap-6">
              {secondary.map((s) => (
                <div
                  key={s.id}
                  className="bg-[#ffffff] p-6 rounded-xl border border-[#c7c4d7]/15 hover:bg-[#f7f9fb] transition-colors group relative cursor-pointer"
                  onClick={() => setCurrentScenario(s)}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-3">
                      <EntityTag tag={s.tag} fallback={t('scenario')} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`material-symbols-outlined text-sm p-1.5 rounded transition-colors ${
                          s.isFeatured
                            ? 'bg-[#e3dfff]/70 text-[#2a14b4] opacity-100'
                            : 'text-[#777586] opacity-0 group-hover:opacity-100 hover:text-[#2a14b4] hover:bg-[#e3dfff]/40'
                        }`}
                        onClick={(e) => { e.stopPropagation(); updateScenario(s.id, { isFeatured: !s.isFeatured }); }}
                        title={featuredActionLabel(s.isFeatured)}
                        aria-label={featuredActionLabel(s.isFeatured)}
                      >
                        keep
                      </button>
                      <button
                        className="material-symbols-outlined text-sm text-[#777586] hover:text-[#2a14b4] p-1.5 rounded hover:bg-[#e3dfff]/40 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                      >
                        edit
                      </button>
                      <button
                        className="material-symbols-outlined text-sm text-[#777586] hover:text-[#ba1a1a] p-1.5 rounded hover:bg-[#ffdad6]/40 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(s); }}
                      >
                        delete
                      </button>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-[#191c1e] mb-2">{s.title}</h4>
                  {s.description && (
                    <p className="text-sm text-[#464554] leading-relaxed mb-4 line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#777586] uppercase tracking-widest">
                    <span className="material-symbols-outlined text-base text-[#00423c]">check_circle</span>
                    Updated: {timeAgo(s.updatedAt)}
                  </div>
                  <div className="absolute inset-0 bg-[#2a14b4]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="glass-panel px-5 py-2 rounded-full border border-white/20 shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                      <span className="text-[#2a14b4] font-bold text-sm">Open Scenario</span>
                      <span className="material-symbols-outlined text-[#2a14b4] text-sm">arrow_forward</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tertiary cards (col-4 each) */}
          {tertiary.map((s) => (
            <div
              key={s.id}
              className="md:col-span-4 group relative cursor-pointer"
              onClick={() => setCurrentScenario(s)}
            >
              <div className="bg-[#ffffff] p-6 rounded-xl border border-[#c7c4d7]/15 hover:bg-[#f7f9fb] transition-colors h-full flex flex-col justify-between">
                <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-3">
                    <EntityTag tag={s.tag} fallback={t('scenario')} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`material-symbols-outlined text-sm p-1.5 rounded transition-colors ${
                        s.isFeatured
                          ? 'bg-[#e3dfff]/70 text-[#2a14b4] opacity-100'
                          : 'text-[#777586] opacity-0 group-hover:opacity-100 hover:text-[#2a14b4] hover:bg-[#e3dfff]/40'
                      }`}
                      onClick={(e) => { e.stopPropagation(); updateScenario(s.id, { isFeatured: !s.isFeatured }); }}
                      title={featuredActionLabel(s.isFeatured)}
                      aria-label={featuredActionLabel(s.isFeatured)}
                    >
                      keep
                    </button>
                    <button
                      className="material-symbols-outlined text-sm text-[#777586] hover:text-[#2a14b4] p-1.5 rounded hover:bg-[#e3dfff]/40 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                    >
                      edit
                    </button>
                    <button
                      className="material-symbols-outlined text-sm text-[#777586] hover:text-[#ba1a1a] p-1.5 rounded hover:bg-[#ffdad6]/40 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(s); }}
                    >
                      delete
                    </button>
                  </div>
                </div>
                  <h4 className="text-lg font-bold text-[#191c1e]">{s.title}</h4>
                {s.description && (
                  <p className="text-sm text-[#464554] leading-relaxed mb-4 line-clamp-2">{s.description}</p>
                )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#777586] uppercase tracking-widest pt-6 border-t border-[#c7c4d7]/10">
                  <span className="material-symbols-outlined text-base text-[#00423c]">check_circle</span>
                  Updated: {timeAgo(s.updatedAt)}
                </div>
              </div>
              <div className="absolute inset-0 bg-[#2a14b4]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <div className="glass-panel px-5 py-2 rounded-full border border-white/20 shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                  <span className="text-[#2a14b4] font-bold text-sm">Open Scenario</span>
                  <span className="material-symbols-outlined text-[#2a14b4] text-sm">arrow_forward</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="fixed bottom-0 left-0 right-0 h-8 bg-[#f2f4f6] border-t border-[#c7c4d7]/10 flex items-center px-6 justify-between text-[10px] font-mono text-[#c7c4d7] uppercase tracking-widest z-50">
        <div className="flex items-center gap-3">
          <span>Elqira</span>
          <span className="text-[#191c1e]">v{APP_VERSION}</span>
          <span>Smart Configuration</span>
          <span className={smartEnabled ? 'text-[#005c54]' : 'text-[#ba1a1a]'}>
            {smartEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Project</span>
          <span className="text-sm font-bold text-[#191c1e] normal-case tracking-normal">
            {currentProject.title}
          </span>
        </div>
      </footer>

      {/* Modals */}
      {showNew && (
        <Modal title={t('newScenario')} onClose={() => setShowNew(false)}>
          <ScenarioForm onClose={() => setShowNew(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={t('editScenario')} onClose={() => setEditing(null)}>
          <ScenarioForm scenario={editing} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title={t('deleteScenario')} onClose={() => setConfirmDelete(null)} size="sm">
          <p className="text-sm text-[#464554] mb-6">
            {t('confirmDelete')} <strong>{confirmDelete.title}</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-sm rounded-lg border border-[#c7c4d7]/30 text-[#464554] hover:bg-[#f2f4f6] transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => { deleteScenario(confirmDelete.id); setConfirmDelete(null); }}
              className="px-4 py-2 text-sm rounded-lg bg-[#ba1a1a] text-white hover:opacity-90 transition-opacity"
            >
              {t('delete')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
