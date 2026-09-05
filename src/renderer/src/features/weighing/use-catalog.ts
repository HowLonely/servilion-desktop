import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

// La báscula muestra clientes y empresas como grilla de botones, no como
// buscador: se piden de una vez y se filtran en memoria. El catálogo real ronda
// la decena de clientes y las cuarenta empresas del mayor de ellos, así que cabe
// entero y evita una petición por cada toque en la pantalla.
const CATALOG_LIMIT = 200;

export const weighingCatalogKeys = {
  clients: ["weighing", "catalog", "clients"] as const,
  companies: (clientId: number) => ["weighing", "catalog", "companies", clientId] as const,
};

export function useActiveClients() {
  return useQuery({
    queryKey: weighingCatalogKeys.clients,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/clients/", {
        params: { query: { is_active: true, limit: CATALOG_LIMIT } },
      });
      if (error) throw error;
      return data.items;
    },
    // El catálogo cambia cuando un ADMIN da de alta un cliente, no durante un
    // turno de báscula: refrescarlo en cada montaje sería ruido.
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientCompanies(clientId: number | null) {
  return useQuery({
    queryKey: weighingCatalogKeys.companies(clientId ?? -1),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/companies/", {
        params: { query: { client_id: clientId!, is_active: true, limit: CATALOG_LIMIT } },
      });
      if (error) throw error;
      return data.items;
    },
    enabled: clientId !== null,
    staleTime: 5 * 60 * 1000,
  });
}
