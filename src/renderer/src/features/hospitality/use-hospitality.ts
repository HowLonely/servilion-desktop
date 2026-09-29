import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import type { components } from "@/lib/api/schema";

type DispatchIn = components["schemas"]["DispatchIn"];
type LinenMovementOut = components["schemas"]["LinenMovementOut"];

export const hospitalityKeys = {
  all: ["hospitality"] as const,
  balances: ["hospitality", "balances"] as const,
  recentDispatches: ["hospitality", "recent-dispatches"] as const,
};

// Cuántos despachos recientes muestra la terminal para reimprimir la guía. Es
// una lista de trabajo del turno, no un historial: eso está en el panel web.
export const RECENT_DISPATCHES = 8;

/**
 * Saldo de hotelería de todos los clientes de hotelería.
 *
 * Una sola respuesta alcanza para todo en esta terminal: la lista de clientes a
 * los que se despacha, los tipos de hotelería de cada uno y los saldos.
 */
export function useBalances() {
  return useQuery({
    queryKey: hospitalityKeys.balances,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/hospitality/balances");
      if (error) throw error;
      return data;
    },
    // Los repartos y retiros llegan desde la app móvil sin que esta terminal
    // haga nada: se refresca sola para no mostrar un saldo viejo.
    refetchInterval: 60_000,
  });
}

export function useRecentDispatches() {
  return useQuery({
    queryKey: hospitalityKeys.recentDispatches,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/hospitality/movements", {
        params: { query: { kind: "DESPACHO", include_voided: false, limit: RECENT_DISPATCHES } },
      });
      if (error) throw error;
      return data.items;
    },
  });
}

export function useRegisterDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: DispatchIn): Promise<LinenMovementOut> => {
      const { data, error } = await api.POST("/api/hospitality/dispatches", { body });
      if (error) throw parseApiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalityKeys.all });
    },
  });
}

/**
 * Trae la guía de un despacho y la manda a la impresora de documentos.
 *
 * No se cachea, igual que las etiquetas del pesaje: si el despacho se anuló
 * desde la web, el servidor lo rechaza y no se imprime una guía que ya no vale.
 */
export function usePrintLinenDispatch() {
  return useMutation({
    mutationFn: async (movementId: number) => {
      const { data, error } = await api.GET("/api/hospitality/movements/{movement_id}/print", {
        params: { path: { movement_id: movementId } },
      });
      if (error) throw new Error(parseApiError(error).detail);

      const result = await window.servilion.printer.linenDispatch(data);
      if (!result.ok) throw new Error(result.detail);
      return data;
    },
  });
}
