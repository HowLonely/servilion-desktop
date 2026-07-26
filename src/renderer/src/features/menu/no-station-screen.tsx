import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fullName, roleLabel } from "@/lib/auth/capabilities";
import { useSession } from "@/lib/auth/session-provider";

/**
 * El usuario inició sesión, pero su rol no habilita ninguna de las dos
 * estaciones (ej. un rol de solo consulta). Mejor decirlo claro que dejarlo
 * frente a una pantalla que le va a devolver 403 al primer intento.
 */
export function NoStationScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user, logout } = useSession();

  return (
    <div className="flex h-full items-center justify-center bg-muted/30 p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="flex size-14 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <ShieldAlert className="size-7" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Esta cuenta no puede operar la terminal
        </h1>
        <p className="text-base text-muted-foreground">
          {user ? (
            <>
              <strong>{fullName(user)}</strong> tiene el rol{" "}
              <strong>{roleLabel(user.role)}</strong>, que no habilita digitalizar
              OT ni el empaque. Pide a un supervisor que revise tu rol, o inicia
              sesión con otra cuenta.
            </>
          ) : null}
        </p>
        <div className="mt-2 flex gap-2">
          <Button onClick={() => void logout()}>Cambiar de usuario</Button>
          <Button variant="outline" onClick={onOpenSettings}>
            Ajustes del equipo
          </Button>
        </div>
      </div>
    </div>
  );
}
