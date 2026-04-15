import type { AppSettings, Request, Response } from '../../types';
import type { ExplainResponseResult } from '../../features/requests/explainResponse';
import type { DebugResponseResult } from '../../features/requests/debugResponse';
import type { CompareResponseResult } from '../../features/requests/compareResponse';
import type { ScenarioHealthReportResult } from '../../features/requests/scenarioHealthReport';

export interface SmartRuntimeConfig {
  settings: AppSettings;
  apiKey: string;
}

function getLanguageInstruction(language: AppSettings['language']) {
  return language === 'it'
    ? 'Write the entire explanation in Italian.'
    : 'Write the entire explanation in English.';
}

export interface ExplainResponseInput {
  request: Request;
  response: Response;
}

interface SmartProvider {
  explainResponse(input: ExplainResponseInput, config: SmartRuntimeConfig): Promise<ExplainResponseResult>;
  debugResponse(input: ExplainResponseInput, config: SmartRuntimeConfig): Promise<DebugResponseResult>;
  compareResponse(input: CompareResponseInput, config: SmartRuntimeConfig): Promise<CompareResponseResult>;
  scenarioHealth(input: ScenarioHealthInput, config: SmartRuntimeConfig): Promise<ScenarioHealthReportResult>;
}

export interface CompareResponseInput {
  request: Request;
  baseline: Response;
  current: Response;
}

export interface ScenarioHealthInput {
  scenarioTitle: string;
  pairs: Array<{
    request: { title: string; method: string; url: string; body?: string };
    response: { statusCode: number; statusText: string; duration: number; body: string };
  }>;
}

function getResponseText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';

  const responseData = data as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof responseData.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text;
  }

  for (const item of responseData.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type?.includes('text') && typeof content.text === 'string' && content.text.trim()) {
        return content.text;
      }
    }
  }

  return '';
}

function isExplainResponseResult(value: unknown): value is ExplainResponseResult {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as ExplainResponseResult;
  return (
    typeof candidate.summary === 'string' &&
    !!candidate.statusSemantic &&
    typeof candidate.statusSemantic.label === 'string' &&
    typeof candidate.statusSemantic.value === 'string' &&
    typeof candidate.statusSemantic.tone === 'string' &&
    !!candidate.latencyTier &&
    typeof candidate.latencyTier.label === 'string' &&
    typeof candidate.latencyTier.value === 'string' &&
    typeof candidate.latencyTier.tone === 'string' &&
    Array.isArray(candidate.highlights)
  );
}

function getGeminiText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';

  const responseData = data as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = responseData.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  return text?.trim() ?? '';
}

const explainResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'statusSemantic', 'latencyTier', 'highlights'],
  properties: {
    summary: { type: 'string' },
    statusSemantic: {
      type: 'object',
      additionalProperties: false,
      required: ['label', 'value', 'tone'],
      properties: {
        label: { type: 'string' },
        value: { type: 'string' },
        tone: { type: 'string', enum: ['good', 'neutral', 'warning'] },
      },
    },
    latencyTier: {
      type: 'object',
      additionalProperties: false,
      required: ['label', 'value', 'tone'],
      properties: {
        label: { type: 'string' },
        value: { type: 'string' },
        tone: { type: 'string', enum: ['good', 'neutral', 'warning'] },
      },
    },
    highlights: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'badge', 'description'],
        properties: {
          label: { type: 'string' },
          badge: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
} as const;

const debugResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'rootCauses', 'suggestedFixes'],
  properties: {
    summary: { type: 'string' },
    rootCauses: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'severity'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    suggestedFixes: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description'],
        properties: {
          description: { type: 'string' },
        },
      },
    },
  },
} as const;

const compareResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'statusChanged', 'latencyDelta', 'addedFields', 'removedFields', 'changedFields', 'semanticNotes', 'regressionRisk'],
  properties: {
    summary: { type: 'string' },
    statusChanged: { type: 'boolean' },
    latencyDelta: { type: 'number' },
    regressionRisk: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
    addedFields: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['path', 'value', 'kind'],
        properties: {
          path: { type: 'string' },
          value: { type: 'string' },
          kind: { type: 'string', enum: ['added'] },
        },
      },
    },
    removedFields: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['path', 'value', 'kind'],
        properties: {
          path: { type: 'string' },
          value: { type: 'string' },
          kind: { type: 'string', enum: ['removed'] },
        },
      },
    },
    changedFields: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['path', 'baselineValue', 'currentValue', 'kind'],
        properties: {
          path: { type: 'string' },
          baselineValue: { type: 'string' },
          currentValue: { type: 'string' },
          kind: { type: 'string', enum: ['changed'] },
        },
      },
    },
    semanticNotes: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['text', 'severity'],
        properties: {
          text: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
        },
      },
    },
  },
} as const;

const scenarioHealthSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['scenarioTitle', 'executedAt', 'summary', 'consistency', 'errorPatterns', 'implicitDependencies', 'latencyProfile'],
  properties: {
    scenarioTitle: { type: 'string' },
    executedAt: { type: 'string' },
    summary: { type: 'string' },
    consistency: {
      type: 'object', additionalProperties: false,
      required: ['consistent', 'issues'],
      properties: {
        consistent: { type: 'boolean' },
        issues: {
          type: 'array', maxItems: 6,
          items: {
            type: 'object', additionalProperties: false,
            required: ['requestTitles', 'description'],
            properties: {
              requestTitles: { type: 'array', items: { type: 'string' } },
              description: { type: 'string' },
            },
          },
        },
      },
    },
    errorPatterns: {
      type: 'object', additionalProperties: false,
      required: ['hasErrors', 'patterns'],
      properties: {
        hasErrors: { type: 'boolean' },
        patterns: {
          type: 'array', maxItems: 8,
          items: {
            type: 'object', additionalProperties: false,
            required: ['statusCode', 'requests', 'note'],
            properties: {
              statusCode: { type: 'number' },
              requests: { type: 'array', items: { type: 'string' } },
              note: { type: 'string' },
            },
          },
        },
      },
    },
    implicitDependencies: {
      type: 'object', additionalProperties: false,
      required: ['dependencies'],
      properties: {
        dependencies: {
          type: 'array', maxItems: 6,
          items: {
            type: 'object', additionalProperties: false,
            required: ['sourceRequest', 'targetRequest', 'field', 'note'],
            properties: {
              sourceRequest: { type: 'string' },
              targetRequest: { type: 'string' },
              field: { type: 'string' },
              note: { type: 'string' },
            },
          },
        },
      },
    },
    latencyProfile: {
      type: 'object', additionalProperties: false,
      required: ['avgMs', 'minMs', 'maxMs', 'bottleneck', 'tier', 'entries'],
      properties: {
        avgMs: { type: 'number' },
        minMs: { type: 'number' },
        maxMs: { type: 'number' },
        bottleneck: { type: ['string', 'null'] },
        tier: { type: 'string', enum: ['optimal', 'stable', 'slow'] },
        entries: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            required: ['title', 'duration', 'tier'],
            properties: {
              title: { type: 'string' },
              duration: { type: 'number' },
              tier: { type: 'string', enum: ['optimal', 'stable', 'slow'] },
            },
          },
        },
      },
    },
  },
} as const;

