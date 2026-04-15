// Data access service for Projects, Scenarios and Requests
// Uses the StorageService abstraction for persistence

import { storageService } from './storage';
import type { Project, Scenario, Request, AppSettings } from '../types';

const KEYS = {
  projects: 'elqira:projects',
  scenarios: 'elqira:scenarios',
  requests: 'elqira:requests',
  settings: 'elqira:settings',
};

const DEFAULT_PROJECT_VERSION = 'v1.0.0';

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

function now(): string {
  return new Date().toISOString();
}

// --- Projects ---

export function getProjects(): Project[] {
  const projects = storageService.get<Project[]>(KEYS.projects) ?? [];
  return sortFeaturedFirst(
    projects.map((project) => ({
      ...project,
      version: project.version?.trim() || DEFAULT_PROJECT_VERSION,
      isFeatured: Boolean(project.isFeatured),
    }))
  );
}

export function saveProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
  const projects = storageService.get<Project[]>(KEYS.projects) ?? [];
  const shouldFeature = project.isFeatured || projects.length === 0;
  const normalizedProjects = shouldFeature
    ? projects.map((item) => ({ ...item, isFeatured: false }))
    : projects;
  const newProject: Project = {
    ...project,
    version: project.version?.trim() || DEFAULT_PROJECT_VERSION,
    isFeatured: shouldFeature,
    id: uid(),
    createdAt: now(),
    updatedAt: now(),
  };
  storageService.set(KEYS.projects, [...normalizedProjects, newProject]);
  return newProject;
}

export function updateProject(id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
  const projects = storageService.get<Project[]>(KEYS.projects) ?? [];
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
    isFeatured: data.isFeatured !== undefined ? data.isFeatured : nextProjects[index].isFeatured,
    updatedAt: now(),
  };
  nextProjects[index] = updated;
  storageService.set(KEYS.projects, nextProjects);
  return updated;
}

export function deleteProject(id: string): void {
  const projects = getProjects().filter((p) => p.id !== id);
  storageService.set(KEYS.projects, projects);
  // Cascade delete scenarios and their requests
  const scenarios = getScenariosByProject(id);
  scenarios.forEach((s) => deleteScenario(s.id));
}

// --- Scenarios ---

export function getScenariosByProject(projectId: string): Scenario[] {
  const all = storageService.get<Scenario[]>(KEYS.scenarios) ?? [];
  return sortFeaturedFirst(
    all
      .filter((s) => s.projectId === projectId)
      .map((scenario) => ({ ...scenario, isFeatured: Boolean(scenario.isFeatured) }))
  );
}

export function saveScenario(scenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>): Scenario {
  const all = storageService.get<Scenario[]>(KEYS.scenarios) ?? [];
  const hasScenariosForProject = all.some((item) => item.projectId === scenario.projectId);
  const shouldFeature = scenario.isFeatured || !hasScenariosForProject;
  const normalizedAll = shouldFeature
    ? all.map((item) => (item.projectId === scenario.projectId ? { ...item, isFeatured: false } : item))
    : all;
  const newScenario: Scenario = {
    ...scenario,
    isFeatured: shouldFeature,
    id: uid(),
    createdAt: now(),
    updatedAt: now(),
  };
  storageService.set(KEYS.scenarios, [...normalizedAll, newScenario]);
  return newScenario;
}

export function updateScenario(id: string, data: Partial<Omit<Scenario, 'id' | 'createdAt'>>): Scenario | null {
  const all = storageService.get<Scenario[]>(KEYS.scenarios) ?? [];
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
    isFeatured: data.isFeatured !== undefined ? data.isFeatured : nextAll[index].isFeatured,
    updatedAt: now(),
  };
  nextAll[index] = updated;
  storageService.set(KEYS.scenarios, nextAll);
  return updated;
}

export function deleteScenario(id: string): void {
  const all = (storageService.get<Scenario[]>(KEYS.scenarios) ?? []).filter((s) => s.id !== id);
  storageService.set(KEYS.scenarios, all);
  // Cascade delete requests
  const requests = getRequestsByScenario(id);
  requests.forEach((r) => deleteRequest(r.id));
}

// --- Requests ---

export function getRequestsByScenario(scenarioId: string): Request[] {
  const all = storageService.get<Request[]>(KEYS.requests) ?? [];
  return all.filter((r) => r.scenarioId === scenarioId);
}

export function saveRequest(request: Omit<Request, 'id' | 'createdAt' | 'updatedAt'>): Request {
  const all = storageService.get<Request[]>(KEYS.requests) ?? [];
  const newRequest: Request = { ...request, id: uid(), createdAt: now(), updatedAt: now() };
  storageService.set(KEYS.requests, [...all, newRequest]);
  return newRequest;
}

export function updateRequest(id: string, data: Partial<Omit<Request, 'id' | 'createdAt'>>): Request | null {
  const all = storageService.get<Request[]>(KEYS.requests) ?? [];
  const index = all.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const updated = { ...all[index], ...data, updatedAt: now() };
  all[index] = updated;
  storageService.set(KEYS.requests, all);
  return updated;
}

export function deleteRequest(id: string): void {
  const all = (storageService.get<Request[]>(KEYS.requests) ?? []).filter((r) => r.id !== id);
  storageService.set(KEYS.requests, all);
}

// --- Settings ---

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  smartEnabled: false,
};

export interface AppDataSnapshot {
  projects: Project[];
  scenarios: Scenario[];
  requests: Request[];
  settings: AppSettings;
}

export function getSettings(): AppSettings {
  const stored = storageService.get<AppSettings & { smartApiKey?: string }>(KEYS.settings);
  if (!stored) return DEFAULT_SETTINGS;

  const { smartApiKey: _smartApiKey, ...safeSettings } = stored;
  return { ...DEFAULT_SETTINGS, ...safeSettings };
}

export function saveSettings(settings: AppSettings): void {
  storageService.set(KEYS.settings, settings);
}

export function exportAppData(): AppDataSnapshot {
  return {
    projects: getProjects(),
    scenarios: storageService.get<Scenario[]>(KEYS.scenarios) ?? [],
    requests: storageService.get<Request[]>(KEYS.requests) ?? [],
    settings: getSettings(),
  };
}

export function importAppData(snapshot: AppDataSnapshot): void {
  storageService.set(KEYS.projects, snapshot.projects ?? []);
  storageService.set(KEYS.scenarios, snapshot.scenarios ?? []);
  storageService.set(KEYS.requests, snapshot.requests ?? []);
  storageService.set(KEYS.settings, snapshot.settings ?? DEFAULT_SETTINGS);
}
