import { useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { parseApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-provider";
import { CompanySelect } from "@/features/companies/company-select";
import { WorkerFormDialog } from "@/features/workers/worker-form-dialog";
import { WorkerViewDialog } from "@/features/workers/worker-view-dialog";
import {
  useDeactivateWorker,
  useWorkers,
  WORKERS_PAGE_SIZE,
} from "@/features/workers/use-workers";

import type { components } from "@/lib/api/schema";

type WorkerOut = components["schemas"]["WorkerOut"];
type ActiveFilter = "true" | "false" | "all";

/**
 * Histórico de trabajadores. Todos los roles de `HISTORY_ROLES` consultan;
 * solo quien tiene `canManageWorkers` (ADMIN) ve el botón de crear y puede
 * editar o desactivar desde la fila — el resto abre la misma fila en solo
 * lectura (`WorkerViewDialog`).
 */
export function WorkersHistoryPanel() {
  const { capabilities } = useSession();
  const canManage = capabilities.canManageWorkers;

  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [offset, setOffset] = useState(0);

  const [viewingId, setViewingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<WorkerOut | "new" | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState<number | null>(null);

  const { data: page, isLoading } = useWorkers({
    search: search || undefined,
    company_id: companyId,
    is_active: activeFilter === "all" ? undefined : activeFilter === "true",
    limit: WORKERS_PAGE_SIZE,
    offset,
  });
  const deactivateWorker = useDeactivateWorker();

  const workers = page?.items ?? [];
  const total = page?.count ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + WORKERS_PAGE_SIZE, total);

  function resetAnd(update: () => void): void {
    update();
    setOffset(0);
  }

  async function handleDeactivate(workerId: number): Promise<void> {
    try {
      await deactivateWorker.mutateAsync(workerId);
      toast.success("Trabajador desactivado.");
      setConfirmingDeactivate(null);
    } catch (error) {
      toast.error(parseApiError(error).detail);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder="Buscar por nombre o código…"
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
            value={activeFilter}
            onChange={(e) => resetAnd(() => setActiveFilter(e.target.value as ActiveFilter))}
          >
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
            <option value="all">Todos</option>
          </select>
        </div>

        {canManage && (
          <Button size="lg" className="h-11" onClick={() => setEditing("new")}>
            Nuevo trabajador
          </Button>
        )}
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && workers.length === 0 && (
        <Card className="p-8 text-center text-base text-muted-foreground">
          No se encontraron trabajadores con estos filtros.
        </Card>
      )}

      {workers.length > 0 && (
        <div className="overflow-hidden rounded-xl border">
          {workers.map((worker, index) => (
            <div
              key={worker.id}
              className={cn(
                "flex flex-wrap items-center gap-3 bg-card px-4 py-3",
                index > 0 && "border-t",
                !worker.is_active && "opacity-60",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  canManage ? setEditing(worker) : setViewingId(worker.id)
                }
              >
                <p className="truncate text-base font-semibold">
                  {worker.full_name}
                  <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                    {worker.badge_code}
                  </span>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {[
                    worker.camp_name && worker.room_number
                      ? `${worker.camp_name} · ${worker.room_number}`
                      : worker.camp_name,
                    worker.shift && `Turno ${worker.shift}`,
                    worker.position,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sin datos de faena"}
                </p>
              </button>

              {!worker.is_active && (
                <span className="shrink-0 rounded-full border px-3 py-1 text-sm text-muted-foreground">
                  Inactivo
                </span>
              )}

              {canManage && worker.is_active && (
                confirmingDeactivate === worker.id ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deactivateWorker.isPending}
                      onClick={() => void handleDeactivate(worker.id)}
                    >
                      {deactivateWorker.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Ban className="size-4" />
                      )}
                      Sí, desactivar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmingDeactivate(null)}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setConfirmingDeactivate(worker.id)}
                  >
                    <Ban className="size-4" />
                    Desactivar
                  </Button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {total > WORKERS_PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {from}–{to} de {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - WORKERS_PAGE_SIZE))}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={to >= total}
              onClick={() => setOffset((o) => o + WORKERS_PAGE_SIZE)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {viewingId !== null && (
        <WorkerViewDialog
          workerId={viewingId}
          open={viewingId !== null}
          onOpenChange={(open) => !open && setViewingId(null)}
        />
      )}

      {canManage && editing !== null && (
        <WorkerFormDialog
          worker={editing === "new" ? undefined : editing}
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </div>
  );
}
