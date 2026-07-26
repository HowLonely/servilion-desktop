import { useState } from "react";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServerStatusBadge } from "@/components/server-status-badge";

import type { ServerStatus } from "@shared/types";
import { useSession } from "@/lib/auth/session-provider";

/**
 * Login de la terminal. Se ve una vez por equipo, no todos los días: por eso el
 * "mantener sesión" viene marcado. Los campos son grandes porque los opera
 * personal de planta, muchas veces con guantes.
 *
 * El acceso a Ajustes vive aquí a propósito: en un equipo recién instalado la
 * dirección del servidor todavía no es la correcta, y sin sesión no hay
 * cabecera desde donde llegar a ellos.
 */
export function LoginScreen({
  stationName,
  serverStatus,
  onOpenSettings,
}: {
  stationName: string;
  serverStatus: ServerStatus;
  onOpenSettings: () => void;
}) {
  const { login } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Escribe tu usuario y contraseña.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await login({
      username: username.trim(),
      password,
      rememberSession,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.detail);
      setPassword("");
    }
  }

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <ServerStatusBadge status={serverStatus} />
        <Button variant="ghost" size="sm" onClick={onOpenSettings}>
          <Settings className="size-4" />
          Ajustes del equipo
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Servilion</h1>
            <p className="mt-1 text-base text-muted-foreground">
              Terminal de digitalización
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm font-medium">
                Usuario
              </label>
              <Input
                id="username"
                autoFocus
                autoComplete="username"
                className="h-13 text-lg"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-13 text-lg"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-5 accent-primary"
                checked={rememberSession}
                onChange={(event) => setRememberSession(event.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium">
                  Mantener la sesión iniciada en este equipo
                </span>
                <span className="block text-muted-foreground">
                  La terminal quedará lista para digitar cada vez que se encienda,
                  sin pedir la contraseña.
                </span>
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-base font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="h-13 w-full text-lg" disabled={submitting}>
              {submitting ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {stationName ? `Equipo: ${stationName}` : "Servilion"}
          </p>
        </div>
      </div>
    </div>
  );
}
