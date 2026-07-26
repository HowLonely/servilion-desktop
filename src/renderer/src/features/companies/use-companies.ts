import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import type { components } from "@/lib/api/schema";

type CompanyOut = components["schemas"]["CompanyOut"];
type CompanyIn = components["schemas"]["CompanyIn"];

export type CompanyFilters = {
  search?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

export const companiesKeys = {
  all: ["companies"] as const,
  list: (filters: CompanyFilters) => ["companies", "list", filters] as const,
  detail: (id: number) => ["companies", "detail", id] as const,
};

// El listado del backend está paginado (limit/offset).
export const COMPANIES_PAGE_SIZE = 25;

// Tope de resultados para selectores (dropdown de filtro, formularios): no es
// un listado completo, así que basta con la primera página ordenada por nombre.
export const COMPANIES_SELECT_LIMIT = 100;

export function useCompanies(filters: CompanyFilters = {}) {
  return useQuery({
    queryKey: companiesKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/companies/", {
        params: { query: filters },
      });
      if (error) throw error;
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useCompany(companyId: number | undefined) {
  return useQuery({
    queryKey: companiesKeys.detail(companyId ?? -1),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/companies/{company_id}", {
        params: { path: { company_id: companyId! } },
      });
      if (error) throw error;
      return data;
    },
    enabled: companyId !== undefined,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CompanyIn) => {
      const { data, error } = await api.POST("/api/companies/", { body });
      if (error) throw parseApiError(error);
      return data as CompanyOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}

export function useUpdateCompany(companyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CompanyIn) => {
      const { data, error } = await api.PUT("/api/companies/{company_id}", {
        params: { path: { company_id: companyId } },
        body,
      });
      if (error) throw parseApiError(error);
      return data as CompanyOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}

export function useDeactivateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: number) => {
      const { error } = await api.DELETE("/api/companies/{company_id}", {
        params: { path: { company_id: companyId } },
      });
      if (error) throw parseApiError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}
