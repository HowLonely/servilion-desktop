import { useCallback, useEffect, useState } from "react";

import type { StationConfig } from "@shared/types";

/** Ajustes del equipo, leídos del proceso main y persistidos por él. */
export function useStationConfig(): {
  config: StationConfig | null;
  update: (patch: Partial<StationConfig>) => Promise<StationConfig>;
} {
  const [config, setConfig] = useState<StationConfig | null>(null);

  useEffect(() => {
    void window.servilion.config.get().then(setConfig);
  }, []);

  const update = useCallback(async (patch: Partial<StationConfig>) => {
    const next = await window.servilion.config.set(patch);
    setConfig(next);
    return next;
  }, []);

  return { config, update };
}
