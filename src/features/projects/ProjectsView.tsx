// Projects Overview — fedele al mockup Stitch: bento grid, editorial layout
import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/Modal';
import { EntityTag } from '../../components/EntityTag';
import { CardMenu } from '../../components/CardMenu';
import { ProjectIcon } from '../../components/ProjectIcon';
import { ProjectForm } from './ProjectForm';
import type { Project } from '../../types';
import { exportProjectData, getScenariosByProject, importProjectData } from '../../services/dataService';
import { isSafeHttpUrl } from '../../services/security';
import { createTransferFilename, downloadJsonFile, MAX_IMPORT_FILE_BYTES } from '../../services/transferService';

const APP_VERSION = __APP_VERSION__;
const DEFAULT_PROJECT_VERSION = 'v1.0.0';

type ProjectHealth = {
  project: Project;
  scenarioCount: number;
  isArchived: boolean;
};

export function ProjectsView() {
  const {
    t,
    projects,
    setCurrentProject,
    updateProject,
    deleteProject,
    refreshWorkspaceData,
  } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [transferMessage, setTransferMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const projectVersion = (version?: string) => version?.trim() || DEFAULT_PROJECT_VERSION;
  const featuredActionLabel = (isFeatured?: boolean) => (isFeatured ? t('unfeature') : t('feature'));
  const projectMenuItems = (project: Project) => [
    {
      key: 'reference',
      label: t('projectReferenceUrl'),
      icon: 'menu_book',
      hidden: !project.referenceUrl,
      onClick: (event: React.MouseEvent) => openReference(event as React.MouseEvent<HTMLButtonElement>, project.referenceUrl!),
    },
    {
      key: 'export',
      label: t('exportProjectAction'),
      icon: 'download',
      onClick: (event: React.MouseEvent) => void handleProjectExport(event as React.MouseEvent<HTMLButtonElement>, project),
    },
    {
      key: 'feature',
      label: featuredActionLabel(project.isFeatured),
      icon: 'keep',
      active: project.isFeatured,
      activeIcon: 'keep',
      hidden: Boolean(project.isArchived),
      onClick: () => updateProject(project.id, { isFeatured: !project.isFeatured }),
    },
    {
      key: 'archive',
      label: project.isArchived ? t('unarchiveProject') : t('archiveProject'),
      icon: project.isArchived ? 'unarchive' : 'archive',
      onClick: () => updateProject(project.id, { isArchived: !project.isArchived }),
    },
    {
      key: 'edit',
      label: t('editProject'),
      icon: 'edit',
      onClick: () => setEditing(project),
    },
    {
      key: 'delete',
      label: t('deleteProject'),
      icon: 'delete',
      danger: true,
      onClick: () => setConfirmDelete(project),
    },
  ];

  const projectHealth = useMemo<ProjectHealth[]>(
    () =>
      projects.map((project) => {
        const scenarios = getScenariosByProject(project.id);

        return {
          project,
          scenarioCount: scenarios.length,
          isArchived: Boolean(project.isArchived),
        };
      }),
    [projects]
  );

  const activeProjects = projectHealth.filter((entry) => !entry.isArchived);
  const archivedProjects = projectHealth.filter((entry) => entry.isArchived);
  const featuredProject = activeProjects[0] ?? null;
  const regularProjects = activeProjects.slice(1);
  const isEmpty = projects.length === 0;
  const projectReadiness = (entry: ProjectHealth) => (
    entry.scenarioCount > 0
      ? { icon: 'check_circle', label: t('entityReadyToInspect'), iconClass: 'text-[#00423c]' }
      : { icon: 'playlist_add', label: t('entityNeedsPopulation'), iconClass: 'text-[#777586]' }
  );

  const openReference = (event: React.MouseEvent<HTMLButtonElement>, url: string) => {
    event.stopPropagation();
    if (!isSafeHttpUrl(url)) return;
    if (window.elqiraDesktop?.openExternalUrl) {
      void window.elqiraDesktop.openExternalUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleProjectExport = async (event: React.MouseEvent<HTMLButtonElement>, project: Project) => {
    event.stopPropagation();

    const snapshot = await exportProjectData(project.id);
    if (!snapshot) return;

    downloadJsonFile(createTransferFilename('project', project.title), snapshot);
    setTransferMessage({ tone: 'success', text: t('projectExported') });
  };

  const openProjectImport = () => {
    fileInputRef.current?.click();
  };

  const handleProjectImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        setTransferMessage({ tone: 'error', text: t('importFileTooLarge') });
        return;
      }

      const snapshot = JSON.parse(await file.text());
      await importProjectData(snapshot);
      refreshWorkspaceData();
      setTransferMessage({ tone: 'success', text: t('projectImported') });
    } catch (error) {
      setTransferMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : t('projectImportInvalid'),
      });
    } finally {
      event.target.value = '';
    }
  };

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
                <button
                  onClick={openProjectImport}
                  className="px-8 py-4 bg-white text-[#191c1e] font-semibold rounded-lg flex items-center gap-3 border border-[#c7c4d7]/20 shadow-sm hover:bg-[#f7f9fb] transition-colors"
                >
                  {t('importProjectAction')}
                  <span className="material-symbols-outlined">upload</span>
                </button>
              </div>
              {transferMessage && (
                <p className={`text-sm font-semibold ${transferMessage.tone === 'error' ? 'text-[#ba1a1a]' : 'text-[#2a14b4]'}`}>
                  {transferMessage.text}
                </p>
              )}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleProjectImport}
          className="hidden"
        />
        <footer className="fixed bottom-0 left-0 right-0 p-4 flex justify-between items-center text-[10px] font-mono text-[#c7c4d7] uppercase tracking-widest pointer-events-none">
          <div className="flex items-center gap-3">
            <span>Elqira</span>
            <span className="text-[#191c1e]">v{APP_VERSION}</span>
            <span>Analysis</span>
            <span className="text-[#005c54]">Local</span>
          </div>
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
              <div className="flex flex-col items-start gap-3 md:items-end">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowNew(true)}
                    className="inline-flex items-center justify-center rounded-lg bg-[#2a14b4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#2a14b4]/20 transition-transform hover:scale-[0.99] active:scale-95"
                  >
                    {t('createNewProject')}
                  </button>
                  <button
                    onClick={openProjectImport}
                    className="inline-flex items-center justify-center rounded-lg border border-[#c7c4d7]/20 bg-white px-5 py-3 text-sm font-semibold text-[#191c1e] shadow-sm transition-colors hover:bg-[#f7f9fb]"
                  >
                    {t('importProjectAction')}
                  </button>
                </div>
                {transferMessage && (
                  <p className={`text-xs font-semibold ${transferMessage.tone === 'error' ? 'text-[#ba1a1a]' : 'text-[#2a14b4]'}`}>
                    {transferMessage.text}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {!featuredProject && (
              <div className="md:col-span-12 rounded-xl border border-dashed border-[#c7c4d7]/30 bg-white px-6 py-12 text-center">
                <p className="text-lg font-semibold text-[#191c1e]">{t('noActiveProjects')}</p>
                <p className="mt-2 text-sm text-[#777586]">{t('noActiveProjectsDesc')}</p>
              </div>
            )}

            {[featuredProject, ...regularProjects].filter(Boolean).map((entry, idx) => {
              const current = entry as ProjectHealth;
              const p = current.project;
              const isFeatured = idx === 0;
              const readiness = projectReadiness(current);
              return isFeatured ? (
                // Featured large card
                <div
                  key={p.id}
                  className="md:col-span-8 group relative bg-white p-8 rounded-xl overflow-visible border border-[#c7c4d7]/15 shadow-sm transition-all hover:bg-[#f7f9fb] cursor-pointer"
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
                          className={`flex gap-1 transition-opacity ${p.isFeatured ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.isFeatured && (
                            <span
                              className="flex h-7 w-7 items-center justify-center text-[#2a14b4]"
                              aria-label={t('feature')}
                              title={t('feature')}
                            >
                              <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                keep
                              </span>
                            </span>
                          )}
                          <CardMenu items={projectMenuItems(p)} />
                        </div>
                      </div>
                        <div className="flex items-center gap-4 mb-3">
                        {p.icon && (
                          <ProjectIcon
                            icon={p.icon}
                            frameClassName="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#ffffff,#f3f5f7)] p-2 shadow-[inset_0_0_0_1px_rgba(199,196,215,0.18)]"
                            imgClassName="h-full w-full object-contain"
                          />
                        )}
                        <h2 className="text-3xl font-bold text-[#191c1e] tracking-tight">{p.title}</h2>
                      </div>
                      {p.description && <p className="text-[#464554] max-w-md">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#777586] uppercase tracking-widest pt-6 border-t border-[#c7c4d7]/10">
                      <span className={`material-symbols-outlined text-base ${readiness.iconClass}`}>{readiness.icon}</span>
                      {readiness.label}
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
                  className="md:col-span-4 group relative bg-white p-6 rounded-xl overflow-visible border border-[#c7c4d7]/15 flex flex-col justify-between hover:bg-[#f7f9fb] transition-colors cursor-pointer"
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
                      <div
                        className={`flex gap-1 transition-opacity ${p.isFeatured ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.isFeatured && (
                          <span
                            className="flex h-7 w-7 items-center justify-center text-[#2a14b4]"
                            aria-label={t('feature')}
                            title={t('feature')}
                          >
                            <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              keep
                            </span>
                          </span>
                        )}
                        <CardMenu items={projectMenuItems(p)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      {p.icon && (
                        <ProjectIcon
                          icon={p.icon}
                          frameClassName="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#ffffff,#f3f5f7)] p-1.5 shadow-[inset_0_0_0_1px_rgba(199,196,215,0.18)]"
                          imgClassName="h-full w-full object-contain"
                        />
                      )}
                      <h3 className="text-xl font-bold text-[#191c1e]">{p.title}</h3>
                    </div>
                    {p.description && <p className="text-sm text-[#464554]">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#777586] uppercase tracking-widest pt-6 border-t border-[#c7c4d7]/10">
                    <span className={`material-symbols-outlined text-base ${readiness.iconClass}`}>{readiness.icon}</span>
                    {readiness.label}
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

          <section className="mt-16">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.45em] text-[#777586]">
                {t('archivedProjects')}
              </h2>
              <div className="h-px flex-1 bg-[#c7c4d7]/20" />
            </div>

            {archivedProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#c7c4d7]/25 bg-white px-6 py-5 text-sm text-[#777586]">
                {t('archivedProjectsEmpty')}
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden border border-[#c7c4d7]/15 bg-white shadow-sm">
                {archivedProjects.map((entry, index) => {
                  const p = entry.project;
                  return (
                    <div
                      key={p.id}
                      className={`group flex items-center gap-4 px-6 py-5 transition-colors hover:bg-[#f7f9fb] cursor-pointer ${
                        index !== archivedProjects.length - 1 ? 'border-b border-[#c7c4d7]/12' : ''
                      }`}
                      onClick={() => setCurrentProject(p)}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f2f4f6] text-[#777586]">
                        {p.icon ? (
                          <ProjectIcon
                            icon={p.icon}
                            frameClassName="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#ffffff,#f3f5f7)] p-1.5 shadow-[inset_0_0_0_1px_rgba(199,196,215,0.18)]"
                            imgClassName="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="material-symbols-outlined">folder_zip</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="truncate text-xl font-bold text-[#191c1e]">{p.title}</h3>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-widest uppercase bg-[#f2f4f6] text-[#777586]">
                            {projectVersion(p.version)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#777586] truncate">
                          {p.description?.trim() || t('project')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.2em] text-[#9a98aa]">
                          {entry.scenarioCount} {t('scenarios')}
                        </span>
                        <CardMenu items={projectMenuItems(p)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* Status bar footer */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleProjectImport}
        className="hidden"
      />

      <footer className="fixed bottom-0 left-0 right-0 h-8 bg-[#f2f4f6] border-t border-[#c7c4d7]/10 flex items-center px-6 justify-between text-[10px] font-mono text-[#c7c4d7] uppercase tracking-widest z-50">
        <div className="flex items-center gap-3">
          <span>Elqira</span>
          <span className="text-[#191c1e]">v{APP_VERSION}</span>
          <span>Analysis</span>
          <span className="text-[#005c54]">Local</span>
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
