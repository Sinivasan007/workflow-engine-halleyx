import React from 'react';
import { motion } from 'framer-motion';

export default function MetricCard({ label, value, icon: Icon, color, trend, index = 0 }) {
  const colorMap = {
    indigo:  'bg-violet-100 text-violet-600',
    green:   'bg-emerald-100 text-emerald-600',
    blue:    'bg-blue-100 text-blue-600',
    red:     'bg-red-100 text-red-600',
    yellow:  'bg-yellow-100 text-yellow-600',
    purple:  'bg-purple-100 text-purple-600',
  };

  const iconClass = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(124,58,237,0.12)' }}
      className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]
                 hover:border-violet-600/30 transition-all duration-300 cursor-default"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-3xl font-bold text-[#111827]">{value}</p>
          <p className="text-[#6B7280] text-sm mt-1">{label}</p>
        </div>
      </div>
      {trend && (
        <div className={`mt-3 text-xs font-medium ${trend.up ? 'text-emerald-600' : 'text-red-600'}`}>
          {trend.up ? '↑' : '↓'} {trend.value}
        </div>
      )}
    </motion.div>
  );
}
