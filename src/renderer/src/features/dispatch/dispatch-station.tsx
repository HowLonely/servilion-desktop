import { useRef, useState } from "react";
import { Check, CircleAlert, ScanLine, Truck } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StationShell } from "@/components/station-shell";
import { formatDateTime } from "@/lib/date";
import { parseApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-provider";
import { OrderNumberLabel } from "@/features/orders/components/order-number-label";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import {
  isAmbiguousReference,
  useDispatchOrder,
  useDispatchScan,
} from "@/features/orders/hooks/use-orders";

import type { components } from "@/lib/api/schema";
import type { ServerStatus } from "@shared/types";

type LaundryOrderOut = components["schemas"]["LaundryOrderOut"];
type AmbiguousOrderOut = components["schemas"]["AmbiguousOrderOut"];

type Feedback = { ok: boolean; text: string };

type Ambiguity = {
  reference: string;
  candidates: AmbiguousOrderOut[];
};

/**
 * Estación de Despacho (paso 7 del flujo).
 *
 * Un solo pistoleo: resuelve la boleta del morral y lo despacha en el mismo
 * disparo (`POST /api/orders/scan/dispatch`). No hay nada que abrir, cerrar ni
 * confirmar aparte — a diferencia de la mesa de empaque, acá no hay ciclo de
 * pistoleos. El backend es quien decide si el morral tiene algo que
 * despachar: Completa o Incompleta (cerrado, sigue en planta), o Despachada
 * con una prenda resuelta pendiente de su envío aparte. Cualquier otro estado
 * se rechaza y lo dice, sin tocar nada.
 */
export function DispatchStation({
  stationName,
  serverStatus,
  onBack,
  onOpenSettings,
}: {
  stationName: string;
  serverStatus: ServerStatus;
  onBack?: () => void;
  onOpenSettings: () => void;
}) {
  const { capabilities } = useSession();
  const canDispatch = capabilities.canDispatch;

  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lastOrder, setLastOrder] = useState<LaundryOrderOut | null>(null);
  const [ambiguity, setAmbiguity] = useState<Ambiguity | null>(null);

  const scan = useDispatchScan();

  function focusInput(): void {
    inputRef.current?.focus();
  }

  function describeDispatch(order: LaundryOrderOut): string {
    return `Morral despachado ✓ · OT ${order.order_number ?? order.reference ?? "—"}`;
  }

  async function handleScan(): Promise<void> {
    const value = code.trim();
    if (!value) return;
    setAmbiguity(null);
    try {
      const order = await scan.mutateAsync({ code: value, note: "" });
      setLastOrder(order);
      setCode("");
      setFeedback({ ok: true, text: describeDispatch(order) });
      toast.success("Morral despachado a faena.");
    } catch (error) {
      if (isAmbiguousReference(error)) {
        // Mismo caso que en empaque: el ref calza con más de un morral listo
        // para despacho y solo el operador, que lo tiene al frente, sabe cuál.
        setAmbiguity({ reference: error.reference, candidates: error.candidates });
        setFeedback(null);
      } else {
        setFeedback({ ok: false, text: parseApiError(error).detail });
      }
    } finally {
      focusInput();
    }
  }

  return (
    <StationShell
      title="Despacho"
      description="Pistolea la boleta de un morral cerrado para sacarlo de planta."
      stationName={stationName}
      serverStatus={serverStatus}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
    >
      <div className="flex flex-col gap-6">
        <Card className="p-5">
          <label
            htmlFor="dispatch-code"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <ScanLine className="size-5 text-primary" />
            Pistolea la boleta del morral
          </label>
          <div className="mt-2 flex flex-wrap items-stretch gap-2">
            <Input
              id="dispatch-code"
              ref={inputRef}
              autoFocus
              autoComplete="off"
              className="h-14 min-w-64 flex-1 font-mono text-2xl uppercase tracking-wide"
              placeholder="Ej. P1005"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleScan();
                }
              }}
            />
            <Button
              size="lg"
              className="h-14 px-6 text-lg"
              onClick={() => void handleScan()}
              disabled={scan.isPending}
            >
              <Truck className="size-5" />
              Despachar
            </Button>
          </div>

          {feedback && (
            <div
              className={cn(
                "mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-lg font-medium",
                feedback.ok
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {feedback.ok ? (
                <Check className="size-5 shrink-0" />
              ) : (
                <CircleAlert className="size-5 shrink-0" />
              )}
              {feedback.text}
            </div>
          )}

          <p className="mt-2 text-sm text-muted-foreground">
            Solo despacha morrales cerrados (Completa o Incompleta) o guías ya
            despachadas con una prenda pendiente de enviar aparte. Cualquier
            otro estado se rechaza, sin tocar nada.
          </p>
        </Card>

        {!canDispatch && (
          <p className="text-base text-muted-foreground">
            Tu rol no puede despachar. Esta estación es para el Digitador de
            Empaque y el Supervisor.
          </p>
        )}

        {ambiguity && (
          <DispatchAmbiguityPicker
            ambiguity={ambiguity}
            onResolved={(order) => {
              setAmbiguity(null);
              setLastOrder(order);
              setFeedback({ ok: true, text: describeDispatch(order) });
              toast.success("Morral despachado a faena.");
              focusInput();
            }}
            onFailed={(text) => {
              setAmbiguity(null);
              setFeedback({ ok: false, text });
              focusInput();
            }}
          />
        )}

        {lastOrder && !ambiguity && (
          <Card className="flex flex-row flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  OT <OrderNumberLabel value={lastOrder.order_number} />
                </h2>
                <OrderStatusBadge status={lastOrder.status} />
              </div>
              <p className="mt-1 text-base text-muted-foreground">
                {lastOrder.worker_name} · {lastOrder.company_name} · Ref{" "}
                <span className="font-mono font-semibold">
                  {lastOrder.reference || "—"}
                </span>{" "}
                · {lastOrder.garment_count} prendas
              </p>
            </div>
          </Card>
        )}
      </div>
    </StationShell>
  );
}

