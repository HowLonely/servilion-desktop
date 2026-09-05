import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useCamps, useRooms } from "@/features/camps/use-camps";

const NONE_VALUE = "";

/**
 * Selector de habitación en dos pasos: primero el campamento, luego la pieza.
 *
 * Un campamento puede tener cientos de piezas, así que nunca se listan todas
 * juntas: la consulta de habitaciones se dispara recién al elegir campamento.
 * Usa `<select>` nativo, como el resto de los ajustes de esta app (ver
 * `settings-screen.tsx`), en vez del combobox de búsqueda que sí tiene sentido
 * para trabajadores o empresas: un campamento son a lo sumo una decena de
 * opciones, no algo que valga la pena buscar por texto.
 */
export function RoomSelect({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (roomId: number | null) => void;
  className?: string;
}) {
  const [campId, setCampId] = useState<number | null>(null);

  const { data: camps } = useCamps();

  // Al editar un trabajador llega la habitación pero no su campamento: se
  // deduce de la lista completa para dejar los dos selectores en el estado
  // correcto sin que el operador tenga que adivinar dónde vive.
  const { data: roomsAll } = useRooms(undefined, campId === null && value !== null);
  useEffect(() => {
    if (campId !== null || value === null) return;
    const found = roomsAll?.find((room) => room.id === value);
    if (found) setCampId(found.camp_id);
  }, [roomsAll, value, campId]);

  const { data: rooms } = useRooms(campId ?? undefined, campId !== null);

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      <select
        className="h-12 rounded-lg border bg-background px-3 text-base"
        value={campId ?? NONE_VALUE}
        onChange={(event) => {
          const id = event.target.value ? Number(event.target.value) : null;
          setCampId(id);
          // Cambiar de campamento invalida la pieza elegida: el número 101 de
          // un campamento no es el 101 de otro.
          onChange(null);
        }}
      >
        <option value={NONE_VALUE}>Sin campamento</option>
        {camps?.map((camp) => (
          <option key={camp.id} value={camp.id}>
            {camp.name}
          </option>
        ))}
      </select>

      <select
        className="h-12 rounded-lg border bg-background px-3 text-base disabled:opacity-50"
        disabled={campId === null}
        value={value ?? NONE_VALUE}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value={NONE_VALUE}>
          {campId === null ? "Elige campamento" : "Sin habitación"}
        </option>
        {rooms?.map((room) => (
          <option key={room.id} value={room.id}>
            {room.number}
          </option>
        ))}
      </select>
    </div>
  );
}
