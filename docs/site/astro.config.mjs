import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.habiteka.app',
  output: 'static',
  integrations: [starlight({
    title: 'Habiteka · Documentación',
    description: 'Guías de uso, herramientas y atajos de Habiteka.',
    defaultLocale: 'root',
    locales: { root: { label: 'Español', lang: 'es' } },
    customCss: ['./src/styles/custom.css'],
    components: {
      Header: './src/components/docs-header.astro',
      ThemeSelect: './src/components/theme-icon-picker.astro',
    },
    lastUpdated: true,
    sidebar: [
      { label: 'Inicio', slug: 'index' },
      { label: 'Primeros pasos', items: [
        { label: 'Tu primer proyecto', slug: 'guias/primer-proyecto' },
        { label: 'Importar un plano', slug: 'guias/importar-plano' },
        { label: 'Guardar y aprobar', slug: 'guias/guardar-aprobar' },
      ] },
      { label: 'Diseñar el inmueble', items: [
        { label: 'Herramientas del editor', slug: 'editor/herramientas' },
        { label: 'Navegación y atajos', slug: 'editor/atajos' },
        { label: 'Techos, luces y tejado', slug: 'editor/techos-luces-tejado' },
        { label: 'Parcela real', slug: 'guias/parcela-real' },
        { label: 'Crear y revisar imágenes', slug: 'guias/imagenes' },
      ] },
      { label: 'Presentar el resultado', items: [
        { label: 'Crear vídeo en un solo lugar', slug: 'videos/estudio' },
        { label: 'Elegir un tipo de vídeo', slug: 'videos/tipos' },
        { label: 'Montaje de imágenes', slug: 'videos/montaje-imagenes' },
        { label: 'Recorrido y muestra de obra', slug: 'videos/recorrido' },
        { label: 'Promoción sobre parcela', slug: 'videos/promocion' },
      ] },
      { label: 'Ayuda', items: [
        { label: 'Resolver problemas', slug: 'ayuda/problemas' },
        { label: 'Estado y novedades', slug: 'ayuda/novedades' },
      ] },
    ],
  })],
});
