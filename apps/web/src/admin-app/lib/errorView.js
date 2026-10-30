export const SOURCE_LABEL = { api: 'API', web: 'App', job: 'Tarefa' };
export const SOURCE_TONE = { api: 'purple', web: 'blue', job: 'amber' };

/** Where an error happened, in one short line for tables and headers. */
export function whatOf(e) {
  if (e.source === 'api') return `${e.method ?? ''} ${e.route ?? ''}`.trim();
  if (e.source === 'web') return e.route ?? 'app';
  return 'segundo plano';
}
