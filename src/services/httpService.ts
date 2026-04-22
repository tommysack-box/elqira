// HTTP execution service — sends the actual HTTP request
import type { Request, Response } from '../types';
import { isSafeHttpUrl } from './security';

const MAX_RESPONSE_BODY_BYTES = 2 * 1024 * 1024;

function responseTooLargeMessage(limitBytes: number): string {
  return `Response body exceeds the safe limit of ${(limitBytes / (1024 * 1024)).toFixed(0)} MB.`;
}

async function readResponseBodyWithLimit(response: globalThis.Response, limitBytes: number): Promise<string> {
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > limitBytes) {
      throw new Error(responseTooLargeMessage(limitBytes));
    }
  }

  if (!response.body) {
    const body = await response.text();
    if (new Blob([body]).size > limitBytes) {
      throw new Error(responseTooLargeMessage(limitBytes));
    }
    return body;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytesRead += value.byteLength;
      if (bytesRead > limitBytes) {
        await reader.cancel();
        throw new Error(responseTooLargeMessage(limitBytes));
      }

      body += decoder.decode(value, { stream: true });
    }

    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
}

export async function executeRequest(request: Request, timeoutMs?: number): Promise<Response> {
  const startTime = Date.now();
  if (!isSafeHttpUrl(request.url)) {
    throw new Error('Only http:// and https:// URLs are allowed.');
  }
  const requestUrl = new URL(request.url);

  // Build headers object (only enabled headers)
  const headersObj: Record<string, string> = {};
  request.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      headersObj[h.key.trim()] = h.value;
    });

  const init: RequestInit = {
    method: request.method,
    headers: headersObj,
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  if (timeoutMs) {
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    init.signal = controller.signal;
  }

  // Attach body for methods that support it
  if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
    init.body = request.body;
  }

  try {
    const res = await fetch(requestUrl.toString(), init);
    const duration = Date.now() - startTime;

    // Read response body
    const body = await readResponseBodyWithLimit(res, MAX_RESPONSE_BODY_BYTES);

    // Collect response headers
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      statusCode: res.status,
      statusText: res.statusText,
      duration,
      body,
      headers: responseHeaders,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (timedOut && error instanceof DOMException && error.name === 'AbortError') {
      const timeoutError = new Error(`Request timed out after ${timeoutMs} ms`) as Error & { duration?: number };
      timeoutError.duration = Date.now() - startTime;
      throw timeoutError;
    }

    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
