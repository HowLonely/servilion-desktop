import { useEffect, useState } from "react";
import { PackageSearch, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/date";
import { parseApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-provider";
import {
  batchStatusLabel,
  batchStatusTone,
  SHORTAGE_ALERT_RATE,
} from "@/features/hospitality/lib/status";
import {
  useBatch,
  useBatchesInPlant,
  useDispatchBatch,
  useRegisterReturnCount,
} from "@/features/hospitality/use-hospitality";

/**
 * Conteo de salida de un lote y, si el rol alcanza, su despacho.
 *
 * Es el momento donde aparece la merma, que es lo único que este servicio viene
 * a medir: cuántas piezas entraron a granel y cuántas volvieron. Por eso el
 * conteo es repetible mientras el lote no se despache —contar cientos de
 * sábanas admite corrección— y el despacho exige que no falte ninguna línea por
 * contar, porque despachar sin contar dejaría la merma sin registrar.
 */
export function ReturnCountPanel() {
  const { batches, isLoading } = useBatchesInPlant();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  if (selectedId !== null) {
    return (
      <BatchCounter batchId={selectedId} onClose={() => setSelectedId(null)} />
    );
  }

  if (batches.length === 0) {
    return (
      <Card className="flex items-center gap-3 p-6 text-base text-muted-foreground">
        <PackageSearch className="size-6 shrink-0" />
        No hay lotes de lencería en planta. Los que ya se despacharon se consultan
        en el panel web.
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      {batches.map((batch, index) => (
        <button
          key={batch.id}
          type="button"
          onClick={() => setSelectedId(batch.id)}
          className={cn(
            "flex w-full items-center justify-between gap-3 bg-card px-4 py-4 text-left transition-colors hover:bg-muted/60",
            index > 0 && "border-t",
          )}
        >
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              <span className="font-mono">{batch.batch_number}</span> ·{" "}
              {batch.company_name}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {[batch.camp_name, `${batch.total_in} piezas`, formatDateTime(batch.received_at)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-sm font-medium",
              batchStatusTone(batch.status),
            )}
          >
            {batchStatusLabel(batch.status)}
          </span>
        </button>
      ))}
    </div>
  );
}

function BatchCounter({
  batchId,
  onClose,
}: {
  batchId: number;
  onClose: () => void;
}) {
  const { capabilities } = useSession();
  const { data: batch, isLoading } = useBatch(batchId);
  const registerCount = useRegisterReturnCount(batchId);
  const dispatchBatch = useDispatchBatch(batchId);

  // Lo tecleado por línea, como texto: "" es "todavía no lo cuento", que es
  // distinto de un 0 —una línea de la que no volvió nada— y el backend
  // distingue los dos (`quantity_out` nulo vs. cero).
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [receivedBy, setReceivedBy] = useState("");

  useEffect(() => {
    if (!batch) return;
    setCounts(
      Object.fromEntries(
        batch.items.map((item) => [
          item.id,
          item.quantity_out === null ? "" : String(item.quantity_out),
        ]),
      ),
    );
    setReceivedBy(batch.received_by_client);
  }, [batch]);

  if (isLoading || !batch) return <Skeleton className="h-64 w-full" />;

  const isDispatched = batch.status === "DESPACHADO";
  const entered = Object.entries(counts).filter(([, value]) => value !== "");
  const allCounted = entered.length === batch.items.length;
  const canDispatch = capabilities.canDispatchLinen && allCounted && !isDispatched;

  async function saveCounts(): Promise<void> {
    try {
      await registerCount.mutateAsync(
        entered.map(([itemId, value]) => ({
          item_id: Number(itemId),
          quantity_out: Number(value),
        })),
      );
      toast.success("Cuenta de salida registrada.");
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  async function dispatch(): Promise<void> {
    try {
      await dispatchBatch.mutateAsync({ received_by_client: receivedBy, note: "" });
      toast.success("Lote despachado a faena.");
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-2xl font-bold tracking-tight">
              {batch.batch_number}
            </h2>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium",
                batchStatusTone(batch.status),
              )}
            >
              {batchStatusLabel(batch.status)}
            </span>
          </div>
          <p className="mt-1 text-base text-muted-foreground">
            {[batch.company_name, batch.camp_name, `${batch.total_in} piezas recibidas`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Ver otros lotes
        </Button>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Cuenta de salida
          </h3>
          <p className="text-sm text-muted-foreground">
            Cuántas piezas de cada tipo volvieron del lavado. Se puede corregir
            mientras el lote no se despache.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border">
          {batch.items.map((item, index) => {
            const value = counts[item.id] ?? "";
            const out = value === "" ? null : Number(value);
            const shortage = out === null ? null : item.quantity_in - out;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 text-lg",
                  index > 0 && "border-t",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.name}
                </span>
                <span className="shrink-0 text-base text-muted-foreground tabular-nums">
                  entraron {item.quantity_in}
                </span>
                <Input
                  className="h-12 w-24 text-center text-xl font-bold tabular-nums"
                  inputMode="numeric"
                  aria-label={`Piezas que volvieron de ${item.name}`}
                  disabled={isDispatched}
                  value={value}
                  onChange={(e) =>
                    setCounts((current) => ({
                      ...current,
                      [item.id]: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
                <ShortageTag quantityIn={item.quantity_in} shortage={shortage} />
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-3 py-3">
            <span className="text-sm text-muted-foreground">
              {entered.length} de {batch.items.length} líneas contadas
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {entered.reduce((sum, [, value]) => sum + Number(value), 0)} /{" "}
              {batch.total_in}
            </span>
          </div>
        </div>

        {!isDispatched && (
          <Button
            size="lg"
            className="h-12 text-lg sm:self-start sm:px-8"
            disabled={entered.length === 0 || registerCount.isPending}
            onClick={() => void saveCounts()}
          >
            {registerCount.isPending ? "Guardando…" : "Guardar cuenta de salida"}
          </Button>
        )}
      </Card>

      {capabilities.canDispatchLinen && !isDispatched && (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              Despachar a faena
            </h3>
            <p className="text-sm text-muted-foreground">
              Cierra el lote y fija su merma. Exige que todas las líneas estén
              contadas: despachar sin contar dejaría la merma sin registrar.
            </p>
          </div>
          <Input
            className="h-12 max-w-md text-lg"
            placeholder="Quién recibe en faena (opcional)"
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
          />
          <Button
            size="lg"
            variant={canDispatch ? "default" : "outline"}
            className="h-12 text-lg sm:self-start sm:px-8"
            disabled={!canDispatch || dispatchBatch.isPending}
            onClick={() => void dispatch()}
          >
            {dispatchBatch.isPending ? "Despachando…" : "Despachar lote"}
          </Button>
          {!allCounted && (
            <p className="text-sm text-amber-600">
              Faltan líneas por contar. Guarda la cuenta de salida completa antes
              de despachar.
            </p>
          )}
        </Card>
      )}

      {!capabilities.canDispatchLinen && !isDispatched && (
        <p className="text-sm text-muted-foreground">
          El despacho del lote lo registra el supervisor: es el que fija la merma
          definitiva.
        </p>
      )}
    </div>
  );
}

/** Merma de una línea. En rojo solo cuando deja de ser ruido de conteo. */
function ShortageTag({
  quantityIn,
  shortage,
}: {
  quantityIn: number;
  shortage: number | null;
}) {
  if (shortage === null) {
    return <span className="w-28 shrink-0 text-sm text-muted-foreground">—</span>;
  }
  if (shortage <= 0) {
    return (
      <span className="w-28 shrink-0 text-sm font-medium text-emerald-600">
        Sin merma
      </span>
    );
  }
  const alarming = quantityIn > 0 && shortage / quantityIn >= SHORTAGE_ALERT_RATE;
  return (
    <span
      className={cn(
        "flex w-28 shrink-0 items-center gap-1 text-sm font-semibold tabular-nums",
        alarming ? "text-destructive" : "text-amber-600",
      )}
    >
      {alarming && <TriangleAlert className="size-4 shrink-0" />}
      faltan {shortage}
    </span>
  );
}
