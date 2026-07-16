# Coupon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing coupon foundation with a full admin management UI (filterable/sortable table, create/edit/toggle/delete) and wire coupon validation into `createCheckoutSession`.

**Architecture:** New `CouponsPage.jsx` replaces the current `CouponsPanel.jsx` at `/admin/coupons` (keep old panel at its existing route). The `coupons` Firestore collection gains `enabled`, `validFrom/Until`, `currentUses`, and `source` fields. `createCheckoutSession` Cloud Function accepts an optional `couponCode` param that validates + applies the discount via Stripe.

**Tech Stack:** React 19, Firebase Firestore (client SDK), Stripe Node.js SDK, Tailwind CSS v4, Cloud Functions Node 18.

**Spec:** `docs/superpowers/specs/2026-05-17-coupon-system-design.md`

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/pages/admin/CouponsPage.jsx` | Full coupon management page (table, filters, create/edit/toggle/delete) |
| Modify | `src/pages/admin/AdminApp.jsx` | Add `/admin/coupons` route pointing to `CouponsPage` |
| Modify | `functions/createCheckoutSession.js` | Accept `couponCode`, validate, apply Stripe discount, increment `currentUses` |
| Modify | `functions/stripeWebhook.js` | Increment `currentUses` on `checkout.session.completed` |

---

## Task 1: Add `/admin/coupons` Route to AdminApp

**Files:**
- Modify: `src/pages/admin/AdminApp.jsx`

- [ ] **Step 1: Read the current AdminApp routing**

Read `src/pages/admin/AdminApp.jsx`. Note how routes are defined and how the sidebar nav is structured.

- [ ] **Step 2: Add the route**

Add an import and route for `CouponsPage`:

```jsx
import CouponsPage from './CouponsPage';

// In the Routes:
<Route path="coupons" element={<CouponsPage db={db} functions={functions} />} />
```

- [ ] **Step 3: Add nav entry**

In the sidebar nav, add after the existing coupon/discount link (if any):

```jsx
<NavLink to="coupons" className={navClass}>
  🎟️ Cupons
</NavLink>
```

Use the same `navClass` / active styling pattern as existing nav links.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminApp.jsx
git commit -m "feat: add /admin/coupons route and nav entry"
```

---

## Task 2: Build CouponsPage — Table and Filters

**Files:**
- Create: `src/pages/admin/CouponsPage.jsx`

- [ ] **Step 1: Create the skeleton with Firestore real-time subscription**

