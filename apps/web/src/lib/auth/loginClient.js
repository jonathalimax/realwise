const RESERVED_TOP_LEVEL_PATHS = new Set(['', 'login', 'loading', 'admin', 'purchase-success', 'checkout', 'bill-payment']);

export function extractClientIdFromPathname(pathname = '') {
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';
  if (RESERVED_TOP_LEVEL_PATHS.has(firstSegment)) {
    return '';
  }
  return firstSegment;
}

export function resolveLoginClientId({
  search = '',
  pathname = '',
  storedClientId = '',
} = {}) {
  const params = new URLSearchParams(search);
  const queryClientId = (params.get('clientId') || '').trim();
  if (queryClientId) {
    return queryClientId;
  }

  const pathClientId = extractClientIdFromPathname(pathname);
  if (pathClientId) {
    return pathClientId;
  }

  return storedClientId.trim();
}

export function buildLoginRedirectUrl(pathname = '', storedClientId = '') {
  const clientId = resolveLoginClientId({ pathname, storedClientId });
  if (!clientId) {
    return '/login';
  }

  const params = new URLSearchParams({ clientId });
  return `/login?${params.toString()}`;
}
