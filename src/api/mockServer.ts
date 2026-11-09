import type { Difficulty, WindSetting } from '../game/types';
import type {
  LeaderboardRow,
  MatchRecord,
  MockScenario,
  NewMatchInput,
  Paginated,
} from './types';

const DB_KEY = 'wormageddon.mockdb.v1';
const SCENARIO_KEY = 'wormageddon.netScenario.v1';

interface Db {
  matches: MatchRecord[];
  seededAt: string;
}

function safeRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // opaque-origin iframes cannot persist; in-memory state still works
  }
}

const memoryDb: { current: Db | null } = { current: null };

const FIXTURE_PLAYERS = [
  'VerminViper',
  'DirtDauber',
  'Boomhauer',
  'Wormhole',
  'GrenadeGus',
  'TNTina',
  'Sapper',
  'Mudlark',
  'Fuse',
  'Nibbler',
  'Shrapnel',
  'Hollow',
];

const CONFIGS: Array<{ turnSeconds: number; wind: WindSetting; difficulty: Difficulty }> = [
  { turnSeconds: 45, wind: 'light', difficulty: 'veteran' },
  { turnSeconds: 45, wind: 'light', difficulty: 'rookie' },
  { turnSeconds: 60, wind: 'strong', difficulty: 'veteran' },
  { turnSeconds: 30, wind: 'off', difficulty: 'elite' },
  { turnSeconds: 45, wind: 'strong', difficulty: 'elite' },
  { turnSeconds: 60, wind: 'light', difficulty: 'veteran' },
];

export function keyOf(turnSeconds: number, wind: WindSetting, difficulty: Difficulty): string {
  return `${turnSeconds}s-${wind}-${difficulty}`;
}

function makeFixtures(): MatchRecord[] {
  const now = Date.now();
  const rows: MatchRecord[] = [];
  FIXTURE_PLAYERS.forEach((name, index) => {
    for (let round = 0; round < CONFIGS.length; round += 1) {
      const cfg = CONFIGS[round];
      const score = 420 + ((index * 137 + round * 251) % 1180);
      const created = new Date(now - (index * 3 + round) * 36e5 - 864e5).toISOString();
      const configKey = keyOf(cfg.turnSeconds, cfg.wind, cfg.difficulty);
      rows.push({
        id: `fixture-${index}-${round}`,
        clientMatchId: `fixture-${index}-${round}`,
        matchId: `M-${(index + 1) * 100 + round}`,
        playerId: `bot-${index}`,
        playerName: name,
        teamName: index % 2 === 0 ? 'Ironclad' : 'Rustbelt',
        score,
        durationSeconds: 140 + ((index * 41 + round * 67) % 420),
        endReason: round === 0 ? 'time' : 'wipeout',
        configKey,
        turnSeconds: cfg.turnSeconds,
        wind: cfg.wind,
        difficulty: cfg.difficulty,
        kills: 1 + ((index + round) % 3),
        createdAt: created,
      });
    }
  });
  return rows;
}

function getDb(): Db {
  if (memoryDb.current) return memoryDb.current;
  const loaded = safeRead<Db>(DB_KEY);
  if (loaded && Array.isArray(loaded.matches)) {
    memoryDb.current = loaded;
    return loaded;
  }
  const fresh: Db = { matches: makeFixtures(), seededAt: new Date().toISOString() };
  memoryDb.current = fresh;
  safeWrite(DB_KEY, fresh);
  return fresh;
}

function persist(db: Db): void {
  memoryDb.current = db;
  safeWrite(DB_KEY, db);
}

export function getScenario(): MockScenario {
  const value = safeRead<MockScenario>(SCENARIO_KEY);
  return value === 'slow' || value === 'empty' || value === 'error' ? value : 'normal';
}

export function setScenario(scenario: MockScenario): void {
  safeWrite(SCENARIO_KEY, scenario);
}

export function resetMockData(): void {
  memoryDb.current = null;
  safeWrite(DB_KEY, null);
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    // ignore
  }
  getDb();
}

export function latencyMs(): number {
  const scenario = getScenario();
  if (scenario === 'slow') return 1500;
  if (scenario === 'normal') return 120;
  return 260;
}

export function shouldFail(): boolean {
  return getScenario() === 'error';
}

export function isEmpty(): boolean {
  return getScenario() === 'empty';
}

export function listLeaderboard(page: number, pageSize: number, configKey?: string): Paginated<LeaderboardRow> {
  const db = getDb();
  const relevant = db.matches.filter((m) => (configKey ? m.configKey === configKey : true));
  const best = new Map<string, MatchRecord>();
  for (const match of relevant) {
    const current = best.get(match.playerId);
    if (!current || match.score > current.score) best.set(match.playerId, match);
  }
  const sorted = [...best.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.durationSeconds !== b.durationSeconds) return a.durationSeconds - b.durationSeconds;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const rows: LeaderboardRow[] = sorted.map((m, index) => ({
    rank: index + 1,
    playerId: m.playerId,
    playerName: m.playerName,
    teamName: m.teamName,
    score: m.score,
    kills: m.kills,
    durationSeconds: m.durationSeconds,
    configKey: m.configKey,
    createdAt: m.createdAt,
  }));
  return paginate(rows, page, pageSize);
}

export function listMatches(playerId: string, page: number, pageSize: number): Paginated<MatchRecord> {
  const db = getDb();
  const rows = db.matches
    .filter((m) => m.playerId === playerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(rows, page, pageSize);
}

export function registerMatch(input: NewMatchInput): { record: MatchRecord; created: boolean } {
  const db = getDb();
  const existing = db.matches.find((m) => m.clientMatchId === input.clientMatchId);
  if (existing) return { record: existing, created: false };

  const record: MatchRecord = {
    id: `match-${Math.random().toString(36).slice(2, 10)}`,
    matchId: `M-${Date.now().toString(36).toUpperCase()}`,
    clientMatchId: input.clientMatchId,
    playerId: input.playerId,
    playerName: input.playerName,
    teamName: input.teamName,
    score: Math.round(input.score),
    durationSeconds: Math.round(input.durationSeconds),
    endReason: input.endReason,
    configKey: keyOf(input.turnSeconds, input.wind, input.difficulty),
    turnSeconds: input.turnSeconds,
    wind: input.wind,
    difficulty: input.difficulty,
    kills: input.kills,
    createdAt: new Date().toISOString(),
  };
  const next: Db = { ...db, matches: [...db.matches, record] };
  persist(next);
  return { record, created: true };
}

function paginate<T>(rows: T[], page: number, pageSize: number): Paginated<T> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.max(1, Math.min(50, Math.floor(pageSize) || 8));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const start = (safePage - 1) * safeSize;
  return {
    items: rows.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    total,
    totalPages,
  };
}

export const MOCK_TOTAL_FIXTURES = FIXTURE_PLAYERS.length;
