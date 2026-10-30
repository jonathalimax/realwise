import React from 'react';

/**
 * A phone around a real screenshot of the app. The notch sits in the frame's own top padding so it never covers the
 * screenshot. Images are 750x1624 (2x of a 375x812 phone); width/height reserve the space so nothing jumps while loading.
 */
export default function PhoneFrame({ src, alt, className = '', eager = false }) {
  return (
    <div className={`relative mx-auto w-full max-w-[250px] rounded-[2.6rem] bg-slate-900 p-[7px] pt-7 shadow-2xl shadow-violet-900/25 ring-1 ring-slate-700/70 ${className}`}>
      <span aria-hidden className="absolute left-1/2 top-2.5 h-2 w-16 -translate-x-1/2 rounded-full bg-slate-800" />
      <img
        src={src}
        alt={alt}
        width="750"
        height="1624"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="block h-auto w-full rounded-[2rem] bg-slate-950"
      />
    </div>
  );
}
