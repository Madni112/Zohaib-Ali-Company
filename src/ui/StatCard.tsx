import React from 'react';
import { IconType } from 'react-icons';
import GlassCard from './GlassCard';

interface StatCardProps {
  title: string;
  value: number | string;
  Icon: IconType;
  /** Tailwind gradient class for the icon background */
  bgColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, Icon, bgColor = 'bg-gradient-to-br from-emerald-500 to-teal-700' }) => {
  const formattedValue =
    typeof value === 'number'
      ? value.toLocaleString(undefined, { minimumFractionDigits: 2 })
      : value;
  return (
    <GlassCard className="flex items-center justify-between p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">{title}</span>
        <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 tracking-tight">{formattedValue}</span>
      </div>
      <div className={`flex items-center justify-center w-11 h-11 rounded-2xl text-white shadow-md ${bgColor} group-hover:scale-105 transition-transform duration-200`}>
        <Icon size={22} />
      </div>
    </GlassCard>
  );
};

export default StatCard;
