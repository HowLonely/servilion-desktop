import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import type { components } from "@/lib/api/schema";

type GarmentTypeOut = components["schemas"]["GarmentTypeOut"];
type GarmentTypeIn = components["schemas"]["GarmentTypeIn"];

export type GarmentFilters = {
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

export const garmentTypesKeys = {
  all: ["garment-types"] as const,
  list: (filters: GarmentFilters) => ["garment-types", "list", filters] as const,
};

// El listado del backend está paginado (limit/offset).
export const GARMENT_TYPES_PAGE_SIZE = 25;

// Tope para selectores (ej. el detalle de prendas al crear una guía): el
// catálogo se recorre entero solo cuando hace falta elegir un tipo, así que
// alcanza con una página grande ordenada por nombre.
export const GARMENT_TYPES_SELECT_LIMIT = 200;

export function useGarmentTypes(filters: GarmentFilters = {}) {
  return useQuery({
    queryKey: garmentTypesKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/garments/", {
        params: { query: filters },
      });
      if (error) throw error;
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useCreateGarmentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: GarmentTypeIn) => {
      const { data, error } = await api.POST("/api/garments/", { body });
      if (error) throw parseApiError(error);
      return data as GarmentTypeOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: garmentTypesKeys.all });
    },
  });
}

export function useUpdateGarmentType(garmentTypeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: GarmentTypeIn) => {
      const { data, error } = await api.PUT("/api/garments/{garment_type_id}", {
        params: { path: { garment_type_id: garmentTypeId } },
        body,
      });
      if (error) throw parseApiError(error);
      return data as GarmentTypeOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: garmentTypesKeys.all });
    },
  });
}
