import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { parseApiError } from "@/lib/api/errors";

import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];
export type StaffUserOut = Schemas["StaffUserOut"];
export type StaffUserCreateIn = Schemas["StaffUserCreateIn"];
export type StaffUserUpdateIn = Schemas["StaffUserUpdateIn"];
export type RoleOut = Schemas["RoleOut"];
export type RoleIn = Schemas["RoleIn"];
export type PermissionOut = Schemas["PermissionOut"];
export type ClientOut = Schemas["ClientOut"];
export type ClientIn = Schemas["ClientIn"];
export type ClientPriceOut = Schemas["ClientGarmentPriceOut"];
export type FaenaOut = Schemas["FaenaOut"];
export type CampOut = Schemas["CampOut"];
export type RoomOut = Schemas["RoomOut"];
export type SyncStatusOut = Schemas["SyncStatusOut"];
export type SyncIssueOut = Schemas["SyncIssueOut"];

// Hooks de Configuración. Todas las mutaciones invalidan su familia de claves:
// lo que se crea aquí aparece de inmediato en los selectores de las
// estaciones (empresas en la báscula, prendas al digitalizar).

const keys = {
  users: ["admin", "users"] as const,
  roles: ["admin", "roles"] as const,
  permissions: ["admin", "permissions"] as const,
  clients: ["admin", "clients"] as const,
  prices: (clientId: number) => ["admin", "clients", clientId, "prices"] as const,
  faenas: ["admin", "faenas"] as const,
  camps: ["camps"] as const,
  sync: ["sync"] as const,
};

function useInvalidate(...families: (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of families) void queryClient.invalidateQueries({ queryKey });
  };
}

// --- Usuarios -------------------------------------------------------------

export type UserFilters = {
  search?: string;
  role?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

export function useStaffUsers(filters: UserFilters) {
  return useQuery({
    queryKey: [...keys.users, filters],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/users/", { params: { query: filters } });
      if (error) throw error;
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useSaveStaffUser() {
  const invalidate = useInvalidate(keys.users, keys.roles);
  return useMutation({
    mutationFn: async (
      input: { id: number; body: StaffUserUpdateIn } | { id: null; body: StaffUserCreateIn },
    ) => {
      const result =
        input.id === null
          ? await api.POST("/api/users/", { body: input.body })
          : await api.PUT("/api/users/{user_id}", {
              params: { path: { user_id: input.id } },
              body: input.body,
            });
      if (result.error) throw parseApiError(result.error);
      return result.data as StaffUserOut;
    },
    onSuccess: invalidate,
  });
}

export function useSetPassword() {
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      const { data, error } = await api.POST("/api/users/{user_id}/password", {
        params: { path: { user_id: userId } },
        body: { password },
      });
      if (error) throw parseApiError(error);
      return data;
    },
  });
}

// --- Roles ----------------------------------------------------------------

export function useRoles() {
  return useQuery({
    queryKey: keys.roles,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/roles/");
      if (error) throw error;
      return data;
    },
  });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: keys.permissions,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/roles/permissions");
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });
}

export function useSaveRole() {
  const invalidate = useInvalidate(keys.roles, keys.users);
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | null; body: RoleIn }) => {
      if (id === null) {
        const { data, error } = await api.POST("/api/roles/", { body });
        if (error) throw parseApiError(error);
        return data as RoleOut;
      }
      const { data, error } = await api.PUT("/api/roles/{role_id}", { params: { path: { role_id: id } }, body });
      if (error) throw parseApiError(error);
      return data as RoleOut;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidate(keys.roles);
  return useMutation({
    mutationFn: async (roleId: number) => {
      const { error } = await api.DELETE("/api/roles/{role_id}", {
        params: { path: { role_id: roleId } },
      });
      if (error) throw parseApiError(error);
    },
    onSuccess: invalidate,
  });
}

// --- Clientes y precios ---------------------------------------------------

export function useClients(filters: { search?: string; is_active?: boolean; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...keys.clients, filters],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/clients/", { params: { query: filters } });
      if (error) throw error;
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useSaveClient() {
  const invalidate = useInvalidate(keys.clients, ["companies"], ["weighing"]);
  return useMutation({
    mutationFn: async ({ id, body }: { id: number | null; body: ClientIn }) => {
      if (id === null) {
        const { data, error } = await api.POST("/api/clients/", { body });
        if (error) throw parseApiError(error);
        return data as ClientOut;
      }
      const { data, error } = await api.PUT("/api/clients/{client_id}", { params: { path: { client_id: id } }, body });
      if (error) throw parseApiError(error);
      return data as ClientOut;
    },
    onSuccess: invalidate,
  });
}

export function useDeactivateClient() {
  const invalidate = useInvalidate(keys.clients, ["companies"]);
  return useMutation({
    mutationFn: async (clientId: number) => {
      const { error } = await api.DELETE("/api/clients/{client_id}", {
        params: { path: { client_id: clientId } },
      });
      if (error) throw parseApiError(error);
    },
    onSuccess: invalidate,
  });
}

export function useClientPrices(clientId: number | null) {
  return useQuery({
    queryKey: keys.prices(clientId ?? -1),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/clients/{client_id}/prices", {
        params: { path: { client_id: clientId! } },
      });
      if (error) throw error;
      return data;
    },
    enabled: clientId !== null,
  });
}

