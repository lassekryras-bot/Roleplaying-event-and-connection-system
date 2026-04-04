import { notifyNetworkFailure } from './toast';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retriable: boolean,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  endpointName?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function isRetriable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchWithHandling<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const {
    retries = 1,
    retryDelayMs = 500,
    endpointName = url,
    headers,
    ...requestInit
  } = options;

  let attempt = 0;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        ...requestInit,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      const payload = await parsePayload(response);

      if (!response.ok) {
        const retriable = isRetriable(response.status);
        throw new ApiError(
          `Request to ${endpointName} failed with status ${response.status}`,
          response.status,
          retriable,
          payload,
        );
      }

      return payload as T;
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : new ApiError(`Request to ${endpointName} could not be completed.`, 0, true, error);

      if (attempt >= retries || !apiError.retriable) {
        notifyNetworkFailure(apiError.message);
        throw apiError;
      }

      await delay(retryDelayMs * (attempt + 1));
      attempt += 1;
    }
  }

  throw new ApiError(`Request to ${endpointName} exhausted retries.`, 0, false);
}

export async function withRetryAction<T>(
  run: () => Promise<T>,
  onRetry: () => void,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    onRetry();
    throw error;
  }
}
