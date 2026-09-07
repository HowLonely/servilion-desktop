import { useRef, useState } from "react";
import { Check, CircleAlert, PackageSearch, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StationShell } from "@/components/station-shell";
import { formatDateTime } from "@/lib/date";
import { parseApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-provider";
import { OrderDetailDialog } from "@/features/orders/components/order-detail-dialog";
import { OrderNumberLabel } from "@/features/orders/components/order-number-label";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { PackingPanel } from "@/features/packing/packing-panel";
import {
  isAmbiguousReference,
  useOrder,
  usePackingCodeScan,
  usePackingScan,
} from "@/features/orders/hooks/use-orders";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/features/orders/lib/status";

import type { components } from "@/lib/api/schema";
import type { ServerStatus } from "@shared/types";

type PackingScanOut = components["schemas"]["PackingScanOut"];
type AmbiguousOrderOut = components["schemas"]["AmbiguousOrderOut"];

// Etapas en que la estación tiene algo que hacer con el morral. Coincide con
// las que `PackingPanel` habilita: COMPLETADA porque el morral cerrado sigue
// en planta esperando su despacho, y DESPACHADA porque puede quedar una prenda
// resuelta pendiente de su envío aparte (ahí el panel filtra si de verdad
// queda algo por enviar).
const PACKING_STAGES = [
  "RECIBIDA",
  "EN_REVISION",
  "INCOMPLETA",
  "COMPLETADA",
  "DESPACHADA",
];

type Feedback = { ok: boolean; text: string };

type Ambiguity = {
  reference: string;
  candidates: AmbiguousOrderOut[];
  // Segmento de prenda del código pistoleado, si lo traía: al elegir la guía
  // hay que terminar de aplicarlo, no solo abrir el morral.
  pendingLabel: string;
};

/** Segmento de prenda de una etiqueta lavable (`P1005-ALM` → `ALM`). */
function labelSegment(code: string): string {
  const index = code.lastIndexOf("-");
  return index === -1 ? "" : code.slice(index + 1).trim();
}

/** Traduce la acción que resolvió el backend a lo que ve el operador. */
function describeScan(result: PackingScanOut): Feedback {
  const { action, order, progress } = result;
  const counter = `${progress.scanned_total}/${progress.declared_total}`;

  if (action === "ABIERTO") {
    return { ok: true, text: `Morral abierto · ${counter} prendas` };
  }
  if (action === "CERRADO") {
    return order.status === "COMPLETADA"
      ? { ok: true, text: `Morral cerrado completo ✓ · ${counter}` }
      : { ok: false, text: `Morral cerrado INCOMPLETO · ${counter}` };
  }
  if (action === "ENCONTRADA") {
    return progress.is_complete
      ? { ok: true, text: `Prenda encontrada · morral completo ✓ · ${counter}` }
      : { ok: true, text: `Prenda encontrada · ${counter}` };
  }
  return progress.is_complete
    ? { ok: true, text: `Morral completo ✓ · ${counter}` }
    : { ok: true, text: `Prenda pistoleada · ${counter}` };
}

/**
 * Estación de empaque y revisión (paso 6 del flujo).
 *
 * Hay un solo input para los dos códigos que hay sobre la mesa, porque el
 * backend deduce la acción y el operador no tiene que elegir modo en pantalla
 * (FLUJO_NEGOCIO.md §4, paso 6):
 * - la boleta del morral lo abre y, pistoleada de nuevo, lo cierra;
 * - la etiqueta lavable de una prenda abre el morral (si hacía falta) y marca
 *   la prenda en el mismo disparo.
 *
 * El despacho (paso 7) es un módulo aparte (ver features/despacho): pistolear
 * acá la boleta de un morral ya cerrado ya no hace nada más que avisarlo.
 *
 * Es el mismo escáner que el panel web, con un cambio: "Ver OT completa", que
 * allá navega al panel, aquí abre un detalle de solo lectura sin salir de la
 * estación.
 */
export function PackingStation({
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
  const canPack = capabilities.canPack;

  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [ambiguity, setAmbiguity] = useState<Ambiguity | null>(null);

  const { data: order } = useOrder(orderId ?? undefined);
  const scan = usePackingCodeScan();

  function focusInput(): void {
    inputRef.current?.focus();
  }

  function clearStation(): void {
    setOrderId(null);
    setCode("");
    setFeedback(null);
    setAmbiguity(null);
    focusInput();
  }

  async function handleScan(): Promise<void> {
    const value = code.trim();
    if (!value) return;
    setAmbiguity(null);
    try {
      const result = await scan.mutateAsync({ code: value, quantity: 1 });
      setOrderId(result.order.id);
      setCode("");
      setFeedback(describeScan(result));
      if (result.action === "CERRADO") {
        toast[result.order.status === "COMPLETADA" ? "success" : "warning"](
          result.order.status === "COMPLETADA"
            ? "Morral validado: OT completa. Despáchala desde el módulo Despacho."
            : "Morral incompleto: OT marcada como incompleta. Despáchala desde el módulo Despacho.",
        );
      }
    } catch (error) {
      if (isAmbiguousReference(error)) {
        // El código calza con más de una guía viva y solo el operador, que las
        // tiene al frente, sabe cuál es. No es el ref repitiéndose: desde el
        // ciclo (`ReferenceCounter`) el ref corre de 1000 a 1999 y al dar la
        // vuelta avanza la letra. Lo que sí puede cruzarse es un código con
        // otra capa —una OT que coincide con el ref o el control de otra guía—
        // o un morral viejo que quedó Incompleto y nunca se cerró.
        setAmbiguity({
          reference: error.reference,
          candidates: error.candidates,
          pendingLabel: labelSegment(value),
        });
        setFeedback(null);
      } else {
        setFeedback({ ok: false, text: parseApiError(error).detail });
      }
    } finally {
      focusInput();
    }
  }

  const isPackingStage = order ? PACKING_STAGES.includes(order.status) : false;

  return (
    <StationShell
      title="Empaque y revisión"
      description="Valida el morral limpio pistoleando cada prenda antes de despacharlo."
      stationName={stationName}
      serverStatus={serverStatus}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
    >
      <div className="flex flex-col gap-6">
        {/* Escáner único de la mesa */}
        <Card className="p-5">
          <label
            htmlFor="morral-code"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <ScanLine className="size-5 text-primary" />
            Pistolea la boleta o la etiqueta de una prenda
          </label>
          <div className="mt-2 flex flex-wrap items-stretch gap-2">
            <Input
              id="morral-code"
              ref={inputRef}
              autoFocus
              autoComplete="off"
              className="h-14 min-w-64 flex-1 font-mono text-2xl uppercase tracking-wide"
              placeholder="Ej. P1005 o P1005-ALM…"
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
              Pistolear
            </Button>
            {order && (
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-5 text-lg"
                onClick={clearStation}
              >
                Limpiar
              </Button>
            )}
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
            La boleta abre el morral y, pistoleada de nuevo, lo cierra. La
            etiqueta de una prenda lo abre y marca la prenda en un solo
            disparo. El despacho se hace aparte, en el módulo Despacho.
          </p>
        </Card>

        {ambiguity && (
          <AmbiguityPicker
            ambiguity={ambiguity}
            onResolved={(resolvedId, text) => {
              setOrderId(resolvedId);
              setAmbiguity(null);
              setCode("");
              setFeedback({ ok: true, text });
              focusInput();
            }}
            onFailed={(text) => {
              setAmbiguity(null);
              setFeedback({ ok: false, text });
              focusInput();
            }}
          />
        )}

        {!canPack && (
          <p className="text-base text-muted-foreground">
            Tu rol no puede validar el empaque. Esta estación es para el
            Digitador de Empaque y el Supervisor.
          </p>
        )}

        {order && (
          <>
            {/* Cabecera de la guía abierta */}
            <Card className="flex flex-row flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                    OT <OrderNumberLabel value={order.order_number} />
                  </h2>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-1 text-base text-muted-foreground">
                  {order.worker_name} · {order.company_name} · Ref{" "}
                  <span className="font-mono font-semibold">
                    {order.reference || "—"}
                  </span>{" "}
                  · {order.garment_count} prendas
                </p>
              </div>
              <Button variant="outline" onClick={() => setDetailOpen(true)}>
                Ver OT completa
              </Button>
            </Card>

            {canPack && isPackingStage ? (
              // El panel no pistolea: el escáner de arriba ya cubre prendas y
              // cierre. Abajo queda el progreso y lo que se declara a mano
              // (prenda comprada, boleta, botones de respaldo).
              <PackingPanel order={order} />
            ) : canPack ? (
              <Card>
                <CardContent className="flex items-center gap-3 py-6 text-base text-muted-foreground">
                  <PackageSearch className="size-6 shrink-0" />
                  <span>
                    Esta OT está en estado{" "}
                    <strong>
                      {ORDER_STATUS_LABELS[order.status as OrderStatus] ??
                        order.status}
                    </strong>
                    , fuera de la etapa de empaque. Solo se puede validar mientras
                    el morral está en planta (Recibida, En revisión o Despachada
                    incompleta).
                  </span>
                </CardContent>
              </Card>
            ) : null}

            <OrderDetailDialog
              orderId={order.id}
              open={detailOpen}
              onOpenChange={setDetailOpen}
            />
          </>
        )}
      </div>
    </StationShell>
  );
}

/**
 * Desempate cuando un ref calza con más de un morral abierto. Se muestran los
 * datos que el operador puede contrastar con el morral que tiene al frente
 * —trabajador, empresa y cuándo entró— en vez de pedirle un dato de calendario
 * que la etiqueta no trae.
 */
function AmbiguityPicker({
  ambiguity,
  onResolved,
  onFailed,
}: {
  ambiguity: Ambiguity;
  onResolved: (orderId: number, text: string) => void;
  onFailed: (text: string) => void;
}) {
  return (
    <Card className="flex flex-col gap-3 border-amber-400 p-5">
      <div className="flex items-center gap-2 text-base font-semibold">
        <CircleAlert className="size-5 text-amber-500" />
        Hay {ambiguity.candidates.length} morrales abiertos con el ref{" "}
        <span className="font-mono">{ambiguity.reference}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Elige el morral que tienes al frente: el código calza con más de uno.
      </p>
      <div className="overflow-hidden rounded-xl border">
        {ambiguity.candidates.map((candidate, index) => (
          <CandidateRow
            key={candidate.order_id}
            candidate={candidate}
            pendingLabel={ambiguity.pendingLabel}
            bordered={index > 0}
            onResolved={onResolved}
            onFailed={onFailed}
          />
        ))}
      </div>
    </Card>
  );
}

function CandidateRow({
  candidate,
  pendingLabel,
  bordered,
  onResolved,
  onFailed,
}: {
  candidate: AmbiguousOrderOut;
  pendingLabel: string;
  bordered: boolean;
  onResolved: (orderId: number, text: string) => void;
  onFailed: (text: string) => void;
}) {
  // Una mutación por candidata: el pistoleo pendiente se aplica contra la guía
  // que el operador elija, ya sin ambigüedad que resolver.
  const scan = usePackingScan(candidate.order_id);

  async function choose(): Promise<void> {
    if (!pendingLabel) {
      // Era la boleta: basta con abrir esta guía en el panel.
      onResolved(candidate.order_id, "Morral seleccionado");
      return;
    }
    try {
      const progress = await scan.mutateAsync({
        code: pendingLabel,
        quantity: 1,
      });
      onResolved(
        candidate.order_id,
        `Prenda pistoleada · ${progress.scanned_total}/${progress.declared_total}`,
      );
    } catch (error) {
      onFailed(parseApiError(error).detail);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void choose()}
      disabled={scan.isPending}
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
