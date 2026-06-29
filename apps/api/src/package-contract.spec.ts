import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};

describe('api package contract', () => {
  it('does not ship firebase-admin anymore', () => {
    expect(pkg.dependencies?.['firebase-admin']).toBeUndefined();
  });
});
