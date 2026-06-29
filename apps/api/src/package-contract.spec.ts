const pkg = require('../package.json');

describe('api package contract', () => {
  it('does not ship firebase-admin anymore', () => {
    expect(pkg.dependencies?.['firebase-admin']).toBeUndefined();
  });
});
