import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';

const PurchaseReturnReceiptList = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReceiptLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('purchase_return_receipts').select('*').order('id', { ascending: false });
      if (error) throw error;
      setReceipts(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReceiptLogs(); }, []);

  const handleDeleteReceipt = async (id: string | number) => {
    if (!window.confirm('Delete this collection entry record note?')) return;
    try {
      const { error } = await supabase.from('purchase_return_receipts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Collection receipt deleted!');
      fetchReceiptLogs();
    } catch (err: any) { toast.error(err.message); }
  };

  const filteredReceipts = receipts.filter(r => (r.receipt_no || '').toLowerCase().includes(searchTerm.toLowerCase()) || (r.return_no || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const totalEntries = filteredReceipts.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedReceipts = filteredReceipts.slice(startIndex, startIndex + pageSize);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-black dark:text-bodydark text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Purchase Return Receipts Log Directory</h2>
          <p className="text-xs text-gray-400">View subsequent vendor settlement funds payouts collected logs</p>
        </div>
        <button type="button" onClick={() => navigate('/Purchase/Purchase-Return-Receipt/Add')} className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white shadow-sm cursor-pointer">+ Add Return Receipt</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        <div className="flex justify-between items-center mb-4 gap-4">
          <div className="text-sm text-gray-500">Show <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded border py-0.5 px-1 bg-transparent font-bold"><option value="10">10</option><option value="25">25</option></select> entries</div>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search receipt order code..." className="rounded border py-1 px-3 bg-transparent outline-none w-64 text-xs font-semibold" />
        </div>

        <table className="w-full table-auto border-collapse text-left">
          <thead>
            <tr className="bg-gray-2 text-xs font-bold uppercase dark:bg-meta-4 border-b border-stroke text-black dark:text-white">
              <th className="py-3 px-4 w-16">S#</th>
              <th className="py-3 px-4">Receipt No</th>
              <th className="py-3 px-4">Return Ref Note</th>
              <th className="py-3 px-4">Vendor Profile</th>
              <th className="py-3 px-4 text-center">Gateway</th>
              <th className="py-3 px-4 text-right pr-6">Amount Collected</th>
              <th className="py-3 px-4 w-24 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-10"><Spinner /></td></tr> : paginatedReceipts.length === 0 ? <tr><td colSpan={7} className="text-center py-8 italic text-gray-400">No return settlement layouts collected logs found.</td></tr> : paginatedReceipts.map((rcpt, idx) => (
              <tr key={rcpt.id} className="border-b font-semibold text-xs border-stroke hover:bg-slate-50 text-black dark:text-white dark:border-strokedark">
                <td className="py-3 px-4 text-gray-400">{startIndex + idx + 1}</td>
                <td className="py-3 px-4 font-mono font-black text-primary">{rcpt.receipt_no}</td>
                <td className="py-3 px-4 font-mono font-bold text-gray-500">{rcpt.return_no}</td>
                <td className="py-3 px-4">{rcpt.vendor_name}</td>
                <td className="py-3 px-4 text-center"><span className={`px-2 py-0.5 border text-[10px] rounded font-bold ${rcpt.payment_method === 'By Cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60' : 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60'}`}>{rcpt.payment_method}</span></td>
                <td className="py-3 px-4 text-right font-mono font-black text-success pr-6">Rs. {Number(rcpt.amount_received || 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-center">
                  <TableActions
                    onEdit={() => navigate('/Purchase/Purchase-Return-Receipt/Add', { state: { receiptRecord: rcpt } })}
                    onDelete={() => handleDeleteReceipt(rcpt.id)}
                    editTitle="Edit Receipt"
                    deleteTitle="Delete Receipt"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PurchaseReturnReceiptList;
