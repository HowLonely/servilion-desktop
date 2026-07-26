import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/date";
import { OrderNumberLabel } from "@/features/orders/components/order-number-label";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { useOrder } from "@/features/orders/hooks/use-orders";

/**
 * Detalle de la OT en SOLO LECTURA. En el panel web, "Ver OT completa" navega a
 * una página donde además se cambia el estado, se suben fotos y se imprime la
 * boleta. Esta terminal es de digitalización: aquí solo se consulta, para
 * resolver una duda durante el empaque sin salir de la estación ni poder tocar
 * nada por error.
 */
export function OrderDetailDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: order, isLoading } = useOrder(open ? orderId : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3 text-xl">
            {order ? (
              <>
                OT <OrderNumberLabel value={order.order_number} />
                <OrderStatusBadge status={order.status} />
              </>
            ) : (
              "OT"
            )}
          </DialogTitle>
          <DialogDescription>
            Vista de consulta. Para editar la OT, usa el panel web.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <Skeleton className="h-64 w-full" />}

        {order && (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Row label="Trabajador" value={order.worker_name} />
              <Row label="Empresa" value={order.company_name} />
              <Row label="Cliente" value={order.client_name} />
              <Row label="Turno" value={order.shift || "—"} />
              <Row label="Ref" value={order.reference || "—"} mono />
              <Row label="Código de control" value={order.control_code || "—"} mono />
              <Row label="Recibida" value={formatDateTime(order.received_at)} />
              <Row
                label="Peso del morral"
                value={order.weight_kg != null ? `${order.weight_kg} kg` : "—"}
              />
            </dl>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold tracking-tight">
                Prendas declaradas ({order.garment_count})
              </h3>
              <div className="overflow-hidden rounded-xl border">
                {order.items.map((item, index) => (
                  <div
                    key={`${item.garment_type_id ?? "libre"}-${item.name}-${index}`}
                    className={`flex items-center gap-3 px-3 py-2.5 text-base ${
                      index > 0 ? "border-t" : ""
                    }`}
                  >
                    <span className="min-w-16 shrink-0 rounded-md bg-muted px-2 py-1 text-center font-mono text-sm font-bold tabular-nums">
                      {item.code || "S/C"}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.name}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {item.scanned_quantity}
                      <span className="text-muted-foreground">/{item.quantity}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {order.observations && (
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold tracking-tight">
                  Observaciones
                </h3>
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">
                  {order.observations}
                </p>
              </div>
            )}
          </div>
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