export function useSaveClientPrices(clientId: number) {
  const invalidate = useInvalidate(keys.prices(clientId));
  return useMutation({
    mutationFn: async (prices: { garment_type_id: number; unit_price: number }[]) => {
      const { data, error } = await api.PUT("/api/clients/{client_id}/prices", {
        params: { path: { client_id: clientId } },
        body: { prices },
      });
      if (error) throw parseApiError(error);
      return data;
    },
    onSuccess: invalidate,
  });
}

// --- Faenas, campamentos y habitaciones -----------------------------------

const SITES_LIMIT = 200;

export function useFaenas() {
  return useQuery({
    queryKey: keys.faenas,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/faenas/", { params: { query: { limit: SITES_LIMIT } } });
      if (error) throw error;
      return data.items;
    },
  });
}

export function useSaveFaena() {
  const invalidate = useInvalidate(keys.faenas);
  return useMutation({
    mutationFn: async ({ id, name, is_active }: { id: number | null; name: string; is_active: boolean }) => {
      const body = { name, is_active };
      if (id === null) {
        const { data, error } = await api.POST("/api/faenas/", { body });
        if (error) throw parseApiError(error);
        return data as FaenaOut;
      }
      const { data, error } = await api.PUT("/api/faenas/{faena_id}", { params: { path: { faena_id: id } }, body });
      if (error) throw parseApiError(error);
      return data as FaenaOut;
    },
    onSuccess: invalidate,
  });
}

export function useAdminCamps(faenaId: number | null) {
  return useQuery({
    queryKey: [...keys.camps, "admin", faenaId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/camps/", {
        params: { query: { faena_id: faenaId!, limit: SITES_LIMIT } },
      });
      if (error) throw error;
      return data.items;
    },
    enabled: faenaId !== null,
  });
}

export function useSaveCamp() {
  const invalidate = useInvalidate(keys.camps, keys.faenas);
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number | null;
      body: { faena_id: number; name: string; is_active: boolean };
    }) => {
      if (id === null) {
        const { data, error } = await api.POST("/api/camps/", { body });
        if (error) throw parseApiError(error);
        return data as CampOut;
      }
      const { data, error } = await api.PUT("/api/camps/{camp_id}", { params: { path: { camp_id: id } }, body });
      if (error) throw parseApiError(error);
      return data as CampOut;
    },
    onSuccess: invalidate,
  });
}

export function useAdminRooms(campId: number | null) {
  return useQuery({
    queryKey: [...keys.camps, "admin-rooms", campId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/rooms/", {
        params: { query: { camp_id: campId!, limit: SITES_LIMIT } },
      });
      if (error) throw error;
      return data.items;
    },
    enabled: campId !== null,
  });
}

export function useSaveRoom() {
  const invalidate = useInvalidate(keys.camps);
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number | null;
      body: { camp_id: number; number: string; is_active: boolean };
    }) => {
      if (id === null) {
        const { data, error } = await api.POST("/api/rooms/", { body });
        if (error) throw parseApiError(error);
        return data as RoomOut;
      }
      const { data, error } = await api.PUT("/api/rooms/{room_id}", { params: { path: { room_id: id } }, body });
      if (error) throw parseApiError(error);
      return data as RoomOut;
    },
    onSuccess: invalidate,
  });
}

// --- Sincronización -------------------------------------------------------

/**
 * Estado de la sincronización del servidor. Contra el servidor local dice si
 * hay internet y cuántos cambios esperan; contra la nube, qué servidores
 * locales se ven. Se refresca solo porque cambia sin que nadie toque nada.
 */
export function useSyncStatus(enabled = true) {
  return useQuery({
    queryKey: [...keys.sync, "status"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/sync/status");
      if (error) throw error;
      return data;
    },
    enabled,
    refetchInterval: 10_000,
    retry: false,
  });
}

export function useSyncIssues(resolved: boolean | undefined, offset: number) {
  return useQuery({
    queryKey: [...keys.sync, "issues", resolved, offset],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/sync/issues", {
        params: { query: { resolved, limit: 25, offset } },
      });
      if (error) throw error;
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useResolveSyncIssue() {
  const invalidate = useInvalidate(keys.sync);
  return useMutation({
    mutationFn: async (issueId: number) => {
      const { error } = await api.POST("/api/sync/issues/{issue_id}/resolve", {
        params: { path: { issue_id: issueId } },
      });
      if (error) throw parseApiError(error);
    },
    onSuccess: invalidate,
  });
}
