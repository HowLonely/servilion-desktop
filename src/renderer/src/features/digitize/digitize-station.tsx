import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StationShell } from "@/components/station-shell";
import { CreateOrderForm } from "@/features/digitize/create-order-form";
import { OrderNumberLabel } from "@/features/orders/components/order-number-label";

import type { components } from "@/lib/api/schema";
import type { ServerStatus } from "@shared/types";

type LaundryOrderOut = components["schemas"]["LaundryOrderOut"];

/**
 * Estación de digitalización de OT. El ciclo es: digitar → confirmar → siguiente,
 * sin sacar la mano del teclado ni salir de la pantalla.
 */
export function DigitizeStation({
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
  const [created, setCreated] = useState<LaundryOrderOut | null>(null);
  // Remontar el formulario es la forma más simple de dejarlo en blanco: no
  // queda ni un dato del morral anterior, que en digitación es justo el error
  // que más caro sale.
  const [formKey, setFormKey] = useState(0);

  function startNext() {
    setCreated(null);
    setFormKey((key) => key + 1);
  }

  return (
    <StationShell
      title="Digitalizar OT"
      description="Pasa al sistema la OT física de la ropa sucia recibida."
      stationName={stationName}
      serverStatus={serverStatus}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
    >
      {created ? (
        <OrderCreatedPanel order={created} onNext={startNext} />
      ) : (
        <CreateOrderForm key={formKey} onCreated={setCreated} />
      )}
    </StationShell>
  );
}

/**
 * Confirmación de la OT guardada. Reemplaza al salto que hace el panel web
 * hacia el detalle de la orden: aquí lo que se necesita es ver el ref que hay
 * que anotar en el morral y seguir con el siguiente.
 */
function OrderCreatedPanel({
  order,
  onNext,
}: {
  order: LaundryOrderOut;
  onNext: () => void;
}) {
  // Enter en cualquier parte encadena la siguiente OT. El botón tiene autoFocus,
  // pero el listener global cubre el caso de que el foco se pierda.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Enter") {
        event.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNext]);

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="size-9" />
      </span>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">OT digitalizada</h2>
        <p className="mt-1 text-base text-muted-foreground">
          {order.worker_name} · {order.company_name}
        </p>
      </div>

      <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
        <DataTile label="N° de OT">
          <OrderNumberLabel value={order.order_number} />
        </DataTile>
        <DataTile label="Ref del morral">
          <span className="font-mono">{order.reference || "—"}</span>
        </DataTile>
      </div>

      <p className="text-lg">
        <strong className="tabular-nums">{order.garment_count}</strong>{" "}
        {order.garment_count === 1 ? "prenda registrada" : "prendas registradas"}
      </p>

      <Button autoFocus size="lg" className="h-14 px-10 text-lg" onClick={onNext}>
        Digitalizar otra OT
        <kbd className="ml-2 rounded border border-primary-foreground/30 px-1.5 py-0.5 font-mono text-xs">
          Enter
        </kbd>
      </Button>
    </div>
  );
}

function DataTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-muted/40 px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-xl font-bold tracking-tight">{children}</span>
    </div>
  );
}
