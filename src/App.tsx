// Root application component — wires together layout and routing by view
import { AppProvider, useApp } from './context/AppContext';
import { TopNav } from './components/TopNav';
import { SelectionBreadcrumb } from './components/SelectionBreadcrumb';
import { ProjectsView } from './features/projects/ProjectsView';
import { ScenariosView } from './features/scenarios/ScenariosView';
import { RequestsWorkspace } from './features/requests/RequestsWorkspace';
import { SettingsView } from './features/settings/SettingsView';

function AppShell() {
  const { view } = useApp();

  return (
    <div className="flex flex-col h-screen bg-[#f7f9fb] text-[#191c1e] overflow-hidden">
      <TopNav />
      <SelectionBreadcrumb />
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {view === 'projects' && <ProjectsView />}
        {view === 'scenarios' && <ScenariosView />}
        {view === 'requests' && <RequestsWorkspace />}
        {view === 'settings' && <SettingsView />}
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
