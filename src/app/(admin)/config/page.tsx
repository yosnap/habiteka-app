/** Entrada de configuración: la plataforma solo conserva sus ajustes de sistema. */
import { redirect } from 'next/navigation';

export default function ConfigPage() {
  redirect('/config/system');
}
