import { useState } from "react";

import { cn } from "@/lib/utils";
import { StationShell } from "@/components/station-shell";
import { useSession } from "@/lib/auth/session-provider";
import { BalancesPanel } from "@/features/hospitality/balances-panel";
import { DispatchPanel } from "@/features/hospitality/dispatch-panel";

import type { ServerStatus } from "@shared/types";

type View = "dispatch" | "balances";

/**
 * Estación de lencería de hotelería.
 *
 * Es el otro servicio de la planta y no otra pantalla del mismo: la lencería
 * es un stock del cliente que rota entre la planta y sus campamentos, sin
 * trabajador, sin habitación y sin entrega individual.
 *
 * De ese circuito, en la planta solo ocurre el despacho de lo limpio hacia la
 * faena, y lo hace el digitador de empaque. El reparto a cada campamento y el
 * retiro del sucio se registran en faena con la app móvil. Los saldos se
 * consultan aquí; corregirlos (conteo de inventario) es del administrador en
 * el panel web.
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
  const { canDispatchLinen } = capabilities;

  const [view, setView] = useState<View>(canDispatchLinen ? "dispatch" : "balances");

  return (
    <StationShell
      title="Lencería de hotelería"
      description="Despacho de lencería limpia a faena y saldo de cada campamento."
      stationName={stationName}
      serverStatus={serverStatus}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
    >
      <div className="flex flex-col gap-6">
        {canDispatchLinen && (
          <div className="flex gap-2 rounded-xl border bg-card p-1.5">
            <ViewTab
              active={view === "dispatch"}
              label="Despachar a faena"
              onClick={() => setView("dispatch")}
            />
            <ViewTab
              active={view === "balances"}
              label="Saldos"
              onClick={() => setView("balances")}
            />
          </div>
        )}

        {view === "dispatch" && canDispatchLinen && <DispatchPanel />}
        {view === "balances" && <BalancesPanel />}
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
