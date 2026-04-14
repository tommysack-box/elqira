// Core domain types for Elqira

export interface Project {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Scenario {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Request {
  id: string;
  scenarioId: string;
  title: string;
  description?: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  body?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  smartEnabled: boolean;
  smartApiKey?: string;
  smartProvider?: string;
  smartModel?: string;
  smartEndpoint?: string;
}
