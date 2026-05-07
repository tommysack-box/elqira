// App-wide context: current selections, data, settings and language
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Project, Scenario, Request, Response, AppSettings, RequestHealthCategory } from '../types';
import * as dataService from '../services/dataService';
import type { LastUsedProject, LastUsedRequest, LastUsedScenario } from '../services/dataService';
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
  lastUsedProject: LastUsedProject | null;
  openLastUsedProject: () => void;
  lastUsedScenario: LastUsedScenario | null;
  openLastUsedScenario: () => void;
  createScenario: (data: Omit<Scenario, 'id'>) => void;
  updateScenario: (id: string, data: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  requests: Request[];
  favoriteRequests: Request[];
  draftRequest: Request | null;
  currentRequest: Request | null;
  setCurrentRequest: (r: Request | null) => void;
  lastUsedRequest: LastUsedRequest | null;
  recentRequests: LastUsedRequest[];
  openLastUsedRequest: () => void;
  openRecentRequest: (requestId: string) => void;
  createDraftRequest: (data: Omit<Request, 'id'>) => void;
  saveCurrentRequest: (requestOverride?: Request) => void;
  discardDraftRequest: () => void;
  createRequest: (data: Omit<Request, 'id'>) => void;
  updateRequest: (id: string, data: Partial<Request>) => void;
  copyRequest: (request: Request) => void;
  deleteRequest: (id: string) => void;
  reorderRequests: (orderedIds: string[]) => void;
  currentResponse: Response | null;
  setCurrentResponse: (r: Response | null) => void;
  responseMap: Map<string, ScenarioResponseEntry>;
  setResponseForRequest: (requestId: string, response: Response, requestSnapshot?: Request) => void;
  getScenarioResponses: () => Array<{ request: Request; response: Response }>;
  refreshWorkspaceData: () => void;
  reloadAppData: () => void;
}

const AppContext = createContext<AppState | null>(null);

type ScenarioResponseEntry = {
  response: Response;
  requestSnapshot?: Request;
};

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

