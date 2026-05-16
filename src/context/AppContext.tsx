// App-wide context: current selections, data, settings and language
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Project, Scenario, Request, Response, AppSettings, RequestHealthCategory } from '../types';
import * as dataService from '../services/dataService';
import type { LastUsedProject, LastUsedRequest, LastUsedScenario, RecentScenario } from '../services/dataService';
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
  recentScenarios: RecentScenario[];
  openRecentScenario: (scenarioId: string) => void;
  createScenario: (data: Omit<Scenario, 'id'>) => void;
  updateScenario: (id: string, data: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  requests: Request[];
  favoriteRequests: Request[];
  draftRequest: Request | null;
  openRequestTabs: Request[];
  currentRequest: Request | null;
  setCurrentRequest: (r: Request | null) => void;
  closeRequestTab: (requestId: string) => void;
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

function classifyLatencyHealth(duration: number): RequestHealthCategory {
  if (duration < 300) return 'STABLE';
  if (duration < 1000) return 'LATENCY_MEDIUM';
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
  const [recentScenarios, setRecentScenariosState] = useState<RecentScenario[]>(() => (
    dataService.areBootstrapDataLoaded() ? dataService.getLastUsedWorkspace().recentScenarios : []
  ));
  const [draftRequest, setDraftRequest] = useState<Request | null>(null);
  const [openRequestTabs, setOpenRequestTabs] = useState<Request[]>([]);
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
    setRecentScenariosState(workspace.recentScenarios);
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
    const existingScenarioEntry = recentScenarios.find((entry) => entry.scenarioId === scenario.id);
    const nextLastScenario = {
      projectId: scenario.projectId,
      scenarioId: scenario.id,
    };
    dataService.setLastUsedScenario(nextLastScenario);
    dataService.setRecentScenario({
      projectId: scenario.projectId,
      scenarioId: scenario.id,
      title: scenario.title,
      description: scenario.description,
      healthCategory: existingScenarioEntry?.healthCategory ?? 'OFFLINE',
      averageDurationMs: existingScenarioEntry?.averageDurationMs,
    });
    setLastUsedProjectState({ projectId: scenario.projectId });
    setLastUsedScenarioState(nextLastScenario);
    setRecentScenariosState(dataService.getLastUsedWorkspace().recentScenarios);
  }, [recentScenarios]);

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

  const upsertOpenRequestTab = useCallback((request: Request) => {
    setOpenRequestTabs((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === request.id);
      if (existingIndex === -1) {
        return [...prev, request];
      }

      return prev.map((entry, index) => (
        index === existingIndex ? request : entry
      ));
    });
  }, []);

  // --- Projects ---
  const setCurrentProject = useCallback((p: Project | null) => {
    setCurrentProjectState(p);
    setCurrentScenarioState(null);
    setDraftRequest(null);
    setOpenRequestTabs([]);
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
      setOpenRequestTabs([]);
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
    setOpenRequestTabs([]);
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

  const openRecentScenario = useCallback((scenarioId: string) => {
    const recentScenario = recentScenarios.find((entry) => entry.scenarioId === scenarioId);
    if (!recentScenario) return;

    const project = dataService.getProjectById(recentScenario.projectId);
    const scenario = dataService.getScenarioById(recentScenario.scenarioId);
    if (!project || !scenario || scenario.projectId !== project.id) {
      syncLastUsedWorkspace();
      return;
    }

    setCurrentProject(project);
    setCurrentScenario(scenario);
  }, [recentScenarios, setCurrentProject, setCurrentScenario, syncLastUsedWorkspace]);

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
      setOpenRequestTabs([]);
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
    if (r) {
      upsertOpenRequestTab(r);
    }
    rememberRequest(r);
  }, [rememberRequest, responseMap, upsertOpenRequestTab]);

  const closeRequestTab = useCallback((requestId: string) => {
    setOpenRequestTabs((prev) => {
      const closingIndex = prev.findIndex((entry) => entry.id === requestId);
      if (closingIndex === -1) return prev;

      const next = prev.filter((entry) => entry.id !== requestId);
      setCurrentRequestState((activeRequest) => {
        if (activeRequest?.id !== requestId) {
          return activeRequest;
        }

        const fallbackRequest = next[closingIndex] ?? next[closingIndex - 1] ?? null;
        setCurrentResponse(fallbackRequest ? responseMap.get(fallbackRequest.id)?.response ?? null : null);
        if (fallbackRequest) {
          rememberRequest(fallbackRequest);
        }
        return fallbackRequest;
      });

      return next;
    });
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
        setCurrentRequest(request);
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
        setCurrentRequest(request);
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
    setCurrentRequest(draft);
  }, [setCurrentRequest]);

  const saveCurrentRequest = useCallback((requestOverride?: Request) => {
    const requestToSave = requestOverride ?? currentRequest;
    if (!requestToSave?.isDraft) return;

    const payload = stripDraftFields(requestToSave);
    const saved = dataService.saveRequest(payload);

    setRequestVersion((v) => v + 1);
    setDraftRequest(null);
    setOpenRequestTabs((prev) => prev.map((entry) => (
      entry.id === requestToSave.id ? saved : entry
    )));
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
    setOpenRequestTabs((prev) => prev.filter((entry) => entry.id !== draftId));
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
      setOpenRequestTabs((prev) => prev.map((entry) => (
        entry.id === id ? { ...entry, ...data } : entry
      )));
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
    setOpenRequestTabs((prev) => prev.map((entry) => (
      entry.id === id ? { ...entry, ...data } : entry
    )));
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
    setCurrentRequest(copy);
  }, [setCurrentRequest]);

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
      closeRequestTab(id);
    } else {
      setOpenRequestTabs((prev) => prev.filter((entry) => entry.id !== id));
    }
    syncLastUsedWorkspace();
  }, [closeRequestTab, currentRequest?.id, discardDraftRequest, draftRequest?.id, syncLastUsedWorkspace]);

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

      if (currentScenario) {
        const scenarioRequests = dataService.getRequestsByScenario(currentScenario.id);
        const effectiveRequestById = new Map(scenarioRequests.map((request) => [request.id, request]));
        const responses = scenarioRequests.flatMap((request) => {
          const entry = request.id === requestId
            ? { response, requestSnapshot }
            : next.get(request.id);
          if (!entry) return [];
          const effectiveRequest = entry.requestSnapshot ?? effectiveRequestById.get(request.id) ?? request;
          return effectiveRequest.scenarioId === currentScenario.id ? [entry.response] : [];
        });
        const successfulResponses = responses.filter((entry) => entry.statusCode !== 0);
        const averageDurationMs = successfulResponses.length > 0
          ? successfulResponses.reduce((total, entry) => total + entry.duration, 0) / successfulResponses.length
          : undefined;

        dataService.updateRecentScenarioHealth(
          currentScenario.id,
          averageDurationMs !== undefined ? classifyLatencyHealth(averageDurationMs) : 'OFFLINE',
          averageDurationMs
        );
        setRecentScenariosState(dataService.getLastUsedWorkspace().recentScenarios);
      }

      return next;
    });
    dataService.updateRecentRequestHealth(requestId, classifyRequestHealth(response));
    setRecentRequestsState(dataService.getLastUsedWorkspace().recentRequests);
  }, [currentScenario]);

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
    setOpenRequestTabs([]);
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
      scenarios, currentScenario, setCurrentScenario, lastUsedProject, openLastUsedProject, lastUsedScenario, openLastUsedScenario, recentScenarios, openRecentScenario, createScenario, updateScenario, deleteScenario,
      requests, favoriteRequests, draftRequest, openRequestTabs, currentRequest, setCurrentRequest, closeRequestTab, lastUsedRequest, recentRequests, openLastUsedRequest, openRecentRequest, createDraftRequest, saveCurrentRequest, discardDraftRequest, createRequest, updateRequest, copyRequest, deleteRequest, reorderRequests,
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
      recentScenarios,
      openRecentScenario,
      createScenario,
      updateScenario,
      deleteScenario,
      requests,
      favoriteRequests,
      draftRequest,
      openRequestTabs,
      currentRequest,
      setCurrentRequest,
      closeRequestTab,
      lastUsedRequest,
      recentScenarios,
      recentRequests,
      openLastUsedRequest,
      openRecentScenario,
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
