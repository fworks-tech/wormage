import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { LeaderboardRow, MatchRecord, NewMatchInput, Paginated } from './types';

export const queryKeys = {
  leaderboard: (configKey: string, page: number, pageSize: number) =>
    ['leaderboard', configKey, page, pageSize] as const,
  matches: (playerId: string, page: number, pageSize: number) => ['matches', playerId, page, pageSize] as const,
};

export function useLeaderboard(configKey: string, page: number, pageSize = 8) {
  return useQuery({
    queryKey: queryKeys.leaderboard(configKey, page, pageSize),
    queryFn: async () => {
      const { data } = await api.get<Paginated<LeaderboardRow>>('/api/leaderboard', {
        params: { page, pageSize, configKey },
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 20_000,
    retry: 1,
  });
}

export function useMatchHistory(playerId: string, page: number, pageSize = 8) {
  return useQuery({
    queryKey: queryKeys.matches(playerId, page, pageSize),
    queryFn: async () => {
      const { data } = await api.get<Paginated<MatchRecord>>('/api/matches', {
        params: { playerId, page, pageSize },
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useRegisterMatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewMatchInput) => {
      const { data } = await api.post<MatchRecord>('/api/matches', input);
      return data;
    },
    retry: 1,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['leaderboard'] });
      void client.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export async function refreshBoards(client: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['leaderboard'] }),
    client.invalidateQueries({ queryKey: ['matches'] }),
  ]);
}
