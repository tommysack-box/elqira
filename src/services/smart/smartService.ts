import type { AppSettings, Request, Response } from '../../types';
import type { ExplainResponseResult } from '../../features/requests/explainResponse';
import type { DebugResponseResult } from '../../features/requests/debugResponse';

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
