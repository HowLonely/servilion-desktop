import { useState } from "react";

import { cn } from "@/lib/utils";
import { StationShell } from "@/components/station-shell";
import { OrdersHistoryPanel } from "@/features/history/orders-history-panel";
import { WorkersHistoryPanel } from "@/features/history/workers-history-panel";

import type { ServerStatus } from "@shared/types";

type View = "orders" | "workers";

/**
 * Estación de consulta: histórico de OT y de trabajadores, en solo lectura
 * salvo para quien administra catálogo (ver `WORKER_MANAGE_ROLES`).
 *
 * No es un puesto físico como las demás estaciones —nadie "hace turno" acá—,
 * pero vive en el mismo menú porque resuelve la misma necesidad que las otras
 * cuatro: una pantalla propia sin depender del panel web para algo que ocurre
 * mientras se digitaliza o se supervisa.
 */
export function HistoryStation({
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
  const [view, setView] = useState<View>("orders");

  return (
    <StationShell
      title="Consultar histórico"
      description="Guías y trabajadores, con los mismos filtros del panel web."
      stationName={stationName}
      serverStatus={serverStatus}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
    >
      <div className="flex flex-col gap-6">
        <div className="flex gap-2 rounded-xl border bg-card p-1.5">
          <ViewTab
            active={view === "orders"}
            label="Órdenes de trabajo"
            onClick={() => setView("orders")}
          />
          <ViewTab
            active={view === "workers"}
            label="Trabajadores"
            onClick={() => setView("workers")}
          />
        </div>

        {view === "orders" ? <OrdersHistoryPanel /> : <WorkersHistoryPanel />}
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
