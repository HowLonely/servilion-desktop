import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import type { components } from "@/lib/api/schema";

type WorkerOut = components["schemas"]["WorkerOut"];
type WorkerIn = components["schemas"]["WorkerIn"];

export type WorkerFilters = {
  company_id?: number;
  search?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

export const workersKeys = {
  all: ["workers"] as const,
  list: (filters: WorkerFilters) => ["workers", "list", filters] as const,
  detail: (id: number) => ["workers", "detail", id] as const,
};

// El listado del backend está paginado (limit/offset): nunca se traen todos
// los trabajadores de una vez.
export const WORKERS_PAGE_SIZE = 25;

export function useWorkers(filters: WorkerFilters = {}) {
  return useQuery({
    queryKey: workersKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/workers/", {
        params: { query: filters },
      });
      if (error) throw error;
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useWorker(workerId: number | undefined) {
  return useQuery({
    queryKey: workersKeys.detail(workerId ?? -1),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/workers/{worker_id}", {
        params: { path: { worker_id: workerId! } },
      });
      if (error) throw error;
      return data;
    },
    enabled: workerId !== undefined,
  });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WorkerIn) => {
      const { data, error } = await api.POST("/api/workers/", { body });
      if (error) throw parseApiError(error);
      return data as WorkerOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workersKeys.all });
    },
  });
}

export function useUpdateWorker(workerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WorkerIn) => {
      const { data, error } = await api.PUT("/api/workers/{worker_id}", {
        params: { path: { worker_id: workerId } },
        body,
      });
      if (error) throw parseApiError(error);
      return data as WorkerOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workersKeys.all });
    },
  });
}

export function useDeactivateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workerId: number) => {
      const { error } = await api.DELETE("/api/workers/{worker_id}", {
        params: { path: { worker_id: workerId } },
      });
      if (error) throw parseApiError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workersKeys.all });
    },
  });
}
