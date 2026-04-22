// Data access service for Projects, Scenarios and Requests
// Uses the StorageService abstraction for persistence

import { storageService } from './storage';
import type { Project, Scenario, Request, AppSettings } from '../types';
import { sanitizeSensitiveUrlParams } from '../features/requests/requestSensitive';
import {
  sanitizeProjectRecords,
  sanitizeReferenceUrl,
  sanitizeRequestRecords,
  sanitizeRequestUrl,
  sanitizeScenarioRecords,
  sanitizeSettings,
  sanitizeTimeoutMs,
} from './security';

const KEYS = {
  projects: 'elqira:projects',
  scenarios: 'elqira:scenarios',
  requests: 'elqira:requests',
  settings: 'elqira:settings',
};

const DEFAULT_PROJECT_VERSION = 'v1.0.0';
const DEFAULT_SCENARIO_VERSION = 'v1.0.0';

function readProjects(): Project[] {
  return storageService.get<Project[]>(KEYS.projects) ?? [];
}

function readScenarios(): Scenario[] {
  return storageService.get<Scenario[]>(KEYS.scenarios) ?? [];
}

function readRequests(): Request[] {
  return storageService.get<Request[]>(KEYS.requests) ?? [];
}

function sortFeaturedFirst<T extends { isFeatured?: boolean }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const featuredDelta = Number(Boolean(b.item.isFeatured)) - Number(Boolean(a.item.isFeatured));
      if (featuredDelta !== 0) return featuredDelta;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

// Helper to generate a unique ID
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortRequestsByOrder(requests: Request[]): Request[] {
  return [...requests].sort((a, b) => {
    const aOrder = a.requestOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.requestOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.id.localeCompare(b.id);
  });
}

function decodeJsonPointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function sanitizeBodyValue(body: string | undefined, sensitiveBodyPaths: string[] | undefined): string | undefined {
  if (!body) return body;
  if (!sensitiveBodyPaths || sensitiveBodyPaths.length === 0) return body;

  try {
    const parsed = JSON.parse(body) as unknown;

    for (const pointer of sensitiveBodyPaths) {
      if (!pointer.startsWith('/')) continue;
      const parts = pointer
        .split('/')
        .slice(1)
        .map(decodeJsonPointerToken);

      if (parts.length === 0) continue;

      let cursor: unknown = parsed;
      for (let index = 0; index < parts.length - 1; index += 1) {
        const segment = parts[index];
        if (Array.isArray(cursor)) {
          const arrayIndex = Number(segment);
          if (!Number.isInteger(arrayIndex) || arrayIndex < 0 || arrayIndex >= cursor.length) {
            cursor = undefined;
            break;
          }
          cursor = cursor[arrayIndex];
          continue;
        }

        if (cursor && typeof cursor === 'object' && segment in cursor) {
          cursor = (cursor as Record<string, unknown>)[segment];
          continue;
        }

        cursor = undefined;
        break;
      }

      const lastSegment = parts[parts.length - 1];
      if (Array.isArray(cursor)) {
        const arrayIndex = Number(lastSegment);
        if (Number.isInteger(arrayIndex) && arrayIndex >= 0 && arrayIndex < cursor.length) {
          cursor[arrayIndex] = '';
        }
        continue;
      }

      if (cursor && typeof cursor === 'object' && lastSegment in cursor) {
        (cursor as Record<string, unknown>)[lastSegment] = '';
      }
    }

    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
}

function sanitizeRequestForStorage(request: Request): Request {
  return {
    ...request,
    isDraft: false,
    timeoutMs: sanitizeTimeoutMs(request.timeoutMs),
    url: sanitizeSensitiveUrlParams(sanitizeRequestUrl(request.url), request.sensitiveUrlParamIds) ?? '',
    headers: request.headers.map((header) => ({
      ...header,
      value: header.sensitive ? '' : header.value,
    })),
    params: request.params?.map((param) => ({
      ...param,
      value: param.sensitive ? '' : param.value,
    })),
    body: sanitizeBodyValue(request.body, request.sensitiveBodyPaths),
  };
}

// --- Projects ---

export function getProjects(): Project[] {
  const projects = readProjects();
  return sortFeaturedFirst(
    projects.map((project) => ({
      ...project,
      version: project.version?.trim() || DEFAULT_PROJECT_VERSION,
      referenceUrl: project.referenceUrl?.trim() || undefined,
      isFeatured: Boolean(project.isFeatured),
    }))
  );
}

export function saveProject(project: Omit<Project, 'id'>): Project {
  const projects = readProjects();
  const shouldFeature = project.isFeatured || projects.length === 0;
  const normalizedProjects = shouldFeature
    ? projects.map((item) => ({ ...item, isFeatured: false }))
    : projects;
  const newProject: Project = {
    ...project,
    version: project.version?.trim() || DEFAULT_PROJECT_VERSION,
    referenceUrl: sanitizeReferenceUrl(project.referenceUrl),
    isFeatured: shouldFeature,
    id: uid(),
  };
  storageService.set(KEYS.projects, [...normalizedProjects, newProject]);
  return newProject;
}

export function updateProject(id: string, data: Partial<Omit<Project, 'id'>>): Project | null {
  const projects = readProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const nextProjects = data.isFeatured
    ? projects.map((project) => (project.id === id ? project : { ...project, isFeatured: false }))
    : [...projects];
  const updated = {
    ...nextProjects[index],
    ...data,
    version: data.version !== undefined
      ? data.version.trim() || DEFAULT_PROJECT_VERSION
      : nextProjects[index].version?.trim() || DEFAULT_PROJECT_VERSION,
    referenceUrl: data.referenceUrl !== undefined
      ? sanitizeReferenceUrl(data.referenceUrl)
      : sanitizeReferenceUrl(nextProjects[index].referenceUrl),
    isFeatured: data.isFeatured !== undefined ? data.isFeatured : nextProjects[index].isFeatured,
  };
  nextProjects[index] = updated;
  storageService.set(KEYS.projects, nextProjects);
  return updated;
}

export function deleteProject(id: string): void {
  const projects = readProjects().filter((project) => project.id !== id);
  const scenarios = readScenarios();
  const removedScenarioIds = new Set(
    scenarios
      .filter((scenario) => scenario.projectId === id)
      .map((scenario) => scenario.id)
  );
  const requests = removedScenarioIds.size === 0
    ? readRequests()
    : readRequests().filter((request) => !removedScenarioIds.has(request.scenarioId));

  storageService.set(KEYS.projects, projects);
  storageService.set(
    KEYS.scenarios,
    removedScenarioIds.size === 0
      ? scenarios
      : scenarios.filter((scenario) => !removedScenarioIds.has(scenario.id))
  );
  storageService.set(KEYS.requests, requests);
}

// --- Scenarios ---

export function getScenariosByProject(projectId: string): Scenario[] {
  const all = readScenarios();
  return sortFeaturedFirst(
    all
      .filter((s) => s.projectId === projectId)
      .map((scenario) => ({
        ...scenario,
        version: scenario.version?.trim() || DEFAULT_SCENARIO_VERSION,
        referenceUrl: scenario.referenceUrl?.trim() || undefined,
        isFeatured: Boolean(scenario.isFeatured),
      }))
  );
}

export function saveScenario(scenario: Omit<Scenario, 'id'>): Scenario {
  const all = readScenarios();
  const hasScenariosForProject = all.some((item) => item.projectId === scenario.projectId);
  const shouldFeature = scenario.isFeatured || !hasScenariosForProject;
  const normalizedAll = shouldFeature
    ? all.map((item) => (item.projectId === scenario.projectId ? { ...item, isFeatured: false } : item))
    : all;
  const newScenario: Scenario = {
    ...scenario,
    version: scenario.version?.trim() || DEFAULT_SCENARIO_VERSION,
    referenceUrl: sanitizeReferenceUrl(scenario.referenceUrl),
    isFeatured: shouldFeature,
    id: uid(),
  };
  storageService.set(KEYS.scenarios, [...normalizedAll, newScenario]);
  return newScenario;
}

export function updateScenario(id: string, data: Partial<Omit<Scenario, 'id'>>): Scenario | null {
  const all = readScenarios();
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const currentScenario = all[index];
  const nextAll = data.isFeatured
    ? all.map((scenario) =>
        scenario.projectId === currentScenario.projectId && scenario.id !== id
          ? { ...scenario, isFeatured: false }
          : scenario
      )
    : [...all];
  const updated = {
    ...nextAll[index],
    ...data,
    version: data.version !== undefined
      ? data.version.trim() || DEFAULT_SCENARIO_VERSION
      : nextAll[index].version?.trim() || DEFAULT_SCENARIO_VERSION,
    referenceUrl: data.referenceUrl !== undefined
      ? sanitizeReferenceUrl(data.referenceUrl)
      : sanitizeReferenceUrl(nextAll[index].referenceUrl),
    isFeatured: data.isFeatured !== undefined ? data.isFeatured : nextAll[index].isFeatured,
  };
  nextAll[index] = updated;
  storageService.set(KEYS.scenarios, nextAll);
  return updated;
}

export function deleteScenario(id: string): void {
  storageService.set(KEYS.scenarios, readScenarios().filter((scenario) => scenario.id !== id));
  storageService.set(KEYS.requests, readRequests().filter((request) => request.scenarioId !== id));
}

// --- Requests ---

export function getRequestsByScenario(scenarioId: string): Request[] {
  const all = readRequests();
  return sortRequestsByOrder(
    all.filter((r) => r.scenarioId === scenarioId)
  )
    .map((request) => ({
      ...request,
      timeoutMs: sanitizeTimeoutMs(request.timeoutMs),
      sensitiveUrlParamIds: request.sensitiveUrlParamIds ?? [],
    }));
}

export function saveRequest(request: Omit<Request, 'id'>): Request {
  const all = readRequests();
  const scenarioRequests = all.filter((item) => item.scenarioId === request.scenarioId);
  const nextOrder = scenarioRequests.reduce((maxOrder, item) => Math.max(maxOrder, item.requestOrder ?? -1), -1) + 1;
  const newRequest: Request = {
    ...request,
    requestOrder: request.requestOrder ?? nextOrder,
    url: sanitizeRequestUrl(request.url),
    id: uid(),
  };
  storageService.set(KEYS.requests, [...all, sanitizeRequestForStorage(newRequest)]);
  return newRequest;
}

export function updateRequest(id: string, data: Partial<Omit<Request, 'id'>>): Request | null {
  const all = readRequests();
  const index = all.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const updated = { ...all[index], ...data };
  all[index] = sanitizeRequestForStorage(updated);
  storageService.set(KEYS.requests, all);
  return updated;
}

export function deleteRequest(id: string): void {
  const all = readRequests().filter((r) => r.id !== id);
  storageService.set(KEYS.requests, all);
}

export function reorderRequests(scenarioId: string, orderedIds: string[]): void {
  const all = readRequests();
  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  const nextAll = all.map((request) => {
    if (request.scenarioId !== scenarioId) return request;
    const nextOrder = orderById.get(request.id);
    if (nextOrder === undefined) return request;
    return {
      ...request,
      requestOrder: nextOrder,
    };
  });

  storageService.set(KEYS.requests, nextAll);
}

// --- Settings ---

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  requestTimeoutMs: undefined,
};