function classifyRequestHealth(response: Response): RequestHealthCategory {
  if (response.statusCode === 0) return 'OFFLINE';
  if (response.duration < 300) return 'STABLE';
  if (response.duration < 1000) return 'LATENCY_MEDIUM';
  return 'LATENCY_HIGH';
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
  const [lastUsedProject, setLastUsedProjectState] = useState<LastUsedProject | null>(() => (
    dataService.areBootstrapDataLoaded() ? dataService.getLastUsedWorkspace().project : null
  ));
  const [lastUsedScenario, setLastUsedScenarioState] = useState<LastUsedScenario | null>(() => (
    dataService.areBootstrapDataLoaded() ? dataService.getLastUsedWorkspace().scenario : null
  ));
  const [draftRequest, setDraftRequest] = useState<Request | null>(null);
  const [currentRequest, setCurrentRequestState] = useState<Request | null>(null);
  const [lastUsedRequest, setLastUsedRequestState] = useState<LastUsedRequest | null>(() => (
    dataService.areBootstrapDataLoaded() ? dataService.getLastUsedWorkspace().request : null
  ));
  const [recentRequests, setRecentRequestsState] = useState<LastUsedRequest[]>(() => (
    dataService.areBootstrapDataLoaded() ? dataService.getLastUsedWorkspace().recentRequests : []
  ));
  const [currentResponse, setCurrentResponse] = useState<Response | null>(null);
  const [responseMap, setResponseMap] = useState<Map<string, ScenarioResponseEntry>>(new Map());

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

  const favoriteRequests = React.useMemo(
    () => dataService.getProjects().flatMap((p) =>
      dataService.getScenariosByProject(p.id).flatMap((s) =>
        dataService.getRequestsByScenario(s.id).filter((r) => r.isFavorite)
      )
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestVersion]
  );

  const t = useCallback(
    (key: TranslationKey): string => translations[settings.language][key] ?? translations.en[key],
    [settings.language]
  );

  const syncLastUsedWorkspace = useCallback(() => {
    const workspace = dataService.getLastUsedWorkspace();
    setLastUsedProjectState(workspace.project);
    setLastUsedScenarioState(workspace.scenario);
    setLastUsedRequestState(workspace.request);
    setRecentRequestsState(workspace.recentRequests);
  }, []);

  const rememberProject = useCallback((project: Project | null) => {
    if (!project) return;
    const nextLastProject = {
      projectId: project.id,
    };
    dataService.setLastUsedProject(nextLastProject);
    setLastUsedProjectState(nextLastProject);
  }, []);

  const rememberScenario = useCallback((scenario: Scenario | null) => {
    if (!scenario) return;
    const nextLastScenario = {
      projectId: scenario.projectId,
      scenarioId: scenario.id,
    };
    dataService.setLastUsedScenario(nextLastScenario);
    setLastUsedProjectState({ projectId: scenario.projectId });
    setLastUsedScenarioState(nextLastScenario);
  }, []);

  const rememberRequest = useCallback((request: Request | null, scenarioOverride?: Scenario | null) => {
    if (!request || request.isDraft) return;

    const scenario = scenarioOverride
      ?? (currentScenario?.id === request.scenarioId ? currentScenario : dataService.getScenarioById(request.scenarioId));
    if (!scenario) return;

    const nextLastRequest = {
      projectId: scenario.projectId,
      scenarioId: scenario.id,
      requestId: request.id,
      title: request.title,
      description: request.description,
      method: request.method,
      healthCategory: recentRequests.find((entry) => entry.requestId === request.id)?.healthCategory ?? 'OFFLINE',
    };

    dataService.setLastUsedRequest(nextLastRequest);
    setLastUsedProjectState({ projectId: scenario.projectId });
    setLastUsedScenarioState({ projectId: scenario.projectId, scenarioId: scenario.id });
    setLastUsedRequestState(nextLastRequest);
    setRecentRequestsState(dataService.getLastUsedWorkspace().recentRequests);
  }, [currentScenario, recentRequests]);

  // --- Projects ---
  const setCurrentProject = useCallback((p: Project | null) => {
    setCurrentProjectState(p);
    setCurrentScenarioState(null);
    setDraftRequest(null);
    setCurrentRequestState(null);
    setCurrentResponse(null);
    setIsRequestDataLoading(Boolean(p) && !dataService.areRequestsLoaded());
    if (p) {
      rememberProject(p);
      setView('scenarios');
    }
  }, [rememberProject]);

  const openLastUsedProject = useCallback(() => {
    if (!lastUsedProject) return;

    const project = dataService.getProjectById(lastUsedProject.projectId);
    if (!project) {
      dataService.setLastUsedProject(null);
      syncLastUsedWorkspace();
      return;
    }

    setCurrentProject(project);
  }, [lastUsedProject, setCurrentProject, syncLastUsedWorkspace]);

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
      syncLastUsedWorkspace();
    });
  }, [currentProject?.id, syncLastUsedWorkspace]);

  // --- Scenarios ---
  const setCurrentScenario = useCallback((s: Scenario | null) => {
    setCurrentScenarioState(s);
    setDraftRequest(null);
    setCurrentRequestState(null);
    setCurrentResponse(null);
    setResponseMap(new Map());
    if (s) {
      rememberScenario(s);
      setView('requests');
    }
  }, [rememberScenario]);

  const openLastUsedScenario = useCallback(() => {
    if (!lastUsedScenario) return;

    const project = dataService.getProjectById(lastUsedScenario.projectId);
    const scenario = dataService.getScenarioById(lastUsedScenario.scenarioId);
    if (!project || !scenario || scenario.projectId !== project.id) {
      dataService.setLastUsedScenario(null);
      syncLastUsedWorkspace();
      return;
    }

    setCurrentProject(project);
    setCurrentScenario(scenario);
  }, [lastUsedScenario, setCurrentProject, setCurrentScenario, syncLastUsedWorkspace]);

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
      syncLastUsedWorkspace();
    });
  }, [currentScenario?.id, syncLastUsedWorkspace]);

  // --- Requests ---
  const setCurrentRequest = useCallback((r: Request | null) => {
    setCurrentRequestState(r);
    setCurrentResponse(r ? responseMap.get(r.id)?.response ?? null : null);
    rememberRequest(r);
  }, [rememberRequest, responseMap]);

  const openLastUsedRequest = useCallback(() => {
    if (!lastUsedRequest) return;

    const project = dataService.getProjectById(lastUsedRequest.projectId);
    const scenario = dataService.getScenarioById(lastUsedRequest.scenarioId);
    if (!project || !scenario || scenario.projectId !== project.id) {
      dataService.setLastUsedRequest(null);
      syncLastUsedWorkspace();
      return;
    }

    setCurrentProject(project);
    setCurrentScenario(scenario);
    setCurrentRequestState(null);
    setCurrentResponse(null);

    void dataService.ensureRequestsLoaded()
      .then(() => {
        const request = dataService.getRequestsByScenario(scenario.id).find((entry) => entry.id === lastUsedRequest.requestId) ?? null;
        if (!request) {
          dataService.setLastUsedRequest(null);
          syncLastUsedWorkspace();
          return;
        }

        setRequestVersion((v) => v + 1);
        setCurrentRequestState(request);
        setCurrentResponse(null);
        rememberRequest(request, scenario);
      })
      .catch((error) => {
        console.error('[AppProvider] Failed to restore last used request', error);
      });
  }, [lastUsedRequest, rememberRequest, setCurrentProject, setCurrentScenario, syncLastUsedWorkspace]);

  const openRecentRequest = useCallback((requestId: string) => {
    const recentRequest = recentRequests.find((entry) => entry.requestId === requestId);
    if (!recentRequest) return;

    const project = dataService.getProjectById(recentRequest.projectId);
    const scenario = dataService.getScenarioById(recentRequest.scenarioId);
    if (!project || !scenario || scenario.projectId !== project.id) {
      syncLastUsedWorkspace();
      return;
    }

    setCurrentProject(project);
    setCurrentScenario(scenario);
    setCurrentRequestState(null);
    setCurrentResponse(null);

    void dataService.ensureRequestsLoaded()
      .then(() => {
        const request = dataService.getRequestsByScenario(scenario.id).find((entry) => entry.id === recentRequest.requestId) ?? null;
        if (!request) {
          syncLastUsedWorkspace();
          return;
        }

        setRequestVersion((v) => v + 1);
        setCurrentRequestState(request);
        setCurrentResponse(null);
        rememberRequest(request, scenario);
      })
      .catch((error) => {
        console.error('[AppProvider] Failed to restore recent request', error);
      });
  }, [recentRequests, rememberRequest, setCurrentProject, setCurrentScenario, syncLastUsedWorkspace]);

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

  const saveCurrentRequest = useCallback((requestOverride?: Request) => {
    const requestToSave = requestOverride ?? currentRequest;
    if (!requestToSave?.isDraft) return;

    const payload = stripDraftFields(requestToSave);
    const saved = dataService.saveRequest(payload);

    setRequestVersion((v) => v + 1);
    setDraftRequest(null);
    setCurrentRequestState(saved);
    setCurrentResponse((prev) => {
      const draftResponse = responseMap.get(requestToSave.id)?.response;
      return draftResponse ?? prev;
    });
    setResponseMap((prev) => {
      if (!prev.has(requestToSave.id)) return prev;
      const next = new Map(prev);
      const draftResponse = next.get(requestToSave.id);
      next.delete(requestToSave.id);
      if (draftResponse) {
        next.set(saved.id, {
          ...draftResponse,
          requestSnapshot: draftResponse.requestSnapshot
            ? { ...draftResponse.requestSnapshot, id: saved.id, isDraft: false }
            : undefined,
        });
      }
      return next;
    });
    rememberRequest(saved);
  }, [currentRequest, rememberRequest, responseMap]);

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

    let updatedRequest: Request | null = null;
    if (currentRequest?.id === id) {
      const currentRequestData = stripImmutableRequestFields(currentRequest);
      updatedRequest = dataService.updateRequest(id, { ...currentRequestData, ...data });
    } else {
      updatedRequest = dataService.updateRequest(id, data);
    }
    setRequestVersion((v) => v + 1);
    if (currentRequest?.id === id)
      setCurrentRequestState((prev) => (prev ? { ...prev, ...data } : null));
    if (lastUsedRequest?.requestId === id && updatedRequest) {
      rememberRequest(updatedRequest);
    }
  }, [currentRequest, draftRequest?.id, lastUsedRequest?.requestId, rememberRequest]);

  const copyRequest = useCallback((request: Request) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, isDraft, lastStatusCode, lastStatusText, ...rest } = request;
    const copy = dataService.saveRequest({ ...rest, title: `${request.title} (copy)`, isFavorite: false });
    setRequestVersion((v) => v + 1);
    setCurrentRequestState(copy);
    rememberRequest(copy);
  }, [rememberRequest]);

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
    syncLastUsedWorkspace();
  }, [currentRequest?.id, discardDraftRequest, draftRequest?.id, syncLastUsedWorkspace]);

  const reorderRequests = useCallback((orderedIds: string[]) => {
    if (!currentScenario) return;
    dataService.reorderRequests(currentScenario.id, orderedIds);
    setRequestVersion((v) => v + 1);
  }, [currentScenario]);

  // --- Response map (in-memory, per-scenario) ---
  const setResponseForRequest = useCallback((requestId: string, response: Response, requestSnapshot?: Request) => {
    setResponseMap((prev) => {
      const next = new Map(prev);
      next.set(requestId, { response, requestSnapshot });
      return next;
    });
    dataService.updateRecentRequestHealth(requestId, classifyRequestHealth(response));
    setRecentRequestsState(dataService.getLastUsedWorkspace().recentRequests);
  }, []);

  const getScenarioResponses = useCallback((): Array<{ request: Request; response: Response }> => {
    const result: Array<{ request: Request; response: Response }> = [];
    for (const req of requests) {
      const entry = responseMap.get(req.id);
      if (entry) result.push({ request: entry.requestSnapshot ?? req, response: entry.response });
    }
    return result;
  }, [requests, responseMap]);

  const saveSettings = useCallback((s: AppSettings) => {
    dataService.saveSettings(s);
    setSettings(s);
  }, []);

  const refreshWorkspaceData = useCallback(() => {
    setProjectVersion((v) => v + 1);
    setScenarioVersion((v) => v + 1);
    setRequestVersion((v) => v + 1);
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
    syncLastUsedWorkspace();
    setView('projects');
  }, [syncLastUsedWorkspace]);

  useEffect(() => {
    if (dataService.areBootstrapDataLoaded()) {
      return;
    }

    let cancelled = false;
    const BOOTSTRAP_TIMEOUT_MS = 8000;

    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        console.warn('[AppProvider] Bootstrap timed out, forcing ready state');
        setIsBootstrapping(false);
      }
    }, BOOTSTRAP_TIMEOUT_MS);

    void dataService.initializeBootstrapData()
      .then(() => {
        if (cancelled) return;

        setSettings(dataService.getSettings());
        setProjectVersion((v) => v + 1);
        setScenarioVersion((v) => v + 1);
        setRequestVersion((v) => v + 1);
        syncLastUsedWorkspace();
      })
      .catch((error) => {
        console.error('[AppProvider] Failed to initialize storage', error);
        if (!cancelled) setIsBootstrapping(false);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        if (cancelled) return;
        setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [syncLastUsedWorkspace]);

  useEffect(() => {
    if (!currentProject) {
      return;
    }

    if (dataService.areRequestsLoaded()) {
      return;
    }

    let cancelled = false;

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
  }, [currentProject]);

  const value = React.useMemo(
    () => ({
      isBootstrapping,
      isRequestDataLoading,
      view, setView,
      settings, saveSettings, t,
      projects, currentProject, setCurrentProject, createProject, updateProject, deleteProject,
      scenarios, currentScenario, setCurrentScenario, lastUsedProject, openLastUsedProject, lastUsedScenario, openLastUsedScenario, createScenario, updateScenario, deleteScenario,
      requests, favoriteRequests, draftRequest, currentRequest, setCurrentRequest, lastUsedRequest, recentRequests, openLastUsedRequest, openRecentRequest, createDraftRequest, saveCurrentRequest, discardDraftRequest, createRequest, updateRequest, copyRequest, deleteRequest, reorderRequests,
      currentResponse, setCurrentResponse,
      responseMap, setResponseForRequest, getScenarioResponses,
      refreshWorkspaceData,
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
      lastUsedProject,
      openLastUsedProject,
      lastUsedScenario,
      openLastUsedScenario,
      createScenario,
      updateScenario,
      deleteScenario,
      requests,
      favoriteRequests,
      draftRequest,
      currentRequest,
      setCurrentRequest,
      lastUsedRequest,
      recentRequests,
      openLastUsedRequest,
      openRecentRequest,
      createDraftRequest,
      saveCurrentRequest,
      discardDraftRequest,
    createRequest,
    updateRequest,
    copyRequest,
    deleteRequest,
    reorderRequests,
      currentResponse,
      responseMap,
      setResponseForRequest,
      getScenarioResponses,
      refreshWorkspaceData,
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
