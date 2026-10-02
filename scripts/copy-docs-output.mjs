import { cp, mkdir, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../docs/site/dist/', import.meta.url));
const destination = fileURLToPath(new URL('../public/documentacion/', import.meta.url));
// Check the build exists before replacing the previous generated output.
await access(`${source}index.html`);
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
console.log('Documentación incorporada a public/documentacion para el mismo despliegue de Next.js.');
