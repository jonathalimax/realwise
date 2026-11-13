# Banks and bank logos

## Source of truth

`apps/web/src/lib/banks.js` holds `BANKS` (63 entries: banks, fintechs, wallets, brokers, `cash`, and the generic `other`). `contexts/CardsContext.jsx` re-exports `BANKS`/`BANK_COLORS` and `getBankInfo()` resolves through it.

Each entry: `id` (stable, stored in user data, existing ids unchanged), `name`, `code` (COMPE when it exists), `logo` (file in `apps/web/public/banks/`, or `null`), `brand` (hex for the monogram tile), legacy Tailwind `color` key, and `aliases`.

## Rendering

`components/ui/BankLogo.jsx`: `<BankLogo bankId name size />`. Rounded tile, `alt` text, `loading="lazy"`, `decoding="async"`, local files only (never hotlinked). No logo file, or load error: monogram tile (initials on the brand color). There are no emoji icons any more; native `<select>` options are text only.

Used in: cards screens (`pages/Cards.jsx`, `CardsModal`, `WalletCards`), transaction list rows, investments rows, bank pickers in the card forms and the chat `AccountFormSheet`.

## Existing user data (no migration)

`matchBank(value)` normalizes (lowercase, no accents, no punctuation) and matches the saved `bankId` or name against id, name and aliases: exact first, then whole-word phrase containment, longest alias first. `BankLogo` tries `bankId`; if it is `other`/unknown it tries the free-text name (custom bank name, card name). Unknown banks get a monogram.

## Logo status

Real logos (36): nubank, mercadopago, picpay (simple-icons, brand color applied); itau, bradesco, santander, bb, caixa, inter, c6, btg, xp, sicoob, sicredi, banrisul, bs2, agibank, original, pan, bmg, mercantil, bv, sofisa, unicred, basa, bnb, banestes, banese, digio, genial, cielo, nomad, revolut, wise, paypal, binance (Wikimedia Commons SVGs, optimized with svgo, 1-9 KB each).

Monogram only (no reliable official asset obtained): neon, next, astropay, safra, willbank, pagbank, pay99, iti, daycoval, cresol, ailos, brb, banpara, abc, pine, master, modalmais, rico, avenue, cora, stone, ton, recargapay, ame, banco24horas, cash, other.

Caveats: Commons logos are community uploads of the banks' marks; "most recent version" was not independently verified against each bank's brand portal. simple-icons `neon`, `cora`, `pagseguro` were NOT used (they are a different company or an outdated mark).

## Chat account form

The chat `account_form` options come from `apps/api/src/chat/onboarding.ts` (`BANKS`, validated by `BANK_IDS`). It still offers only the original ids; extending it requires an API change. The new logo is shown next to its picker.
