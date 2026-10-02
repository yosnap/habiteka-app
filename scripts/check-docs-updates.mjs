import { execFileSync } from 'node:child_process';
import { documentationUpdateIssue } from './docs-update-policy.mjs';

const args = process.argv.slice(2);
const staged = args.includes('--staged');
const baseIndex = args.indexOf('--base');
const base = baseIndex < 0 ? null : args[baseIndex + 1];
if (args.some(arg => !['--staged', '--base', base].includes(arg)) || (baseIndex >= 0 && (!base || base.startsWith('-'))) || (staged && base)) {
  console.error('Uso: node scripts/check-docs-updates.mjs [--staged | --base <ref>]');
  process.exit(2);
}
const git = flags => execFileSync('git', flags, { encoding: 'utf8' }).split('\0').filter(Boolean);
try {
  const range = base ? [`${base}...HEAD`] : staged ? ['--cached'] : ['HEAD'];
  const changed = git(['diff', '--name-only', '--diff-filter=ACDMRT', '-z', ...range]);
  const presentDocs = git(['diff', '--name-only', '--diff-filter=ACMRT', '-z', ...range]);
  const untracked = !staged && !base ? git(['ls-files', '--others', '--exclude-standard', '-z']) : [];
  // Deleted documentation does not satisfy an update requirement.
  const files = [...changed.filter(path => !/\.(md|mdx)$/.test(path)), ...presentDocs, ...untracked];
  const issue = documentationUpdateIssue(files);
  if (issue) { console.error(issue); process.exitCode = 1; }
  else console.log('Documentación: cambios de código acompañados de documentación, o sin cambios que la requieran.');
} catch (error) {
  console.error(`No se pudo comparar el cambio: ${error.message}`);
  process.exitCode = 2;
}
