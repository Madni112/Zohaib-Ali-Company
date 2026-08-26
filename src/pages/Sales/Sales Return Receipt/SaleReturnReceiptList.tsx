import React, { useEffect, useState } from 'react';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { useNavigate } from 'react-router-dom';
import { MdDelete, MdEdit } from 'react-icons/md';

const SaleReturnReceiptList = () => {
    const navigate = useNavigate();
    const [receipts, setReceipts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
                .select('id, total_amount, payout_amount_paid, invoice_no');

            const returnsMap = new Map((returnsData || []).map((r: any) => [String(r.id), r]));
            const returnsInvoiceMap = new Map((returnsData || []).map((r: any) => [String(r.invoice_no).replace('INV-', ''), r]));

            const combinedReceipts = (receiptRows || []).map((rec: any) => {
                const parentReturn = returnsMap.get(String(rec.sales_return_id)) || returnsInvoiceMap.get(String(rec.original_invoice_no).replace('INV-', '')) || {};
                return {
                    ...rec,
                    sales_returns: parentReturn
                };
            });

            setReceipts(combinedReceipts);
        } catch (err: any) {
            toast.error('Failed to load receipts: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- ✅ CRITICAL REVERSAL AUTOMATION ENGINE: Mutates parent return bill automatically upon receipt removal ---
    const handleDeleteReceipt = async (id: string | number) => {
        if (!window.confirm('Are you certain you want to permanently delete this return receipt record?')) return;

        try {
            setLoading(true);

            // ✅ FIXED CLEAN DELETION: Wipes ONLY the row from sales_return_receipts table.
            // We completely remove any code that was running an update function against 'sales_returns' below this line!
            const { error: deleteError } = await supabase
                .from('sales_return_receipts')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            toast.success('Sales return receipt removed cleanly. Parent invoice preserved!');
            fetchReceiptsLog(); // Refreshes your active log grid
        } catch (err: any) {
            toast.error('Deletion Interrupted: ' + err.message);
        } finally {
            setLoading(false);
        }
    };


    const filteredReceipts = receipts.filter(rec =>
        String(rec.customer_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(rec.original_invoice_no).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-white text-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-black dark:text-white">Sales Return Payout Receipts Log</h2>
                    <p className="text-gray-400 mt-0.5">Track and authorize downstream account balance collections vouchers</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search customer or invoice..."
                        className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-white dark:bg-boxdark outline-none focus:border-primary font-semibold text-black dark:text-white"
                    />
                    <button onClick={() => navigate('/sales/sales-return-receipt/add')} className="shrink-0 bg-success text-white py-1.5 px-4 rounded font-bold hover:bg-opacity-90 transition shadow-sm cursor-pointer">+ Add Collection Receipt</button>
                </div>
            </div>

            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6 overflow-hidden">
                <div className="max-w-full overflow-x-auto">
                    <table className="w-full table-auto border-collapse text-left">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-meta-4 text-[10px] font-black uppercase tracking-wider border-b border-stroke text-black dark:text-white">
                                <th className="py-3 px-4 text-center w-16">Receipt #</th>
                                <th className="py-3 px-4">Processing Date</th>
                                <th className="py-3 px-4">Customer Account Title</th>
                                <th className="py-3 px-4 font-mono">Invoice Reference</th>
                                <th className="py-3 px-4 text-center">Settlement Mode</th>
                                <th className="py-3 px-4">Allocated Bank Ledger</th>
                                <th className="py-3 px-4 text-right pr-4">Amount Payout Remitted</th>
                                <th className="py-3 px-4 text-center w-28">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-12"><Spinner /></td></tr>
                            ) : filteredReceipts.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-12 text-gray-400 font-bold italic bg-gray-50/50">No remittance adjustment entries currently logged.</td></tr>
                            ) : (
                                filteredReceipts.map((rec) => {

                                    let displayDate = String(rec.payment_date || rec.processing_date || rec.created_at || '').trim();
                                    if (displayDate.startsWith('[')) {
                                        displayDate = displayDate.replace(/[\[\]"']/g, '').split(',')[0];
                                    }
                                    if (displayDate.includes('T')) {
                                        displayDate = displayDate.split('T')[0];
                                    }

                                    const rawInvoice = String(rec.invoice_no || rec.original_invoice_no || '').trim();
                                    const cleanInv = rawInvoice.replace(/^inv-?/i, '').trim();
                                    const formattedInvoiceNo = cleanInv ? `INV-${cleanInv.padStart(4, '0')}` : (rawInvoice || '-');

                                    const formattedReceiptNo = rec.receipt_no || `REC-${String(rec.id).padStart(4, '0')}`;

                                    return (
                                        <tr key={rec.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-xs text-black dark:text-white">
                                            <td className="py-2.5 px-4 text-center font-bold font-mono text-primary">{formattedReceiptNo}</td>
                                            <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">{displayDate}</td>
                                            <td className="py-2.5 px-4 font-sans font-bold">{rec.customer_name}</td>
                                            <td className="py-2.5 px-4 font-mono text-danger font-bold uppercase">{formattedInvoiceNo}</td>
                                            <td className="py-2.5 px-4 text-center">
                                                <span className={`inline-flex rounded-sm py-0.5 px-2 text-[9px] font-black text-white uppercase tracking-wide ${(rec.settlement_mode || rec.payment_mode) === 'Cash' ? 'bg-success' : 'bg-primary'}`}>
                                                    {rec.settlement_mode || rec.payment_mode || 'Cash'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 font-mono text-gray-600 dark:text-gray-400">{rec.bank_name || rec.bank_account_title || '-'}</td>
                                            <td className="py-2.5 px-4 text-right pr-4 text-danger font-black font-mono">Rs. {Number(rec.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>

                                            <td className="py-2.5 px-4 text-center">
                                                <TableActions
                                                    onEdit={() => navigate('/sales/sales-return-receipt/add', { state: { receiptRecord: rec } })}
                                                    onDelete={() => handleDeleteReceipt(rec.id)}
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
            </div>
        </div>
    );
};

export default SaleReturnReceiptList;