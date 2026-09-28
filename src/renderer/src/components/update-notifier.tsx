import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Aviso de versión nueva de la terminal, ya descargada en segundo plano.
 *
 * No interrumpe: el operador puede estar a mitad de un morral. Si no reinicia,
 * la versión se instala al cerrar la app o, en una terminal que nunca se
 * cierra, sola de madrugada (ver `main/updater.ts`).
 */
export function UpdateNotifier() {
  useEffect(() => {
    function announce(version: string): void {
      toast.info(`Hay una versión nueva de Servilion (${version}).`, {
        id: "servilion-update",
        description: "Se instala sola al cerrar la app, o ahora si reinicias.",
        duration: Infinity,
        action: { label: "Reiniciar ahora", onClick: () => void window.servilion.updates.install() },
      });
    }
    void window.servilion.updates.pending().then((version) => version && announce(version));
    return window.servilion.updates.onReady(announce);
  }, []);

  return null;
}