function scenarioHealthSystemPrompt(lang: AppSettings['language']): string {
  return `You are the Scenario Health engine for Elqira, an AI-powered API client. \
Your task is to deeply analyze a set of HTTP request/response pairs that belong to the same scenario and produce a structured, developer-focused health report. \
${getLanguageInstruction(lang)}

Analyze the following four dimensions with care:

1. API CONSISTENCY
   Examine whether responses from the same API resource (same host + path prefix) share a coherent JSON schema. \
   Flag fields that appear in some responses but not others (missing/extra keys). \
   Also flag when the same resource group returns status codes from different families (e.g. some 2xx and some 4xx), as this may indicate flaky endpoints or missing auth.

2. ERROR PATTERNS
   Identify all requests that returned an error status (4xx, 5xx, or status 0 for network failures). \
   Group them by status code and provide a precise, actionable diagnostic note for each group: \
   e.g. 401 → token expired or missing, 403 → RBAC misconfiguration, 404 → wrong resource ID or stale endpoint, 429 → rate limiting, 5xx → server-side bug or overload, 0 → CORS, DNS, or connectivity issue.

3. IMPLICIT DEPENDENCIES
   Look for data flowing between requests: a value produced in one response (e.g. an id, token, or URL) \
   that is likely consumed in the URL path, query params, or body of a later request. \
   Report the source request, target request, the field name, and a concise explanation of the dependency.

4. LATENCY PROFILE
   Classify each request as optimal (<300 ms), stable (300–999 ms), or slow (≥1000 ms). \
   Compute the average, min, and max latency across the scenario. \
   Identify the single biggest bottleneck (highest duration) if it exceeds 500 ms, and suggest whether it could indicate N+1 queries, missing caching, or heavy payloads.

Write a concise executive summary that synthesises the most important findings across all four dimensions. Output valid JSON only.`;
}

function scenarioHealthUserPrompt(scenarioTitle: string, lang: AppSettings['language']): string {
  return `Analyze all the following request/response pairs from scenario "${scenarioTitle}" and return a complete scenario health report covering all four dimensions: API consistency, error patterns, implicit dependencies, and latency profile. ${getLanguageInstruction(lang)}\n`;
}

