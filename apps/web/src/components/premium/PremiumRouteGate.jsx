import { useAccess } from '../../contexts/AccessContext';
import PremiumFeatureLock from './PremiumFeatureLock';

export default function PremiumRouteGate({
  featureKey,
  featureName,
  children,
}) {
  const { premiumFeatureLocks } = useAccess();

  if (premiumFeatureLocks?.[featureKey]) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 dark:bg-gray-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl pt-8">
          <PremiumFeatureLock
            featureName={featureName}
            onUnlock={() => {
              window.location.assign(`/checkout?feature=${encodeURIComponent(featureKey)}`);
            }}
            onBackToFree={() => {
              window.location.assign('/dashboard');
            }}
          />
        </div>
      </div>
    );
  }

  return children;
}
