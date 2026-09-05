import { useMemo, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { parseApiError } from "@/lib/api/errors";
import {
  GARMENT_TYPES_SELECT_LIMIT,
  useGarmentTypes,
} from "@/features/garments/use-garment-types";
import { useCreateBatch } from "@/features/hospitality/use-hospitality";
import {
  useCamps,
  useHospitalityCompanies,
} from "@/features/hospitality/use-linen-catalog";

import type { components } from "@/lib/api/schema";

type LinenBatchOut = components["schemas"]["LinenBatchOut"];

type Line = {
  garment_type_id: number | null;
  custom_name: string;
  quantity_in: number;
};

const MAX_SUGGESTIONS = 8;

/**
 * Recepción de una carga de lencería del campamento.
 *
 * A diferencia de la digitalización de una OT no hay trabajador, RUT, turno ni
 * habitación: la carga es del campamento y vuelve al mandante. Lo que se
 * registra es qué lencería llegó y cuánta, porque esa cantidad es contra la que
 * se contará la salida para obtener la merma — el número que este servicio
 * viene a hacer visible por primera vez.
 */
export function ReceiveBatchForm({
  onReceived,
}: {
  onReceived: (batch: LinenBatchOut) => void;
}) {
  const createBatch = useCreateBatch();
  const { companies, isLoading: loadingCompanies } = useHospitalityCompanies();
  const { data: camps } = useCamps();
  const { data: garmentsPage } = useGarmentTypes({
    is_active: true,
    limit: GARMENT_TYPES_SELECT_LIMIT,
  });
  const garments = useMemo(() => garmentsPage?.items ?? [], [garmentsPage]);

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [campId, setCampId] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [observations, setObservations] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const queryRef = useRef<HTMLInputElement>(null);

  // El campamento se elige entre los de la faena de la empresa: la lencería es
  // del campamento donde duerme la gente, no de cualquiera de la cartera.
  const company = companies.find((item) => item.id === companyId) ?? null;
  const availableCamps = useMemo(
    () =>
      (camps ?? []).filter(
        (camp) => company?.faena_id == null || camp.faena_id === company.faena_id,
      ),
    [camps, company],
  );

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return garments
      .filter(
        (g) =>
          g.name.toLowerCase().includes(term) ||
          g.code.toLowerCase().includes(term),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [garments, query]);

  const totalPieces = lines.reduce((sum, line) => sum + (line.quantity_in || 0), 0);
  const canSubmit = companyId !== null && lines.length > 0 && !createBatch.isPending;

  function addCatalogLine(id: number): void {
    setLines((current) => {
      if (current.some((line) => line.garment_type_id === id)) {
        toast.info("Esa lencería ya está en el lote.");
        return current;
      }
      return [...current, { garment_type_id: id, custom_name: "", quantity_in: 1 }];
    });
    setQuery("");
    queryRef.current?.focus();
  }

  function addCustomLine(): void {
    const name = query.trim().toUpperCase();
    if (!name) return;
    setLines((current) => [
      ...current,
      { garment_type_id: null, custom_name: name, quantity_in: 1 },
    ]);
    setQuery("");
    queryRef.current?.focus();
  }

  function updateLine(index: number, patch: Partial<Line>): void {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  async function submit(): Promise<void> {
    if (companyId === null) return;
    try {
      const batch = await createBatch.mutateAsync({
        company_id: companyId,
        camp_id: campId,
        weight_kg: weightKg ? Number(weightKg) : null,
        observations,
        items: lines.map((line) => ({
          garment_type_id: line.garment_type_id,
          custom_name: line.custom_name,
          quantity_in: line.quantity_in,
          weight_kg: null,
        })),
      });
      // Se limpia todo menos la empresa: lo normal es que lleguen varias cargas
      // del mismo campamento seguidas.
      setLines([]);
      setWeightKg("");
      setObservations("");
      onReceived(batch);
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1 · De quién es la carga */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">
          1 · Contrato de hotelería
        </h2>
        {loadingCompanies ? (
          <Skeleton className="h-24 w-full" />
        ) : companies.length === 0 ? (
          <Card className="p-5 text-base text-muted-foreground">
            No hay empresas con contrato de hotelería. Un administrador tiene que
            marcarlas como tal en el panel web antes de recibir lencería.
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((item) => (
              <ChoiceButton
                key={item.id}
                selected={item.id === companyId}
                title={item.name}
                subtitle={item.faena_name || item.client_name}
                onClick={() => {
                  setCompanyId(item.id);
                  setCampId(null);
                }}
              />
            ))}
          </div>
        )}

        {companyId !== null && availableCamps.length > 0 && (
          <>
            <h3 className="mt-2 text-sm font-medium text-muted-foreground">
              Campamento (opcional)
            </h3>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {availableCamps.map((camp) => (
                <ChoiceButton
                  key={camp.id}
                  selected={camp.id === campId}
                  title={camp.name}
                  subtitle={`${camp.rooms_count} habitaciones`}
                  onClick={() => setCampId(camp.id === campId ? null : camp.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* 2 · Qué llegó */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">
          2 · Lencería recibida
        </h2>

        <div className="relative">
          <Input
            ref={queryRef}
            className="h-14 text-lg"
            placeholder="Busca sábana, toalla, cubrecama…"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              // Enter toma la primera sugerencia; si no hay ninguna, lo tecleado
              // entra como lencería fuera de catálogo. El campamento manda cosas
              // que nadie dio de alta y la carga tiene que quedar registrada
              // igual.
              if (suggestions.length > 0) addCatalogLine(suggestions[0].id);
              else addCustomLine();
            }}
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-md">
              {suggestions.map((garment, index) => (
                <button
                  key={garment.id}
                  type="button"
                  onClick={() => addCatalogLine(garment.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-3 text-left text-lg hover:bg-muted/60",
                    index > 0 && "border-t",
                  )}
                >
                  <span className="min-w-16 shrink-0 rounded-md bg-muted px-2 py-1 text-center font-mono text-base font-bold">
                    {garment.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{garment.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="overflow-hidden rounded-xl border">
            {lines.map((line, index) => {
              const garment =
                line.garment_type_id != null
                  ? garments.find((g) => g.id === line.garment_type_id)
                  : undefined;
              return (
                <div
                  key={`${line.garment_type_id ?? "x"}-${line.custom_name}-${index}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 text-lg",
                    index > 0 && "border-t",
                  )}
                >
                  <span className="min-w-16 shrink-0 rounded-md bg-muted px-2 py-1 text-center font-mono text-base font-bold tabular-nums">
                    {garment?.code ?? "S/C"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {garment?.name ?? line.custom_name}
                    {!garment && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        (fuera de catálogo)
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10"
                      aria-label="Restar uno"
                      disabled={line.quantity_in <= 1}
                      onClick={() =>
                        updateLine(index, {
                          quantity_in: Math.max(1, line.quantity_in - 1),
                        })
                      }
                    >
                      <Minus className="size-5" />
                    </Button>
                    <Input
                      className="h-10 w-20 text-center text-xl font-bold tabular-nums"
                      inputMode="numeric"
                      aria-label="Piezas recibidas"
                      value={String(line.quantity_in)}
                      onChange={(e) => {
                        // Una carga de lencería son cientos de piezas: tocar
                        // "+" doscientas veces no es una opción, así que el
                        // número también se teclea.
                        const parsed = Number(e.target.value.replace(/\D/g, ""));
                        updateLine(index, {
                          quantity_in: Number.isFinite(parsed) ? parsed : 0,
                        });
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10"
                      aria-label="Sumar uno"
                      onClick={() =>
                        updateLine(index, { quantity_in: line.quantity_in + 1 })
                      }
                    >
                      <Plus className="size-5" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 text-muted-foreground hover:text-destructive"
                    aria-label="Quitar lencería"
                    onClick={() =>
                      setLines((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="size-5" />
                  </Button>
                </div>
              );
            })}

            <div className="flex items-center justify-end border-t bg-muted/40 px-3 py-3">
              <span className="text-2xl font-bold tabular-nums">
                {totalPieces} {totalPieces === 1 ? "pieza" : "piezas"}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 3 · Cierre */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight">
          3 · Peso, observaciones y guardado
        </h2>
        <div className="flex flex-col gap-2">
          <label htmlFor="batch-weight" className="text-sm font-medium">
            Peso de la carga en kg (opcional)
          </label>
          <Input
            id="batch-weight"
            className="h-14 max-w-48 text-lg tabular-nums"
            inputMode="decimal"
            placeholder="0,0"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value.replace(",", "."))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="batch-observations" className="text-sm font-medium">
            Observaciones
          </label>
          <Textarea
            id="batch-observations"
            className="text-base"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </div>

        <Button
          size="lg"
          className="h-14 text-lg"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {createBatch.isPending ? "Registrando…" : "Registrar carga recibida"}
        </Button>
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            El lote tiene que declarar al menos un tipo de lencería: sin eso no
            hay contra qué contar la salida.
          </p>
        )}
      </section>
    </div>
  );
}

/** Tarjeta de selección grande, para elegir con el dedo y no con el mouse. */
function ChoiceButton({
  selected,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-16 flex-col justify-center rounded-xl border px-4 py-3 text-left transition",
        selected
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "bg-card hover:border-primary/50",
      )}
    >
      <span className="truncate text-base font-semibold">{title}</span>
      {subtitle && (
        <span className="truncate text-sm text-muted-foreground">{subtitle}</span>
      )}
    </button>
  );
}