class OpenAISmartProvider implements SmartProvider {
  async explainResponse(input: ExplainResponseInput, config: SmartRuntimeConfig): Promise<ExplainResponseResult> {
    const endpoint = config.settings.smartEndpoint?.trim() || 'https://api.openai.com/v1/responses';
    const model = config.settings.smartModel?.trim();

    console.log('[Smart][ExplainResponse] Preparing OpenAI request', {
      provider: config.settings.smartProvider,
      endpoint,
      model,
      hasApiKey: Boolean(config.apiKey?.trim()),
      requestTitle: input.request.title,
      statusCode: input.response.statusCode,
    });

    if (!model) {
      console.error('[Smart][ExplainResponse] Missing smart model configuration');
      throw new Error('Smart model is missing.');
    }

    const requestPayload = {
      request: {
        title: input.request.title,
        method: input.request.method,
        url: input.request.url,
        headers: input.request.headers.filter((h) => h.enabled && h.key.trim()),
        params: input.request.params?.filter((p) => p.enabled && p.key.trim()) ?? [],
        body: input.request.body ?? '',
      },
      response: {
        statusCode: input.response.statusCode,
        statusText: input.response.statusText,
        duration: input.response.duration,
        headers: input.response.headers,
        body: input.response.body,
      },
    };

    let res: globalThis.Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          instructions:
            `You are the Smart Explain engine for Elqira. Explain API responses for developers in concise, useful language. Output valid JSON only. ${getLanguageInstruction(config.settings.language)}`,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                text:
                  `Analyze this API request/response pair and return a concise JSON explanation for developers. ${getLanguageInstruction(config.settings.language)}\n` +
                  JSON.stringify(requestPayload, null, 2),
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'explain_response',
              strict: true,
              schema: explainResponseSchema,
            },
          },
        }),
      });
    } catch (error) {
      console.error('[Smart][ExplainResponse] Network failure while calling OpenAI', error);
      throw error;
    }

    console.log('[Smart][ExplainResponse] OpenAI response received', {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Smart][ExplainResponse] OpenAI returned non-OK response', {
        status: res.status,
        statusText: res.statusText,
        errorText,
      });
      throw new Error(errorText || `Smart request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const outputText = getResponseText(payload);
    console.log('[Smart][ExplainResponse] Parsed OpenAI payload', {
      hasOutputText: Boolean(outputText),
      outputLength: outputText.length,
    });
    const parsed = JSON.parse(outputText);

    if (!isExplainResponseResult(parsed)) {
      console.error('[Smart][ExplainResponse] Invalid structured output payload', parsed);
      throw new Error('Invalid Smart Explain payload.');
    }

    return parsed;
  }

  async debugResponse(input: ExplainResponseInput, config: SmartRuntimeConfig): Promise<DebugResponseResult> {
    const endpoint = config.settings.smartEndpoint?.trim() || 'https://api.openai.com/v1/responses';
    const model = config.settings.smartModel?.trim();

    if (!model) throw new Error('Smart model is missing.');

    const requestPayload = {
      request: {
        title: input.request.title,
        method: input.request.method,
        url: input.request.url,
        headers: input.request.headers.filter((h) => h.enabled && h.key.trim()),
        params: input.request.params?.filter((p) => p.enabled && p.key.trim()) ?? [],
        body: input.request.body ?? '',
      },
      response: {
        statusCode: input.response.statusCode,
        statusText: input.response.statusText,
        duration: input.response.duration,
        headers: input.response.headers,
        body: input.response.body,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: `You are the Smart Debug engine for Elqira. Analyze API error responses and identify root causes and suggested fixes for developers. Output valid JSON only. ${getLanguageInstruction(config.settings.language)}`,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  `Analyze this failed API request/response and return a JSON debug analysis. ${getLanguageInstruction(config.settings.language)}\n` +
                  JSON.stringify(requestPayload, null, 2),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'debug_response',
            strict: true,
            schema: debugResponseSchema,
          },
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Smart Debug request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const outputText = getResponseText(payload);
    const parsed = JSON.parse(outputText) as DebugResponseResult;
    return parsed;
  }

  async compareResponse(input: CompareResponseInput, config: SmartRuntimeConfig): Promise<CompareResponseResult> {
    const endpoint = config.settings.smartEndpoint?.trim() || 'https://api.openai.com/v1/responses';
    const model = config.settings.smartModel?.trim();

    if (!model) throw new Error('Smart model is missing.');

    const comparePayload = {
      request: {
        title: input.request.title,
        method: input.request.method,
        url: input.request.url,
      },
      baseline: {
        statusCode: input.baseline.statusCode,
        statusText: input.baseline.statusText,
        duration: input.baseline.duration,
        body: input.baseline.body,
      },
      current: {
        statusCode: input.current.statusCode,
        statusText: input.current.statusText,
        duration: input.current.duration,
        body: input.current.body,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: `You are the Smart Compare engine for Elqira. Compare two API responses (baseline vs current) and identify semantic differences, regressions, and changes. Output valid JSON only. ${getLanguageInstruction(config.settings.language)}`,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  `Compare these two API responses (baseline vs current) for the same request and return a semantic diff analysis. ${getLanguageInstruction(config.settings.language)}\n` +
                  JSON.stringify(comparePayload, null, 2),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'compare_response',
            strict: true,
            schema: compareResponseSchema,
          },
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Smart Compare request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const outputText = getResponseText(payload);
    const parsed = JSON.parse(outputText) as CompareResponseResult;
    return parsed;
  }

  async scenarioHealth(input: ScenarioHealthInput, config: SmartRuntimeConfig): Promise<ScenarioHealthReportResult> {
    const endpoint = config.settings.smartEndpoint?.trim() || 'https://api.openai.com/v1/responses';
    const model = config.settings.smartModel?.trim();
    if (!model) throw new Error('Smart model is missing.');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model,
        instructions: scenarioHealthSystemPrompt(config.settings.language),
        input: [{
          role: 'user',
          content: [{
            type: 'input_text',
            text: scenarioHealthUserPrompt(input.scenarioTitle, config.settings.language) +
              JSON.stringify(input.pairs, null, 2),
          }],
        }],
        text: {
          format: { type: 'json_schema', name: 'scenario_health', strict: true, schema: scenarioHealthSchema },
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Smart Scenario Health request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const outputText = getResponseText(payload);
    return JSON.parse(outputText) as ScenarioHealthReportResult;
  }
}

class GoogleSmartProvider implements SmartProvider {
  async explainResponse(input: ExplainResponseInput, config: SmartRuntimeConfig): Promise<ExplainResponseResult> {
    const model = config.settings.smartModel?.trim();

    if (!model) {
      console.error('[Smart][ExplainResponse] Missing smart model configuration for Google');
      throw new Error('Smart model is missing.');
    }

    const endpoint =
      config.settings.smartEndpoint?.trim() ||
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    const requestPayload = {
      request: {
        title: input.request.title,
        method: input.request.method,
        url: input.request.url,
        headers: input.request.headers.filter((h) => h.enabled && h.key.trim()),
        params: input.request.params?.filter((p) => p.enabled && p.key.trim()) ?? [],
        body: input.request.body ?? '',
      },
      response: {
        statusCode: input.response.statusCode,
        statusText: input.response.statusText,
        duration: input.response.duration,
        headers: input.response.headers,
        body: input.response.body,
      },
    };

    console.log('[Smart][ExplainResponse] Preparing Google request', {
      provider: config.settings.smartProvider,
      endpoint,
      model,
      hasApiKey: Boolean(config.apiKey?.trim()),
      requestTitle: input.request.title,
      statusCode: input.response.statusCode,
    });

    let res: globalThis.Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `You are the Smart Explain engine for Elqira. Explain API responses for developers in concise, useful language. Output valid JSON only. ${getLanguageInstruction(config.settings.language)}`,
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  text:
                    `Analyze this API request/response pair and return a concise JSON explanation for developers. ${getLanguageInstruction(config.settings.language)}\n` +
                    JSON.stringify(requestPayload, null, 2),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: explainResponseSchema,
          },
        }),
      });
    } catch (error) {
      console.error('[Smart][ExplainResponse] Network failure while calling Google', error);
      throw error;
    }

    console.log('[Smart][ExplainResponse] Google response received', {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Smart][ExplainResponse] Google returned non-OK response', {
        status: res.status,
        statusText: res.statusText,
        errorText,
      });
      throw new Error(errorText || `Smart request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const outputText = getGeminiText(payload);
    console.log('[Smart][ExplainResponse] Parsed Google payload', {
      hasOutputText: Boolean(outputText),
      outputLength: outputText.length,
    });

    const parsed = JSON.parse(outputText);

    if (!isExplainResponseResult(parsed)) {
      console.error('[Smart][ExplainResponse] Invalid Google structured output payload', parsed);
      throw new Error('Invalid Smart Explain payload.');
    }

    return parsed;
  }

  async debugResponse(input: ExplainResponseInput, config: SmartRuntimeConfig): Promise<DebugResponseResult> {
    const model = config.settings.smartModel?.trim();
    if (!model) throw new Error('Smart model is missing.');

    const endpoint =
      config.settings.smartEndpoint?.trim() ||
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    const requestPayload = {
      request: {
        title: input.request.title,
        method: input.request.method,
        url: input.request.url,
        headers: input.request.headers.filter((h) => h.enabled && h.key.trim()),
        params: input.request.params?.filter((p) => p.enabled && p.key.trim()) ?? [],
        body: input.request.body ?? '',
      },
      response: {
        statusCode: input.response.statusCode,
        statusText: input.response.statusText,
        duration: input.response.duration,
        headers: input.response.headers,
        body: input.response.body,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `You are the Smart Debug engine for Elqira. Analyze API error responses and identify root causes and suggested fixes for developers. Output valid JSON only. ${getLanguageInstruction(config.settings.language)}`,
            },
          ],
        },
        contents: [
          {
            parts: [
              {
                text:
                  `Analyze this failed API request/response and return a JSON debug analysis. ${getLanguageInstruction(config.settings.language)}\n` +
                  JSON.stringify(requestPayload, null, 2),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: debugResponseSchema,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Smart Debug request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const outputText = getGeminiText(payload);
    const parsed = JSON.parse(outputText) as DebugResponseResult;
    return parsed;
  }

  async compareResponse(input: CompareResponseInput, config: SmartRuntimeConfig): Promise<CompareResponseResult> {
    const model = config.settings.smartModel?.trim();
    if (!model) throw new Error('Smart model is missing.');

    const endpoint =
      config.settings.smartEndpoint?.trim() ||
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    const comparePayload = {
      request: {
        title: input.request.title,
        method: input.request.method,
        url: input.request.url,
      },
      baseline: {
        statusCode: input.baseline.statusCode,
        statusText: input.baseline.statusText,
        duration: input.baseline.duration,
        body: input.baseline.body,
      },
      current: {
        statusCode: input.current.statusCode,
        statusText: input.current.statusText,
        duration: input.current.duration,
        body: input.current.body,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `You are the Smart Compare engine for Elqira. Compare two API responses (baseline vs current) and identify semantic differences, regressions, and changes. Output valid JSON only. ${getLanguageInstruction(config.settings.language)}`,
            },
          ],
        },
        contents: [
          {
            parts: [
              {
                text:
                  `Compare these two API responses (baseline vs current) for the same request and return a semantic diff analysis. ${getLanguageInstruction(config.settings.language)}\n` +
                  JSON.stringify(comparePayload, null, 2),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: compareResponseSchema,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Smart Compare request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const outputText = getGeminiText(payload);
    const parsed = JSON.parse(outputText) as CompareResponseResult;
    return parsed;
  }

  async scenarioHealth(input: ScenarioHealthInput, config: SmartRuntimeConfig): Promise<ScenarioHealthReportResult> {
    const model = config.settings.smartModel?.trim();
    if (!model) throw new Error('Smart model is missing.');

    const endpoint =
      config.settings.smartEndpoint?.trim() ||
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: scenarioHealthSystemPrompt(config.settings.language),
          }],
        },
        contents: [{
          parts: [{
            text: scenarioHealthUserPrompt(input.scenarioTitle, config.settings.language) +
              JSON.stringify(input.pairs, null, 2),
          }],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: scenarioHealthSchema,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Smart Scenario Health request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const outputText = getGeminiText(payload);
    return JSON.parse(outputText) as ScenarioHealthReportResult;
  }
}

function resolveProvider(config: SmartRuntimeConfig): SmartProvider {
  const provider = config.settings.smartProvider?.trim().toLowerCase();

  if (provider === 'openai') return new OpenAISmartProvider();
  if (provider === 'gemini' || provider === 'google') return new GoogleSmartProvider();
  throw new Error('Selected smart provider is not supported yet.');
}

export async function runExplainResponse(
  input: ExplainResponseInput,
  config: SmartRuntimeConfig
): Promise<ExplainResponseResult> {
  if (!config.settings.smartEnabled) {
    console.error('[Smart][ExplainResponse] Smart features are disabled');
    throw new Error('Smart features are disabled.');
  }

  if (!config.apiKey.trim()) {
    console.error('[Smart][ExplainResponse] Missing API key in runtime session');
    throw new Error('Smart API key is missing for this session.');
  }

  console.log('[Smart][ExplainResponse] Resolving provider', {
    provider: config.settings.smartProvider,
    model: config.settings.smartModel,
  });
  return resolveProvider(config).explainResponse(input, config);
}

export async function runDebugResponse(
  input: ExplainResponseInput,
  config: SmartRuntimeConfig
): Promise<DebugResponseResult> {
  if (!config.settings.smartEnabled) {
    throw new Error('Smart features are disabled.');
  }

  if (!config.apiKey.trim()) {
    throw new Error('Smart API key is missing for this session.');
  }

  return resolveProvider(config).debugResponse(input, config);
}

export async function runCompareResponse(
  input: CompareResponseInput,
  config: SmartRuntimeConfig
): Promise<CompareResponseResult> {
  if (!config.settings.smartEnabled) {
    throw new Error('Smart features are disabled.');
  }

  if (!config.apiKey.trim()) {
    throw new Error('Smart API key is missing for this session.');
  }

  return resolveProvider(config).compareResponse(input, config);
}

export async function runScenarioHealth(
  input: ScenarioHealthInput,
  config: SmartRuntimeConfig
): Promise<ScenarioHealthReportResult> {
  if (!config.settings.smartEnabled) {
    throw new Error('Smart features are disabled.');
  }

  if (!config.apiKey.trim()) {
    throw new Error('Smart API key is missing for this session.');
  }

  return resolveProvider(config).scenarioHealth(input, config);
}
