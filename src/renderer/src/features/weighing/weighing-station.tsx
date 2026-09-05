import { useState } from "react";

import { StationShell } from "@/components/station-shell";
import { WeighingPanel } from "@/features/weighing/weighing-panel";
import { ShiftWeighIns } from "@/features/weighing/shift-weigh-ins";

import type { ServerStatus } from "@shared/types";

/**
 * Estación 1 de Antofagasta: la báscula de recepción.
 *
 * Es lo primero que le pasa al morral cuando llega la ropa sucia, antes de
 * digitalizar nada (FLUJO_NEGOCIO.md §4, paso 4). El operador declara de quién
 * es el morral, cuántas prendas trae y cuánto pesa; el sistema emite el `ref` y
 * saca por la etiquetera un adhesivo por prenda más el ticket que después lee
 * el digitador.
 *
 * Está pensada para una pantalla táctil y de pie: aquí no hay teclado ni
 * pistola, solo dedos sobre el vidrio.
 */
export function WeighingStation({
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
  // La lista del turno se abre bajo demanda: ocupa la pantalla completa y lo
  // normal es pesar, no corregir.
  const [showShift, setShowShift] = useState(false);

  return (
    <StationShell
      title="Pesaje y etiquetado"
      description="Pesa el morral sucio e imprime sus etiquetas"
      stationName={stationName}
      serverStatus={serverStatus}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
    >
      {showShift ? (
        <ShiftWeighIns onClose={() => setShowShift(false)} />
      ) : (
        <WeighingPanel onOpenShift={() => setShowShift(true)} />
      )}
    </StationShell>
  );
}
