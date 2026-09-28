import { useMemo, useState } from "react";
import { Check, Loader2, Minus, Plus, Printer, Truck } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/date";
import { parseApiError } from "@/lib/api/errors";
import {
  useBalances,
  usePrintLinenDispatch,
  useRecentDispatches,
  useRegisterDispatch,
} from "@/features/hospitality/use-hospitality";

import type { components } from "@/lib/api/schema";

type LinenMovementOut = components["schemas"]["LinenMovementOut"];

/**
 * Despacho de lencería limpia desde la planta hacia la faena del cliente.
 *
 * Es lo único de hotelería que ocurre en la planta: el reparto a cada
 * campamento y el retiro del sucio los registra el supervisor en faena con la
 * app móvil. Al guardar se imprime la guía que viaja con la carga.
 */
export function DispatchPanel() {
  const { data: balances, isLoading } = useBalances();
  const registerDispatch = useRegisterDispatch();
  const printDispatch = usePrintLinenDispatch();

  const [companyId, setCompanyId] = useState<number | null>(null);
  // Lo tecleado por tipo de lencería. Vacío o cero = ese tipo no va.
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<LinenMovementOut | null>(null);

  const companies = useMemo(() => balances ?? [], [balances]);
  const company =
    companies.find((item) => item.company_id === companyId) ??
    (companies.length === 1 ? companies[0] : undefined);
  const servilion = company?.locations.find((row) => row.kind === "SERVILION");

  const lines = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([garmentTypeId, quantity]) => ({ garment_type_id: Number(garmentTypeId), quantity }));
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);

  function print(movementId: number): void {
    printDispatch.mutate(movementId, {
      onSuccess: () => toast.success("Guía enviada a la impresora."),
      onError: (error) =>
        toast.error("No se pudo imprimir la guía", {
          description: error instanceof Error ? error.message : String(error),
        }),
    });
  }

  async function submit(): Promise<void> {
    if (!company || lines.length === 0) return;
    try {
      const movement = await registerDispatch.mutateAsync({
        company_id: company.company_id,
        lines,
        note,
      });
      setCreated(movement);
      // La guía se imprime después de guardar y su fallo no deshace el
      // despacho: ya quedó registrado y se reimprime desde la confirmación o
      // desde la lista de despachos recientes.
      print(movement.id);
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  function reset(): void {
    setQuantities({});
    setNote("");
    setCreated(null);
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (created) {
    return (
      <DispatchConfirmation
        movement={created}
        isPrinting={printDispatch.isPending}
        onReprint={() => print(created.id)}
        onNext={reset}
      />
    );
  }

  if (companies.length === 0) {
    return (
      <Card className="p-6 text-base text-muted-foreground">
        No hay empresas con contrato de hotelería. Un administrador tiene que marcarlas como tal en
        el panel web.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {companies.length > 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">1 · Cliente</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((item) => (
              <button
                key={item.company_id}
                type="button"
                onClick={() => {
                  setCompanyId(item.company_id);
                  setQuantities({});
                }}
                className={cn(
                  "flex min-h-16 flex-col justify-center rounded-xl border px-4 py-3 text-left transition",
                  item.company_id === company?.company_id
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "bg-card hover:border-primary/50",
                )}
              >
                <span className="truncate text-base font-semibold">{item.company_name}</span>
                {item.faena_name && (
                  <span className="truncate text-sm text-muted-foreground">{item.faena_name}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {company && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {companies.length > 1 ? "2 · " : ""}Lencería limpia que sale a {company.faena_name || company.company_name}
          </h2>

          {company.linen_types.length === 0 ? (
            <Card className="p-5 text-base text-muted-foreground">
              No hay tipos de lencería. En el panel web, marca en Prendas los que se usan en
              hotelería.
            </Card>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {company.linen_types.map((type, index) => {
                const quantity = quantities[type.id] ?? 0;
                const atPlant =
                  servilion?.lines.find((line) => line.garment_type_id === type.id)?.quantity ?? 0;
                const setQuantity = (value: number): void =>
                  setQuantities((previous) => ({ ...previous, [type.id]: Math.max(0, value) }));
                return (
                  <div
                    key={type.id}
                    className={cn("flex items-center gap-3 px-3 py-3 text-lg", index > 0 && "border-t")}
                  >
                    <span className="min-w-16 shrink-0 rounded-md bg-muted px-2 py-1 text-center font-mono text-base font-bold">
                      {type.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{type.name}</span>
                      {/* Solo como referencia y solo si es positivo: Servilion
                          no se cuenta, así que antes de acumular retiros su
                          saldo puede quedar negativo y no le dice nada útil a
                          quien arma la carga. */}
                      {atPlant > 0 && (
                        <span className="block text-sm text-muted-foreground">
                          Retirado sucio y aún sin despachar: {atPlant.toLocaleString("es-CL")}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10"
                        aria-label={`Restar una ${type.name}`}
                        disabled={quantity <= 0}
                        onClick={() => setQuantity(quantity - 1)}
                      >
                        <Minus className="size-5" />
                      </Button>
                      <Input
                        className="h-10 w-24 text-center text-xl font-bold tabular-nums"
                        inputMode="numeric"
                        aria-label={`Piezas de ${type.name}`}
                        value={quantity ? String(quantity) : ""}
                        placeholder="0"
                        onChange={(event) =>
                          // Un despacho son cientos de piezas: el número se
                          // teclea, los botones son para corregir de a una.
                          setQuantity(Number(event.target.value.replace(/\D/g, "")) || 0)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10"
                        aria-label={`Sumar una ${type.name}`}
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        <Plus className="size-5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-end border-t bg-muted/40 px-3 py-3">
                <span className="text-2xl font-bold tabular-nums">
                  {total.toLocaleString("es-CL")} {total === 1 ? "pieza" : "piezas"}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="dispatch-note" className="text-sm font-medium">
              Observaciones (opcional)
            </label>
            <Textarea
              id="dispatch-note"
              className="text-base"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <Button
            size="lg"
            className="h-14 text-lg"
            disabled={lines.length === 0 || registerDispatch.isPending}
            onClick={() => void submit()}
          >
            {registerDispatch.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Truck className="size-5" />
            )}
            {registerDispatch.isPending ? "Registrando…" : "Despachar e imprimir guía"}
          </Button>
        </section>
      )}

      <RecentDispatches onReprint={print} isPrinting={printDispatch.isPending} />
    </div>
  );
}

function DispatchConfirmation({
  movement,
  isPrinting,
  onReprint,
  onNext,
}: {
  movement: LinenMovementOut;
  isPrinting: boolean;
  onReprint: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="size-9" />
      </span>
      <div>
        <p className="text-base text-muted-foreground">
          Lencería despachada a {movement.company_name}
        </p>
        <p className="mt-1 font-mono text-5xl font-semibold tracking-tight">{movement.number}</p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2 text-base">
        {movement.lines.map((line) => (
          <li key={line.garment_type_id} className="rounded-lg border bg-card px-3 py-1.5">
            <span className="text-muted-foreground">{line.name}: </span>
            <span className="font-semibold tabular-nums">{line.quantity}</span>
          </li>
        ))}
      </ul>
      <div className="flex w-full max-w-md flex-col gap-3">
        <Button size="lg" className="h-16 text-lg" onClick={onNext}>
          Nuevo despacho
        </Button>
        <Button size="lg" variant="outline" className="h-14" disabled={isPrinting} onClick={onReprint}>
          {isPrinting ? <Loader2 className="size-5 animate-spin" /> : <Printer className="size-5" />}
          Volver a imprimir la guía
        </Button>
      </div>
    </div>
  );
}

function RecentDispatches({
  onReprint,
  isPrinting,
}: {
  onReprint: (movementId: number) => void;
  isPrinting: boolean;
}) {
  const { data: dispatches } = useRecentDispatches();
  if (!dispatches || dispatches.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-tight">Despachos recientes</h2>
      <div className="overflow-hidden rounded-xl border">
        {dispatches.map((dispatch, index) => (
          <div
            key={dispatch.id}
            className={cn("flex flex-wrap items-center gap-3 bg-card px-4 py-3", index > 0 && "border-t")}
          >
            <div className="min-w-40 flex-1">
              <p className="font-mono text-lg font-semibold">{dispatch.number}</p>
              <p className="text-sm text-muted-foreground">
                {dispatch.company_name} · {formatDateTime(dispatch.occurred_at)}
              </p>
            </div>
            <span className="text-base font-semibold tabular-nums">
              {dispatch.total_quantity.toLocaleString("es-CL")} piezas
            </span>
            <Button
              variant="outline"
              className="h-11"
              disabled={isPrinting}
              onClick={() => onReprint(dispatch.id)}
            >
              <Printer className="size-4" />
              Reimprimir guía
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
