import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import type { components } from "@/lib/api/schema";

type LaundryOrderOut = components["schemas"]["LaundryOrderOut"];
type LaundryOrderIn = components["schemas"]["LaundryOrderIn"];
type PackingProgressOut = components["schemas"]["PackingProgressOut"];

export type OrderFilters = {
  status?: string;
  company_id?: number;
  client_id?: number;
  worker_id?: number;
  search?: string;
  date_from: string;
  date_to: string;
  limit?: number;
  offset?: number;
};

export const ordersKeys = {
  all: ["orders"] as const,
  list: (filters: OrderFilters) => ["orders", "list", filters] as const,
  detail: (id: number) => ["orders", "detail", id] as const,
  packing: (id: number) => ["orders", "packing", id] as const,
  receipt: (id: number) => ["orders", "receipt", id] as const,
  counters: ["orders", "counters"] as const,
};

// El listado del backend está paginado (limit/offset): el histórico legado ronda
// las 280.000 guías, así que nunca se piden todas.
export const ORDERS_PAGE_SIZE = 25;

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ordersKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/orders/", {
        params: { query: { limit: ORDERS_PAGE_SIZE, ...filters } },
      });
      if (error) throw error;
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useOrder(orderId: number | undefined) {
  return useQuery({
    queryKey: ordersKeys.detail(orderId ?? -1),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/orders/{order_id}", {
        params: { path: { order_id: orderId! } },
      });
      if (error) throw error;
      return data;
    },
    enabled: orderId !== undefined,
  });
}

export function useOrderReceipt(orderId: number) {
  return useQuery({
    queryKey: ordersKeys.receipt(orderId),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/orders/{order_id}/receipt", {
        params: { path: { order_id: orderId } },
      });
      if (error) throw error;
      return data;
    },
  });
}

// Contadores ENTREGADOS / DESPACHADOS de la operación en faena.
export function useOrderCounters() {
  return useQuery({
    queryKey: ordersKeys.counters,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/orders/counters");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LaundryOrderIn) => {
      const { data, error } = await api.POST("/api/orders/", { body });
      if (error) throw parseApiError(error);
      return data as LaundryOrderOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });
}

export function useUpdateOrderStatus(orderId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status: string; note: string }) => {
      const { data, error } = await api.PATCH("/api/orders/{order_id}/status", {
        params: { path: { order_id: orderId } },
        body,
      });
      if (error) throw parseApiError(error);
      return data as LaundryOrderOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });
}

// Resuelve una guía a partir de un código pistoleado (ref, OT o control). La usa
// la estación de empaque para abrir el morral al escanear cualquier prenda.
export function useFindOrderByCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await api.GET("/api/orders/scan/{code}", {
        params: { path: { code } },
      });
      if (error) throw parseApiError(error);
      return data as LaundryOrderOut;
    },
  });
}

// La recepción en lavandería no es una acción aparte: ocurre al ingresar la
// guía (`useCreateOrder` fija `laundry_received_at`), así que no hay hook manual.

// --- Paso 6: pistoleo de empaque del morral limpio ---

export function usePackingProgress(orderId: number, enabled: boolean) {
  return useQuery({
    queryKey: ordersKeys.packing(orderId),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/orders/{order_id}/packing", {
        params: { path: { order_id: orderId } },
      });
      if (error) throw error;
      return data;
    },
    enabled,
  });
}

export function usePackingScan(orderId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { code: string; quantity: number }) => {
      const { data, error } = await api.POST(
        "/api/orders/{order_id}/packing/scan",
        { params: { path: { order_id: orderId } }, body },
      );
      if (error) throw parseApiError(error);
      return data as PackingProgressOut;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ordersKeys.packing(orderId), data);
    },
  });
}

export function useFinishPacking(orderId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { note: string }) => {
      const { data, error } = await api.POST(
        "/api/orders/{order_id}/packing/finish",
        { params: { path: { order_id: orderId } }, body },
      );
      if (error) throw parseApiError(error);
      return data as LaundryOrderOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });
}

// Resuelve una prenda que faltó al empacar (guía INCOMPLETA): encontrada
// (con su código) o comprada (con su costo). Ver MissingItemResolution.
export function useResolveMissingItem(orderId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      item_id: number;
      resolution_type: "ENCONTRADA" | "COMPRADA";
      quantity: number;
      code: string;
      purchase_cost: number | null;
      note: string;
    }) => {
      const { data, error } = await api.POST(
        "/api/orders/{order_id}/incomplete/resolve",
        { params: { path: { order_id: orderId } }, body },
      );
      if (error) throw parseApiError(error);
      return data as LaundryOrderOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      queryClient.invalidateQueries({ queryKey: ordersKeys.packing(orderId) });
    },
  });
}

// --- Paso 8: recepción del morral limpio en faena ---

export function useCleanReception(orderId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { note: string }) => {
      const { data, error } = await api.POST(
        "/api/orders/{order_id}/clean-reception",
        { params: { path: { order_id: orderId } }, body },
      );
      if (error) throw parseApiError(error);
      return data as LaundryOrderOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });
}

// --- Paso 9: entrega en habitación ---

export function useRegisterDelivery(orderId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { note: string }) => {
      const { data, error } = await api.POST("/api/orders/{order_id}/deliver", {
        params: { path: { order_id: orderId } },
        body,
      });
      if (error) throw parseApiError(error);
      return data as LaundryOrderOut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });
}
