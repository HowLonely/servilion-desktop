import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

import type { components } from "@/lib/api/schema";

type WeighInOut = components["schemas"]["WeighInOut"];
type WeighInIn = components["schemas"]["WeighInIn"];

export const weighingKeys = {
  all: ["weighing"] as const,
  shift: ["weighing", "shift"] as const,
  pending: ["weighing", "pending"] as const,
};

// Techo de sugerencias al tipear el ref: completa lo que ya se está
// escribiendo, no reemplaza la búsqueda exacta por ref completo.
export const PENDING_SUGGESTIONS_LIMIT = 30;

// Cuántos pesajes del turno se muestran en la báscula. Es una lista para
// corregir lo recién hecho, no un historial: más allá de la última decena, lo
// que el operador quiere ya no está en esta pantalla sino en el panel web.
export const SHIFT_LIST_SIZE = 12;

/** Los pesajes de este operador, para reimprimir o anular el que salió mal. */
export function useShiftWeighIns() {
  return useQuery({
    queryKey: weighingKeys.shift,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/weighing/", {
        params: { query: { mine: true, limit: SHIFT_LIST_SIZE } },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateWeighIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WeighInIn): Promise<WeighInOut> => {
      const { data, error } = await api.POST("/api/weighing/", { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: weighingKeys.all });
    },
  });
}

export function useVoidWeighIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const { data, error } = await api.POST("/api/weighing/{weigh_in_id}/void", {
        params: { path: { weigh_in_id: id } },
        body: { reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: weighingKeys.all });
    },
  });
}

/**
 * Trae los datos de impresión de un pesaje y los manda a la etiquetera.
 *
 * No se cachea: cada reimpresión debe volver a pedir el estado real. Si el
 * pesaje se anuló desde otra terminal, el servidor lo dirá y no se gastará un
 * rollo de adhesivos en un morral que ya no existe.
 */
export function usePrintWeighLabels() {
  return useMutation({
    mutationFn: async (weighInId: number) => {
      const { data, error } = await api.GET("/api/weighing/{weigh_in_id}/print", {
        params: { path: { weigh_in_id: weighInId } },
      });
      if (error) throw error;

      const result = await window.servilion.printer.weighLabels(data);
      if (!result.ok) throw new Error(result.detail);
      return data;
    },
  });
}

/**
 * Pesajes pendientes de digitalizar, para sugerir mientras se tipea el ref.
 *
 * Sin `mine`: quien digitaliza no es necesariamente quien pesó el morral, así
 * que la lista cubre a todo el turno y no solo lo que pesó este operador.
 * Se refresca sola cada 30s porque es una cola operativa: si no se toca la
 * pantalla, igual va a cambiar por lo que pesan otras básculas.
 */
export function usePendingWeighIns() {
  return useQuery({
    queryKey: weighingKeys.pending,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/weighing/", {
        params: { query: { status: "PENDIENTE", limit: PENDING_SUGGESTIONS_LIMIT } },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}

/**
 * Busca el pesaje pendiente de un ref para que la digitación lo consuma.
 *
 * Es una mutación y no una query porque se dispara al terminar de tipear o
 * pistolear el ref, no al montar la pantalla: es una acción del operador.
 */
export function useFindPendingWeighIn() {
  return useMutation({
    mutationFn: async (reference: string): Promise<WeighInOut> => {
      const { data, error } = await api.GET("/api/weighing/pending/{reference}", {
        params: { path: { reference } },
      });
      if (error) throw error;
      return data;
    },
  });
}
