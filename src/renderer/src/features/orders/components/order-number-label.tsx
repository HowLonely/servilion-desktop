import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { reconstructedOrderNumberReason } from "@/features/orders/lib/order-number";

const NO_OT_REASON =
  "El trabajador no registró un número de OT en el papel físico; la guía se identifica por su ref.";

// Marca visualmente los OT que no vienen "limpios": null (el trabajador no
// escribió nada — el digitador tipea "0" y el backend lo normaliza a null) o
// reconstruidos por el import legado (sufijo "-L<id>"). El ícono lleva el
// detalle en `title` (tooltip nativo), igual que el resto de la tabla de
// atascadas.
export function OrderNumberLabel({
  value,
  className,
}: {
  value: string | null;
  className?: string;
}) {
  if (!value) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-muted-foreground italic", className)}
        title={NO_OT_REASON}
      >
        Sin OT
        <Info className="size-3.5 shrink-0" />
      </span>
    );
  }

  const reason = reconstructedOrderNumberReason(value);
  if (!reason) return <>{value}</>;

  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={reason}>
      {value}
      <Info className="size-3.5 shrink-0 text-muted-foreground" />
    </span>
  );
}
