import { Navigate, Route, Routes } from 'react-router-dom';
import { useAccess } from '../../contexts/AccessContext';
import PaywallPage from './PaywallPage';
import BillingSuccessPage from './BillingSuccessPage';

// Sits above every data provider: while blocked, none of them mounts, so nothing calls the
// (also blocked) API. The server is the real enforcement; this only reflects `access`.
// `/billing*` stays reachable in both states so the Stripe redirects always land somewhere.
export default function SubscriptionGate({ children }) {
  const { access } = useAccess();
  const blocked = access?.allowed === false;

  return (
    <Routes>
      <Route path="billing" element={<PaywallPage />} />
      <Route path="billing/success" element={<BillingSuccessPage />} />
      <Route path="billing/cancelled" element={<Navigate to="/billing" replace />} />
      <Route path="*" element={blocked ? <PaywallPage /> : children} />
    </Routes>
  );
}
