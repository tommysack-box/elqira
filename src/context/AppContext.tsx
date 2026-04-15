// App-wide context: current selections, data, settings and language
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Project, Scenario, Request, Response, AppSettings } from '../types';
import * as dataService from '../services/dataService';
import { smartApiKeyService } from '../services/smartApiKeyService';
import { translations } from '../i18n/translations';
import type { TranslationKey } from '../i18n/translations';

export type View = 'projects' | 'scenarios' | 'requests' | 'settings';

interface AppState {
  view: View;
  setView: (v: View) => void;
  settings: AppSettings;
  saveSettings: (s: AppSettings) => void;
  smartApiKey: string;
  setSmartApiKey: (value: string) => void;
  clearSmartApiKey: () => void;
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
  responseMap: Map<string, Response>;
  setResponseForRequest: (requestId: string, response: Response) => void;
  getScenarioResponses: () => Array<{ request: Request; response: Response }>;
  reloadAppData: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => dataService.getSettings());
  const [smartApiKey, setSmartApiKeyState] = useState(() => smartApiKeyService.get());
  const [view, setView] = useState<View>('projects');

  // Version counters force re-reads from storage on mutations
  const [projectVersion, setProjectVersion] = useState(0);
  const [scenarioVersion, setScenarioVersion] = useState(0);
  const [requestVersion, setRequestVersion] = useState(0);

  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [currentScenario, setCurrentScenarioState] = useState<Scenario | null>(null);
  const [currentRequest, setCurrentRequestState] = useState<Request | null>(null);
  const [currentResponse, setCurrentResponse] = useState<Response | null>(null);
  const [responseMap, setResponseMap] = useState<Map<string, Response>>(new Map());

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
    setResponseMap(new Map());
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
    setCurrentResponse(r ? responseMap.get(r.id) ?? null : null);
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
    setResponseMap((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    if (currentRequest?.id === id) {
      setCurrentRequestState(null);
      setCurrentResponse(null);
    }
  };

  const refreshRequests = () => setRequestVersion((v) => v + 1);

  // --- Response map (in-memory, per-scenario) ---
  const setResponseForRequest = useCallback((requestId: string, response: Response) => {
    setResponseMap((prev) => {
      const next = new Map(prev);
      next.set(requestId, response);
      return next;
    });
  }, []);

  const getScenarioResponses = useCallback((): Array<{ request: Request; response: Response }> => {
    const result: Array<{ request: Request; response: Response }> = [];
    for (const req of requests) {
      const resp = responseMap.get(req.id);
      if (resp) result.push({ request: req, response: resp });
    }
    return result;
  }, [requests, responseMap]);

  const saveSettings = (s: AppSettings) => {
    dataService.saveSettings(s);
    setSettings(s);
  };

  const setSmartApiKey = (value: string) => {
    smartApiKeyService.set(value);
    setSmartApiKeyState(value);
  };

  const clearSmartApiKey = () => {
    smartApiKeyService.clear();
    setSmartApiKeyState('');
  };

  const reloadAppData = () => {
    dataService.saveSettings(dataService.getSettings());
    setSettings(dataService.getSettings());
    clearSmartApiKey();
    setProjectVersion((v) => v + 1);
    setScenarioVersion((v) => v + 1);
    setRequestVersion((v) => v + 1);
    setCurrentProjectState(null);
    setCurrentScenarioState(null);
    setCurrentRequestState(null);
    setCurrentResponse(null);
    setResponseMap(new Map());
    setView('projects');
  };

  return (
    <AppContext.Provider
      value={{
        view, setView,
        settings, saveSettings, smartApiKey, setSmartApiKey, clearSmartApiKey, t,
        projects, currentProject, setCurrentProject, createProject, updateProject, deleteProject,
        scenarios, currentScenario, setCurrentScenario, createScenario, updateScenario, deleteScenario,
        requests, currentRequest, setCurrentRequest, createRequest, updateRequest, deleteRequest, refreshRequests,
        currentResponse, setCurrentResponse,
        responseMap, setResponseForRequest, getScenarioResponses,
        reloadAppData,
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
