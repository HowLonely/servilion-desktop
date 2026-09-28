import { useEffect, useState } from "react";
import { Camera, CheckCircle2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StationShell } from "@/components/station-shell";
import {
  CreateOrderForm,
  type PhotoOutcome,
} from "@/features/digitize/create-order-form";
import { useUploadOrderPhoto } from "@/features/orders/hooks/use-order-photo";
import { parseApiError } from "@/lib/api/errors";
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
  const [created, setCreated] = useState<{
    order: LaundryOrderOut;
    photo: PhotoOutcome;
  } | null>(null);
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
        <OrderCreatedPanel
          order={created.order}
          photo={created.photo}
          onNext={startNext}
        />
      ) : (
        <CreateOrderForm
          key={formKey}
          onCreated={(order, photo) => setCreated({ order, photo })}
        />
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
  photo,
  onNext,
}: {
  order: LaundryOrderOut;
  photo: PhotoOutcome;
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

      <PhotoStatus orderId={order.id} initial={photo} />

      <Button autoFocus size="lg" className="h-14 px-10 text-lg" onClick={onNext}>
        Digitalizar otra OT
        <kbd className="ml-2 rounded border border-primary-foreground/30 px-1.5 py-0.5 font-mono text-xs">
          Enter
        </kbd>
      </Button>
    </div>
  );
}

/**
 * Estado de la foto de la OT. Si no subió, la guía ya está guardada igual: se
 * ofrece reintentar aquí, y si se sigue sin internet se puede subir después
 * desde el detalle de la guía en el panel web.
 */
function PhotoStatus({
  orderId,
  initial,
}: {
  orderId: number;
  initial: PhotoOutcome;
}) {
  const uploadPhoto = useUploadOrderPhoto();
  const [outcome, setOutcome] = useState(initial);

  async function retry() {
    if (outcome.status !== "failed") return;
    try {
      await uploadPhoto.mutateAsync({ orderId, photo: outcome.photo });
      setOutcome({ status: "uploaded" });
    } catch (error) {
      setOutcome({ ...outcome, detail: parseApiError(error).detail });
    }
  }

  if (outcome.status === "none") {
    return <p className="text-sm text-muted-foreground">Guardada sin foto de la OT.</p>;
  }

  if (outcome.status === "uploaded") {
    return (
      <p className="flex items-center gap-2 text-base text-emerald-700">
        <Camera className="size-5" />
        Foto de la OT guardada
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
      <p className="flex items-center gap-2 text-base font-medium">
        <TriangleAlert className="size-5 shrink-0" />
        La OT se guardó, pero la foto no se pudo subir.
      </p>
      <p className="text-sm">{outcome.detail}</p>
      <Button
        variant="outline"
        className="bg-background"
        disabled={uploadPhoto.isPending}
        onClick={() => void retry()}
      >
        {uploadPhoto.isPending ? "Subiendo..." : "Reintentar subida"}
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
