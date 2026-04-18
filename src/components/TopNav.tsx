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
  const showWindowControls = desktopBridge?.hasCustomTitleBar ?? false;

  useEffect(() => {
    if (!showWindowControls || !desktopBridge) return;

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
  }, [desktopBridge, showWindowControls]);

  const handleToggleMaximize = async () => {
    if (!desktopBridge) return;
    const nextState = await desktopBridge.toggleMaximizeWindow();
    setIsMaximized(nextState);
  };

  return (
    <>
      <header className={`bg-[#f7f9fb] flex justify-between items-center w-full h-14 sticky top-0 z-50 border-b border-[#c7c4d7]/20 ${showWindowControls ? 'desktop-titlebar pl-6 pr-0' : 'px-6'}`}>
        {/* Left: logo + nav */}
        <div className="flex items-center gap-8 min-w-0">
          <div className="desktop-brand desktop-no-drag">
            <span className="desktop-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 1024 1024" className="desktop-brand-mark-svg">
                <path fill="currentColor" d="M740.4,57h-456.8c-110.09,0-199.34,89.25-199.34,199.34v349.66c0,74.48,40.87,139.37,101.38,173.59l-80.79,152.23c-11.38,21.44,12.81,44.2,33.52,31.54l258.42-158.02h343.6c110.09,0,199.34-89.25,199.34-199.34v-349.66c0-110.09-89.25-199.34-199.34-199.34Z"/>
                <path fill="#ffffff" d="M391.3,412.85c30.88-13.6,66.59-15.02,104.39-16.52l3.66-.15c37.34-1,74.68-.94,110.79-.88,10.01.01,20.1,0,30.16,0,9.57,17.28,27.97,28.99,49.12,28.99,31,0,56.14-25.13,56.14-56.14s-25.13-56.14-56.14-56.14c-21.15,0-39.56,11.71-49.13,28.99-10.04,0-20.09.02-30.07,0-36.49-.06-74.23-.12-112.69.91l-4,.16c-41.2,1.63-83.81,3.33-124.13,21.08-22.84,10.06-42.89,27.96-59.68,52.81,7.28-72.27,26.14-137.27,70.74-162.18,20.8-9.89,46.29-11.04,73.25-12.27l4.67-.21c37.65-1.06,86.02-.96,132.78-.85,16.71.04,33.26.07,49.15.06,9.58,17.26,27.97,28.95,49.1,28.95,31,0,56.14-25.13,56.14-56.14s-25.13-56.14-56.14-56.14c-21.17,0-39.58,11.73-49.15,29.03-15.83.02-32.32-.02-48.98-.06-47.28-.11-96.18-.21-134.69.88-.16,0-.33.01-.49.02l-4.86.22c-30.06,1.37-64.13,2.91-95.11,17.96-.4.2-.8.4-1.19.61-113.67,62.29-106.31,263.58-101.44,396.77.36,9.88.7,19.34.98,28.3.02,5.57.16,10.74.43,15.34.01.19.04.37.06.55.03.34.04.68.08,1.02.03.22.06.43.09.64.05.36.11.71.18,1.07.05.28.09.56.15.84.05.24.11.47.17.71.09.37.19.74.3,1.1.07.23.12.45.19.68.08.25.16.49.24.73.13.37.28.74.42,1.1.08.2.15.41.24.61.1.23.2.46.3.69.16.35.34.7.52,1.04.11.21.21.43.32.64.11.2.22.4.34.6.18.32.38.63.58.94.15.24.3.49.47.73.11.16.22.32.34.48.2.28.41.54.62.81.21.28.42.56.64.82.1.12.21.25.32.37.21.24.43.47.64.7.27.29.54.59.82.87.09.09.19.18.29.28.22.21.46.41.69.62.32.29.63.58.96.85.09.07.18.14.27.21.27.21.54.4.82.6.33.24.65.49.99.72.08.06.17.11.26.16.35.23.71.43,1.06.63.11.07.22.13.33.2.19.11.38.24.57.34.08.04.15.08.23.12.37.19.76.36,1.14.54.39.18.78.38,1.18.54.41.17.84.31,1.27.46.39.14.76.29,1.16.41.49.15,1,.26,1.51.38.34.08.67.18,1.02.25.03,0,.07.02.1.02.73.14,1.46.24,2.19.32.11.01.21.04.31.05.91.09,1.81.14,2.71.14.04,0,.08,0,.12,0,.16,0,.32,0,.48,0,.09,0,.18-.02.27-.02.24,0,.47,0,.71-.02.29-.02.56-.07.84-.09.44-.04.87-.07,1.3-.13.14-.02.28-.04.42-.06.33-.05.66-.13.99-.19.48-.09.96-.19,1.44-.3.33-.08.66-.17.99-.27.17-.05.33-.1.5-.15.36-.11.72-.23,1.07-.35.4-.14.79-.3,1.18-.46.37-.15.75-.3,1.11-.47.07-.03.14-.07.22-.11.37-.17.72-.36,1.08-.55.4-.21.79-.42,1.17-.65.28-.17.56-.34.83-.51.16-.1.31-.21.47-.31.3-.2.59-.41.88-.62.34-.25.67-.52,1-.78.28-.23.57-.45.84-.69.12-.1.23-.21.35-.31.26-.23.5-.48.75-.73.32-.32.64-.63.94-.96.22-.24.43-.48.64-.72.16-.18.31-.36.46-.55.19-.24.38-.48.57-.73.25-.33.48-.67.72-1.01.25-.37.5-.73.74-1.11.06-.1.14-.2.2-.31.16-.26.29-.53.44-.8.22-.4.44-.81.65-1.22.19-.38.35-.76.52-1.14.05-.11.11-.22.15-.34.02-.05.05-.09.07-.14.03-.07.06-.14.09-.21.02-.05.04-.1.06-.15,31.99-77.51,67.22-100.06,157.18-100.46,46.2-.85,93.29-.8,138.84-.78,12.34,0,24.66,0,36.99,0,9.57,17.28,27.97,28.99,49.12,28.99,31,0,56.14-25.13,56.14-56.14s-25.13-56.14-56.14-56.14c-21.15,0-39.56,11.71-49.13,28.99-12.31,0-24.62.02-36.94,0-45.81-.03-93.17-.07-139.5.78-65.23.28-110.81,12.35-145.56,41.8,11.97-56.58,35.57-112.38,73.01-128.88Z"/>
              </svg>
            </span>
            <div className="desktop-brand-copy">
              <span className="desktop-brand-title">Elqira</span>
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
          <div className="desktop-no-drag flex self-stretch ml-4 window-controls-shell">
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
