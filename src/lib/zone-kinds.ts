/**
 * Vocabulario controlado del TIPO de zona (`ProjectZone.kind`). Fuente única para
 * el selector de la UI y para la variante interior/exterior del prompt del render:
 * así no se desincronizan unos valores con otros (el `kind` es texto libre en BD,
 * pero la app solo escribe/lee estos valores normalizados).
 *
 * El valor se guarda normalizado (minúsculas, sin tildes) para que la comparación
 * con `EXTERIOR_ZONE_KINDS` sea estable.
 */
export interface ZoneKindOption {
  /** Valor persistido (normalizado). */
  value: string;
  /** Etiqueta legible para la UI. */
  label: string;
  /** True si el espacio es exterior (cambia la descripción del render). */
  exterior: boolean;
}

export const ZONE_KINDS: readonly ZoneKindOption[] = [
  { value: 'interior', label: 'Interior', exterior: false },
  { value: 'fachada', label: 'Fachada', exterior: true },
  { value: 'entrada', label: 'Entrada', exterior: true },
  { value: 'jardin', label: 'Jardín', exterior: true },
  { value: 'aerea', label: 'Vista aérea', exterior: true },
  { value: 'trasera', label: 'Parte trasera', exterior: true },
];

/** Valores de tipo que representan un espacio EXTERIOR (derivado del vocabulario). */
export const EXTERIOR_ZONE_KINDS: ReadonlySet<string> = new Set(
  ZONE_KINDS.filter((k) => k.exterior).map((k) => k.value),
);

/** True si `value` es un tipo de zona del vocabulario controlado. */
export function isValidZoneKind(value: string): boolean {
  return ZONE_KINDS.some((k) => k.value === value);
}
