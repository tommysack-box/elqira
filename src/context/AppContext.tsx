// App-wide context: current selections, data, settings and language
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Project, Scenario, Request, Response, AppSettings } from '../types';
import * as dataService from '../services/dataService';
import { translations } from '../i18n/translations';
import type { TranslationKey } from '../i18n/translations';

export type View = 'projects' | 'scenarios' | 'requests' | 'settings';

interface AppState {
  view: View;
  setView: (v: View) => void;
  settings: AppSettings;
  saveSettings: (s: AppSettings) => void;
  t: (key: TranslationKey) => string;
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;
  createProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  scenarios: Scenario[];
  currentScenario: Scenario | null;
  setCurrentScenario: (s: Scenario | null) => void;
  createScenario: (data: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateScenario: (id: string, data: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  requests: Request[];
  currentRequest: Request | null;
  setCurrentRequest: (r: Request | null) => void;
  createRequest: (data: Omit<Request, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRequest: (id: string, data: Partial<Request>) => void;
  deleteRequest: (id: string) => void;
  refreshRequests: () => void;
  currentResponse: Response | null;
  setCurrentResponse: (r: Response | null) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => dataService.getSettings());
  const [view, setView] = useState<View>('projects');

  // Version counters force re-reads from storage on mutations
  const [projectVersion, setProjectVersion] = useState(0);
  const [scenarioVersion, setScenarioVersion] = useState(0);
  const [requestVersion, setRequestVersion] = useState(0);

  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [currentScenario, setCurrentScenarioState] = useState<Scenario | null>(null);
  const [currentRequest, setCurrentRequestState] = useState<Request | null>(null);
  const [currentResponse, setCurrentResponse] = useState<Response | null>(null);

  // Derived lists — re-read from storage whenever a version changes
  const projects = React.useMemo(
    () => dataService.getProjects(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectVersion]
  );
  const scenarios = React.useMemo(
    () => (currentProject ? dataService.getScenariosByProject(currentProject.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentProject, scenarioVersion]
  );
  const requests = React.useMemo(
    () => (currentScenario ? dataService.getRequestsByScenario(currentScenario.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentScenario, requestVersion]
  );

  const t = useCallback(
    (key: TranslationKey): string => translations[settings.language][key] ?? translations.en[key],
    [settings.language]
  );

  // --- Projects ---
  const setCurrentProject = (p: Project | null) => {
    setCurrentProjectState(p);
    setCurrentScenarioState(null);
    setCurrentRequestState(null);
    setCurrentResponse(null);
    if (p) setView('scenarios');
  };

  const createProject = (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const p = dataService.saveProject(data);
    setProjectVersion((v) => v + 1);
    setCurrentProject(p);
  };

  const updateProject = (id: string, data: Partial<Project>) => {
    dataService.updateProject(id, data);
    setProjectVersion((v) => v + 1);
    if (currentProject?.id === id)
      setCurrentProjectState((prev) => (prev ? { ...prev, ...data } : null));
  };

  const deleteProject = (id: string) => {
    dataService.deleteProject(id);
    setProjectVersion((v) => v + 1);
    if (currentProject?.id === id) {
      setCurrentProjectState(null);
      setCurrentScenarioState(null);
      setCurrentRequestState(null);
      setCurrentResponse(null);
      setView('projects');
    }
  };

  // --- Scenarios ---
  const setCurrentScenario = (s: Scenario | null) => {
    setCurrentScenarioState(s);
    setCurrentRequestState(null);
    setCurrentResponse(null);
    if (s) setView('requests');
  };

  const createScenario = (data: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>) => {
    const s = dataService.saveScenario(data);
    setScenarioVersion((v) => v + 1);
    setCurrentScenario(s);
  };

  const updateScenario = (id: string, data: Partial<Scenario>) => {
    dataService.updateScenario(id, data);
    setScenarioVersion((v) => v + 1);
    if (currentScenario?.id === id)
      setCurrentScenarioState((prev) => (prev ? { ...prev, ...data } : null));
  };

  const deleteScenario = (id: string) => {
    dataService.deleteScenario(id);
    setScenarioVersion((v) => v + 1);
    if (currentScenario?.id === id) {
      setCurrentScenarioState(null);
      setCurrentRequestState(null);
      setCurrentResponse(null);
      setView('scenarios');
    }
  };

  // --- Requests ---
  const setCurrentRequest = (r: Request | null) => {
    setCurrentRequestState(r);
    setCurrentResponse(null);
  };

  const createRequest = (data: Omit<Request, 'id' | 'createdAt' | 'updatedAt'>) => {
    const r = dataService.saveRequest(data);
    setRequestVersion((v) => v + 1);
    setCurrentRequest(r);
  };

  const updateRequest = (id: string, data: Partial<Request>) => {
    dataService.updateRequest(id, data);
    setRequestVersion((v) => v + 1);
    if (currentRequest?.id === id)
      setCurrentRequestState((prev) => (prev ? { ...prev, ...data } : null));
  };

  const deleteRequest = (id: string) => {
    dataService.deleteRequest(id);
    setRequestVersion((v) => v + 1);
    if (currentRequest?.id === id) {
      setCurrentRequestState(null);
      setCurrentResponse(null);
    }
  };

  const refreshRequests = () => setRequestVersion((v) => v + 1);

  const saveSettings = (s: AppSettings) => {
    dataService.saveSettings(s);
    setSettings(s);
  };

  return (
    <AppContext.Provider
      value={{
        view, setView,
        settings, saveSettings, t,
        projects, currentProject, setCurrentProject, createProject, updateProject, deleteProject,
        scenarios, currentScenario, setCurrentScenario, createScenario, updateScenario, deleteScenario,
        requests, currentRequest, setCurrentRequest, createRequest, updateRequest, deleteRequest, refreshRequests,
        currentResponse, setCurrentResponse,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
