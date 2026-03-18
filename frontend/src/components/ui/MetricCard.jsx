import React from 'react';
import { motion } from 'framer-motion';

export default function MetricCard({ label, value, icon: Icon, color, trend, index = 0 }) {
  const colorMap = {
    indigo:  'bg-indigo-500/20 text-indigo-400',
    green:   'bg-green-500/20 text-green-400',
    blue:    'bg-blue-500/20 text-blue-400',
    red:     'bg-red-500/20 text-red-400',
    yellow:  'bg-yellow-500/20 text-yellow-400',
    purple:  'bg-purple-500/20 text-purple-400',
  };

  const iconClass = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ y: -4, boxShadow: '0 0 30px rgba(99,102,241,0.15)' }}
      className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6
                 hover:border-[#6366F1]/50 transition-all duration-300 cursor-default"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-3xl font-bold text-white">{value}</p>
          <p className="text-[#94A3B8] text-sm mt-1">{label}</p>
        </div>
      </div>
      {trend && (
        <div className={`mt-3 text-xs font-medium ${trend.up ? 'text-green-400' : 'text-red-400'}`}>
          {trend.up ? '↑' : '↓'} {trend.value}
        </div>
      )}
    </motion.div>
  );
}
