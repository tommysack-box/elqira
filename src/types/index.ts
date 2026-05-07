// Core domain types for Elqira

export interface Project {
  id: string;
  title: string;
  description?: string;
  tag?: string;
  version?: string;
  icon?: string;
  referenceUrl?: string;
  isFeatured?: boolean;
  isArchived?: boolean;
}

export interface Scenario {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  tag?: string;
  version?: string;
  referenceUrl?: string;
  isFeatured?: boolean;
  isArchived?: boolean;
  executionLinks?: ScenarioExecutionLink[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type RequestHealthCategory = 'STABLE' | 'LATENCY_MEDIUM' | 'LATENCY_HIGH' | 'OFFLINE';

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
  sensitive?: boolean;
}

export interface QueryParam {
  key: string;
  value: string;
  enabled: boolean;
  sensitive?: boolean;
}

export type RequestVariableSourceType = 'response-body' | 'response-header';
export type RequestVariableTargetType = 'header' | 'param' | 'body';

export interface ScenarioExecutionLink {
  id: string;
  sourceRequestId?: string;
  targetRequestId?: string;
  sourceType?: RequestVariableSourceType;
  sourceSelector?: string;
  variableName?: string;
  targetType?: RequestVariableTargetType;
  targetSelector?: string;
  valueTemplate?: string;
  required?: boolean;
}

export interface RequestVariableCapture {
  id: string;
  sourceType?: RequestVariableSourceType;
  sourceSelector?: string;
  variableName?: string;
  required?: boolean;
}

export interface RequestVariableInput {
  id: string;
  targetType?: RequestVariableTargetType;
  targetSelector?: string;
  valueTemplate?: string;
  required?: boolean;
}

export interface Request {
  id: string;
  scenarioId: string;
  requestOrder?: number;
  title: string;
  description?: string;
  timeoutMs?: number;
  method: HttpMethod;
  url: string;
  headers: Header[];
  params?: QueryParam[];
  body?: string;
  sensitiveBodyPaths?: string[];
  sensitiveUrlParamIds?: string[];
  responseCaptures?: RequestVariableCapture[];
  scenarioInputs?: RequestVariableInput[];
  notes?: string;
  isDraft?: boolean;
  isFavorite?: boolean;
  lastStatusCode?: number;
  lastStatusText?: string;
}

export interface Response {
  statusCode: number;
  statusText: string;
  duration: number; // ms
  body: string;
  headers: Record<string, string>;
  timestamp: string;
}

export type Language = 'en' | 'it';

export interface AppSettings {
  language: Language;
  requestTimeoutMs?: number;
}
