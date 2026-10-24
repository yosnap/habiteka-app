/** Dirección anterior de las claves de IA: ahora viven en «Mi perfil». */
import { redirect } from 'next/navigation';
import { AI_KEYS_SETTINGS_PATH } from '@/lib/ai-keys-settings';

export default function LegacyAiKeysPage() {
  redirect(AI_KEYS_SETTINGS_PATH);
}