export interface AppDataSnapshot {
  projects: Project[];
  scenarios: Scenario[];
  requests: Request[];
  settings: AppSettings;
}

export function getSettings(): AppSettings {
  const stored = storageService.get<AppSettings & Record<string, unknown>>(KEYS.settings);
  return sanitizeSettings(stored);
}

export function saveSettings(settings: AppSettings): void {
  storageService.set(KEYS.settings, sanitizeSettings(settings));
}

export function exportAppData(): AppDataSnapshot {
  return {
    projects: getProjects(),
    scenarios: readScenarios(),
    requests: readRequests(),
    settings: getSettings(),
  };
}

export function importAppData(snapshot: AppDataSnapshot): void {
  const projects = sanitizeProjectRecords(snapshot?.projects);
  const projectIds = new Set(projects.map((project) => project.id));
  const scenarios = sanitizeScenarioRecords(snapshot?.scenarios)
    .filter((scenario) => projectIds.has(scenario.projectId));
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  const requests = sanitizeRequestRecords(snapshot?.requests)
    .filter((request) => scenarioIds.has(request.scenarioId))
    .map(sanitizeRequestForStorage);

  storageService.set(KEYS.projects, projects);
  storageService.set(KEYS.scenarios, scenarios);
  storageService.set(KEYS.requests, requests);
  storageService.set(KEYS.settings, sanitizeSettings(snapshot?.settings ?? DEFAULT_SETTINGS));
}
