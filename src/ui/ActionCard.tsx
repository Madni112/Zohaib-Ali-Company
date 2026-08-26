import React from 'react';
import { IconType } from 'react-icons';
import GlassCard from './GlassCard';

interface ActionCardProps {
  title: string;
  subtitle: string;
  Icon: IconType;
  bgGradient?: string; // Tailwind gradient class for background
  onClick: () => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ title, subtitle, Icon, bgGradient = 'bg-gradient-to-br from-emerald-600 to-teal-700', onClick }) => {
  return (
    <div
      className={`p-5 rounded-2xl cursor-pointer transform transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${bgGradient} text-white flex items-center justify-between shadow-md relative overflow-hidden group`}
      onClick={onClick}
    >
      {/* Decorative background light orb */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform duration-300 pointer-events-none" />
      
      <div className="flex flex-col z-10">
        <span className="text-sm font-extrabold uppercase tracking-wider">{title}</span>
        <span className="text-xs font-medium text-white/85 mt-0.5">{subtitle}</span>
      </div>
      <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-xs group-hover:scale-110 transition-transform duration-200 z-10">
        <Icon size={24} />
      </div>
    </div>
  );
};

export default ActionCard;
