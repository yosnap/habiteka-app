/**
 * Tipos de sala del asistente de diseño (F7). Dato de dominio: tanto el wizard (UI) como
 * el auto-amueblado (`furnish-templates`) los usan, así que viven aquí y no en la capa de
 * componentes, para no invertir la dirección de dependencia.
 */
export const ROOM_TYPES = [
  { id: 'salon', label: 'Salón' },
  { id: 'dormitorio', label: 'Dormitorio' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'bano', label: 'Baño' },
] as const;

export type RoomType = (typeof ROOM_TYPES)[number]['id'];
