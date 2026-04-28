// Data access service for Projects, Scenarios and Requests
// Uses the StorageService abstraction for persistence

import { storageService } from './storage';
import type { Project, Scenario, Request, AppSettings } from '../types';
import { sanitizeSensitiveUrlParams } from '../features/requests/requestSensitive';
import {
  sanitizeProjectRecords,
  sanitizeProjectRecord,
  sanitizeReferenceUrl,
  sanitizeRequestRecords,
  sanitizeRequestUrl,
  sanitizeScenarioRecords,
  sanitizeScenarioRecord,
  sanitizeSettings,
  sanitizeTimeoutMs,
} from './security';
import { MAX_IMPORT_FILE_BYTES } from './transferService';

const KEYS = {
  projects: 'elqira:projects',
  scenarios: 'elqira:scenarios',
  requests: 'elqira:requests',
  settings: 'elqira:settings',
};

const BOOTSTRAP_KEYS = [KEYS.projects, KEYS.scenarios, KEYS.settings] as const;
const TRANSFER_SCHEMA_VERSION = 1 as const;

const DEFAULT_PROJECT_VERSION = 'v1.0.0';
const DEFAULT_SCENARIO_VERSION = 'v1.0.0';
const MAX_PERSISTED_STATE_BYTES = 20 * 1024 * 1024;
const MAX_PROJECTS = 500;
const MAX_SCENARIOS_TOTAL = 5000;
const MAX_REQUESTS_TOTAL = 20000;
const MAX_SCENARIOS_PER_PROJECT = 500;
const MAX_REQUESTS_PER_SCENARIO = 1000;
const MAX_EXECUTION_LINKS_PER_SCENARIO = 1000;
const MAX_HEADERS_PER_REQUEST = 100;
const MAX_PARAMS_PER_REQUEST = 100;
const MAX_SENSITIVE_PATHS_PER_REQUEST = 200;
const MAX_CAPTURES_PER_REQUEST = 100;
const MAX_INPUTS_PER_REQUEST = 100;
const MAX_PROJECT_TITLE_LENGTH = 160;
const MAX_PROJECT_DESCRIPTION_LENGTH = 4000;
const MAX_PROJECT_TAG_LENGTH = 64;
const MAX_VERSION_LENGTH = 32;
const MAX_REFERENCE_URL_LENGTH = 2048;
const MAX_SCENARIO_TITLE_LENGTH = 160;
const MAX_SCENARIO_DESCRIPTION_LENGTH = 4000;
const MAX_REQUEST_TITLE_LENGTH = 160;
const MAX_REQUEST_DESCRIPTION_LENGTH = 4000;
const MAX_REQUEST_URL_LENGTH = 4096;
const MAX_BODY_LENGTH = 250_000;
const MAX_NOTES_LENGTH = 20_000;
const MAX_HEADER_KEY_LENGTH = 256;
const MAX_HEADER_VALUE_LENGTH = 4096;
const MAX_PARAM_KEY_LENGTH = 256;
const MAX_PARAM_VALUE_LENGTH = 4096;
const MAX_SELECTOR_LENGTH = 1024;
const MAX_VARIABLE_NAME_LENGTH = 128;
const MAX_TEMPLATE_LENGTH = 4096;
const INVALID_TRANSFER_FILE_MESSAGE = 'Invalid import file';
const IMPORT_LIMIT_EXCEEDED_MESSAGE = 'Import rejected: content exceeds supported limits';

type PersistedState = {
  projects: Project[];
  scenarios: Scenario[];
  requests: Request[];
  settings: AppSettings;
};

function readProjects(): Project[] {
  return storageService.get<Project[]>(KEYS.projects) ?? [];
}

function readScenarios(): Scenario[] {
  return storageService.get<Scenario[]>(KEYS.scenarios) ?? [];
}

function readRequests(): Request[] {
  return storageService.get<Request[]>(KEYS.requests) ?? [];
}

export function initializeBootstrapData(): Promise<void> {
  return storageService.initialize([...BOOTSTRAP_KEYS]);
}

export function areBootstrapDataLoaded(): boolean {
  return storageService.areLoaded([...BOOTSTRAP_KEYS]);
}

