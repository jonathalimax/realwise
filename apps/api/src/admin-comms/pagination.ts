export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function pageParams(page?: string, pageSize?: string): PageParams {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const size = Math.min(100, Math.max(1, Math.floor(Number(pageSize)) || 25));
  return { page: p, pageSize: size, offset: (p - 1) * size };
}
