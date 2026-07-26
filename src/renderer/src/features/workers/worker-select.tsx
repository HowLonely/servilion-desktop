
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useWorker, useWorkers } from "@/features/workers/use-workers";

// Tope de resultados del combobox: es una búsqueda asistida por el backend,
// no un listado completo, así que no necesita más que un puñado de aciertos.
const SELECT_RESULTS_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

export function WorkerSelect({
  value,
  onChange,
  triggerClassName,
}: {
  value: number | undefined;
  onChange: (workerId: number | undefined) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: page, isLoading } = useWorkers({
    search: debouncedSearch || undefined,
    is_active: true,
    limit: SELECT_RESULTS_LIMIT,
  });
  const workers = page?.items;

  // El trabajador ya elegido puede no estar en la página de resultados
  // actual (ej. si se cambió la búsqueda después de seleccionar), así que se
  // resuelve aparte para mostrar su nombre en el botón.
  const { data: selectedWorker } = useWorker(value);
  const selected = workers?.find((w) => w.id === value) ?? selectedWorker;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", triggerClassName)}
        >
          {selected ? `${selected.full_name} (${selected.badge_code})` : "Selecciona un trabajador"}
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre o código..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!isLoading && (
              <CommandEmpty>
                {search
                  ? "No se encontraron trabajadores."
                  : "Escribe para buscar un trabajador."}
              </CommandEmpty>
            )}
            <CommandGroup>
              {workers?.map((worker) => (
                <CommandItem
                  key={worker.id}
                  value={String(worker.id)}
                  onSelect={() => {
                    onChange(worker.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      worker.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{worker.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {worker.badge_code} · {worker.camp_name || "Sin campamento"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {page && page.count > SELECT_RESULTS_LIMIT && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Mostrando {SELECT_RESULTS_LIMIT} de {page.count}. Afina la
                búsqueda para encontrar al trabajador.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
