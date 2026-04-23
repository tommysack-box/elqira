// App-wide context: current selections, data, settings and language
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Project, Scenario, Request, Response, AppSettings } from '../types';
import * as dataService from '../services/dataService';
import { translations } from '../i18n/translations';
import type { TranslationKey } from '../i18n/translations';

type View = 'projects' | 'scenarios' | 'requests' | 'settings';

interface AppState {
  isBootstrapping: boolean;
  isRequestDataLoading: boolean;
  view: View;
  setView: (v: View) => void;
  settings: AppSettings;
  saveSettings: (s: AppSettings) => void;
  t: (key: TranslationKey) => string;
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;
  createProject: (data: Omit<Project, 'id'>) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  scenarios: Scenario[];
  currentScenario: Scenario | null;
  setCurrentScenario: (s: Scenario | null) => void;
  createScenario: (data: Omit<Scenario, 'id'>) => void;
  updateScenario: (id: string, data: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  requests: Request[];
  draftRequest: Request | null;
  currentRequest: Request | null;
  setCurrentRequest: (r: Request | null) => void;
  createDraftRequest: (data: Omit<Request, 'id'>) => void;
  saveCurrentRequest: () => void;
  discardDraftRequest: () => void;
  createRequest: (data: Omit<Request, 'id'>) => void;
  updateRequest: (id: string, data: Partial<Request>) => void;
  deleteRequest: (id: string) => void;
  reorderRequests: (orderedIds: string[]) => void;
  currentResponse: Response | null;
  setCurrentResponse: (r: Response | null) => void;
  responseMap: Map<string, Response>;
  setResponseForRequest: (requestId: string, response: Response) => void;
  getScenarioResponses: () => Array<{ request: Request; response: Response }>;
  reloadAppData: () => void;
}

const AppContext = createContext<AppState | null>(null);

function stripDraftFields(request: Request): Omit<Request, 'id' | 'isDraft'> {
  const { id, isDraft, ...payload } = request;
  void id;
  void isDraft;
  return payload;
}

function stripImmutableRequestFields(request: Request): Omit<Request, 'id'> {
  const { id, ...payload } = request;
  void id;
  return payload;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isBootstrapping, setIsBootstrapping] = useState(() => !dataService.areBootstrapDataLoaded());
  const [isRequestDataLoading, setIsRequestDataLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => dataService.getSettings());
  const [view, setView] = useState<View>('projects');

  // Version counters force re-reads from storage on mutations
  const [projectVersion, setProjectVersion] = useState(0);
  const [scenarioVersion, setScenarioVersion] = useState(0);
  const [requestVersion, setRequestVersion] = useState(0);

  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [currentScenario, setCurrentScenarioState] = useState<Scenario | null>(null);
  const [draftRequest, setDraftRequest] = useState<Request | null>(null);
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
  const setCurrentProject = useCallback((p: Project | null) => {
    setCurrentProjectState(p);
    setCurrentScenarioState(null);
    setDraftRequest(null);
    setCurrentRequestState(null);
    setCurrentResponse(null);
    if (p) setView('scenarios');
  }, []);

  const createProject = useCallback((data: Omit<Project, 'id'>) => {
    const p = dataService.saveProject(data);
    setProjectVersion((v) => v + 1);
    setCurrentProject(p);
  }, [setCurrentProject]);

  const updateProject = useCallback((id: string, data: Partial<Project>) => {
    dataService.updateProject(id, data);
    setProjectVersion((v) => v + 1);
    if (currentProject?.id === id)
      setCurrentProjectState((prev) => (prev ? { ...prev, ...data } : null));
  }, [currentProject?.id]);

  const deleteProject = useCallback((id: string) => {
    if (currentProject?.id === id) {
      setCurrentProjectState(null);
      setCurrentScenarioState(null);
      setDraftRequest(null);
      setCurrentRequestState(null);
      setCurrentResponse(null);
      setView('projects');
    }
    void dataService.deleteProject(id).then(() => {
      setProjectVersion((v) => v + 1);
      setScenarioVersion((v) => v + 1);
      setRequestVersion((v) => v + 1);
    });
  }, [currentProject?.id]);

