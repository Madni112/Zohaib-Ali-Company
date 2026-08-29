import React from 'react';

export const formatQtyToBoxPc = (qty: number | string) => {
  if (qty === undefined || qty === null || qty === '') return { box: 0, pc: 0 };
  const str = String(qty).trim();
  const parts = str.split('.');
  
  const box = parseInt(parts[0], 10) || 0;
  const pcStr = parts.length > 1 ? parts[1] : '0';
  const pc = parseInt(pcStr, 10) || 0;
  
  return { box, pc };
};

export const QtyBadge: React.FC<{ qty: number | string; uom?: string; className?: string }> = ({ qty, uom = '', className = '' }) => {
  // If UOM is KG, LTR, or similar continuous units, render as decimal.
  const lowerUom = (uom || '').toLowerCase().trim();
  const isContinuous = ['kg', 'liter', 'liters', 'ltr', 'm', 'meter', 'meters', 'kg.', 'ltr.'].includes(lowerUom);

  if (isContinuous) {
    return (
      <span className={`font-mono font-bold ${className}`}>
        {Number(qty).toLocaleString()} <span className="text-[10px] font-sans text-gray-500 font-semibold">{uom}</span>
      </span>
    );
  }

  const { box, pc: rawPc } = formatQtyToBoxPc(qty);

  // For non‑continuous units, if the pcs part is unusually large (e.g., 833), interpret it as a decimal fraction
  // Example: 5.833 should be displayed as 5 boxes 8 pcs (assuming 2 decimal places represent pcs)
  let pc = rawPc;
  if (!isContinuous && rawPc >= 100) {
    pc = Math.round(rawPc / 100);
  }

  if (box === 0 && pc === 0) {
    return <span className={`font-mono text-gray-400 ${className}`}>0</span>;
  }

  return (
    <div className={`flex flex-col items-center justify-center leading-tight ${className}`}>
      {box !== 0 && (
        <span className="font-mono font-bold text-[12px] whitespace-nowrap">
          {box.toLocaleString()} <span className="text-[10px] font-sans text-gray-500 font-semibold tracking-wide">box</span>
        </span>
      )}
      {pc !== 0 && (
        <span className="font-mono font-bold text-[10px] text-gray-600 whitespace-nowrap mt-[1px]">
          {pc.toLocaleString()} <span className="text-[9px] font-sans text-gray-400 font-semibold tracking-wide">pc</span>
        </span>
      )}
    </div>
  );
};
