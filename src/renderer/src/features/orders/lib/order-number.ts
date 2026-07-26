// El importador legado reconstruye `order_number` cuando el `ot` físico venía
// vacío o duplicado en la base Access de origen (ver
// `common/management/commands/import_legacy.py::_resolve_order_number`):
// agrega el sufijo "-L<IdAccess>" para poder guardar la guía pese a que el
// campo único no tenía un valor real disponible. Afecta ~40.700 de las
// ~283.000 guías históricas (14%). Esta función distingue ambos casos para
// explicarle al usuario por qué ese número no es el que el trabajador escribió
// a mano en la OT física.
const RECONSTRUCTED_PATTERN = /^(.*)-L\d+$/;
const BLANK_BASES = new Set(["0", "00", "000000", "sot", ""]);

export function reconstructedOrderNumberReason(orderNumber: string): string | null {
  const match = orderNumber.match(RECONSTRUCTED_PATTERN);
  if (!match) return null;

  const base = match[1];
  if (BLANK_BASES.has(base.toLowerCase())) {
    return "El trabajador no registró un número de OT en el papel físico; el sistema generó este identificador para poder trazar la guía.";
  }
  return `El número de OT "${base}" estaba duplicado en el sistema de origen; se agregó un sufijo para diferenciar esta guía.`;
}
