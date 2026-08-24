// Produces self-contained copies of the component previews for uploading to a
// Claude Design project. The previews link to /styles.css so they track the live
// app while you develop; an uploaded card has no server to resolve that against,
// so each stylesheet link is inlined here.
//
//   node tools/bundle-design-system.mjs   →   dist/design-system/*.html

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = `${ROOT}public/design-system/`;
const OUT = `${ROOT}dist/design-system/`;

const LINKS = {
  '/styles.css': `${ROOT}public/styles.css`,
  '/design-system/_harness.css': `${SRC}_harness.css`,
};

const styles = Object.fromEntries(
  await Promise.all(
    Object.entries(LINKS).map(async ([href, path]) => [href, await readFile(path, 'utf8')])
  )
);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const files = (await readdir(SRC))
  .filter((name) => name.endsWith('.html') && name !== 'index.html');

let written = 0;
for (const name of files) {
  let html = await readFile(SRC + name, 'utf8');

  if (!html.startsWith('<!-- @dsCard')) {
    console.warn(`  skipped ${name} — no @dsCard marker on the first line`);
    continue;
  }

  for (const [href, css] of Object.entries(styles)) {
    const link = new RegExp(`<link rel="stylesheet" href="${href}">`, 'g');
    if (!link.test(html)) continue;
    html = html.replace(link, `<style>\n${css.trim()}\n</style>`);
  }

  const stillLinked = html.match(/<link rel="stylesheet"[^>]*>/g);
  if (stillLinked) {
    throw new Error(`${name} still references ${stillLinked.join(', ')} — it would not render once uploaded`);
  }

  await writeFile(OUT + name, html);
  written += 1;
}

console.log(`Bundled ${written} card${written === 1 ? '' : 's'} into dist/design-system/`);
