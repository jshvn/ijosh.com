// Fails when the build publishes JSON that does not parse, or the email address anywhere but
// a mailto: link. The manifest, llms.txt and the JSON-LD are filled from hugo.toml, which holds
// the address, and only the page's link is obfuscated at the edge. Run: task check:meta.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'public';
const { email } = JSON.parse(execFileSync('hugo', ['config', '--format', 'json'])).params.social;
const problems = [];

const html = readFileSync(join(out, 'index.html'), 'utf8');
const ld = [...html.matchAll(/<script type="?application\/ld\+json"?>(.*?)<\/script>/gs)].map(m => m[1]);
if (!ld.length) problems.push('index.html has no JSON-LD');
const json = [['site.webmanifest', readFileSync(join(out, 'site.webmanifest'), 'utf8')],
  ...ld.map((text, i) => [`index.html JSON-LD #${i + 1}`, text])];
for (const [where, text] of json) {
  try { JSON.parse(text); } catch (e) { problems.push(`${where} is not JSON: ${e.message}`); }
}

for (const e of readdirSync(out, { recursive: true, withFileTypes: true })) {
  if (!e.isFile()) continue;
  const path = join(e.parentPath, e.name);
  const text = readFileSync(path, 'latin1');
  for (let i = text.indexOf(email); i !== -1; i = text.indexOf(email, i + 1)) {
    if (!text.slice(0, i).endsWith('mailto:')) problems.push(`${path} has the email address outside a mailto: link`);
  }
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`check:meta: ${json.length} JSON documents parse; the email address is only in its mailto: link`);
