import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

// Mismo criterio que el catálogo de la báscula: se pide una página grande y se
// filtra en memoria. Los campamentos de una faena son una decena y sus
// habitaciones se piden ya acotadas por campamento, así que ninguna de las dos
// listas justifica una búsqueda contra el servidor.
const CATALOG_LIMIT = 200;

export const campsKeys = {
  camps: ["camps", "catalog"] as const,
  rooms: (campId: number | undefined) => ["camps", "rooms", campId ?? "all"] as const,
};

/** Campamentos activos. Único consumidor hoy: `RoomSelect`, para elegir destino. */
export function useCamps() {
  return useQuery({
    queryKey: campsKeys.camps,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/camps/", {
        params: { query: { is_active: true, limit: CATALOG_LIMIT } },
      });
      if (error) throw error;
      return data.items;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Habitaciones de un campamento.
 *
 * `campId` es opcional para que el mismo hook resuelva también el caso
 * inverso: cuando `RoomSelect` recibe una habitación ya elegida (al editar un
 * trabajador) y necesita deducir a qué campamento pertenece antes de que el
 * operador haya tocado nada.
 */
export function useRooms(campId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: campsKeys.rooms(campId),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/rooms/", {
        params: { query: { camp_id: campId, is_active: true, limit: CATALOG_LIMIT } },
      });
      if (error) throw error;
      return data.items;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
