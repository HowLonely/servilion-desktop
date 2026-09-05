import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dateInputDaysAgo, dayRangeToIsoUtc, formatDateTime } from "@/lib/date";
import { CompanySelect } from "@/features/companies/company-select";
import { OrderDetailDialog } from "@/features/orders/components/order-detail-dialog";
import { OrderNumberLabel } from "@/features/orders/components/order-number-label";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/features/orders/lib/status";
import { ORDERS_PAGE_SIZE, useOrders } from "@/features/orders/hooks/use-orders";

// Rango por defecto: el histórico legado ronda las 280.000 guías (ver
// `orders/services.py::list_orders`), así que un listado sin ventana de fecha
// no es viable ni siquiera con los demás filtros vacíos.
const DEFAULT_RANGE_DAYS = 30;

/**
 * Histórico de OT: filtros + listado paginado + detalle de solo lectura.
 *
 * Reutiliza `OrderDetailDialog` tal cual, sin cambios: ya es la vista de
 * consulta que usa el empaque para "Ver OT completa", y acá cumple exactamente
 * el mismo rol.
 */
export function OrdersHistoryPanel() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState(dateInputDaysAgo(DEFAULT_RANGE_DAYS));
  const [dateTo, setDateTo] = useState(dateInputDaysAgo(0));
  const [offset, setOffset] = useState(0);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const { data: page, isLoading } = useOrders({
    search: search || undefined,
    status: status || undefined,
    company_id: companyId,
    ...dayRangeToIsoUtc(dateFrom, dateTo),
    limit: ORDERS_PAGE_SIZE,
    offset,
  });

  const orders = page?.items ?? [];
  const total = page?.count ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + ORDERS_PAGE_SIZE, total);

  function resetAnd(update: () => void): void {
    update();
    setOffset(0);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="OT, ref, control, RUT o nombre…"
            value={search}
            onChange={(e) => resetAnd(() => setSearch(e.target.value))}
          />
        </div>
        <div className="w-56">
          <CompanySelect
            value={companyId}
            onChange={(id) => resetAnd(() => setCompanyId(id))}
            placeholder="Todas las empresas"
            includeAllOption="Todas las empresas"
          />
        </div>
        <select
          className="h-11 rounded-lg border bg-background px-3 text-base"
          value={status}
          onChange={(e) => resetAnd(() => setStatus(e.target.value))}
        >
          <option value="">Todos los estados</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input
            type="date"
            className="h-11 w-40"
            value={dateFrom}
            onChange={(e) => resetAnd(() => setDateFrom(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input
            type="date"
            className="h-11 w-40"
            value={dateTo}
            onChange={(e) => resetAnd(() => setDateTo(e.target.value))}
          />
        </div>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && orders.length === 0 && (
        <Card className="p-8 text-center text-base text-muted-foreground">
          No se encontraron guías con estos filtros.
        </Card>
      )}

      {orders.length > 0 && (
        <div className="overflow-hidden rounded-xl border">
          {orders.map((order, index) => (
            <button
              key={order.id}
              type="button"
              onClick={() => setOpenOrderId(order.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/60",
                index > 0 && "border-t",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-base font-semibold">
                  OT <OrderNumberLabel value={order.order_number} />
                  <span className="font-mono text-sm font-normal text-muted-foreground">
                    Ref {order.reference || "—"}
                  </span>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {order.worker_name} · {order.company_name} ·{" "}
                  {formatDateTime(order.received_at)}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </button>
          ))}
        </div>
      )}

      {total > ORDERS_PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {from}–{to} de {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - ORDERS_PAGE_SIZE))}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={to >= total}
              onClick={() => setOffset((o) => o + ORDERS_PAGE_SIZE)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {openOrderId !== null && (
        <OrderDetailDialog
          orderId={openOrderId}
          open={openOrderId !== null}
          onOpenChange={(open) => !open && setOpenOrderId(null)}
        />
      )}
    </div>
  );
}
