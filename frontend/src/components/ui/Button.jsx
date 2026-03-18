import React from 'react';
import { motion } from 'framer-motion';

const VARIANTS = {
  primary: `bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl px-4 py-2.5
            transition-all duration-200 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]`,
  secondary: `bg-[#1A1A35] hover:bg-[#2D2D5E] text-white border border-[#2D2D5E]
              hover:border-[#6366F1]/50 font-medium rounded-xl px-4 py-2.5 transition-all duration-200`,
  danger: `bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30
           font-medium rounded-xl px-4 py-2.5 transition-all duration-200`,
  success: `bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30
            font-medium rounded-xl px-4 py-2.5 transition-all duration-200`,
  ghost: `hover:bg-[#1A1A35] text-[#94A3B8] hover:text-white
          font-medium rounded-xl px-4 py-2.5 transition-all duration-200`,
};

export default function Button({ 
  children, variant = 'primary', className = '', disabled = false, ...props 
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={`
        inline-flex items-center justify-center gap-2
        ${VARIANTS[variant] || VARIANTS.primary}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}
