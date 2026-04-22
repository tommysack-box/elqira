// Projects Overview — fedele al mockup Stitch: bento grid, editorial layout
import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/Modal';
import { EntityTag } from '../../components/EntityTag';
import { ProjectForm } from './ProjectForm';
import type { Project } from '../../types';
import { getRequestsByScenario, getScenariosByProject } from '../../services/dataService';
import { isSafeHttpUrl } from '../../services/security';

const APP_VERSION = __APP_VERSION__;
const DEFAULT_PROJECT_VERSION = 'v1.0.0';

type ProjectHealth = {
  project: Project;
  scenarioCount: number;
  requestCount: number;
  emptyScenarioCount: number;
  failedRequestCount: number;
  status: 'healthy' | 'warning' | 'critical';
  attentionReasons: string[];
  tagLabel: string;
  versionLabel: string;
};

export function ProjectsView() {
  const { t, projects, setCurrentProject, updateProject, deleteProject } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [versionFilter, setVersionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectHealth['status']>('all');

  const projectVersion = (version?: string) => version?.trim() || DEFAULT_PROJECT_VERSION;
  const featuredActionLabel = (isFeatured?: boolean) => (isFeatured ? t('unfeature') : t('feature'));

  const projectHealth = useMemo<ProjectHealth[]>(
    () =>
      projects.map((project) => {
        const scenarios = getScenariosByProject(project.id);
        let requestCount = 0;
        let emptyScenarioCount = 0;
        let failedRequestCount = 0;

        for (const scenario of scenarios) {
          const requests = getRequestsByScenario(scenario.id);
          requestCount += requests.length;
          if (requests.length === 0) emptyScenarioCount += 1;
          failedRequestCount += requests.filter((request) => request.lastStatusCode === 0 || (request.lastStatusCode ?? 0) >= 400).length;
        }

        const attentionReasons: string[] = [];
        if (failedRequestCount > 0) {
          attentionReasons.push(
            `${failedRequestCount} ${failedRequestCount === 1 ? 'request failed on last run' : 'requests failed on last run'}`
          );
        }
        if (scenarios.length === 0) {
          attentionReasons.push('No scenarios yet');
        }
        if (emptyScenarioCount > 0) {
          attentionReasons.push(
            `${emptyScenarioCount} ${emptyScenarioCount === 1 ? 'scenario has' : 'scenarios have'} no requests`
          );
        }
        if (requestCount === 0 && scenarios.length > 0) {
          attentionReasons.push('No executable requests yet');
        }
        const status: ProjectHealth['status'] = failedRequestCount > 0 || scenarios.length === 0 || requestCount === 0
          ? 'critical'
          : attentionReasons.length > 0
            ? 'warning'
            : 'healthy';

        return {
          project,
          scenarioCount: scenarios.length,
          requestCount,
          emptyScenarioCount,
          failedRequestCount,
          status,
          attentionReasons,
          tagLabel: (project.tag?.trim() || 'Untagged').toLowerCase(),
          versionLabel: projectVersion(project.version),
        };
      }),
    [projects]
  );

  const uniqueTags = useMemo(
    () => Array.from(new Set(projectHealth.map((entry) => entry.tagLabel))).sort(),
    [projectHealth]
  );
  const uniqueVersions = useMemo(
    () => Array.from(new Set(projectHealth.map((entry) => entry.versionLabel))).sort(),
    [projectHealth]
  );
  const filteredProjects = useMemo(
    () =>
      projectHealth.filter((entry) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery = query.length === 0
          || entry.project.title.toLowerCase().includes(query)
          || entry.project.description?.toLowerCase().includes(query)
          || entry.tagLabel.includes(query)
          || entry.versionLabel.toLowerCase().includes(query);
        const matchesTag = tagFilter === 'all' || entry.tagLabel === tagFilter;
        const matchesVersion = versionFilter === 'all' || entry.versionLabel === versionFilter;
        const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
        return matchesQuery && matchesTag && matchesVersion && matchesStatus;
      }),
    [projectHealth, searchQuery, tagFilter, versionFilter, statusFilter]
  );
  const featuredProject = filteredProjects[0] ?? null;
  const regularProjects = filteredProjects.slice(1);
  const isEmpty = projects.length === 0;
  const projectReadiness = (entry: ProjectHealth) => (
    entry.scenarioCount > 0 && entry.requestCount > 0
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
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center justify-center self-start rounded-lg bg-[#2a14b4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#2a14b4]/20 transition-transform hover:scale-[0.99] active:scale-95 md:self-end"
              >
                {t('createNewProject')}
              </button>
            </div>
          </div>

          <section className="mb-8">
            <div className="rounded-2xl bg-white/85 p-3 shadow-sm border border-[#c7c4d7]/10 backdrop-blur-sm">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.68fr))]">
                <label className="flex flex-col">
                  <div className="flex items-center gap-2 rounded-xl border border-[#c7c4d7]/20 bg-[#f7f9fb] px-3 py-2 transition-colors focus-within:border-[#2a14b4] focus-within:bg-white">
                    <span className="material-symbols-outlined text-base text-[#777586]">search</span>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Title, description, tag"
                      className="w-full bg-transparent text-sm text-[#191c1e] outline-none placeholder:text-[#8b8897]"
                    />
                  </div>
                </label>
                <label className="flex flex-col">
                  <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="rounded-xl border border-[#c7c4d7]/20 bg-[#f7f9fb] px-3 py-2 text-sm text-[#191c1e] outline-none transition-colors focus:border-[#2a14b4] focus:bg-white"
                  >
                    <option value="all">All tags</option>
                    {uniqueTags.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col">
                  <select
                    value={versionFilter}
                    onChange={(e) => setVersionFilter(e.target.value)}
                    className="rounded-xl border border-[#c7c4d7]/20 bg-[#f7f9fb] px-3 py-2 text-sm text-[#191c1e] outline-none transition-colors focus:border-[#2a14b4] focus:bg-white"
                  >
                    <option value="all">All versions</option>
                    {uniqueVersions.map((version) => (
                      <option key={version} value={version}>{version}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | ProjectHealth['status'])}
                    className="rounded-xl border border-[#c7c4d7]/20 bg-[#f7f9fb] px-3 py-2 text-sm text-[#191c1e] outline-none transition-colors focus:border-[#2a14b4] focus:bg-white"
                  >
                    <option value="all">All statuses</option>
                    <option value="healthy">Healthy</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {!featuredProject && (
              <div className="md:col-span-12 rounded-xl border border-dashed border-[#c7c4d7]/30 bg-white px-6 py-12 text-center">
                <p className="text-lg font-semibold text-[#191c1e]">No projects match the current filters.</p>
                <p className="mt-2 text-sm text-[#777586]">Broaden search terms or reset filters to restore the full overview.</p>
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
                          className={`flex gap-1 transition-opacity ${p.isFeatured ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.referenceUrl && (
                            <button
                              onClick={(e) => openReference(e, p.referenceUrl!)}
                              title={t('projectReferenceUrl')}
                              aria-label={t('projectReferenceUrl')}
                              className="p-1.5 rounded-lg hover:bg-[#eceef0] text-[#777586] hover:text-[#2a14b4]"
                            >
                              <span className="material-symbols-outlined text-sm">menu_book</span>
                            </button>
                          )}
                          <button
                            onClick={() => updateProject(p.id, { isFeatured: !p.isFeatured })}
                            title={featuredActionLabel(p.isFeatured)}
                            aria-label={featuredActionLabel(p.isFeatured)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              p.isFeatured
                                ? 'bg-[#e3dfff]/70 text-[#2a14b4]'
                                : 'text-[#777586] hover:bg-[#eceef0] hover:text-[#2a14b4]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">keep</span>
                          </button>
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
                      <div
                        className={`flex gap-1 transition-opacity ${p.isFeatured ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.referenceUrl && (
                          <button
                            onClick={(e) => openReference(e, p.referenceUrl!)}
                            title={t('projectReferenceUrl')}
                            aria-label={t('projectReferenceUrl')}
                            className="p-1.5 rounded-lg hover:bg-[#eceef0] text-[#777586] hover:text-[#2a14b4]"
                          >
                            <span className="material-symbols-outlined text-sm">menu_book</span>
                          </button>
                        )}
                        <button
                          onClick={() => updateProject(p.id, { isFeatured: !p.isFeatured })}
                          title={featuredActionLabel(p.isFeatured)}
                          aria-label={featuredActionLabel(p.isFeatured)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            p.isFeatured
                              ? 'bg-[#e3dfff]/70 text-[#2a14b4]'
                              : 'text-[#777586] hover:bg-[#eceef0] hover:text-[#2a14b4]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">keep</span>
                        </button>
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

        </div>
      </div>

      {/* Status bar footer */}
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
