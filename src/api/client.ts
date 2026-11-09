import axios, { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  listLeaderboard,
  listMatches,
  latencyMs,
  registerMatch,
  shouldFail,
  isEmpty,
} from './mockServer';
import type { NewMatchInput } from './types';

type Mode = 'network' | 'local';
let mode: Mode = 'local';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function respond<T>(config: InternalAxiosRequestConfig, status: number, data: T): AxiosResponse<T> {
  return { data, status, statusText: status === 200 || status === 201 ? 'OK' : 'Error', headers: {}, config };
}

/** In-process REST surface used when a service worker is unavailable (single-file demo). */
const localAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const rawUrl = config.url ?? '';
  const url = new URL(rawUrl, window.location.origin);
  const params = new URLSearchParams(url.search);
  Object.entries(config.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });

  await delay(latencyMs());

  if (shouldFail()) {
    throw new AxiosError('Mock upstream is unavailable', 'ERR_BAD_RESPONSE', config, null, respond(config, 503, { message: 'Upstream unavailable' }));
  }

  if (method === 'GET' && url.pathname === '/api/leaderboard') {
    if (isEmpty()) {
      return respond(config, 200, { items: [], page: 1, pageSize: 8, total: 0, totalPages: 1 });
    }
    const page = Number(params.get('page') ?? 1);
    const pageSize = Number(params.get('pageSize') ?? 8);
    const configKey = params.get('configKey') ?? undefined;
    return respond(config, 200, listLeaderboard(page, pageSize, configKey));
  }

  if (method === 'GET' && url.pathname === '/api/matches') {
    if (isEmpty()) {
      return respond(config, 200, { items: [], page: 1, pageSize: 8, total: 0, totalPages: 1 });
    }
    const playerId = params.get('playerId') ?? '';
    const page = Number(params.get('page') ?? 1);
    const pageSize = Number(params.get('pageSize') ?? 8);
    return respond(config, 200, listMatches(playerId, page, pageSize));
  }

  if (method === 'POST' && url.pathname === '/api/matches') {
    const body = (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) as NewMatchInput;
    const { record, created } = registerMatch(body);
    return respond(config, created ? 201 : 200, record);
  }

  throw new AxiosError(`No mock route for ${method} ${url.pathname}`, 'ERR_NOT_FOUND', config, null, respond(config, 404, { message: 'Not found' }));
};

const wired = axios.create({ timeout: 12_000 });
const local = axios.create({ timeout: 12_000, adapter: localAdapter });

function client() {
  return mode === 'network' ? wired : local;
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => client().get<T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client().post<T>(url, data, config),
};

/**
 * Prefer real network mocks (MSW) everywhere except the single-file build,
 * where service workers are not available in the sandboxed preview.
 */
export async function initApiLayer(): Promise<Mode> {
  if (import.meta.env.MODE === 'single' || import.meta.env.VITE_LOCAL_API === 'true') {
    mode = 'local';
    return mode;
  }
  try {
    const { worker } = await import('../mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      quiet: true,
    });
    mode = 'network';
  } catch {
    mode = 'local';
  }
  return mode;
}

export function apiMode(): Mode {
  return mode;
}
