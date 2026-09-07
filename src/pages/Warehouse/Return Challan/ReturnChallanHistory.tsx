import React, { useEffect, useState } from 'react';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdVisibility } from 'react-icons/md';

const ReturnChallanHistory = ({ onView }: { onView: (id: string) => void }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select('*')
        .in('inward_status', ['Received', 'Rejected'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (err: any) {
      toast.error('Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;

  return (
    <div className="max-w-full overflow-x-auto text-black dark:text-white pb-4">
      <table className="w-full table-auto border-collapse text-left">
        <thead>
          <tr className="bg-slate-100 dark:bg-meta-4 text-[10px] font-black uppercase tracking-wider border-b border-stroke text-slate-700 dark:text-white">
            <th className="py-3 px-4">Return Note #</th>
            <th className="py-3 px-4">Customer Name</th>
            <th className="py-3 px-4 text-center">Status</th>
            <th className="py-3 px-4 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr><td colSpan={4} className="text-center py-8 text-gray-500 italic font-bold">No history found.</td></tr>
          ) : (
            history.map((h) => (
              <tr key={h.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/20 font-semibold text-xs">
                <td className="py-3 px-4 font-mono text-primary">{h.return_no || `SR-${String(h.id).padStart(4, '0')}`}</td>
                <td className="py-3 px-4">{h.customer_name}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-flex rounded-md py-0.5 px-2.5 text-[9px] font-black uppercase tracking-wide ${
                    h.inward_status === 'Received' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {h.inward_status}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => onView(h.id)} className="text-primary hover:text-primary/70 transition">
                    <MdVisibility size={20} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ReturnChallanHistory;