  // --- Scenarios ---
  const setCurrentScenario = useCallback((s: Scenario | null) => {
    setCurrentScenarioState(s);
    setDraftRequest(null);
    setCurrentRequestState(null);
    setCurrentResponse(null);
    setResponseMap(new Map());
    if (s) setView('requests');
  }, []);

  const createScenario = useCallback((data: Omit<Scenario, 'id'>) => {
    const s = dataService.saveScenario(data);
    setScenarioVersion((v) => v + 1);
    setCurrentScenario(s);
  }, [setCurrentScenario]);

  const updateScenario = useCallback((id: string, data: Partial<Scenario>) => {
    dataService.updateScenario(id, data);
    setScenarioVersion((v) => v + 1);
    if (currentScenario?.id === id)
      setCurrentScenarioState((prev) => (prev ? { ...prev, ...data } : null));
  }, [currentScenario?.id]);

  const deleteScenario = useCallback((id: string) => {
    if (currentScenario?.id === id) {
      setCurrentScenarioState(null);
      setCurrentRequestState(null);
      setCurrentResponse(null);
      setView('scenarios');
    }
    void dataService.deleteScenario(id).then(() => {
      setScenarioVersion((v) => v + 1);
      setRequestVersion((v) => v + 1);
    });
  }, [currentScenario?.id]);

  // --- Requests ---
  const setCurrentRequest = useCallback((r: Request | null) => {
    setCurrentRequestState(r);
    setCurrentResponse(r ? responseMap.get(r.id) ?? null : null);
  }, [responseMap]);

  const createDraftRequest = useCallback((data: Omit<Request, 'id'>) => {
    const draft: Request = {
      ...data,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isDraft: true,
    };
    setDraftRequest(draft);
    setCurrentRequestState(draft);
    setCurrentResponse(null);
  }, []);

  const saveCurrentRequest = useCallback(() => {
    if (!currentRequest?.isDraft) return;

    const payload = stripDraftFields(currentRequest);
    const saved = dataService.saveRequest(payload);

    setRequestVersion((v) => v + 1);
    setDraftRequest(null);
    setCurrentRequestState(saved);
    setCurrentResponse((prev) => {
      const draftResponse = responseMap.get(currentRequest.id);
      return draftResponse ?? prev;
    });
    setResponseMap((prev) => {
      if (!prev.has(currentRequest.id)) return prev;
      const next = new Map(prev);
      const draftResponse = next.get(currentRequest.id);
      next.delete(currentRequest.id);
      if (draftResponse) next.set(saved.id, draftResponse);
      return next;
    });
  }, [currentRequest, responseMap]);

  const discardDraftRequest = useCallback(() => {
    if (!draftRequest) return;

    const draftId = draftRequest.id;
    setDraftRequest(null);
    setResponseMap((prev) => {
      if (!prev.has(draftId)) return prev;
      const next = new Map(prev);
      next.delete(draftId);
      return next;
    });
    if (currentRequest?.id === draftId) {
      setCurrentRequestState(null);
      setCurrentResponse(null);
    }
  }, [currentRequest?.id, draftRequest]);

  const createRequest = useCallback((data: Omit<Request, 'id'>) => {
    const r = dataService.saveRequest(data);
    setRequestVersion((v) => v + 1);
    setDraftRequest(null);
    setCurrentRequest(r);
  }, [setCurrentRequest]);

  const updateRequest = useCallback((id: string, data: Partial<Request>) => {
    if (draftRequest?.id === id) {
      setDraftRequest((prev) => (prev ? { ...prev, ...data } : prev));
      if (currentRequest?.id === id) {
        setCurrentRequestState((prev) => (prev ? { ...prev, ...data } : null));
      }
      return;
    }

    if (currentRequest?.id === id) {
      const currentRequestData = stripImmutableRequestFields(currentRequest);
      dataService.updateRequest(id, { ...currentRequestData, ...data });
    } else {
      dataService.updateRequest(id, data);
    }
    setRequestVersion((v) => v + 1);
    if (currentRequest?.id === id)
      setCurrentRequestState((prev) => (prev ? { ...prev, ...data } : null));
  }, [currentRequest, draftRequest?.id]);

