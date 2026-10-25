/** Nombre claro de cada código de error de IA registrado, para el informe de uso del perfil. */
const LABELS: Record<string, string> = {
  missing_key: 'Falta la clave del proveedor',
  provider_down: 'Proveedor caído o clave rechazada',
  gateway_down: 'Pasarela caída',
  rate_limit: 'Límite de peticiones del proveedor',
  timeout: 'El proveedor no respondió a tiempo',
  schema: 'Respuesta incompleta o mal formada',
  refusal: 'El modelo se negó a responder',
  spend_cap: 'Tope de gasto diario alcanzado',
  call_limit: 'Demasiadas llamadas seguidas',
  sanitizer: 'Contenido bloqueado por seguridad',
  stream_cancelled: 'Respuesta cancelada a mitad',
  kie_task_pending: 'Tarea de KIE aún en curso',
};

export function aiErrorLabel(code: string): string {
  return LABELS[code] ?? (code.startsWith('http_') ? `Error HTTP ${code.slice(5)}` : 'Error desconocido');
}
