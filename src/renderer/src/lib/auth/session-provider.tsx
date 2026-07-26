import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { capabilitiesOf, type Capabilities } from "@/lib/auth/capabilities";

import type { LoginRequest, LoginResult, SessionUser } from "@shared/types";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = {
  user: SessionUser | null;
  status: SessionStatus;
  capabilities: Capabilities;
  login: (payload: LoginRequest) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * A diferencia del panel web, aquí no hay tokens que restaurar: el proceso main
 * ya intentó reanudar la sesión antes de abrir la ventana, así que basta con
 * preguntarle en qué quedó.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    void window.servilion.session.get().then((state) => {
      if (cancelled) return;
      if (state.status === "authenticated") {
        setUser(state.user);
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
    });

    // El refresh token caducó del todo (30 días sin usar el equipo, o la cuenta
    // fue desactivada): main cerró la sesión y hay que volver al login.
    const unsubscribe = window.servilion.session.onExpired(() => {
      setUser(null);
      setStatus("unauthenticated");
      queryClient.clear();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [queryClient]);

  const login = useCallback(async (payload: LoginRequest): Promise<LoginResult> => {
    const result = await window.servilion.session.login(payload);
    if (result.ok) {
      setUser(result.user);
      setStatus("authenticated");
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await window.servilion.session.logout();
    setUser(null);
    setStatus("unauthenticated");
    // Sin esto, el siguiente operador que inicie sesión vería por un instante
    // los datos en caché del turno anterior.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({ user, status, capabilities: capabilitiesOf(user), login, logout }),
    [user, status, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession debe usarse dentro de <SessionProvider>.");
  return context;
}
