// Core domain types for Elqira

export interface Project {
  id: string;
  title: string;
  description?: string;
  tag?: string;
  version?: string;
  referenceUrl?: string;
  isFeatured?: boolean;
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
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

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
  notes?: string;
  isDraft?: boolean;
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
