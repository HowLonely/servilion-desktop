import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorker } from "@/features/workers/use-workers";

/**
 * Detalle de un trabajador en SOLO LECTURA.
 *
 * Es lo que ven DIGITADOR_OT y SUPERVISOR: pueden consultar el histórico
 * completo de trabajadores, pero crear/editar/desactivar es catálogo y queda
 * para ADMIN (ver `WorkerFormDialog`, que este componente no importa a
 * propósito — así un error de props nunca deja un botón de editar visible
 * donde no corresponde).
 */
export function WorkerViewDialog({
  workerId,
  open,
  onOpenChange,
}: {
  workerId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: worker, isLoading } = useWorker(open ? workerId : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{worker?.full_name ?? "Trabajador"}</DialogTitle>
          <DialogDescription>
            Vista de consulta. Para editar, usa el panel web o pide a un
            administrador.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <Skeleton className="h-56 w-full" />}

        {worker && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Row label="Código/credencial" value={worker.badge_code} mono />
            <Row label="RUN" value={worker.national_id || "—"} mono />
            <Row
              label="Campamento"
              value={worker.camp_name || "Sin campamento"}
            />
            <Row label="Habitación" value={worker.room_number || "—"} />
            <Row label="Turno" value={worker.shift || "—"} />
            <Row label="Cargo" value={worker.position || "—"} />
            <Row label="Área" value={worker.area || "—"} />
            <Row label="Teléfono" value={worker.phone || "—"} />
            <Row label="Estado" value={worker.is_active ? "Activo" : "Inactivo"} />
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}