/**
 * Desempate cuando un ref calza con más de un morral listo para despacho. Ver
 * `AmbiguityPicker` en packing-station.tsx: mismo patrón, pero cada candidata
 * se resuelve despachándola directo en vez de reintentar un pistoleo de prenda.
 */
function DispatchAmbiguityPicker({
  ambiguity,
  onResolved,
  onFailed,
}: {
  ambiguity: Ambiguity;
  onResolved: (order: LaundryOrderOut) => void;
  onFailed: (text: string) => void;
}) {
  return (
    <Card className="flex flex-col gap-3 border-amber-400 p-5">
      <div className="flex items-center gap-2 text-base font-semibold">
        <CircleAlert className="size-5 text-amber-500" />
        Hay {ambiguity.candidates.length} morrales listos para despacho con el
        ref <span className="font-mono">{ambiguity.reference}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Elige el morral que tienes al frente: el código calza con más de uno.
      </p>
      <div className="overflow-hidden rounded-xl border">
        {ambiguity.candidates.map((candidate, index) => (
          <DispatchCandidateRow
            key={candidate.order_id}
            candidate={candidate}
            bordered={index > 0}
            onResolved={onResolved}
            onFailed={onFailed}
          />
        ))}
      </div>
    </Card>
  );
}

function DispatchCandidateRow({
  candidate,
  bordered,
  onResolved,
  onFailed,
}: {
  candidate: AmbiguousOrderOut;
  bordered: boolean;
  onResolved: (order: LaundryOrderOut) => void;
  onFailed: (text: string) => void;
}) {
  const dispatch = useDispatchOrder(candidate.order_id);

  async function choose(): Promise<void> {
    try {
      const order = await dispatch.mutateAsync({ note: "" });
      onResolved(order);
    } catch (error) {
      onFailed(parseApiError(error).detail);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void choose()}
      disabled={dispatch.isPending}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-60",
        bordered && "border-t",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-base font-semibold">
          {candidate.worker_name}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {candidate.company_name} · OT {candidate.order_number ?? "S/N"} ·
          Ingresó {formatDateTime(candidate.received_at)}
        </p>
      </div>
      <OrderStatusBadge status={candidate.status} />
    </button>
  );
}
