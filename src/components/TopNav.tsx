// TopNavBar — fedelmente dal design system Stitch
import { Suspense, lazy, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import type { Project, RequestHealthCategory } from '../types';
import { getProjectById, getScenarioById } from '../services/dataService';

const ProjectForm = lazy(() =>
  import('../features/projects/ProjectForm').then((module) => ({ default: module.ProjectForm }))
);

function WindowControlIcon({ type }: { type: 'minimize' | 'maximize' | 'restore' | 'close' }) {
  if (type === 'minimize') {
    return (
      <svg viewBox="0 0 10 10" aria-hidden="true" className="window-control-icon">
        <path d="M1 5h8" />
      </svg>
    );
  }

  if (type === 'restore') {
    return (
      <svg viewBox="0 0 10 10" aria-hidden="true" className="window-control-icon">
        <path d="M3 1.5h5.5V7" />
        <path d="M1.5 3h5.5v5.5H1.5z" />
      </svg>
    );
  }

  if (type === 'close') {
    return (
      <svg viewBox="0 0 10 10" aria-hidden="true" className="window-control-icon">
        <path d="M2 2l6 6" />
        <path d="M8 2L2 8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className="window-control-icon">
      <path d="M1.5 1.5h7v7h-7z" />
    </svg>
  );
}

function getHealthBadgeClasses(category: RequestHealthCategory): string {
  if (category === 'STABLE') return 'bg-[#89f5e7]/70 text-[#005c54]';
  if (category === 'LATENCY_MEDIUM') return 'bg-[#fff1c2] text-[#9a6a00]';
  if (category === 'LATENCY_HIGH') return 'bg-[#ffdad6] text-[#93000a]';
  return 'bg-[#e6e8ea] text-[#777586]';
}

export function TopNav() {
  const {
    t,
    view,
    setView,
    projects,
    favoriteRequests,
    currentProject,
    setCurrentProject,
    deleteProject,
    setCurrentScenario,
    setCurrentRequest,
    recentRequests,
    openRecentRequest,
  } = useApp();
  const [activeMenu, setActiveMenu] = useState<'projects' | 'history' | 'favorites' | 'help' | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const isHomeActive = view === 'projects';
  const isProjectsActive = view === 'scenarios' || view === 'requests';
  const isSettingsActive = view === 'settings';
  const isProjectMenuOpen = activeMenu === 'projects';
  const isHistoryMenuOpen = activeMenu === 'history';
  const isFavoritesMenuOpen = activeMenu === 'favorites';
  const isHelpMenuOpen = activeMenu === 'help';
  const desktopBridge = window.elqiraDesktop;
  const hasDesktopShell = Boolean(desktopBridge?.isElectron);
  const showWindowControls = desktopBridge?.windowControlsMode === 'custom';

  const historyEntries = recentRequests.flatMap((entry) => {
    const project = getProjectById(entry.projectId);
    const scenario = getScenarioById(entry.scenarioId);
    if (!project || !scenario || scenario.projectId !== project.id) return [];
    return [{ project, scenario, request: entry }];
  });
  const hasHistoryEntries = historyEntries.length > 0;
  const favoriteEntries = favoriteRequests.map((request) => {
    const scenario = getScenarioById(request.scenarioId);
    const project = scenario ? getProjectById(scenario.projectId) : null;
    return { request, scenario, project };
  });

  useEffect(() => {
    if (!hasDesktopShell || !desktopBridge) return;

    let cancelled = false;
    desktopBridge.isWindowMaximized().then((value) => {
      if (!cancelled) {
        setIsMaximized(value);
      }
    });

    const unsubscribe = desktopBridge.onWindowMaximizedChange((value) => {
      setIsMaximized(value);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [desktopBridge, hasDesktopShell]);

  const handleToggleMaximize = async () => {
    if (!desktopBridge) return;
    const nextState = await desktopBridge.toggleMaximizeWindow();
    setIsMaximized(nextState);
  };

  const openFavoriteRequest = (requestId: string) => {
    const entry = favoriteEntries.find((favorite) => favorite.request.id === requestId);
    if (!entry?.project || !entry.scenario) return;

    setCurrentProject(entry.project);
    setCurrentScenario(entry.scenario);
    setCurrentRequest(entry.request);
    setActiveMenu(null);
  };

  const modalFallback = (
    <div className="flex min-h-40 items-center justify-center">
      <div className="app-spinner" role="status" aria-label="Loading form" />
    </div>
  );

  return (
    <>
      <header className={`relative bg-[#f7f9fb] flex items-center w-full h-14 sticky top-0 z-50 ${hasDesktopShell ? 'desktop-titlebar pl-6 pr-36' : 'px-6'}`}>
        {/* Left: logo + nav */}
        <div className="flex items-center gap-8 min-w-0">
          <div className="desktop-brand desktop-no-drag">
            <div className="desktop-brand-copy">
              <span className="desktop-brand-title">
                <span className="desktop-brand-wordmark-accent">Elq</span>
              </span>
            </div>
          </div>
          <nav className="hidden md:flex items-center space-x-6 h-14 desktop-no-drag">
            {/* Home */}
            <button
              onClick={() => {
                setCurrentScenario(null);
                setCurrentRequest(null);
                setCurrentProject(null);
                setView('projects');
              }}
              className={`h-full flex items-center px-2 text-sm font-semibold border-b-2 transition-colors ${
                isHomeActive
                  ? 'text-[#2a14b4] border-[#2a14b4]'
                  : 'text-[#464554] border-transparent hover:text-[#191c1e]'
              }`}
            >
              {t('home')}
            </button>

            {/* Projects dropdown */}
            <div className="relative h-14 flex items-center">
              <button
                onClick={() => { setActiveMenu((current) => (current === 'projects' ? null : 'projects')); }}
                className={`h-full flex items-center px-2 text-sm font-semibold border-b-2 transition-colors ${
                  isProjectsActive || isProjectMenuOpen
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-[#464554] border-transparent hover:text-[#191c1e]'
                }`}
              >
                {t('projects')}
              </button>

              {isProjectMenuOpen && (
                <div className="absolute top-full left-0 mt-0 w-72 bg-white rounded-xl shadow-xl border border-[#c7c4d7]/20 z-50 py-2 overflow-hidden">
                  {projects.length === 0 && (
                    <p className="px-4 py-3 text-xs text-[#777586] font-mono">{t('noProjects')}</p>
                  )}
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-4 py-2.5 group cursor-pointer transition-colors ${
                        currentProject?.id === p.id ? 'bg-[#e3dfff]' : 'hover:bg-[#f2f4f6]'
                      }`}
                    >
                      <button
                        className="flex-1 flex items-center gap-2 text-left"
                        onClick={() => { setCurrentProject(p); setActiveMenu(null); }}
                      >
                        {currentProject?.id === p.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2a14b4] shrink-0" />
                        )}
                        {currentProject?.id !== p.id && <span className="w-1.5" />}
                        <span className="text-sm font-medium text-[#191c1e] truncate">{p.title}</span>
                      </button>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProject(p); setActiveMenu(null); }}
                          className="p-1 rounded hover:bg-[#eceef0] text-[#777586] hover:text-[#191c1e]"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(p); setActiveMenu(null); }}
                          className="p-1 rounded hover:bg-[#ffdad6] text-[#777586] hover:text-[#ba1a1a]"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-[#c7c4d7]/20 mt-1 pt-1">
                    <button
                      onClick={() => { setShowNewProject(true); setActiveMenu(null); }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-[#2a14b4] hover:bg-[#e3dfff] transition-colors font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      {t('newProject')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative h-14 flex items-center">
              <button
                onClick={() => { if (hasHistoryEntries) setActiveMenu((current) => (current === 'history' ? null : 'history')); }}
                disabled={!hasHistoryEntries}
                className={`h-full flex items-center px-2 text-sm font-semibold border-b-2 transition-colors ${
                  isHistoryMenuOpen
                    ? 'text-[#2a14b4] border-[#2a14b4]'
                    : hasHistoryEntries
                      ? 'text-[#464554] border-transparent hover:text-[#191c1e]'
                      : 'text-[#777586] border-transparent opacity-50 cursor-not-allowed'
                }`}
              >
                {t('history')}
              </button>

              {isHistoryMenuOpen && (
                <div className="absolute top-full left-0 mt-0 w-80 bg-white rounded-xl shadow-xl border border-[#c7c4d7]/20 z-50 py-2 overflow-hidden">
                  {historyEntries.map(({ project, scenario, request }) => (
                    <button
                      type="button"
                      key={request.requestId}
                      onClick={() => {
                        openRecentRequest(request.requestId);
                        setActiveMenu(null);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f2f4f6]"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#2a14b4]">swap_horiz</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-[#191c1e]">{request.title}</p>
                          <span className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest ${getHealthBadgeClasses(request.healthCategory)}`}>
                            {request.healthCategory}
                          </span>
                        </div>
                        <p className="truncate text-[11px] font-mono uppercase tracking-wide text-[#777586]">
                          {[project.title, scenario.title].join(' / ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative h-14 flex items-center">
              <button
                onClick={() => { setActiveMenu((current) => (current === 'favorites' ? null : 'favorites')); }}
                className={`h-full flex items-center px-2 text-sm font-semibold border-b-2 transition-colors ${
                  isFavoritesMenuOpen
                    ? 'text-[#2a14b4] border-[#2a14b4]'
                    : 'text-[#464554] border-transparent hover:text-[#191c1e]'
                }`}
              >
                {t('favorites')}
              </button>

              {isFavoritesMenuOpen && (
                <div className="absolute top-full left-0 mt-0 w-80 bg-white rounded-xl shadow-xl border border-[#c7c4d7]/20 z-50 py-2 overflow-hidden">
                  {favoriteEntries.length === 0 && (
                    <p className="px-4 py-3 text-xs text-[#777586] font-mono">{t('noFavorites')}</p>
                  )}
                  {favoriteEntries.map(({ request, scenario, project }) => (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => openFavoriteRequest(request.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f2f4f6]"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#e8b800]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        star
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#191c1e]">{request.title}</p>
                        <p className="truncate text-[11px] font-mono uppercase tracking-wide text-[#777586]">
                          {[project?.title, scenario?.title].filter(Boolean).join(' / ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setView('settings')}
              className={`h-14 flex items-center px-2 text-sm font-semibold border-b-2 transition-colors ${
                isSettingsActive
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-[#464554] border-transparent hover:text-[#191c1e]'
              }`}
            >
              {t('settings')}
            </button>

            <div className="relative h-14 flex items-center">
              <button
                onClick={() => { setActiveMenu((current) => (current === 'help' ? null : 'help')); }}
                className={`h-full flex items-center px-2 text-sm font-semibold border-b-2 transition-colors ${
                  isHelpMenuOpen
                    ? 'text-[#2a14b4] border-[#2a14b4]'
                    : 'text-[#464554] border-transparent hover:text-[#191c1e]'
                }`}
              >
                {t('help')}
              </button>

              {isHelpMenuOpen && (
                <div className="absolute top-full left-0 mt-0 w-56 bg-white rounded-xl shadow-xl border border-[#c7c4d7]/20 z-50 py-2 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAbout(true);
                      setActiveMenu(null);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-[#191c1e] transition-colors hover:bg-[#f2f4f6]"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#2a14b4]">info</span>
                    {t('about')}
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {showWindowControls && (
          <div className="desktop-no-drag absolute top-0 right-0 h-full flex window-controls-shell">
            <button
              type="button"
              aria-label="Minimize window"
              onClick={() => { void desktopBridge?.minimizeWindow(); }}
              className="window-control-button"
            >
              <WindowControlIcon type="minimize" />
            </button>
            <button
              type="button"
              aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
              onClick={() => { void handleToggleMaximize(); }}
              className="window-control-button"
            >
              <WindowControlIcon type={isMaximized ? 'restore' : 'maximize'} />
            </button>
            <button
              type="button"
              aria-label="Close window"
              onClick={() => { void desktopBridge?.closeWindow(); }}
              className="window-control-button window-control-button-close"
            >
              <WindowControlIcon type="close" />
            </button>
          </div>
        )}
      </header>

      {/* Overlay to close menu */}
      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}

      {/* Modals */}
      {showNewProject && (
        <Modal title={t('newProject')} onClose={() => setShowNewProject(false)}>
          <Suspense fallback={modalFallback}>
            <ProjectForm onClose={() => setShowNewProject(false)} />
          </Suspense>
        </Modal>
      )}
      {editingProject && (
        <Modal title={t('editProject')} onClose={() => setEditingProject(null)}>
          <Suspense fallback={modalFallback}>
            <ProjectForm project={editingProject} onClose={() => setEditingProject(null)} />
          </Suspense>
        </Modal>
      )}
      {confirmDelete && (
        <Modal title={t('deleteProject')} onClose={() => setConfirmDelete(null)} size="sm">
          <p className="text-sm text-[#464554] mb-4">
            {t('confirmDelete')} <strong>{confirmDelete.title}</strong>?
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm rounded-lg bg-[#e6e8ea] hover:bg-[#e0e3e5] text-[#191c1e] font-semibold">
              {t('cancel')}
            </button>
            <button
              onClick={() => { deleteProject(confirmDelete.id); setConfirmDelete(null); }}
              className="px-4 py-2 text-sm rounded-lg bg-[#ba1a1a] text-white hover:opacity-90 font-semibold"
            >
              {t('delete')}
            </button>
          </div>
        </Modal>
      )}
      {showAbout && (
        <Modal title={t('productInformation')} onClose={() => setShowAbout(false)} size="sm">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#c7c4d7]/20 bg-[#f7f9fb] px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#777586]">{t('productVersion')}</p>
              <p className="mt-1 text-sm font-semibold text-[#191c1e]">v{__APP_VERSION__}</p>
            </div>
            <div className="rounded-xl border border-[#c7c4d7]/20 bg-[#f7f9fb] px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#777586]">{t('releaseDate')}</p>
              <p className="mt-1 text-sm font-semibold text-[#191c1e]">{__APP_RELEASE_DATE__}</p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
