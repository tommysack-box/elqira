// Projects Overview — fedele al mockup Stitch: bento grid, editorial layout
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/Modal';
import { EntityTag } from '../../components/EntityTag';
import { ProjectForm } from './ProjectForm';
import type { Project } from '../../types';

const APP_VERSION = __APP_VERSION__;
const DEFAULT_PROJECT_VERSION = 'v1.0.0';

export function ProjectsView() {
  const { t, settings, projects, setCurrentProject, deleteProject } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const smartEnabled = settings.smartEnabled;

  const timeAgo = (iso: string) => {
    const now = new Date();
    const diff = now.getTime() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const projectVersion = (version?: string) => version?.trim() || DEFAULT_PROJECT_VERSION;

  const isEmpty = projects.length === 0;

  if (isEmpty) {
    return (
      <>
        {/* Empty state — fedele al mockup no_projects_empty_state */}
        <div className="flex-1 min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6">
          <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left hero */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl font-extrabold tracking-tight text-[#191c1e] leading-tight">
                  Getting Started with <span className="text-[#2a14b4]">Elqira</span>
                </h1>
                <p className="text-lg text-[#464554] max-w-lg leading-relaxed">
                  Start by creating your first project to organize your API scenarios and architectural analysis.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 pt-4">
                <button
                  onClick={() => setShowNew(true)}
                  className="px-8 py-4 bg-[#2a14b4] text-white font-semibold rounded-lg flex items-center gap-3 shadow-lg shadow-[#2a14b4]/20 hover:scale-[0.98] transition-transform active:scale-95"
                >
                  {t('createProject')}
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                </button>
              </div>
              {/* Bento mini grid */}
              <div className="grid grid-cols-2 gap-4 mt-12">
                <div className="p-5 bg-[#f2f4f6] rounded-xl space-y-3">
                  <span className="material-symbols-outlined text-[#2a14b4]">account_tree</span>
                  <h3 className="font-bold text-[#191c1e]">Scenario Engine</h3>
                  <p className="text-sm text-[#464554]">Define and test complex API call.</p>
                </div>
                <div className="p-5 bg-[#f2f4f6] rounded-xl space-y-3">
                  <span className="material-symbols-outlined text-[#005c54]">terminal</span>
                  <h3 className="font-bold text-[#191c1e]">Response Inspector</h3>
                  <p className="text-sm text-[#464554]">Analyze and compare API responses in depth.</p>
                </div>
              </div>
            </div>
            {/* Right decorative panel */}
            <div className="lg:col-span-5 relative">
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#2a14b4]/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#005c54]/5 rounded-full blur-3xl" />
              <div className="relative glass-panel rounded-xl p-6 border border-white/20 shadow-2xl space-y-6">
                {/* Pseudo code block */}
                <div className="bg-[#e0e3e5] rounded-lg overflow-hidden border border-[#c7c4d7]/15">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#e6e8ea]">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#6bd8cb]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#c3c0ff]" />
                    </div>
                    <span className="font-mono text-[10px] uppercase text-[#464554]">init_config.json</span>
                  </div>
                  <div className="p-6 font-mono text-xs leading-relaxed overflow-x-auto">
                    <div className="flex gap-4"><span className="text-[#777586]/40 select-none">01</span><span><span className="text-[#4338ca]">"project_name"</span>: <span className="text-[#00423c]">"New Project"</span>,</span></div>
                    <div className="flex gap-4"><span className="text-[#777586]/40 select-none">02</span><span><span className="text-[#4338ca]">"status"</span>: <span className="text-[#00423c]">"awaiting_creation"</span>,</span></div>
                    <div className="flex gap-4"><span className="text-[#777586]/40 select-none">03</span><span><span className="text-[#4338ca]">"scenarios"</span>: [],</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Footer meta */}
        <footer className="fixed bottom-0 left-0 right-0 p-4 flex justify-between items-center text-[10px] font-mono text-[#c7c4d7] uppercase tracking-widest pointer-events-none">
          <div className="flex items-center gap-3">
            <span>Elqira</span>
            <span className="text-[#191c1e]">v{APP_VERSION}</span>
            <span>Smart Configuration</span>
            <span className={smartEnabled ? 'text-[#005c54]' : 'text-[#ba1a1a]'}>
              {smartEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div>Analytical Architect UI</div>
        </footer>
        {showNew && <Modal title={t('newProject')} onClose={() => setShowNew(false)}><ProjectForm onClose={() => setShowNew(false)} /></Modal>}
      </>
    );
  }

  // Projects Overview — bento grid layout
  return (
    <>
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-6">
          {/* Editorial header */}
          <div className="mb-16">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <h1 className="text-5xl md:text-6xl font-black text-[#191c1e] tracking-tighter leading-none mb-6">
                  {t('projects')} <span className="text-[#2a14b4]">{t('overview')}</span>
                </h1>
                <p className="text-lg text-[#464554] leading-relaxed font-medium">
                  Centralize your API debugging and analysis. Select a project to begin your session.
                </p>
              </div>
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center justify-center self-start rounded-lg bg-[#2a14b4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#2a14b4]/20 transition-transform hover:scale-[0.99] active:scale-95 md:self-end"
              >
                {t('createNewProject')}
              </button>
            </div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {projects.map((p, idx) => {
              const isFeatured = idx === 0;
              return isFeatured ? (
                // Featured large card
                <div
                  key={p.id}
                  className="md:col-span-8 group relative bg-white p-8 rounded-xl overflow-hidden shadow-sm transition-all hover:bg-[#f7f9fb] cursor-pointer"
                  onClick={() => setCurrentProject(p)}
                >
                  <div className="flex flex-col h-full justify-between gap-12">
                    <div>
                      <div className="flex justify-between items-start gap-3 mb-6">
                        <div className="flex items-start gap-3">
                          <EntityTag tag={p.tag} fallback={t('project')} className="self-start" />
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-widest uppercase bg-[#e3dfff] text-[#100069]">
                            {projectVersion(p.version)}
                          </span>
                        </div>
                        <div
                          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-[#eceef0] text-[#777586] hover:text-[#191c1e]">
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button onClick={() => setConfirmDelete(p)} className="p-1.5 rounded-lg hover:bg-[#ffdad6] text-[#777586] hover:text-[#ba1a1a]">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                      <h2 className="text-3xl font-bold text-[#191c1e] mb-3 tracking-tight">{p.title}</h2>
                      {p.description && <p className="text-[#464554] max-w-md">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#777586] uppercase tracking-widest pt-6 border-t border-[#c7c4d7]/10">
                      <span className="material-symbols-outlined text-base text-[#00423c]">check_circle</span>
                      Updated: {timeAgo(p.updatedAt)}
                    </div>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-[#2a14b4]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="glass-panel px-6 py-2 rounded-full border border-white/20 shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                      <span className="text-[#2a14b4] font-bold text-sm">Open Project</span>
                      <span className="material-symbols-outlined text-[#2a14b4] text-sm">arrow_forward</span>
                    </div>
                  </div>
                </div>
              ) : (
                // Side/small card
                <div
                  key={p.id}
                  className="md:col-span-4 group relative bg-white p-6 rounded-xl flex flex-col justify-between hover:bg-[#f7f9fb] transition-colors cursor-pointer"
                  onClick={() => setCurrentProject(p)}
                >
                  <div>
                    <div className="flex justify-between items-start gap-3 mb-6">
                      <div className="flex items-start gap-3">
                        <EntityTag tag={p.tag} fallback={t('project')} className="self-start" />
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-widest uppercase bg-[#e3dfff] text-[#100069]">
                          {projectVersion(p.version)}
                        </span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-[#eceef0] text-[#777586] hover:text-[#191c1e]">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => setConfirmDelete(p)} className="p-1.5 rounded-lg hover:bg-[#ffdad6] text-[#777586] hover:text-[#ba1a1a]">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-[#191c1e] mb-2">{p.title}</h3>
                    {p.description && <p className="text-sm text-[#464554]">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#777586] uppercase tracking-widest pt-6 border-t border-[#c7c4d7]/10">
                    <span className="material-symbols-outlined text-base text-[#00423c]">check_circle</span>
                    Updated: {timeAgo(p.updatedAt)}
                  </div>
                  <div className="absolute inset-0 bg-[#2a14b4]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="glass-panel px-6 py-2 rounded-full border border-white/20 shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
                      <span className="text-[#2a14b4] font-bold text-sm">Open Project</span>
                      <span className="material-symbols-outlined text-[#2a14b4] text-sm">arrow_forward</span>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      </div>

      {/* Status bar footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-8 bg-[#f2f4f6] border-t border-[#c7c4d7]/10 flex items-center px-6 justify-between text-[10px] font-mono text-[#c7c4d7] uppercase tracking-widest z-50">
        <div className="flex items-center gap-3">
          <span>Elqira</span>
          <span className="text-[#191c1e]">v{APP_VERSION}</span>
          <span>Smart Configuration</span>
          <span className={smartEnabled ? 'text-[#005c54]' : 'text-[#ba1a1a]'}>
            {smartEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div />
      </footer>

      {/* Modals */}
      {showNew && <Modal title={t('newProject')} onClose={() => setShowNew(false)}><ProjectForm onClose={() => setShowNew(false)} /></Modal>}
      {editing && <Modal title={t('editProject')} onClose={() => setEditing(null)}><ProjectForm project={editing} onClose={() => setEditing(null)} /></Modal>}
      {confirmDelete && (
        <Modal title={t('deleteProject')} onClose={() => setConfirmDelete(null)} size="sm">
          <p className="text-sm text-[#464554] mb-4">{t('confirmDelete')} <strong>{confirmDelete.title}</strong>?</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm rounded-lg bg-[#e6e8ea] font-semibold text-[#191c1e]">{t('cancel')}</button>
            <button onClick={() => { deleteProject(confirmDelete.id); setConfirmDelete(null); }} className="px-4 py-2 text-sm rounded-lg bg-[#ba1a1a] text-white font-semibold">{t('delete')}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
