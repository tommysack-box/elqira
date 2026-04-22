// TopNavBar — fedelmente dal design system Stitch
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProjectForm } from '../features/projects/ProjectForm';
import { Modal } from './Modal';
import type { Project } from '../types';

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

export function TopNav() {
  const { t, view, setView, projects, currentProject, setCurrentProject, deleteProject, setCurrentScenario, setCurrentRequest } = useApp();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const isHomeActive = view === 'projects';
  const isProjectsActive = view === 'scenarios' || view === 'requests';
  const isSettingsActive = view === 'settings';
  const desktopBridge = window.elqiraDesktop;
  const hasDesktopShell = Boolean(desktopBridge?.isElectron);
  const showWindowControls = desktopBridge?.windowControlsMode === 'custom';

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
                onClick={() => { setProjectMenuOpen(v => !v); }}
                className={`h-full flex items-center px-2 text-sm font-semibold border-b-2 transition-colors ${
                  isProjectsActive
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-[#464554] border-transparent hover:text-[#191c1e]'
                }`}
              >
                {t('projects')}
              </button>

              {projectMenuOpen && (
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
                        onClick={() => { setCurrentProject(p); setProjectMenuOpen(false); }}
                      >
                        {currentProject?.id === p.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2a14b4] shrink-0" />
                        )}
                        {currentProject?.id !== p.id && <span className="w-1.5" />}
                        <span className="text-sm font-medium text-[#191c1e] truncate">{p.title}</span>
                      </button>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProject(p); setProjectMenuOpen(false); }}
                          className="p-1 rounded hover:bg-[#eceef0] text-[#777586] hover:text-[#191c1e]"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(p); setProjectMenuOpen(false); }}
                          className="p-1 rounded hover:bg-[#ffdad6] text-[#777586] hover:text-[#ba1a1a]"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-[#c7c4d7]/20 mt-1 pt-1">
                    <button
                      onClick={() => { setShowNewProject(true); setProjectMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-[#2a14b4] hover:bg-[#e3dfff] transition-colors font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      {t('newProject')}
                    </button>
                  </div>
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
      {projectMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(false)} />
      )}

      {/* Modals */}
      {showNewProject && (
        <Modal title={t('newProject')} onClose={() => setShowNewProject(false)}>
          <ProjectForm onClose={() => setShowNewProject(false)} />
        </Modal>
      )}
      {editingProject && (
        <Modal title={t('editProject')} onClose={() => setEditingProject(null)}>
          <ProjectForm project={editingProject} onClose={() => setEditingProject(null)} />
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
    </>
  );
}
