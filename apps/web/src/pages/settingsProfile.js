export function getSettingsProfile(user) {
  const email = user?.email ?? '';
  const fallbackName = email.split('@')[0] || '\u2014';
  const name = user?.name || fallbackName;
  const initialSource = user?.name || email;
  const initial = initialSource.charAt(0)?.toUpperCase() || '?';

  return {
    name,
    email,
    initial,
    photoUrl: user?.profileImageUrl ?? user?.photoUrl ?? user?.photoURL ?? null,
  };
}
