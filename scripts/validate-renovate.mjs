#!/usr/bin/env node
// Validate .github/renovate.json5 — parse with json5, report summary.
import { readFileSync } from 'fs';
import json5 from 'json5';

const file = process.argv[2] || '.github/renovate.json5';
const src = readFileSync(file, 'utf8');

try {
  const cfg = json5.parse(src);
  const keys = Object.keys(cfg).length;
  const rules = cfg.packageRules?.length ?? 0;
  console.log(`VALID: ${file} (${src.split('\n').length} lines, ${keys} top-level keys, ${rules} packageRules)`);
} catch (e) {
  console.error(`INVALID ${file}: ${e.message}`);
  process.exit(1);
}
