import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export function invalidateGoals(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.goals });
}

export function invalidateTasks(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
}

export function invalidateGratitude(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.gratitude.entries });
}

export function invalidateFoodLogs(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.food.logs });
}

export function invalidateFinance(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
}

export function invalidateAppointments(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
}

export function invalidateAffirmations(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.affirmations });
}
