import { useEffect, useState } from 'react';
import { MegaphoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { supportResource } from '../lib/api/resources/support';

const TONES = {
  info: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/30 dark:text-sky-100 dark:border-sky-900/60',
  warning: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-900/60',
  promo: 'bg-violet-50 text-violet-900 border-violet-200 dark:bg-violet-950/30 dark:text-violet-100 dark:border-violet-900/60',
};

const storageKey = (text) => `rw:announcement:${text}`;
const readDismissed = (text) => {
  try {
    return localStorage.getItem(storageKey(text)) === '1';
  } catch {
    return false;
  }
};

/** Banner for a message the admin publishes to everyone (new feature, maintenance, offer). Dismissible. */
export default function AnnouncementBanner() {
  const [item, setItem] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let active = true;
    supportResource
      .announcement()
      .then((res) => {
        if (active && res?.text) {
          setItem(res);
          setHidden(readDismissed(res.text));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!item || hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(item.text), '1');
    } catch {
      /* private mode: just hide it for this visit */
    }
    setHidden(true);
  };

  return (
    <div role="status" className={`flex items-center gap-3 border-b px-4 py-2 text-sm ${TONES[item.level] ?? TONES.info}`}>
      <MegaphoneIcon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        {item.text}
        {item.linkUrl && (
          <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="ml-2 font-semibold underline">
            {item.linkLabel || 'Saiba mais'}
          </a>
        )}
      </span>
      <button onClick={dismiss} className="shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Dispensar aviso">
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
