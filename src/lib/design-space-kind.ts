/** Uso real del espacio para condicionar renders desde el plano, independiente del estilo. */
export const DESIGN_SPACE_KINDS = [
  { value: 'interior', label: 'Habitación interior' },
  { value: 'patio', label: 'Patio exterior' },
  { value: 'terraza', label: 'Terraza o azotea' },
  { value: 'jardin', label: 'Jardín' },
  { value: 'entrada', label: 'Entrada exterior' },
  { value: 'fachada', label: 'Fachada' },
] as const;

export type DesignSpaceKind = (typeof DESIGN_SPACE_KINDS)[number]['value'];

export function isDesignSpaceKind(value: unknown): value is DesignSpaceKind {
  return DESIGN_SPACE_KINDS.some((kind) => kind.value === value);
}

export function designSpaceKindLabel(value: DesignSpaceKind): string {
  return DESIGN_SPACE_KINDS.find((kind) => kind.value === value)?.label ?? 'Espacio sin definir';
}
