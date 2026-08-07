#!/usr/bin/env node
// License validation script - validates all production dependencies against allowlist

import { execSync } from 'child_process';

const ALLOWED_LICENSES = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'MIT-0',
  'AGPL-3.0',
  'GPL-3.0',
  'LGPL-3.0',
  '(MIT OR EUPL-1.1+)'
]);

try {
  const output = execSync('pnpm licenses list --prod --json', { encoding: 'utf8' });
  const licenses = JSON.parse(output);

  const violations = [];

  for (const [license, packages] of Object.entries(licenses)) {
    if (!ALLOWED_LICENSES.has(license)) {
      packages.forEach(pkg => {
        violations.push(`${pkg.name}: ${license}`);
      });
    }
  }

  if (violations.length > 0) {
    console.error('License violations found:');
    violations.forEach(v => console.error(`  ${v}`));
    process.exit(1);
  }

  console.log('✅ All production licenses are allowed');
} catch (err) {
  console.error('Failed to validate licenses:', err.message);
  process.exit(1);
}