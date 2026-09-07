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
import {
  COMPANIES_SELECT_LIMIT,
  useCompanies,
  useCompany,
} from "@/features/companies/use-companies";

// Portado del panel web (features/companies/components/company-select.tsx) sin
// cambios de fondo: mismo combobox que WorkerSelect, mismos hooks de datos.
const SEARCH_DEBOUNCE_MS = 300;

export function CompanySelect({
  value,
  onChange,
  placeholder = "Selecciona una empresa",
  includeAllOption,
  disabled,
}: {
  value: number | undefined;
  onChange: (companyId: number | undefined) => void;
  placeholder?: string;
  includeAllOption?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: page, isLoading } = useCompanies({
    search: debouncedSearch || undefined,
    is_active: true,
    limit: COMPANIES_SELECT_LIMIT,
  });
  const companies = page?.items;

  // La empresa ya elegida puede no estar en la página de resultados actual
  // (ej. si se cambió la búsqueda después de seleccionar), así que se
  // resuelve aparte para mostrar su nombre en el botón.
  const { data: selectedCompany } = useCompany(value);
  const selected = companies?.find((c) => c.id === value) ?? selectedCompany;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          disabled={disabled}
          className="h-12 w-full justify-between font-normal"
        >
          <span className="truncate">{selected ? selected.name : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!isLoading && !companies?.length && (
              <CommandEmpty>No se encontraron empresas.</CommandEmpty>
            )}
            <CommandGroup>
              {includeAllOption && (
                <CommandItem
                  value="__all__"
                  onSelect={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === undefined ? "opacity-100" : "opacity-0")}
                  />
                  {includeAllOption}
                </CommandItem>
              )}
              {companies?.map((company) => (
                <CommandItem
                  key={company.id}
                  value={String(company.id)}
                  onSelect={() => {
                    onChange(company.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", company.id === value ? "opacity-100" : "opacity-0")}
                  />
                  {company.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
