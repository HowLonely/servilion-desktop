import { useState } from "react";
import { CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/date";
import { parseApiError } from "@/lib/api/errors";
import { AdminList, AdminRow, Pager, Pill } from "@/features/admin/admin-kit";
import { useResolveSyncIssue, useSyncIssues, useSyncStatus } from "@/features/admin/use-admin";

const ISSUE_LABELS: Record<string, string> = {
  DESCARTADO: "Edición descartada",
  RENOMBRADO: "Nombre duplicado",
  DUPLICADO: "Registro duplicado",
  ERROR: "Error",
};

const TABLE_LABELS: Record<string, string> = {
  authentication_user: "Usuario",
  authentication_staffrole: "Rol",
  workers_worker: "Trabajador",
  companies_company: "Empresa",
  companies_client: "Cliente",
  companies_clientgarmentprice: "Precio",
  garments_garmenttype: "Prenda",
  camps_faena: "Faena",
  camps_camp: "Campamento",
  camps_room: "Habitación",
  orders_laundryorder: "Guía",
};

/**
 * Estado del servidor local y lo que la sincronización resolvió sola.
 *
 * Las incidencias no requieren acción para que el sistema siga funcionando: la
 * sincronización ya decidió con una regla fija. Están para que alguien revise,
 * por ejemplo, que el usuario "juan~0042" es un duplicado que conviene renombrar.
 */
export function SyncPanel() {
  const { data: status, isLoading, refetch, isFetching } = useSyncStatus();
  const [showResolved, setShowResolved] = useState(false);
  const [offset, setOffset] = useState(0);
  const { data: issues, isLoading: loadingIssues } = useSyncIssues(showResolved ? undefined : false, offset);
  const resolve = useResolveSyncIssue();

  return (
    <div className="flex flex-col gap-6">
      {isLoading || !status ? (
        <Skeleton className="h-40 w-full" />
      ) : status.node === "edge" ? (
        <Card className="gap-4 p-6">
          <div className="flex items-center gap-3">
            {status.online ? (
              <CheckCircle2 className="size-8 text-emerald-600" />
            ) : (
              <CloudOff className="size-8 text-destructive" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">
                {status.online ? "Servidor local conectado a la nube" : "Servidor local sin conexión a la nube"}
              </p>
              <p className="truncate text-sm text-muted-foreground">{status.cloud_url || "Nube sin configurar"}</p>
            </div>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
              Actualizar
            </Button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="Cambios por enviar" value={String(status.pending_changes)} />
            <Stat label="Último envío" value={status.last_push_at ? formatDateTime(status.last_push_at) : "—"} />
            <Stat label="Última recepción" value={status.last_pull_at ? formatDateTime(status.last_pull_at) : "—"} />
          </dl>
          <p className="text-sm text-muted-foreground">
            La planta trabaja siempre contra este servidor. Sin internet, los cambios esperan aquí y se envían
            solos al volver la conexión. Se guardan los últimos {status.retention_days} días de guías y pesajes;
            lo anterior se consulta en la nube.
          </p>
          {status.last_error && !status.online && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{status.last_error}</p>
          )}
        </Card>
      ) : (
        <Card className="gap-3 p-6">
          <p className="text-lg font-semibold">Esta terminal está conectada directo a la nube</p>
          <p className="text-sm text-muted-foreground">
            Las operaciones de planta (pesaje, digitalización, empaque y despachos) se hacen contra el servidor
            local. Configura su dirección en Ajustes → Servidor.
          </p>
          {status.nodes.map((node) => (
            <div key={node.name} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <span className="flex-1 font-medium">{node.name}</span>
              <Pill tone={node.online ? "primary" : "warning"}>{node.online ? "En línea" : "Sin conexión"}</Pill>
            </div>
          ))}
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Incidencias de sincronización</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={showResolved}
            onChange={(event) => {
              setShowResolved(event.target.checked);
              setOffset(0);
            }}
          />
          Mostrar revisadas
        </label>
      </div>

      <AdminList
        isLoading={loadingIssues}
        isEmpty={(issues?.items ?? []).length === 0}
        emptyText="No hay incidencias pendientes."
      >
        {(issues?.items ?? []).map((issue, index) => (
          <AdminRow
            key={issue.id}
            first={index === 0}
            inactive={issue.resolved_at !== null}
            title={`${TABLE_LABELS[issue.table] ?? issue.table} #${issue.row_id}`}
            subtitle={`${formatDateTime(issue.created_at)} · ${issue.detail}`}
            badges={<Pill tone={issue.kind === "ERROR" ? "warning" : "muted"}>{ISSUE_LABELS[issue.kind] ?? issue.kind}</Pill>}
            actions={
              issue.resolved_at === null && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate(issue.id, {
                      onError: (error) => toast.error(parseApiError(error).detail),
                    })
                  }
                >
                  Marcar revisada
                </Button>
              )
            }
          />
        ))}
      </AdminList>
      <Pager offset={offset} total={issues?.count ?? 0} onChange={setOffset} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
