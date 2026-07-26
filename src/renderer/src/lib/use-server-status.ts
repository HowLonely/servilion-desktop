import { useEffect, useState } from "react";

import type { ServerStatus } from "@shared/types";

/**
 * Estado de la conexión con el servidor, sondeado por el proceso main. El
 * operador tiene que enterarse de que el servidor se cayó antes de digitar una
 * OT entera, no al presionar Guardar.
 */
export function useServerStatus(): {
  status: ServerStatus;
  recheck: () => Promise<void>;
} {
  const [status, setStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    void window.servilion.server.getStatus().then(setStatus);
    return window.servilion.server.onStatusChange(setStatus);
  }, []);

  async function recheck(): Promise<void> {
    setStatus("checking");
    setStatus(await window.servilion.server.check());
  }

  return { status, recheck };
}
