import { Delete } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Teclado numérico en pantalla para la báscula.
 *
 * Existe porque la estación de pesaje no tiene teclado físico: el operador está
 * de pie frente a una balanza con las manos ocupadas por el morral. Las teclas
 * son deliberadamente grandes —lo caro de este puesto no es el tiempo de tocar
 * un número, es tener que corregir un peso mal tecleado que ya salió impreso en
 * nueve adhesivos.
 *
 * Escribe sobre una cadena y no sobre un número para que el valor a medio
 * teclear siga siendo representable: "5." es un estado legítimo mientras el
 * operador va escribiendo "5.7", y un `number` no puede sostenerlo.
 */
export function NumericKeypad({
  value,
  onChange,
  /** Los pesos llevan coma; las cantidades de prendas, no. */
  allowDecimal = false,
  /** Dígitos enteros como máximo, para que no entre un número imposible. */
  maxIntegerDigits = 4,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
  maxIntegerDigits?: number;
  className?: string;
}) {
  function press(key: string): void {
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }

    if (key === ".") {
      // Una sola coma, y nunca como primer carácter: "0.5" se teclea desde el
      // cero, que es lo que muestra la balanza.
      if (!allowDecimal || value.includes(".") || value === "") return;
      onChange(`${value}.`);
      return;
    }

    const [integer = "", decimal = ""] = value.split(".");
    if (value.includes(".")) {
      // Dos decimales: es la precisión de `weight_kg` en la base de datos, así
      // que un tercero se perdería al guardar.
      if (decimal.length >= 2) return;
    } else if (integer.length >= maxIntegerDigits) {
      return;
    }

    // Sin ceros a la izquierda: "05" es un tipeo, no un número.
    onChange(value === "0" ? key : `${value}${key}`);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowDecimal ? "." : "", "0", "back"];

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {keys.map((key, index) =>
        key === "" ? (
          <span key={`empty-${index}`} aria-hidden />
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "back" ? "Borrar" : key === "." ? "Coma decimal" : key}
            className="flex h-16 items-center justify-center rounded-xl border bg-card text-2xl font-semibold tabular-nums shadow-sm transition active:scale-[0.97] active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {key === "back" ? <Delete className="size-6" /> : key === "." ? "," : key}
          </button>
        ),
      )}
    </div>
  );
}
