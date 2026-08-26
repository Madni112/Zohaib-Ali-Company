import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdEdit, MdDelete, MdEvent, MdPerson } from 'react-icons/md';

const PurchaseReceiptList = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPurchaseReceiptLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_vouchers')
        .select('*')
        .or('voucher_type.eq.Cash Payment Voucher,voucher_type.eq.Bank Payment Voucher')
        .order('id', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseReceiptLogs();
  }, []);

  const handleDeleteReceiptRecord = async (id: string | number) => {
    if (!window.confirm('Are you absolutely certain you want to delete this purchase receipt voucher?')) return;

    try {
      const { error } = await supabase.from('financial_vouchers').delete().eq('id', id);
      if (error) throw error;

      toast.success('Purchase receipt voucher deleted successfully!');
      fetchPurchaseReceiptLogs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredReceipts = receipts.filter(r =>
    (r.voucher_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEntries = filteredReceipts.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedReceipts = filteredReceipts.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);
  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-black dark:text-bodydark text-xs">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Purchase Receipt Log Registry</h2>
          <p className="text-xs text-gray-400">View corporate disbursement layouts and audit vendor clearing histories</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/Purchase/Purchase-Receipt/Add')}
          className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-opacity-90 transition shadow-sm cursor-pointer"
        >
          + Add Purchase Receipt
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Show</span>
            <select 
              value={pageSize} 
              onChange={(e) => setPageSize(Number(e.target.value))} 
              className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none text-black dark:text-white font-bold"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size} className="dark:bg-boxdark">{size}</option>
              ))}
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-2 text-sm w-full sm:w-auto text-gray-500 dark:text-gray-400">
            <span>Search:</span>
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              placeholder="Search receipt order or vendor..." 
              className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none text-black dark:text-white text-xs font-semibold" 
            />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                <th className="py-4 px-4 font-semibold w-16">S#</th>
                <th className="py-4 px-4 font-semibold">Receipt No</th>
                <th className="py-4 px-4 font-semibold">Vendor Name</th>
                <th className="py-4 px-4 font-semibold text-center">Voucher Type</th>
                <th className="py-4 px-4 font-semibold text-center">Clearing Date</th>
                <th className="py-4 px-4 font-semibold text-right pr-6">Amount Cleared</th>
                <th className="py-4 px-4 font-semibold w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm"><Spinner /></td></tr>
              ) : paginatedReceipts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-sm text-gray-500 dark:text-gray-400 italic">No purchase clearing receipt logs recorded yet.</td></tr>
              ) : (
                paginatedReceipts.map((rcpt, idx) => {
                  const serialNumber = startIndex + idx + 1;
                  const venName = rcpt.customer_name || 'General Vendor';
                  const vType = rcpt.voucher_type === 'Cash Payment Voucher' ? 'Cash Payment' : 'Bank Payment';

                  return (
                    <tr key={rcpt.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-black dark:text-white text-xs">
                      <td className="py-3.5 px-4 text-gray-400">{serialNumber}</td>
                      <td className="py-3.5 px-4 font-mono font-black text-primary">{rcpt.voucher_no}</td>
                      <td className="py-3.5 px-4 flex items-center gap-1.5"><MdPerson className="text-gray-400" size={16} />{venName}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${rcpt.voucher_type === 'Cash Payment Voucher' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60' : 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60'}`}>
                          {vType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-500"><span className="inline-flex items-center gap-1 text-[11px]"><MdEvent size={13} />{rcpt.voucher_date}</span></td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-success pr-6" >Rs. {Number(rcpt.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-center">
                        <TableActions
                          onEdit={() => navigate('/Purchase/Purchase-Receipt/Add', { state: { receiptRecord: rcpt } })}
                          onDelete={() => handleDeleteReceiptRecord(rcpt.id)}
                          editTitle="Edit Payment Record"
                          deleteTitle="Delete Voucher"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-stroke dark:border-strokedark">
          <div className="text-sm text-gray-500 dark:text-gray-400">Showing {startIndex + 1} to {endIndex} of {totalEntries} entries</div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className="px-3 py-1.5 rounded text-xs font-medium border border-stroke dark:border-strokedark hover:bg-gray-100 dark:hover:bg-meta-4 transition disabled:opacity-30 cursor-pointer">Previous</button>
              {Array.from({ length: totalPages }, (_, i) => <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1.5 rounded text-xs border transition cursor-pointer ${currentPage === i + 1 ? 'bg-primary text-white border-primary' : 'border-stroke dark:border-strokedark text-gray-500 hover:bg-gray-50'}`}>{i + 1}</button>)}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className="px-3 py-1.5 rounded text-xs font-medium border border-stroke dark:border-strokedark hover:bg-gray-100 dark:hover:bg-meta-4 transition disabled:opacity-30 cursor-pointer">Next</button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PurchaseReceiptList;
