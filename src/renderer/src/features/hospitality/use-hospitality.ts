import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import type { components } from "@/lib/api/schema";

type LinenBatchOut = components["schemas"]["LinenBatchOut"];
type LinenBatchIn = components["schemas"]["LinenBatchIn"];
type ReturnCountIn = components["schemas"]["ReturnCountIn"];

export const hospitalityKeys = {
  all: ["hospitality"] as const,
  list: (status: string | undefined) => ["hospitality", "list", status] as const,
  detail: (id: number) => ["hospitality", "detail", id] as const,
};

// Cuántos lotes muestra la terminal. Es una lista de trabajo —los que están en
// planta ahora—, no un historial: el histórico completo se consulta en el panel
// web, que tiene filtros y paginación.
export const BATCH_LIST_SIZE = 25;

/**
 * Lotes de lencería, opcionalmente filtrados por estado.
 *
 * La mesa de conteo solo quiere los que siguen en planta, así que pide
 * `status` y no se trae los despachados de la semana.
 */
export function useBatches(status?: string) {
  return useQuery({
    queryKey: hospitalityKeys.list(status),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/hospitality/", {
        params: { query: { limit: BATCH_LIST_SIZE, ...(status ? { status } : {}) } },
      });
      if (error) throw error;
      return data.items;
    },
    placeholderData: (previous) => previous,
  });
}

/**
 * Los lotes que siguen en planta, que es lo único que la mesa de conteo mira.
 *
 * Son dos consultas y no una filtrada en memoria porque el listado viene
 * ordenado por fecha y paginado: en una semana movida los despachados
 * empujarían fuera de la página justo a los que quedan por contar.
 */
export function useBatchesInPlant() {
  const received = useBatches("RECIBIDO");
  const inProcess = useBatches("EN_PROCESO");

  const batches = [...(received.data ?? []), ...(inProcess.data ?? [])].sort(
    (a, b) => b.received_at.localeCompare(a.received_at),
  );

  return {
    batches,
    isLoading: received.isLoading || inProcess.isLoading,
  };
}

export function useBatch(batchId: number | undefined) {
  return useQuery({
    queryKey: hospitalityKeys.detail(batchId ?? -1),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/hospitality/{batch_id}", {
        params: { path: { batch_id: batchId! } },
      });
      if (error) throw error;
      return data;
    },
    enabled: batchId !== undefined,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LinenBatchIn) => {
      const { data, error } = await api.POST("/api/hospitality/", { body });
      if (error) throw parseApiError(error);
      return data as LinenBatchOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hospitalityKeys.all });
    },
  });
}

/**
 * Cuenta de salida del lote: cuántas piezas de cada tipo volvieron del lavado.
 *
 * Es repetible mientras el lote no se despache, porque contar cientos de
 * sábanas admite corrección y obligar a despachar para arreglar un número sería
 * peor. El backend mueve el lote a EN_PROCESO en la primera cuenta, así que la
 * terminal no declara ese estado por su cuenta.
 */
export function useRegisterReturnCount(batchId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (counts: ReturnCountIn[]) => {
      const { data, error } = await api.POST(
        "/api/hospitality/{batch_id}/return-count",
        { params: { path: { batch_id: batchId } }, body: { counts } },
      );
      if (error) throw parseApiError(error);
      return data as LinenBatchOut;
    },
    onSuccess: (batch) => {
      queryClient.setQueryData(hospitalityKeys.detail(batchId), batch);
      queryClient.invalidateQueries({ queryKey: ["hospitality", "list"] });
    },
  });
}

/**
 * Despacha la carga limpia y cierra el lote. Solo SUPERVISOR (y ADMIN): el
 * backend lo exige así porque el despacho fija la merma definitiva del lote.
 */
export function useDispatchBatch(batchId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { received_by_client: string; note: string }) => {
      const { data, error } = await api.POST(
        "/api/hospitality/{batch_id}/dispatch",
        { params: { path: { batch_id: batchId } }, body },
      );
      if (error) throw parseApiError(error);
      return data as LinenBatchOut;
    },
    onSuccess: (batch) => {
      queryClient.setQueryData(hospitalityKeys.detail(batchId), batch);
      queryClient.invalidateQueries({ queryKey: hospitalityKeys.all });
    },
  });
}
