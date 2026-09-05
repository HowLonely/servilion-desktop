import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import type { components } from "@/lib/api/schema";

type LaundryOrderOut = components["schemas"]["LaundryOrderOut"];
type LaundryOrderIn = components["schemas"]["LaundryOrderIn"];
type PackingProgressOut = components["schemas"]["PackingProgressOut"];
type PackingScanOut = components["schemas"]["PackingScanOut"];
type AmbiguousReferenceOut = components["schemas"]["AmbiguousReferenceOut"];
type ReceiptOut = components["schemas"]["ReceiptOut"];

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

// La recepción en lavandería no es una acción aparte: ocurre al ingresar la
// guía (`useCreateOrder` fija `laundry_received_at`), así que no hay hook manual.

// --- Paso 6: pistoleo de empaque del morral limpio ---

/**
 * Pistoleo único de la mesa de empaque (FLUJO_NEGOCIO.md §4, paso 6).
 *
 * Un solo endpoint para los dos códigos que hay sobre la mesa: la boleta del
 * morral lo abre, el segundo disparo lo cierra y el tercero lo despacha; la
 * etiqueta lavable de una prenda lo abre (si hacía falta) y marca la prenda en
 * el mismo gesto. El backend deduce qué toca según el estado de la guía, así
 * que el operador nunca elige modo en pantalla — que es justamente lo que la
 * terminal tiene que preservar, porque aquí no hay mouse.
 */
export function usePackingCodeScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { code: string; quantity: number }) => {
      const { data, error } = await api.POST("/api/orders/scan/packing", { body });
      // `parseApiError` devuelve el cuerpo tal cual, así que el 409 conserva
      // sus `candidates` para que la UI ofrezca elegir (ver isAmbiguousReference).
      if (error) throw parseApiError(error);
      return data as PackingScanOut;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(ordersKeys.packing(result.order.id), result.progress);
      queryClient.invalidateQueries({ queryKey: ordersKeys.detail(result.order.id) });
      queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
    },
  });
}

/**
 * El 409 del pistoleo no es un error a mostrar y ya: el `ref` se resetea cada
 * semana, así que puede calzar con más de un morral abierto. El backend manda
 * las guías candidatas para que el operador reconozca la suya por trabajador y
 * empresa, que es lo que tiene a la vista.
 */
export function isAmbiguousReference(
  error: unknown,
): error is AmbiguousReferenceOut {
  return (
    !!error &&
    typeof error === "object" &&
    "candidates" in error &&
    Array.isArray((error as AmbiguousReferenceOut).candidates)
  );
}

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

// Despacha a faena (paso 7). Es repetible: el primer disparo saca el morral
// cerrado de planta, y los siguientes despachan, en su propio envío, las
// prendas que se resolvieron después de que el morral ya viajó.
export function useDispatchOrder(orderId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { note: string }) => {
      const { data, error } = await api.POST(
        "/api/orders/{order_id}/dispatch",
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

// Resuelve una prenda que faltó al empacar (guía INCOMPLETA o ya despachada
// con el faltante a bordo): encontrada (con su código) o comprada (con su
// costo). Ver MissingItemResolution.
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

// --- Boleta del morral ---

/**
 * Trae la boleta del morral y la manda a la etiquetera de la estación.
 *
 * Es la que acompaña la ropa limpia de vuelta a faena y la que se pistolea para
 * despachar, así que no se cachea: cada impresión vuelve a pedir el estado real
 * para que el QR y el código de control salgan con lo que el servidor tiene
 * ahora, no con lo que esta pantalla vio hace diez minutos.
 */
export function usePrintReceipt(orderId: number) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.GET("/api/orders/{order_id}/receipt", {
        params: { path: { order_id: orderId } },
      });
      if (error) throw parseApiError(error);

      const result = await window.servilion.printer.receipt(data as ReceiptOut);
      if (!result.ok) throw new Error(result.detail);
      return data as ReceiptOut;
    },
  });
}
