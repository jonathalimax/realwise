import { useState } from 'react';
import { matchBank, resolveBank, getBankLogoUrl, getBankInitials } from '../../lib/banks';

/**
 * Bank tile: the real brand logo (local SVG in /public/banks) or, when we have none,
 * a monogram tile in the bank's brand color.
 *
 * Pass the saved `bankId` and/or a `name` (custom bank name, card name, display name).
 * The saved value is matched against the bank list ignoring case and accents, so data
 * created before the logos existed resolves automatically. Unknown banks get a monogram
 * built from `name`.
 */
function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.65;
}

export default function BankLogo({ bankId, name, size = 32, className = '', rounded }) {
  const [failed, setFailed] = useState(false);

  // Prefer the saved id; for generic/unknown ids, try matching the free-text name.
  let bank = matchBank(bankId);
  if (!bank || bank.id === 'other') bank = matchBank(name) || bank || resolveBank(bankId);

  const label = bank.id === 'other' ? (name || bank.name) : bank.name;
  const logoUrl = failed ? null : getBankLogoUrl(bank);
  const radius = rounded ?? Math.max(6, Math.round(size * 0.28));
  const style = { width: size, height: size, borderRadius: radius };

  if (logoUrl) {
    return (
      <span
        className={`inline-flex flex-shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/10 ${className}`}
        style={style}
      >
        <img
          src={logoUrl}
          alt={label}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: Math.round(size * 0.14) }}
        />
      </span>
    );
  }

  const initials = getBankInitials(bank.id === 'other' ? name || bank.name : bank.name);
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex flex-shrink-0 select-none items-center justify-center font-bold leading-none ${className}`}
      style={{ ...style, background: bank.brand, color: isLight(bank.brand) ? '#1f2937' : '#fff', fontSize: Math.max(9, Math.round(size * (initials.length > 2 ? 0.3 : 0.38))), letterSpacing: '-0.02em' }}
    >
      {initials}
    </span>
  );
}
