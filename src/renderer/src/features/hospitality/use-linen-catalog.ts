import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

// Mismo criterio que el catálogo de la báscula: se pide una página grande y se
// filtra en memoria. Los contratos de hotelería son un puñado; pedirlos por
// búsqueda obligaría a un viaje al servidor por cada letra tecleada en una
// terminal sin teclado. Los campamentos viven en `features/camps/use-camps.ts`,
// compartido con el selector de habitación del módulo de trabajadores.
const CATALOG_LIMIT = 200;

export const linenCatalogKeys = {
  companies: ["hospitality", "catalog", "companies"] as const,
};

export { useCamps } from "@/features/camps/use-camps";

/**
 * Empresas con contrato de hotelería.
 *
 * El filtro es del cliente porque `GET /api/companies/` no expone
 * `service_type` como parámetro, solo en la respuesta. Filtrar aquí no es
 * cosmético: el backend rechaza un lote contra una empresa PERSONAL, así que
 * ofrecerla sería ofrecer un 400 seguro.
 */
export function useHospitalityCompanies() {
  const query = useQuery({
    queryKey: linenCatalogKeys.companies,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/companies/", {
        params: { query: { is_active: true, limit: CATALOG_LIMIT } },
      });
      if (error) throw error;
      return data.items;
    },
    staleTime: 5 * 60 * 1000,
  });

  const companies = useMemo(
    () => (query.data ?? []).filter((company) => company.service_type === "HOTELERIA"),
    [query.data],
  );

  return { ...query, companies };
}
