import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', ...rest }) => {
  return (
    <div
      className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/80 dark:border-slate-800/80 transition-all duration-200 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

export default GlassCard;
