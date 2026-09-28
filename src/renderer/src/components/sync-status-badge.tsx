import { Cloud, CloudOff, CloudUpload, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSyncStatus } from "@/features/admin/use-admin";

const BASE = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

/**
 * Estado de la sincronización del servidor local con la nube.
 *
 * Complementa a `ServerStatusBadge`, que dice si esta terminal llega a su
 * servidor. Este dice si ese servidor llega a internet. Son cosas distintas a
 * propósito: sin internet la planta sigue trabajando, así que no es un error,
 * es un aviso de que lo hecho todavía no está en la nube.
 */
export function SyncStatusBadge({ className }: { className?: string }) {
  const { data: status } = useSyncStatus();
  if (!status) return null;

  if (status.node === "cloud") {
    return (
      <span
        className={cn(BASE, "bg-amber-50 text-amber-800 ring-amber-200", className)}
        title="Pesaje, digitalización, empaque y despachos se hacen contra el servidor local de la planta."
      >
        <TriangleAlert className="size-3.5" />
        Conectado a la nube, no al servidor local
      </span>
    );
  }

  if (!status.online) {
    return (
      <span
        className={cn(BASE, "bg-amber-50 text-amber-800 ring-amber-200", className)}
        title="La planta sigue trabajando. Los cambios se envían solos cuando vuelva internet."
      >
        <CloudOff className="size-3.5" />
        Sin internet{status.pending_changes > 0 ? ` · ${status.pending_changes} por enviar` : ""}
      </span>
    );
  }

  if (status.pending_changes > 0) {
    return (
      <span className={cn(BASE, "bg-sky-50 text-sky-700 ring-sky-200", className)}>
        <CloudUpload className="size-3.5" />
        Enviando {status.pending_changes}
      </span>
    );
  }

  return (
    <span className={cn(BASE, "bg-emerald-50 text-emerald-700 ring-emerald-200", className)}>
      <Cloud className="size-3.5" />
      Nube al día
    </span>
  );
}
