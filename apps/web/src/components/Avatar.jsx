import { useAccess } from '../contexts/AccessContext';
import { getSettingsProfile } from '../pages/settingsProfile';

/** The person's photo (from the sign-in provider or uploaded), or their initial on the brand tint. */
export default function Avatar({ size = 36, className = '', ring = false }) {
  const { currentUser } = useAccess();
  const { photoUrl, initial, name } = getSettingsProfile(currentUser);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--rw-brand-soft)] font-bold text-[var(--rw-brand-ink)] ${ring ? 'ring-2 ring-[var(--rw-brand)]' : ''} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      role="img"
      aria-label={name}
    >
      {photoUrl ? <img src={photoUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : initial}
    </span>
  );
}