export function ensureRequestsLoaded(): Promise<void> {
  return storageService.ensureLoaded(KEYS.requests).then(() => {
    const storedRequests = readRequests();
    const normalizedRequests = storedRequests.map(sanitizeRequestForStorage);

    if (JSON.stringify(storedRequests) !== JSON.stringify(normalizedRequests)) {
      storageService.set(KEYS.requests, normalizedRequests);
    }
  });
}

export function areRequestsLoaded(): boolean {
  return storageService.isLoaded(KEYS.requests);
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
    lastStatusCode: undefined,
    lastStatusText: undefined,
    timeoutMs: sanitizeTimeoutMs(request.timeoutMs),
    url: sanitizeSensitiveUrlParams(sanitizeRequestUrl(request.url), request.sensitiveUrlParamIds) ?? '',
    headers: (request.headers ?? []).map((header) => ({
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

function assertImport(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function estimateSerializedSize(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size;
}

function assertTransferPayloadSize(snapshot: unknown): void {
  assertImport(
    estimateSerializedSize(snapshot) <= MAX_IMPORT_FILE_BYTES,
    IMPORT_LIMIT_EXCEEDED_MESSAGE
  );
}

function assertStringLength(value: string | undefined, max: number): void {
  assertImport(!value || value.length <= max, IMPORT_LIMIT_EXCEEDED_MESSAGE);
}

function assertTransferMetadata(snapshot: unknown, kind: 'project' | 'scenario'): void {
  assertImport(snapshot && typeof snapshot === 'object', INVALID_TRANSFER_FILE_MESSAGE);
  const candidate = snapshot as Partial<{ app: unknown; schemaVersion: unknown; kind: unknown }>;
  assertImport(candidate.app === 'elqira', INVALID_TRANSFER_FILE_MESSAGE);
  assertImport(candidate.schemaVersion === TRANSFER_SCHEMA_VERSION, INVALID_TRANSFER_FILE_MESSAGE);
  assertImport(candidate.kind === kind, INVALID_TRANSFER_FILE_MESSAGE);
}

function validateProjectLimits(project: Project): void {
  assertStringLength(project.title, MAX_PROJECT_TITLE_LENGTH);
  assertStringLength(project.description, MAX_PROJECT_DESCRIPTION_LENGTH);
  assertStringLength(project.tag, MAX_PROJECT_TAG_LENGTH);
  assertStringLength(project.version, MAX_VERSION_LENGTH);
  assertStringLength(project.referenceUrl, MAX_REFERENCE_URL_LENGTH);
}

function validateScenarioLimits(scenario: Scenario): void {
  assertStringLength(scenario.title, MAX_SCENARIO_TITLE_LENGTH);
  assertStringLength(scenario.description, MAX_SCENARIO_DESCRIPTION_LENGTH);
  assertStringLength(scenario.tag, MAX_PROJECT_TAG_LENGTH);
  assertStringLength(scenario.version, MAX_VERSION_LENGTH);
  assertStringLength(scenario.referenceUrl, MAX_REFERENCE_URL_LENGTH);
  assertImport(
    (scenario.executionLinks?.length ?? 0) <= MAX_EXECUTION_LINKS_PER_SCENARIO,
    IMPORT_LIMIT_EXCEEDED_MESSAGE
  );

  for (const link of scenario.executionLinks ?? []) {
    assertStringLength(link.sourceSelector, MAX_SELECTOR_LENGTH);
    assertStringLength(link.targetSelector, MAX_SELECTOR_LENGTH);
    assertStringLength(link.variableName, MAX_VARIABLE_NAME_LENGTH);
    assertStringLength(link.valueTemplate, MAX_TEMPLATE_LENGTH);
  }
}

function validateRequestLimits(request: Request): void {
  assertStringLength(request.title, MAX_REQUEST_TITLE_LENGTH);
  assertStringLength(request.description, MAX_REQUEST_DESCRIPTION_LENGTH);
  assertStringLength(request.url, MAX_REQUEST_URL_LENGTH);
  assertStringLength(request.body, MAX_BODY_LENGTH);
  assertStringLength(request.notes, MAX_NOTES_LENGTH);

  assertImport((request.headers?.length ?? 0) <= MAX_HEADERS_PER_REQUEST, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  assertImport((request.params?.length ?? 0) <= MAX_PARAMS_PER_REQUEST, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  assertImport((request.sensitiveBodyPaths?.length ?? 0) <= MAX_SENSITIVE_PATHS_PER_REQUEST, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  assertImport((request.sensitiveUrlParamIds?.length ?? 0) <= MAX_SENSITIVE_PATHS_PER_REQUEST, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  assertImport((request.responseCaptures?.length ?? 0) <= MAX_CAPTURES_PER_REQUEST, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  assertImport((request.scenarioInputs?.length ?? 0) <= MAX_INPUTS_PER_REQUEST, IMPORT_LIMIT_EXCEEDED_MESSAGE);

  for (const header of request.headers ?? []) {
    assertStringLength(header.key, MAX_HEADER_KEY_LENGTH);
    assertStringLength(header.value, MAX_HEADER_VALUE_LENGTH);
  }

  for (const param of request.params ?? []) {
    assertStringLength(param.key, MAX_PARAM_KEY_LENGTH);
    assertStringLength(param.value, MAX_PARAM_VALUE_LENGTH);
  }

  for (const pointer of request.sensitiveBodyPaths ?? []) {
    assertStringLength(pointer, MAX_SELECTOR_LENGTH);
  }

  for (const paramId of request.sensitiveUrlParamIds ?? []) {
    assertStringLength(paramId, MAX_SELECTOR_LENGTH);
  }

  for (const capture of request.responseCaptures ?? []) {
    assertStringLength(capture.sourceSelector, MAX_SELECTOR_LENGTH);
    assertStringLength(capture.variableName, MAX_VARIABLE_NAME_LENGTH);
  }

  for (const input of request.scenarioInputs ?? []) {
    assertStringLength(input.targetSelector, MAX_SELECTOR_LENGTH);
    assertStringLength(input.valueTemplate, MAX_TEMPLATE_LENGTH);
  }
}

function validateEntityCounts(projects: Project[], scenarios: Scenario[], requests: Request[]): void {
  assertImport(projects.length <= MAX_PROJECTS, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  assertImport(scenarios.length <= MAX_SCENARIOS_TOTAL, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  assertImport(requests.length <= MAX_REQUESTS_TOTAL, IMPORT_LIMIT_EXCEEDED_MESSAGE);

  const scenariosByProjectId = new Map<string, number>();
  for (const scenario of scenarios) {
    scenariosByProjectId.set(scenario.projectId, (scenariosByProjectId.get(scenario.projectId) ?? 0) + 1);
  }
  for (const count of scenariosByProjectId.values()) {
    assertImport(count <= MAX_SCENARIOS_PER_PROJECT, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  }

  const requestsByScenarioId = new Map<string, number>();
  for (const request of requests) {
    requestsByScenarioId.set(request.scenarioId, (requestsByScenarioId.get(request.scenarioId) ?? 0) + 1);
  }
  for (const count of requestsByScenarioId.values()) {
    assertImport(count <= MAX_REQUESTS_PER_SCENARIO, IMPORT_LIMIT_EXCEEDED_MESSAGE);
  }
}

function validateImportData(projects: Project[], scenarios: Scenario[], requests: Request[]): void {
  validateEntityCounts(projects, scenarios, requests);
  projects.forEach(validateProjectLimits);
  scenarios.forEach(validateScenarioLimits);
  requests.forEach(validateRequestLimits);
}

function assertPersistedStateSize(state: PersistedState): void {
  assertImport(
    estimateSerializedSize(state) <= MAX_PERSISTED_STATE_BYTES,
    IMPORT_LIMIT_EXCEEDED_MESSAGE
  );
}

async function persistStateAtomically(state: PersistedState): Promise<void> {
  await storageService.setMany([
    { key: KEYS.projects, value: state.projects },
    { key: KEYS.scenarios, value: state.scenarios },
    { key: KEYS.requests, value: state.requests },
    { key: KEYS.settings, value: state.settings },
  ]);
}

function importScenarioBundle(
  scenario: Scenario,
  requests: Request[],
  projectId: string,
  isFeatured: boolean,
): { scenario: Scenario; requests: Request[] } {
  const importedScenarioId = uid();
  const requestIdMap = new Map<string, string>();

  const importedRequests = requests.map((request) => {
    const importedRequestId = uid();
    requestIdMap.set(request.id, importedRequestId);
    return sanitizeRequestForStorage({
      ...request,
      id: importedRequestId,
      scenarioId: importedScenarioId,
    });
  });

  return {
    scenario: {
      ...scenario,
      id: importedScenarioId,
      projectId,
      isFeatured,
      executionLinks: (scenario.executionLinks ?? []).flatMap((link) => {
        const sourceRequestId = link.sourceRequestId
          ? requestIdMap.get(link.sourceRequestId)
          : undefined;
        const targetRequestId = link.targetRequestId
          ? requestIdMap.get(link.targetRequestId)
          : undefined;

        if (link.sourceRequestId && !sourceRequestId) return [];
        if (link.targetRequestId && !targetRequestId) return [];

        return [{
          ...link,
          id: uid(),
          sourceRequestId,
          targetRequestId,
        }];
      }),
    },
    requests: importedRequests,
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

export async function deleteProject(id: string): Promise<void> {
  await ensureRequestsLoaded();
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
        executionLinks: scenario.executionLinks ?? [],
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

export async function deleteScenario(id: string): Promise<void> {
  await ensureRequestsLoaded();
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
      lastStatusCode: undefined,
      lastStatusText: undefined,
      timeoutMs: sanitizeTimeoutMs(request.timeoutMs),
      sensitiveUrlParamIds: request.sensitiveUrlParamIds ?? [],
      responseCaptures: request.responseCaptures ?? [],
      scenarioInputs: request.scenarioInputs ?? [],
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

export interface ProjectTransferSnapshot {
  app: 'elqira';
  schemaVersion: typeof TRANSFER_SCHEMA_VERSION;
  kind: 'project';
  exportedAt: string;
  project: Project;
  scenarios: Scenario[];
  requests: Request[];
}

export interface ScenarioTransferSnapshot {
  app: 'elqira';
  schemaVersion: typeof TRANSFER_SCHEMA_VERSION;
  kind: 'scenario';
  exportedAt: string;
  project?: Pick<Project, 'title' | 'tag' | 'version'>;
  scenario: Scenario;
  requests: Request[];
}

export function getSettings(): AppSettings {
  const stored = storageService.get<AppSettings & Record<string, unknown>>(KEYS.settings);
  return sanitizeSettings(stored);
}

export function saveSettings(settings: AppSettings): void {
  storageService.set(KEYS.settings, sanitizeSettings(settings));
}

export async function exportAppData(): Promise<AppDataSnapshot> {
  await ensureRequestsLoaded();
  return {
    projects: getProjects(),
    scenarios: readScenarios(),
    requests: readRequests().map(sanitizeRequestForStorage),
    settings: getSettings(),
  };
}

export async function exportProjectData(projectId: string): Promise<ProjectTransferSnapshot | null> {
  await ensureRequestsLoaded();

  const project = getProjects().find((entry) => entry.id === projectId);
  if (!project) return null;

  const scenarios = getScenariosByProject(projectId);
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  const requests = readRequests()
    .filter((request) => scenarioIds.has(request.scenarioId))
    .map(sanitizeRequestForStorage);

  return {
    app: 'elqira',
    schemaVersion: TRANSFER_SCHEMA_VERSION,
    kind: 'project',
    exportedAt: new Date().toISOString(),
    project,
    scenarios,
    requests,
  };
}

export async function exportScenarioData(scenarioId: string): Promise<ScenarioTransferSnapshot | null> {
  await ensureRequestsLoaded();

  const rawScenario = readScenarios().find((entry) => entry.id === scenarioId);
  const scenario = rawScenario ? sanitizeScenarioRecord(rawScenario) : null;
  if (!scenario) return null;

  const project = getProjects().find((entry) => entry.id === scenario.projectId);
  const requests = getRequestsByScenario(scenarioId).map(sanitizeRequestForStorage);

  return {
    app: 'elqira',
    schemaVersion: TRANSFER_SCHEMA_VERSION,
    kind: 'scenario',
    exportedAt: new Date().toISOString(),
    project: project
      ? {
          title: project.title,
          tag: project.tag,
          version: project.version,
        }
      : undefined,
    scenario,
    requests,
  };
}

export async function importProjectData(snapshot: ProjectTransferSnapshot): Promise<Project> {
  await ensureRequestsLoaded();

  assertTransferPayloadSize(snapshot);
  assertTransferMetadata(snapshot, 'project');

  const project = sanitizeProjectRecord(snapshot.project);
  if (!project) {
    throw new Error(INVALID_TRANSFER_FILE_MESSAGE);
  }

  const scenarios = sanitizeScenarioRecords(snapshot.scenarios)
    .filter((scenario) => scenario.projectId === project.id);
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  const requests = sanitizeRequestRecords(snapshot.requests)
    .filter((request) => scenarioIds.has(request.scenarioId));
  validateImportData([project], scenarios, requests);

  const nextProject: Project = {
    ...project,
    id: uid(),
    isFeatured: readProjects().length === 0,
  };

  const requestsByScenarioId = new Map<string, Request[]>();
  for (const request of requests) {
    const scenarioRequests = requestsByScenarioId.get(request.scenarioId) ?? [];
    scenarioRequests.push(request);
    requestsByScenarioId.set(request.scenarioId, scenarioRequests);
  }

  const featuredScenarioId = scenarios.find((scenario) => scenario.isFeatured)?.id ?? scenarios[0]?.id;
  const importedBundles = scenarios.map((scenario) =>
    importScenarioBundle(
      scenario,
      requestsByScenarioId.get(scenario.id) ?? [],
      nextProject.id,
      scenario.id === featuredScenarioId
    )
  );
  const nextState: PersistedState = {
    projects: [...readProjects(), nextProject],
    scenarios: [...readScenarios(), ...importedBundles.map((bundle) => bundle.scenario)],
    requests: [...readRequests(), ...importedBundles.flatMap((bundle) => bundle.requests)],
    settings: getSettings(),
  };
  validateImportData(nextState.projects, nextState.scenarios, nextState.requests);
  assertPersistedStateSize(nextState);
  await persistStateAtomically(nextState);

  return nextProject;
}

export async function importScenarioData(
  projectId: string,
  snapshot: ScenarioTransferSnapshot,
): Promise<Scenario> {
  await ensureRequestsLoaded();

  assertTransferPayloadSize(snapshot);
  assertTransferMetadata(snapshot, 'scenario');

  const scenario = sanitizeScenarioRecord(snapshot.scenario);
  if (!scenario) {
    throw new Error(INVALID_TRANSFER_FILE_MESSAGE);
  }

  const requests = sanitizeRequestRecords(snapshot.requests)
    .filter((request) => request.scenarioId === scenario.id);
  validateImportData([], [scenario], requests);
  const hasScenariosForProject = readScenarios().some((entry) => entry.projectId === projectId);
  const importedBundle = importScenarioBundle(
    scenario,
    requests,
    projectId,
    !hasScenariosForProject
  );
  const nextState: PersistedState = {
    projects: readProjects(),
    scenarios: [...readScenarios(), importedBundle.scenario],
    requests: [...readRequests(), ...importedBundle.requests],
    settings: getSettings(),
  };
  validateImportData(nextState.projects, nextState.scenarios, nextState.requests);
  assertPersistedStateSize(nextState);
  await persistStateAtomically(nextState);

  return importedBundle.scenario;
}

export async function importAppData(snapshot: AppDataSnapshot): Promise<void> {
  assertTransferPayloadSize(snapshot);
  const projects = sanitizeProjectRecords(snapshot?.projects);
  const projectIds = new Set(projects.map((project) => project.id));
  const scenarios = sanitizeScenarioRecords(snapshot?.scenarios)
    .filter((scenario) => projectIds.has(scenario.projectId));
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  const requests = sanitizeRequestRecords(snapshot?.requests)
    .filter((request) => scenarioIds.has(request.scenarioId))
    .map(sanitizeRequestForStorage);
  const settings = sanitizeSettings(snapshot?.settings ?? DEFAULT_SETTINGS);
  const nextState: PersistedState = {
    projects,
    scenarios,
    requests,
    settings,
  };
  validateImportData(projects, scenarios, requests);
  assertPersistedStateSize(nextState);
  await persistStateAtomically(nextState);
}
