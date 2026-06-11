import {readFileSync, readdirSync} from 'fs';
import {join, resolve} from 'path';

/**
 * Drift guard for `.env.example` (AGENTS.md: every variable the backend reads
 * must be documented in `.env.example`). Scans `backend/src` for `process.env.X`
 * references and asserts each is present in the template.
 */

const repoRoot = resolve(__dirname, '../../..');
const srcDir = resolve(__dirname, '../../src');
const envExamplePath = join(repoRoot, '.env.example');

function walkTsFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkTsFiles(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });
}

function envVarsReadInSrc(): Set<string> {
  const names = new Set<string>();
  for (const file of walkTsFiles(srcDir)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

function documentedVars(): Set<string> {
  const text = readFileSync(envExamplePath, 'utf8');
  const names = new Set<string>();
  // A var counts as documented whether it is active (`NAME=`) or shown as a
  // commented optional override (`# NAME=`).
  for (const match of text.matchAll(/^#?\s*([A-Z0-9_]+)=/gm)) {
    names.add(match[1]);
  }
  return names;
}

describe('.env.example', () => {
  it('documents every env var the backend source reads', () => {
    const documented = documentedVars();
    const missing = [...envVarsReadInSrc()]
      .filter(name => !documented.has(name))
      .sort();

    expect(missing).toEqual([]);
  });
});
