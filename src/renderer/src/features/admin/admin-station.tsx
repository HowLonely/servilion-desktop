import { useState } from "react";

import { cn } from "@/lib/utils";
import { StationShell } from "@/components/station-shell";
import { useSession } from "@/lib/auth/session-provider";
import { ClientsPanel } from "@/features/admin/clients-panel";
import { CompaniesPanel } from "@/features/admin/companies-panel";
import { GarmentsPanel } from "@/features/admin/garments-panel";
import { RolesPanel } from "@/features/admin/roles-panel";
import { SitesPanel } from "@/features/admin/sites-panel";
import { SyncPanel } from "@/features/admin/sync-panel";
import { UsersPanel } from "@/features/admin/users-panel";
import { WorkersHistoryPanel } from "@/features/history/workers-history-panel";

import type { Capabilities } from "@/lib/auth/capabilities";
import type { ServerStatus } from "@shared/types";

type Tab = {
  id: string;
  label: string;
  allowed: (capabilities: Capabilities) => boolean;
  render: () => React.ReactNode;
};

const TABS: Tab[] = [
  { id: "users", label: "Usuarios", allowed: (c) => c.canManageUsers, render: () => <UsersPanel /> },
  { id: "roles", label: "Roles", allowed: (c) => c.canManageUsers, render: () => <RolesPanel /> },
  { id: "clients", label: "Clientes", allowed: (c) => c.canManageCatalog, render: () => <ClientsPanel /> },
  { id: "companies", label: "Empresas", allowed: (c) => c.canManageCatalog, render: () => <CompaniesPanel /> },
  { id: "workers", label: "Trabajadores", allowed: (c) => c.canManageWorkers, render: () => <WorkersHistoryPanel /> },
  { id: "garments", label: "Prendas", allowed: (c) => c.canManageCatalog, render: () => <GarmentsPanel /> },
  { id: "sites", label: "Faenas y campamentos", allowed: (c) => c.canManageCatalog, render: () => <SitesPanel /> },
  { id: "sync", label: "Sincronización", allowed: (c) => c.canManageSync, render: () => <SyncPanel /> },
];

/**
 * Configuración: usuarios, roles y catálogo, administrados desde la planta.
 *
 * Existe en la terminal (y no solo en el panel web) porque la terminal trabaja
 * contra el servidor local: dar de alta a un operador nuevo, una empresa o un
 * trabajador no puede depender de que haya internet. Lo que se crea aquí se
 * sincroniza con la nube como todo lo demás.
 */
export function AdminStation({
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
  const tabs = TABS.filter((tab) => tab.allowed(capabilities));
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <StationShell
      title="Configuración"
      description="Usuarios, roles, catálogo y sincronización."
      stationName={stationName}
      serverStatus={serverStatus}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-1.5 rounded-xl border bg-card p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition",
                tab.id === current?.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {current?.render()}
      </div>
    </StationShell>
  );
}