```jsx
import { useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useEffect } from 'react';

export default function CouponsPage({ db, functions }) {
  const [coupons, setCoupons] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'disabled' | 'expired'
  const [filterType, setFilterType] = useState('all');     // 'all' | 'percentage' | 'fixed_amount'
  const [sortBy, setSortBy] = useState('createdAt');       // 'createdAt' | 'currentUses' | 'code'
  const [sortDir, setSortDir] = useState('desc');          // 'asc' | 'desc'
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [db]);

  const now = new Date();

  function getStatus(coupon) {
    if (coupon.validUntil?.toDate?.() < now) return 'expired';
    if (!coupon.enabled) return 'disabled';
    return 'active';
  }

  const filtered = useMemo(() => {
    let result = coupons;
    if (filterStatus !== 'all') result = result.filter(c => getStatus(c) === filterStatus);
    if (filterType !== 'all') result = result.filter(c => c.discountType === filterType);

    result = [...result].sort((a, b) => {
      let av, bv;
      if (sortBy === 'code') { av = a.code; bv = b.code; }
      else if (sortBy === 'currentUses') { av = a.currentUses || 0; bv = b.currentUses || 0; }
      else { av = a.createdAt?.seconds || 0; bv = b.createdAt?.seconds || 0; }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return result;
  }, [coupons, filterStatus, filterType, sortBy, sortDir]);

  async function handleToggle(coupon) {
    await updateDoc(doc(db, 'coupons', coupon.id), { enabled: !coupon.enabled });
  }

  async function handleDelete(coupon) {
    if (!window.confirm(`Desabilitar o cupom ${coupon.code}? (Não será apagado permanentemente)`)) return;
    await updateDoc(doc(db, 'coupons', coupon.id), { enabled: false });
  }

  function formatDiscount(coupon) {
    if (coupon.discountType === 'percentage') return `${coupon.discountValue}%`;
    return `R$ ${((coupon.discountValue || 0) / 100).toFixed(2).replace('.', ',')}`;
  }

  function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate?.() || new Date(ts);
    return d.toLocaleDateString('pt-BR');
  }

  const STATUS_CLASSES = {
    active: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    disabled: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    expired: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  };
  const STATUS_LABELS = { active: 'Ativo', disabled: 'Desabilitado', expired: 'Expirado' };

  function SortHeader({ col, label }) {
    const active = sortBy === col;
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
        onClick={() => { if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc'); } }}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cupons</h1>
        <button
          onClick={() => { setEditingCoupon(null); setShowModal(true); }}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          + Criar Cupom
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="disabled">Desabilitado</option>
          <option value="expired">Expirado</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="all">Todos os tipos</option>
          <option value="percentage">Percentual</option>
          <option value="fixed_amount">Valor fixo</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <SortHeader col="code" label="Código" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Desconto</th>
              <SortHeader col="currentUses" label="Usos" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Válido de</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Válido até</th>
              <SortHeader col="createdAt" label="Criado em" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {filtered.map(coupon => {
              const status = getStatus(coupon);
              return (
                <tr key={coupon.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-white">{coupon.code}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDiscount(coupon)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {coupon.currentUses || 0} / {coupon.maxUses ?? '∞'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(coupon.validFrom)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(coupon.validUntil)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(coupon.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingCoupon(coupon); setShowModal(true); }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >Editar</button>
                      <button
                        onClick={() => handleToggle(coupon)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >{coupon.enabled ? 'Desabilitar' : 'Habilitar'}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  Nenhum cupom encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CreateEditCouponModal
          db={db}
          coupon={editingCoupon}
          onClose={() => { setShowModal(false); setEditingCoupon(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit the skeleton**

```bash
git add src/pages/admin/CouponsPage.jsx
git commit -m "feat: CouponsPage skeleton with real-time table, filters, and sorting"
```

---

## Task 3: Build CreateEditCouponModal

**Files:**
- Modify: `src/pages/admin/CouponsPage.jsx` (add modal inline)

- [ ] **Step 1: Add the modal component**

Add `CreateEditCouponModal` below the `CouponsPage` export (or at the top of the file before the default export):

```jsx
import { addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

function CreateEditCouponModal({ db, coupon, onClose }) {
  const isEdit = !!coupon;
  const [code, setCode] = useState(coupon?.code || '');
  const [discountType, setDiscountType] = useState(coupon?.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(
    coupon ? (coupon.discountType === 'fixed_amount' ? (coupon.discountValue / 100).toString() : coupon.discountValue.toString()) : ''
  );
  const [maxUses, setMaxUses] = useState(coupon?.maxUses?.toString() || '');
  const [validFrom, setValidFrom] = useState(
    coupon?.validFrom ? new Date(coupon.validFrom.toDate()).toISOString().split('T')[0] : ''
  );
  const [validUntil, setValidUntil] = useState(
    coupon?.validUntil ? new Date(coupon.validUntil.toDate()).toISOString().split('T')[0] : ''
  );
  const [enabled, setEnabled] = useState(coupon?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!code.trim()) { setError('Código é obrigatório.'); return; }
    if (!discountValue || Number(discountValue) <= 0) { setError('Valor do desconto inválido.'); return; }

    setSaving(true);
    setError('');

    const storedValue = discountType === 'fixed_amount'
      ? Math.round(Number(discountValue) * 100)
      : Number(discountValue);

    const data = {
      code: code.toUpperCase().trim(),
      discountType,
      discountValue: storedValue,
      maxUses: maxUses ? Number(maxUses) : null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      enabled,
    };

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'coupons', coupon.id), { ...data, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'coupons'), {
          ...data,
          currentUses: 0,
          source: 'admin',
          createdBy: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao salvar cupom.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {isEdit ? 'Editar Cupom' : 'Criar Cupom'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="BEMVINDO50"
              className="w-full font-mono px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de desconto</label>
            <select
              value={discountType}
              onChange={e => setDiscountType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="percentage">Percentual (%)</option>
              <option value="fixed_amount">Valor fixo (R$)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {discountType === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
            </label>
            <input
              type="number"
              min="0"
              max={discountType === 'percentage' ? 100 : undefined}
              step={discountType === 'percentage' ? 1 : 0.01}
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Máximo de usos (vazio = ilimitado)</label>
            <input
              type="number"
              min="1"
              value={maxUses}
              onChange={e => setMaxUses(e.target.value)}
              placeholder="Ilimitado"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Válido de</label>
              <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Válido até</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Habilitado</span>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test in dev server**

```bash
npm run dev
```

Navigate to `/admin/coupons`. Test:
- Create a coupon → appears in table.
- Edit a coupon → modal pre-fills.
- Toggle enable/disable → badge updates.
- Filter by status → table filters.
- Sort by code → table sorts alphabetically.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/CouponsPage.jsx
git commit -m "feat: CreateEditCouponModal with create, edit, and Firestore persistence"
```

---

## Task 4: Wire Coupon Validation into `createCheckoutSession`

**Files:**
- Modify: `functions/createCheckoutSession.js`

- [ ] **Step 1: Read the current function**

Read `functions/createCheckoutSession.js`. Find where the callable input is destructured and where the Stripe session is created.

- [ ] **Step 2: Add coupon validation and Stripe discount**

Add this block after input destructuring, before the Stripe session creation:

```js
const { priceId, email, name, couponCode } = data;

let stripeDiscounts = [];

if (couponCode) {
  // Validate the coupon in Firestore
  const admin = require('firebase-admin');
  const db = admin.firestore();
  
  // Query shared Firestore (moneywise-ad9ec)
  // If using admin SDK pointed at central project, this works directly.
  const snap = await db.collection('coupons')
    .where('code', '==', couponCode.toUpperCase())
    .limit(1)
    .get();

  if (snap.empty) {
    throw new functions.https.HttpsError('invalid-argument', 'Cupom não encontrado.');
  }

  const couponDoc = snap.docs[0];
  const couponData = couponDoc.data();
  const now = new Date();

  if (!couponData.enabled) {
    throw new functions.https.HttpsError('invalid-argument', 'Cupom desabilitado.');
  }
  if (couponData.maxUses !== null && (couponData.currentUses || 0) >= couponData.maxUses) {
    throw new functions.https.HttpsError('invalid-argument', 'Cupom atingiu o limite de usos.');
  }
  if (couponData.validUntil && couponData.validUntil.toDate() < now) {
    throw new functions.https.HttpsError('invalid-argument', 'Cupom expirado.');
  }
  if (couponData.validFrom && couponData.validFrom.toDate() > now) {
    throw new functions.https.HttpsError('invalid-argument', 'Cupom ainda não é válido.');
  }

  // Create or reuse Stripe coupon
  let stripeCouponId = couponData.stripeCouponId;
  if (!stripeCouponId) {
    const stripeCouponParams = {
      id: `rw_${couponDoc.id}`,
      duration: 'once',
    };
    if (couponData.discountType === 'percentage') {
      stripeCouponParams.percent_off = couponData.discountValue;
    } else {
      stripeCouponParams.amount_off = couponData.discountValue;
      stripeCouponParams.currency = 'brl';
    }
    const stripeCoupon = await stripe.coupons.create(stripeCouponParams);
    stripeCouponId = stripeCoupon.id;
    // Cache back to Firestore
    await couponDoc.ref.update({ stripeCouponId });
  }

  stripeDiscounts = [{ coupon: stripeCouponId }];
}

// Add to session creation:
const session = await stripe.checkout.sessions.create({
  // ... existing params ...
  ...(stripeDiscounts.length > 0 && { discounts: stripeDiscounts }),
});
```

- [ ] **Step 3: Commit**

```bash
git add functions/createCheckoutSession.js
git commit -m "feat: validate coupon in createCheckoutSession and apply Stripe discount"
```

---

## Task 5: Increment `currentUses` on Successful Payment

**Files:**
- Modify: `functions/stripeWebhook.js`

- [ ] **Step 1: Find the `checkout.session.completed` handler**

Read `functions/stripeWebhook.js`. Find the branch that handles `checkout.session.completed`.

- [ ] **Step 2: Add `currentUses` increment**

After the existing logic (sending welcome email, updating lead state), add:

```js
// Increment coupon usage if a coupon was applied
const couponCode = session.metadata?.couponCode || null;
if (couponCode) {
  try {
    const snap = await db.collection('coupons')
      .where('code', '==', couponCode.toUpperCase())
      .limit(1)
      .get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        currentUses: admin.firestore.FieldValue.increment(1),
      });
    }
  } catch (err) {
    console.warn('Failed to increment coupon usage:', err);
  }
}
```

For this to work, `couponCode` must be stored in the Stripe session metadata. Update the session creation in `createCheckoutSession.js` to include it:

```js
const session = await stripe.checkout.sessions.create({
  // ...
  metadata: {
    name,
    couponCode: couponCode || '',
    // ... other existing metadata
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add functions/stripeWebhook.js functions/createCheckoutSession.js
git commit -m "feat: increment coupon currentUses on Stripe checkout.session.completed"
```
