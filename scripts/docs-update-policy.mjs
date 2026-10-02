/** Presence gate; reviewers still verify that the documentation describes the actual change. */
export function documentationUpdateIssue(files) {
  const product = files.some(path => /^(src\/|prisma\/)/.test(path));
  const implementation = product || files.some(path =>
    /^(scripts\/|infra\/|\.github\/workflows\/|docs\/site\/)/.test(path) && !/\.(md|mdx)$/.test(path)
    || /^(package\.json|next\.config\.ts|tsconfig\.json|Dockerfile|docker-compose\.yml|eslint\.config\.mjs)$/.test(path));
  if (!implementation) return null;
  const publicDocs = files.some(path => /^docs\/site\/src\/content\/docs\/.+\.(md|mdx)$/.test(path));
  const technicalDocs = files.some(path => /^docs\/.+\.(md|mdx)$/.test(path));
  if (product && !publicDocs)
    return 'Hay cambios de aplicación sin actualización de la guía en docs/site/src/content/docs/. Documenta el comportamiento o aclara en la página afectada si el cambio interno conserva el flujo.';
  if (!technicalDocs)
    return 'Hay cambios de código/configuración sin documentación en docs/. Actualiza la guía o la documentación técnica afectada.';
  return null;
}
