import React from 'react';
import { motion } from 'framer-motion';

export default function Card({ children, className = '', hover = true, ...props }) {
  return (
    <motion.div
      className={`
        bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6
        transition-all duration-300
        ${hover ? 'hover:border-[#6366F1]/50' : ''}
        ${className}
      `}
      whileHover={hover ? { boxShadow: '0 0 20px rgba(99,102,241,0.1)' } : {}}
      {...props}
    >
      {children}
    </motion.div>
  );
}
