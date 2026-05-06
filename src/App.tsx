// Root application component — wires together layout and routing by view
import { Suspense, lazy, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoadingScreen } from './components/LoadingScreen';
import { TopNav } from './components/TopNav';
import { SelectionBreadcrumb } from './components/SelectionBreadcrumb';

const ProjectsView = lazy(() =>
  import('./features/projects/ProjectsView').then((module) => ({ default: module.ProjectsView }))
);
const ScenariosView = lazy(() =>
  import('./features/scenarios/ScenariosView').then((module) => ({ default: module.ScenariosView }))
);
const RequestsWorkspace = lazy(() =>
  import('./features/requests/RequestsWorkspace').then((module) => ({ default: module.RequestsWorkspace }))
);
const SettingsView = lazy(() =>
  import('./features/settings/SettingsView').then((module) => ({ default: module.SettingsView }))
);

function ViewFallback() {
  return <div className="flex-1 min-h-0 bg-[#f7f9fb]" aria-hidden="true" />;
}

function AppShell() {
  const { isBootstrapping, view } = useApp();

  useEffect(() => {
    document.body.dataset.appReady = 'true';
    window.elqiraDesktop?.notifyAppReady();
  }, []);

  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#f7f9fb] text-[#191c1e] overflow-hidden">
      <TopNav />
      <SelectionBreadcrumb />
      <main className="flex-1 flex min-h-0 overflow-hidden">
        <Suspense fallback={<ViewFallback />}>
          {view === 'projects' && <ProjectsView />}
          {view === 'scenarios' && <ScenariosView />}
          {view === 'requests' && <RequestsWorkspace />}
          {view === 'settings' && <SettingsView />}
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
