import React from 'react';

const SIZE_MAP = {
  sm:   'h-4 w-24',
  md:   'h-6 w-48',
  lg:   'h-8 w-64',
  full: 'h-8 w-full',
};

export function SkeletonLine({ size = 'md', className = '' }) {
  return (
    <div
      className={`bg-[#1A1A35] rounded-xl animate-pulse ${SIZE_MAP[size] || SIZE_MAP.md} ${className}`}
    />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6 animate-pulse ${className}`}>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#1A1A35]" />
        <div className="flex-1 space-y-2">
          <div className="h-6 bg-[#1A1A35] rounded-lg w-1/3" />
          <div className="h-4 bg-[#1A1A35] rounded-lg w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow({ cols = 7 }) {
  return (
    <tr className="animate-pulse">
      {[...Array(cols)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-[#1A1A35] rounded-lg w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export default function LoadingSkeleton({ type = 'card', count = 1, ...props }) {
  const Component = type === 'row' ? SkeletonRow : SkeletonCard;
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <Component key={i} {...props} />
      ))}
    </>
  );
}