  const deleteRequest = useCallback((id: string) => {
    if (draftRequest?.id === id) {
      discardDraftRequest();
      return;
    }

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
  }, [currentRequest?.id, discardDraftRequest, draftRequest?.id]);

  const reorderRequests = useCallback((orderedIds: string[]) => {
    if (!currentScenario) return;
    dataService.reorderRequests(currentScenario.id, orderedIds);
    setRequestVersion((v) => v + 1);
  }, [currentScenario]);

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

  const saveSettings = useCallback((s: AppSettings) => {
    dataService.saveSettings(s);
    setSettings(s);
  }, []);

  const reloadAppData = useCallback(() => {
    setSettings(dataService.getSettings());
    setIsRequestDataLoading(false);
    setProjectVersion((v) => v + 1);
    setScenarioVersion((v) => v + 1);
    setRequestVersion((v) => v + 1);
    setCurrentProjectState(null);
    setCurrentScenarioState(null);
    setDraftRequest(null);
    setCurrentRequestState(null);
    setCurrentResponse(null);
    setResponseMap(new Map());
    setView('projects');
  }, []);

  useEffect(() => {
    if (dataService.areBootstrapDataLoaded()) {
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;

    void dataService.initializeBootstrapData()
      .then(() => {
        if (cancelled) return;

        setSettings(dataService.getSettings());
        setProjectVersion((v) => v + 1);
        setScenarioVersion((v) => v + 1);
        setRequestVersion((v) => v + 1);
      })
      .catch((error) => {
        console.error('[AppProvider] Failed to initialize storage', error);
      })
      .finally(() => {
        if (cancelled) return;
        setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentProject) {
      setIsRequestDataLoading(false);
      return;
    }

    if (dataService.areRequestsLoaded()) {
      setIsRequestDataLoading(false);
      return;
    }

    let cancelled = false;
    setIsRequestDataLoading(true);

    void dataService.ensureRequestsLoaded()
      .then(() => {
        if (cancelled) return;
        setRequestVersion((v) => v + 1);
      })
      .catch((error) => {
        console.error('[AppProvider] Failed to load requests data', error);
      })
      .finally(() => {
        if (cancelled) return;
        setIsRequestDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentProject?.id]);

  const value = React.useMemo(
    () => ({
      isBootstrapping,
      isRequestDataLoading,
      view, setView,
      settings, saveSettings, t,
      projects, currentProject, setCurrentProject, createProject, updateProject, deleteProject,
      scenarios, currentScenario, setCurrentScenario, createScenario, updateScenario, deleteScenario,
      requests, draftRequest, currentRequest, setCurrentRequest, createDraftRequest, saveCurrentRequest, discardDraftRequest, createRequest, updateRequest, deleteRequest, reorderRequests,
      currentResponse, setCurrentResponse,
      responseMap, setResponseForRequest, getScenarioResponses,
      reloadAppData,
    }),
    [
      isBootstrapping,
      isRequestDataLoading,
      view,
      settings,
      saveSettings,
      t,
      projects,
      currentProject,
      setCurrentProject,
      createProject,
      updateProject,
      deleteProject,
      scenarios,
      currentScenario,
      setCurrentScenario,
      createScenario,
      updateScenario,
      deleteScenario,
      requests,
      draftRequest,
      currentRequest,
      setCurrentRequest,
      createDraftRequest,
      saveCurrentRequest,
      discardDraftRequest,
    createRequest,
    updateRequest,
    deleteRequest,
    reorderRequests,
    currentResponse,
      responseMap,
      setResponseForRequest,
      getScenarioResponses,
      reloadAppData,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
