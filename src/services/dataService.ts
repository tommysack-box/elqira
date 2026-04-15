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
  return projects.map((project) => ({
    ...project,
    version: project.version?.trim() || DEFAULT_PROJECT_VERSION,
  }));
}

export function saveProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
  const projects = getProjects();
  const newProject: Project = {
    ...project,
    version: project.version?.trim() || DEFAULT_PROJECT_VERSION,
    id: uid(),
    createdAt: now(),
    updatedAt: now(),
  };
  storageService.set(KEYS.projects, [...projects, newProject]);
  return newProject;
}

export function updateProject(id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
  const projects = getProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const updated = {
    ...projects[index],
    ...data,
    version: data.version !== undefined ? data.version.trim() || DEFAULT_PROJECT_VERSION : projects[index].version,
    updatedAt: now(),
  };
  projects[index] = updated;
  storageService.set(KEYS.projects, projects);
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
  return all.filter((s) => s.projectId === projectId);
}

export function saveScenario(scenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>): Scenario {
  const all = storageService.get<Scenario[]>(KEYS.scenarios) ?? [];
  const newScenario: Scenario = { ...scenario, id: uid(), createdAt: now(), updatedAt: now() };
  storageService.set(KEYS.scenarios, [...all, newScenario]);
  return newScenario;
}

export function updateScenario(id: string, data: Partial<Omit<Scenario, 'id' | 'createdAt'>>): Scenario | null {
  const all = storageService.get<Scenario[]>(KEYS.scenarios) ?? [];
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const updated = { ...all[index], ...data, updatedAt: now() };
  all[index] = updated;
  storageService.set(KEYS.scenarios, all);
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
