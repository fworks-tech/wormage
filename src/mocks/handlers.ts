import { delay, http, HttpResponse } from 'msw';
import {
  isEmpty,
  latencyMs,
  listLeaderboard,
  listMatches,
  registerMatch,
  shouldFail,
} from '../api/mockServer';
import type { NewMatchInput } from '../api/types';

export const handlers = [
  http.get('/api/leaderboard', async ({ request }) => {
    await delay(latencyMs());
    if (shouldFail()) return HttpResponse.json({ message: 'Upstream unavailable' }, { status: 503 });
    if (isEmpty()) return HttpResponse.json({ items: [], page: 1, pageSize: 8, total: 0, totalPages: 1 });
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 8);
    const configKey = url.searchParams.get('configKey') ?? undefined;
    return HttpResponse.json(listLeaderboard(page, pageSize, configKey));
  }),

  http.get('/api/matches', async ({ request }) => {
    await delay(latencyMs());
    if (shouldFail()) return HttpResponse.json({ message: 'Upstream unavailable' }, { status: 503 });
    if (isEmpty()) return HttpResponse.json({ items: [], page: 1, pageSize: 8, total: 0, totalPages: 1 });
    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId') ?? '';
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 8);
    return HttpResponse.json(listMatches(playerId, page, pageSize));
  }),

  http.post('/api/matches', async ({ request }) => {
    await delay(latencyMs());
    if (shouldFail()) return HttpResponse.json({ message: 'Upstream unavailable' }, { status: 503 });
    const body = (await request.json()) as NewMatchInput;
    if (!body?.clientMatchId) {
      return HttpResponse.json({ message: 'clientMatchId is required' }, { status: 422 });
    }
    const { record, created } = registerMatch(body);
    return HttpResponse.json(record, { status: created ? 201 : 200 });
  }),
];
