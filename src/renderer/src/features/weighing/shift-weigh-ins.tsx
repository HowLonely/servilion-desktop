import { useState } from "react";
import { Ban, Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/date";
import {
  usePrintWeighLabels,
  useShiftWeighIns,
  useVoidWeighIn,
} from "@/features/weighing/use-weighing";

import type { components } from "@/lib/api/schema";

type WeighInOut = components["schemas"]["WeighInOut"];

/**
 * Los pesajes que hizo este operador, para arreglar lo que salió mal.
 *
 * Solo se puede anular mientras nadie haya digitalizado el morral: después de
 * eso el peso y las prendas se corrigen desde la guía, porque el ref ya viaja
 * pegado a la ropa y anularlo dejaría prendas con un código que no existe.
 */
export function ShiftWeighIns({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useShiftWeighIns();
  const printLabels = usePrintWeighLabels();
  const voidWeighIn = useVoidWeighIn();
  const [confirming, setConfirming] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 text-xl font-semibold tracking-tight">Pesajes de tu turno</h2>
        <Button variant="outline" size="lg" className="h-12" onClick={onClose}>
          <X className="size-5" />
          Cerrar
        </Button>
      </div>

      {isLoading && (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Cargando…
        </div>
      )}

      {!isLoading && (data ?? []).length === 0 && (
        <p className="rounded-xl border bg-card p-8 text-center text-base text-muted-foreground">
          Todavía no has pesado ningún morral en este turno.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {(data ?? []).map((weighIn) => (
          <WeighInRow
            key={weighIn.id}
            weighIn={weighIn}
            isConfirming={confirming === weighIn.id}
            isBusy={printLabels.isPending || voidWeighIn.isPending}
            onAskVoid={() => setConfirming(weighIn.id)}
            onCancelVoid={() => setConfirming(null)}
            onReprint={() =>
              printLabels.mutate(weighIn.id, {
                onSuccess: () => toast.success(`Etiquetas de ${weighIn.reference} enviadas`),
                onError: (error) =>
                  toast.error("No se pudo imprimir", {
                    description: error instanceof Error ? error.message : String(error),
                  }),
              })
            }
            onVoid={() =>
              voidWeighIn.mutate(
                { id: weighIn.id, reason: "Anulado desde la báscula" },
                {
                  onSuccess: () => {
                    setConfirming(null);
                    toast.success(`Pesaje ${weighIn.reference} anulado`);
                  },
                  onError: (error) => toast.error(parseApiError(error).detail),
                },
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}

function WeighInRow({
  weighIn,
  isConfirming,
  isBusy,
  onAskVoid,
  onCancelVoid,
  onReprint,
  onVoid,
}: {
  weighIn: WeighInOut;
  isConfirming: boolean;
  isBusy: boolean;
  onAskVoid: () => void;
  onCancelVoid: () => void;
  onReprint: () => void;
  onVoid: () => void;
}) {
  const isPending = weighIn.status === "PENDIENTE";
  const isVoided = weighIn.status === "ANULADA";

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm",
        isVoided && "opacity-60",
      )}
    >
      <div className="min-w-40 flex-1">
        <p className="font-mono text-2xl font-semibold tracking-tight">{weighIn.reference}</p>
        <p className="text-sm text-muted-foreground">
          {weighIn.company_name}
          {weighIn.is_contractor && " · Contratista"}
        </p>
      </div>

      <div className="text-right text-base">
        <p className="font-semibold tabular-nums">
          {weighIn.garment_count} pz · {weighIn.weight_kg} kg
        </p>
        <p className="text-sm text-muted-foreground">{formatDateTime(weighIn.weighed_at)}</p>
      </div>

      <StatusBadge weighIn={weighIn} />

      {isConfirming ? (
        // La confirmación se pide en línea y no en un diálogo: en táctil, un
        // modal a pantalla completa para una acción de esta escala se cierra de
        // un toque accidental con la misma facilidad con que se acepta.
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="destructive" size="lg" className="h-12 flex-1" disabled={isBusy} onClick={onVoid}>
            {isBusy ? <Loader2 className="size-5 animate-spin" /> : <Ban className="size-5" />}
            Sí, anular
          </Button>
          <Button variant="outline" size="lg" className="h-12 flex-1" onClick={onCancelVoid}>
            No
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="h-12" disabled={isBusy || isVoided} onClick={onReprint}>
            <Printer className="size-5" />
            Reimprimir
          </Button>
          {isPending && (
            <Button variant="outline" size="lg" className="h-12" onClick={onAskVoid}>
              <Ban className="size-5" />
              Anular
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function StatusBadge({ weighIn }: { weighIn: WeighInOut }) {
  const styles: Record<string, string> = {
    PENDIENTE: "border-amber-300 bg-amber-50 text-amber-700",
    DIGITALIZADA: "border-emerald-300 bg-emerald-50 text-emerald-700",
    ANULADA: "border-border bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm font-medium",
        styles[weighIn.status] ?? styles.ANULADA,
      )}
    >
      {weighIn.status_label}
    </span>
  );
}
