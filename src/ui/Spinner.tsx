import React from 'react';

type SpinnerProps = {
  size?: string; // Example: 'w-8 h-8'
  color?: string; // Example: 'border-blue-600'
};

const Spinner: React.FC<SpinnerProps> = ({
  size = 'w-7 h-7',
  color = 'border-primary',
}) => {
  return (
    <div role="status" className="flex items-center justify-center">
      <div
        className={`${size} border-[3px] border-t-transparent rounded-full animate-spin ${color}`}
      ></div>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
