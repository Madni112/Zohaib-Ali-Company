import React, { useEffect, useState } from 'react';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../Context/Auth';

const SaleReturnReceiptList: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(10);

  useEffect(() => {
    fetchReceiptsLog();
  }, []);

  const fetchReceiptsLog = async () => {
    try {
      setLoading(true);
      const { data: receiptRows, error: receiptError } = await supabase
        .from('sales_return_receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (receiptError) throw receiptError;

      const { data: returnsData } = await supabase
        .from('sales_returns')
        .select('id, total_amount, payout_amount_paid, invoice_no, return_no');

      const returnsMap = new Map((returnsData || []).map((r: any) => [String(r.id), r]));
      const returnsInvoiceMap = new Map((returnsData || []).map((r: any) => [String(r.invoice_no).replace('INV-', ''), r]));

      const combinedReceipts = (receiptRows || []).map((rec: any) => {
        const parentReturn = returnsMap.get(String(rec.sales_return_id)) || returnsInvoiceMap.get(String(rec.original_invoice_no || rec.invoice_no).replace('INV-', '')) || {};
        return {
          ...rec,
          sales_returns: parentReturn
        };
      });

      setReceipts(combinedReceipts);
    } catch (err: any) {
      toast.error('Failed to load return receipts: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReceipt = async (id: string | number) => {
    if (!window.confirm('Are you certain you want to permanently delete this return receipt record?')) return;

    try {
      setLoading(true);
      const { error: deleteError } = await supabase
        .from('sales_return_receipts')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success('Sales return receipt removed cleanly.');
      fetchReceiptsLog();
    } catch (err: any) {
      toast.error('Deletion Interrupted: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredReceipts = receipts.filter(rec =>
    String(rec.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(rec.receipt_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(rec.return_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(rec.invoice_no || rec.original_invoice_no || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-white text-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Sales Return Payout Receipts Log</h2>
          <p className="text-gray-400 mt-0.5">Track and authorize downstream account balance collections and refund payout vouchers</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer, receipt #, invoice..."
            className="w-full sm:w-64 rounded-xl border border-stroke py-2 px-3 bg-white dark:bg-boxdark outline-none focus:border-primary font-semibold text-black dark:text-white text-xs shadow-xs"
          />
          <button 
            onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/sales/sales-return-receipt/add`)} 
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-xl font-bold transition shadow-sm cursor-pointer"
          >
            + Add Collection Receipt
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6 overflow-hidden">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 dark:bg-meta-4 text-[10px] font-black uppercase tracking-wider border-b border-stroke text-slate-700 dark:text-white">
                <th className="py-3.5 px-4 text-center w-24 whitespace-nowrap">Receipt #</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Processing Date</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Customer Account Title</th>
                <th className="py-3.5 px-4 font-mono whitespace-nowrap">Return / Invoice Ref</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Settlement Mode</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Disbursing Account</th>
                <th className="py-3.5 px-4 text-right pr-4 whitespace-nowrap">Amount Disbursed (PKR)</th>
                <th className="py-3.5 px-4 text-center w-28 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12"><Spinner /></td></tr>
              ) : filteredReceipts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500 font-bold italic">No remittance adjustment entries currently logged.</td></tr>
              ) : (
                filteredReceipts.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage).map((rec) => {
                  let displayDate = String(rec.payment_date || rec.processing_date || rec.created_at || '').trim();
                  if (displayDate.startsWith('[')) {
                    displayDate = displayDate.replace(/[\[\]"']/g, '').split(',')[0];
                  }
                  if (displayDate.includes('T')) {
                    displayDate = displayDate.split('T')[0];
                  }

                  const rawInvoice = String(rec.return_no || rec.invoice_no || rec.original_invoice_no || '').trim();
                  const cleanInv = rawInvoice.replace(/^inv-?/i, '').trim();
                  const formattedInvoiceNo = cleanInv ? (rawInvoice.startsWith('RTN-') || rawInvoice.startsWith('SRTN-') ? rawInvoice : `INV-${cleanInv.padStart(4, '0')}`) : (rawInvoice || '-');
                  const formattedReceiptNo = rec.receipt_no || `SRR-${String(rec.id).padStart(4, '0')}`;
                  const isCash = (rec.settlement_mode || rec.payment_mode || rec.payment_method) === 'Cash' || (rec.settlement_mode || rec.payment_mode || rec.payment_method) === 'By Cash';
                  const isSplit = (rec.settlement_mode || rec.payment_mode || rec.payment_method) === 'Split';

                  return (
                    <tr key={rec.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-xs text-black dark:text-white">
                      <td className="py-3 px-4 text-center font-bold font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formattedReceiptNo}</td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{displayDate}</td>
                      <td className="py-3 px-4 font-sans font-bold whitespace-nowrap">{rec.customer_name}</td>
                      <td className="py-3 px-4 font-mono text-emerald-800 dark:text-emerald-300 font-bold uppercase whitespace-nowrap">{formattedInvoiceNo}</td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex rounded-md py-0.5 px-2.5 text-[9px] font-black uppercase tracking-wide ${
                          isSplit ? 'bg-amber-100 text-amber-800 border border-amber-300' : (isCash ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300')
                        }`}>
                          {rec.settlement_mode || rec.payment_mode || rec.payment_method || 'Cash'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">{rec.bank_name || rec.bank_account_title || (isCash ? 'Cash Drawer' : '-')}</td>
                      <td className="py-3 px-4 text-right pr-4 text-emerald-800 dark:text-emerald-400 font-black font-mono whitespace-nowrap">
                        Rs. {Number(rec.amount_paid || rec.amount_received || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <TableActions
                          onPrint={() => navigate(`${tenantId ? `/${tenantId}` : ''}/sales/sales-return-receipt/print/${rec.id}`)}
                          onEdit={() => navigate(`${tenantId ? `/${tenantId}` : ''}/sales/sales-return-receipt/add`, { state: { receiptRecord: rec } })}
                          onDelete={() => handleDeleteReceipt(rec.id)}
                          printTitle="Print Receipt Voucher"
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

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Showing {filteredReceipts.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0} to {Math.min(currentPage * entriesPerPage, filteredReceipts.length)} of {filteredReceipts.length} entries
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer text-xs"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 font-bold text-teal-600 text-xs">
            Page {currentPage} of {Math.ceil(filteredReceipts.length / entriesPerPage) || 1}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredReceipts.length / entriesPerPage), p + 1))}
            disabled={currentPage === Math.ceil(filteredReceipts.length / entriesPerPage) || filteredReceipts.length === 0}
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

export default SaleReturnReceiptList;