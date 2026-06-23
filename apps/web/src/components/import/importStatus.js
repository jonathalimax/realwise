export const IMPORT_STATUSES = ['import', 'importIgnore', 'skip'];

export function statusFromFlags({ selected, ignored }) {
  if (!selected) return 'skip';
  return ignored ? 'importIgnore' : 'import';
}

export function flagsForStatus(status) {
  switch (status) {
    case 'importIgnore':
      return { selected: true, ignored: true };
    case 'skip':
      return { selected: false, ignored: false };
    case 'import':
    default:
      return { selected: true, ignored: false };
  }
}
