import React, { useEffect, useState } from 'react';
import { supabase } from '../../../Context/supabaseClient';
import { MdVisibility } from 'react-icons/md';
import Spinner from '../../../ui/Spinner';

interface InwardChallanHistoryProps {
  onView: (id: string) => void;
}

const InwardChallanHistory: React.FC<InwardChallanHistoryProps> = ({ onView }) => {
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('grn_receipts')
        .select('*')
        .neq('status', 'Pending Inward')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setChallans(data || []);
    } catch (err: any) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = challans.filter(c =>
    String(c.grn_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(c.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full text-black dark:text-white text-xs max-h-[70vh] flex flex-col">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search vendor, GRN #..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-80 rounded-lg border border-stroke bg-white px-4 py-2 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark font-bold shadow-sm"
        />
      </div>

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark flex-grow overflow-hidden flex flex-col">
        <div className="max-w-full overflow-y-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead className="sticky top-0 bg-slate-100 dark:bg-meta-4 z-10 shadow-sm">
              <tr className="text-[10px] font-black uppercase tracking-wider border-b border-stroke text-slate-700 dark:text-white">
                <th className="py-3 px-4 whitespace-nowrap">Challan / GRN #</th>
                <th className="py-3 px-4 whitespace-nowrap">Receipt Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Vendor Name</th>
                <th className="py-3 px-4 whitespace-nowrap text-center">Status</th>
                <th className="py-3 px-4 text-center w-28 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><Spinner /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-500 font-bold italic">No history found.</td></tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-xs text-black dark:text-white">
                    <td className="py-3 px-4 font-bold font-mono text-primary whitespace-nowrap">{rec.grn_no}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{rec.receipt_date}</td>
                    <td className="py-3 px-4 font-sans font-bold whitespace-nowrap">{rec.vendor_name}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex rounded-md py-0.5 px-2.5 text-[9px] font-black uppercase tracking-wide border ${
                        rec.status === 'Confirm' || rec.status === 'Billed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60' :
                        rec.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60' :
                        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => onView(rec.id)}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 p-1.5 rounded transition shadow-sm cursor-pointer"
                        title="View GRN"
                      >
                        <MdVisibility size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InwardChallanHistory;
