import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { useAuth } from '../../../Context/Auth';
import { MdPerson, MdEvent, MdReceipt, MdAssignmentReturn } from 'react-icons/md';

const PurchaseReturnReceiptList: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const formatMoney = (val: number | string | undefined | null): string => {
    const num = Number(val) || 0;
    if (Number.isInteger(num)) {
      return num.toLocaleString('en-US');
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const fetchReceiptLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_return_receipts')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (err: any) {
      toast.error('Data Fetching Failure: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceiptLogs();
  }, []);

  const handleDeleteReceipt = async (id: string | number) => {
    if (!window.confirm('Are you certain you want to permanently erase this refund collection record?')) return;
    try {
      const { error } = await supabase.from('purchase_return_receipts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Collection receipt deleted successfully!');
      fetchReceiptLogs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredReceipts = receipts.filter(r =>
    (r.receipt_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.return_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEntries = filteredReceipts.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedReceipts = filteredReceipts.slice(startIndex, startIndex + pageSize);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-black dark:text-bodydark text-xs antialiased font-sans">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-black text-base">
              <MdAssignmentReturn size={18} />
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Purchase Return Receipts Registry
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Audit inward vendor settlement refunds, bank payouts, and debit note clearance vouchers
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return-Receipt/Add`)}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 px-5 text-xs font-bold text-white shadow-md hover:bg-opacity-90 transition cursor-pointer"
        >
          + Add Return Receipt
        </button>
      </div>

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-stroke py-1 px-2.5 bg-transparent dark:border-strokedark font-bold outline-none cursor-pointer"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span>entries</span>
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by receipt #, return note, vendor..."
            className="rounded-lg border border-stroke py-1.5 px-3 bg-transparent outline-none w-full sm:w-72 text-xs font-semibold focus:border-primary dark:border-strokedark"
          />
        </div>

        {/* Table */}
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-gray-2 text-xs font-bold uppercase dark:bg-meta-4 border-b border-stroke text-black dark:text-white tracking-wider">
                <th className="py-3.5 px-4 w-16 text-center whitespace-nowrap">S#</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Receipt Code</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Linked Return Note</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Wholesale Vendor</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Date</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Collection Channel</th>
                <th className="py-3.5 px-4 text-right pr-6 whitespace-nowrap">Refund Collected</th>
                <th className="py-3.5 px-4 w-24 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12"><Spinner /></td></tr>
              ) : paginatedReceipts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 italic text-gray-400">No vendor return refund records recorded yet.</td></tr>
              ) : (
                paginatedReceipts.map((rcpt, idx) => {
                  const method = rcpt.payment_method || 'By Cash';
                  const dateFormatted = rcpt.payment_date || rcpt.created_at?.split('T')[0] || 'N/A';

                  return (
                    <tr key={rcpt.id} className="border-b font-semibold text-xs border-stroke hover:bg-slate-50 dark:hover:bg-meta-4/10 text-black dark:text-white dark:border-strokedark transition duration-150">
                      <td className="py-3.5 px-4 text-center text-gray-400 whitespace-nowrap">{startIndex + idx + 1}</td>
                      <td className="py-3.5 px-4 font-mono font-black text-primary whitespace-nowrap">{rcpt.receipt_no}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{rcpt.return_no}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap flex items-center gap-1.5"><MdPerson className="text-gray-400 shrink-0" size={16} />{rcpt.vendor_name}</td>
                      <td className="py-3.5 px-4 text-center text-gray-500 whitespace-nowrap"><span className="inline-flex items-center gap-1 text-[11px]"><MdEvent size={13} className="shrink-0" />{dateFormatted}</span></td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 border text-[10px] rounded-full font-bold uppercase tracking-wide whitespace-nowrap ${method === 'By Cash'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                          : method === 'Split'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60'
                            : 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60'
                          }`}>
                          {method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 pr-6 whitespace-nowrap">
                        Rs. {formatMoney(rcpt.amount_received)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <TableActions
                          onPrint={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return-Receipt/Print/${rcpt.id}`)}
                          onEdit={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return-Receipt/Add`, { state: { receiptRecord: rcpt } })}
                          onDelete={() => handleDeleteReceipt(rcpt.id)}
                          printTitle="Print Refund Receipt"
                          editTitle="Edit Receipt"
                          deleteTitle="Delete Receipt"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-stroke dark:border-strokedark">
          <div className="text-xs text-gray-500 dark:text-gray-400">Showing {startIndex + 1} to {endIndex} of {totalEntries} entries</div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer text-xs"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 font-bold text-teal-600 text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer text-xs"
              >
                Next
              </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default PurchaseReturnReceiptList;
