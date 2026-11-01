import React from 'react';

export function Shimmer({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />
  );
}

export function ShimmerText({ width = 'w-32', height = 'h-4', className = '' }) {
  return (
    <Shimmer className={`${width} ${height} ${className}`} />
  );
}

export function ShimmerButton({ className = '' }) {
  return (
    <Shimmer className={`h-16 w-48 rounded-full ${className}`} />
  );
}

// Simple page skeleton for internal pages
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header skeleton */}
      <div className="sticky top-0 h-16 border-b border-[var(--rw-border)] bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6">
          <Shimmer className="w-32 h-5" />
          <div className="flex items-center gap-3">
            <Shimmer className="w-8 h-8 rounded-lg" />
            <Shimmer className="w-24 h-5" />
          </div>
          <Shimmer className="w-10 h-10 rounded-full" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <Shimmer className="w-16 h-16 rounded-2xl" />
          </div>
          <Shimmer className="w-80 h-10 mx-auto mb-4" />
          <Shimmer className="w-[500px] max-w-full h-6 mx-auto" />
        </div>

        {/* Content grid */}
        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-4">
            <Shimmer className="w-full h-[400px] rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Shimmer className="w-full h-[300px] rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Full page loading skeleton for landing pages
export function LandingPageSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header skeleton */}
      <div className="fixed top-0 inset-x-0 h-20 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-50">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Shimmer className="w-10 h-10 rounded-xl" />
            <Shimmer className="w-32 h-5" />
          </div>
          <div className="flex items-center gap-4">
            <Shimmer className="w-20 h-10 rounded-full" />
            <Shimmer className="w-32 h-10 rounded-full" />
          </div>
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="pt-40 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <Shimmer className="w-64 h-10 rounded-full" />
          </div>

          {/* Headline */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-center">
              <Shimmer className="w-[500px] max-w-full h-14" />
            </div>
            <div className="flex justify-center">
              <Shimmer className="w-[400px] max-w-full h-14" />
            </div>
          </div>

          {/* Subheadline */}
          <div className="flex justify-center mb-10">
            <Shimmer className="w-[600px] max-w-full h-8" />
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4 mb-16">
            <Shimmer className="w-48 h-16 rounded-full" />
            <Shimmer className="w-40 h-4" />
          </div>

          {/* Device hints */}
          <div className="flex justify-center gap-6">
            <Shimmer className="w-24 h-5" />
            <Shimmer className="w-24 h-5" />
          </div>

          {/* App preview skeleton */}
          <div className="mt-20 max-w-5xl mx-auto">
            <Shimmer className="w-full h-[400px] rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Benefits section skeleton */}
      <div className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Shimmer className="w-48 h-6 mx-auto mb-4" />
            <Shimmer className="w-80 h-10 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-6 rounded-2xl border border-[var(--rw-border)]">
                <Shimmer className="w-12 h-12 rounded-xl mb-4" />
                <Shimmer className="w-full h-4 mb-2" />
                <Shimmer className="w-3/4 h-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
