import { createContext, useContext, useEffect } from "react";

/**
 * Modo táctil de la terminal.
 *
 * El valor viene de `StationConfig.touchMode` (Ajustes del equipo) y se publica
 * por contexto en vez de leerse del config en cada componente: la mitad de las
 * pantallas necesita saberlo para decidir si muestra un teclado en pantalla o
 * un atajo de teclado, y pasarlo por props las obligaría a recibirlo todas.
 *
 * Además se refleja como `data-touch` en el <html>, que es donde engancha el
 * CSS (ver `index.css`). Así lo puramente visual —tamaño de objetivo, escala
 * tipográfica— se resuelve en una hoja de estilos y no repartido en clases.
 */
const TouchModeContext = createContext(false);

export function TouchModeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // `data-touch` y no una clase: es un estado del equipo, no un tema.
    document.documentElement.dataset.touch = String(enabled);
  }, [enabled]);

  return <TouchModeContext.Provider value={enabled}>{children}</TouchModeContext.Provider>;
}

export function useTouchMode(): boolean {
  return useContext(TouchModeContext);
}
