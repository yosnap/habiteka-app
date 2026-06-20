/**
 * Explorador de media del back-office: importación por URL y rejilla de los assets
 * de la carpeta raíz. El acceso lo valida el layout; la acción lo revalida.
 */
import { adminListMedia } from '@/server/admin/media/actions';
import { MediaImportForm } from '@/components/admin/media-import-form';

export default async function MediaPage() {
  const assets = await adminListMedia();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">Media</h1>
      <MediaImportForm />
      {assets.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay imágenes todavía.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-3">
          {assets.map((a) => (
            <li
              key={a.id}
              className="border-line overflow-hidden rounded-[var(--radius-card)] border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt="" className="aspect-square w-full object-cover" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
