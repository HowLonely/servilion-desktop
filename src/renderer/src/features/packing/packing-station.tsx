import { useRef, useState } from "react";
import { PackageSearch, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StationShell } from "@/components/station-shell";
import { parseApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-provider";
import { OrderDetailDialog } from "@/features/orders/components/order-detail-dialog";
import { OrderNumberLabel } from "@/features/orders/components/order-number-label";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { PackingPanel } from "@/features/packing/packing-panel";
import { useFindOrderByCode } from "@/features/orders/hooks/use-orders";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/features/orders/lib/status";

import type { components } from "@/lib/api/schema";
import type { ServerStatus } from "@shared/types";

type LaundryOrderOut = components["schemas"]["LaundryOrderOut"];

// El morral solo se puede validar mientras está en planta (post-digitalización
// y antes de despacharse). Coincide con las etapas en que `PackingPanel`
// habilita el pistoleo.
const PACKING_STAGES = ["RECIBIDA", "EN_REVISION", "INCOMPLETA"];

/**
 * Estación de empaque y revisión (paso 6 del flujo). Portada del panel web: se
 * escanea el ref/OT de cualquier prenda para abrir el morral y luego se
 * pistolea prenda por prenda. El único cambio es "Ver OT completa", que en la
 * web navegaba al panel y aquí abre un detalle de solo lectura sin salir de la
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
  const [order, setOrder] = useState<LaundryOrderOut | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const lookup = useFindOrderByCode();

  async function handleScan() {
    const value = code.trim();
    if (!value) return;
    try {
      const found = await lookup.mutateAsync(value);
      setOrder(found);
      setCode("");
      // No se refoca aquí: el panel de empaque toma el foco para pistolear.
    } catch (error) {
      toast.error(parseApiError(error).detail);
      inputRef.current?.focus();
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
        {/* Abrir morral */}
        <Card className="p-5">
          <label
            htmlFor="morral-code"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <ScanLine className="size-5 text-primary" />
            Abrir morral
          </label>
          <div className="mt-2 flex flex-wrap items-stretch gap-2">
            <Input
              id="morral-code"
              ref={inputRef}
              autoFocus
              className="h-14 min-w-64 flex-1 font-mono text-2xl uppercase tracking-wide"
              placeholder="Escanea el ref, la OT o el control…"
              value={code}
              autoComplete="off"
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
              disabled={lookup.isPending}
            >
              Abrir morral
            </Button>
            {order && (
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-5 text-lg"
                onClick={() => {
                  setOrder(null);
                  setCode("");
                  inputRef.current?.focus();
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            El QR de la etiqueta lavable de cada prenda lleva el ref de la OT.
            Escanea cualquier prenda para abrir su morral.
          </p>
        </Card>

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
                    el morral está en planta (Recibida, En revisión o Incompleta).
                  </span>
                </CardContent>
              </Card>
            ) : null}

            <OrderDetailDialog
              orderId={order.id}
              open={detailOpen}
              onOpenChange={(next) => {
                setDetailOpen(next);
                // Al cerrar el detalle el foco vuelve al escáner: si no, el
                // siguiente pistoleo se pierde en el vacío.
                if (!next) inputRef.current?.focus();
              }}
            />
          </>
        )}
      </div>
    </StationShell>
  );
}
