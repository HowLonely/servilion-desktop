import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/date";
import { useBalances } from "@/features/hospitality/use-hospitality";

import type { components } from "@/lib/api/schema";

type CompanyBalanceOut = components["schemas"]["CompanyBalanceOut"];

/**
 * Saldo de hotelería por campamento, solo de consulta.
 *
 * Corregir un saldo es un conteo de inventario y lo hace el administrador en el
 * panel web; aquí se mira para saber qué tiene cada campamento antes de armar
 * un despacho.
 */
export function BalancesPanel() {
  const { data, isLoading, error } = useBalances();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) {
    return <p className="text-base text-destructive">No se pudieron cargar los saldos.</p>;
  }
  if (data.length === 0) {
    return (
      <Card className="p-6 text-base text-muted-foreground">
        No hay empresas con contrato de hotelería.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {data.map((company) => (
        <CompanyBalances key={company.company_id} company={company} />
      ))}
    </div>
  );
}

function CompanyBalances({ company }: { company: CompanyBalanceOut }) {
  const hasNegative = company.locations.some(
    (row) => row.kind !== "SERVILION" && row.has_negative,
  );

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{company.company_name}</h2>
        {company.faena_name && (
          <p className="text-sm text-muted-foreground">{company.faena_name}</p>
        )}
      </div>

      {hasNegative && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" />
          Hay lugares con saldo negativo. Avisa a un administrador para que haga un conteo.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-base">
          <thead className="bg-muted/40 text-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Lugar</th>
              {company.linen_types.map((type) => (
                <th key={type.id} className="px-4 py-2 text-right font-medium">
                  {type.name}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-left font-medium">Último conteo</th>
            </tr>
          </thead>
          <tbody>
            {company.locations.map((row) => (
              <tr
                key={`${row.kind}-${row.camp_id ?? ""}`}
                className={cn("border-t", row.kind !== "CAMPAMENTO" && "bg-muted/20")}
              >
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-1.5">
                    {row.has_negative && row.kind !== "SERVILION" && (
                      <TriangleAlert className="size-4 text-destructive" />
                    )}
                    {row.name}
                  </span>
                </td>
                {row.lines.map((line) => (
                  <td
                    key={line.garment_type_id}
                    className={cn(
                      "px-4 py-3 text-right tabular-nums",
                      line.quantity < 0 && "font-semibold text-destructive",
                      line.quantity === 0 && "text-muted-foreground",
                    )}
                  >
                    {line.quantity.toLocaleString("es-CL")}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {row.total.toLocaleString("es-CL")}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {row.kind === "SERVILION"
                    ? "No se cuenta"
                    : row.last_counted_at
                      ? formatDate(row.last_counted_at)
                      : "Nunca"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
