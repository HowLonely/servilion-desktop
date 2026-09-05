import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { StationShell } from "@/components/station-shell";
import { useSession } from "@/lib/auth/session-provider";
import { ReceiveBatchForm } from "@/features/hospitality/receive-batch-form";
import { ReturnCountPanel } from "@/features/hospitality/return-count-panel";

import type { ServerStatus } from "@shared/types";

type View = "receive" | "count";

/**
 * Estación de lencería de hotelería.
 *
 * Es el otro servicio de la planta y no otra pantalla del mismo: lo que entra
 * es lencería a granel del campamento —sábanas, toallas, cortinas—, sin
 * trabajador, sin habitación y sin entrega individual. El sistema antiguo no
 * sabía representarlo y lo forzaba creando trabajadores falsos con el nombre
 * del tipo de lencería; tenerlo aparte es lo que permite dejar de hacer eso.
 *
 * Los dos momentos del lote los operan los mismos puestos que el morral, y por
 * eso están en esta terminal: la recepción de la carga sucia es del digitador
 * de OT y la cuenta de salida es del de empaque. Cada rol ve solo el suyo; el
 * supervisor, que puede los dos, elige arriba.
 */
export function HospitalityStation({
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
  const { canReceiveLinen, canCountLinen } = capabilities;

  const [view, setView] = useState<View>(canReceiveLinen ? "receive" : "count");

  const bothViews = canReceiveLinen && canCountLinen;

  return (
    <StationShell
      title="Lencería de hotelería"
      description="Carga a granel del campamento: cuánto entró, cuánto volvió y la merma."
      stationName={stationName}
      serverStatus={serverStatus}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
    >
      <div className="flex flex-col gap-6">
        {bothViews && (
          <div className="flex gap-2 rounded-xl border bg-card p-1.5">
            <ViewTab
              active={view === "receive"}
              label="Recibir carga"
              onClick={() => setView("receive")}
            />
            <ViewTab
              active={view === "count"}
              label="Contar salida"
              onClick={() => setView("count")}
            />
          </div>
        )}

        {view === "receive" && canReceiveLinen && (
          <ReceiveBatchForm
            onReceived={(batch) => {
              // No se salta a "Contar salida": la lencería acaba de entrar y
              // todavía no vuelve del lavado. Lo que sigue en la mesa es la
              // próxima carga.
              toast.success(`Lote ${batch.batch_number} recibido.`);
            }}
          />
        )}

        {view === "count" && canCountLinen && <ReturnCountPanel />}
      </div>
    </StationShell>
  );
}

function ViewTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-12 flex-1 rounded-lg px-4 text-base font-semibold transition",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
