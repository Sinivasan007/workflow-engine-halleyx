import React from 'react';

export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`
        w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3
        placeholder-[#64748B]
        focus:outline-none focus:border-indigo-500
        focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]
        transition-all duration-200
        ${className}
      `}
      {...props}
    />
  );
}
