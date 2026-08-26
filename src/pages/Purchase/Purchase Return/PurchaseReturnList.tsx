import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdEdit, MdDelete, MdEvent, MdStore, MdPerson } from 'react-icons/md';

const PurchaseReturnList = () => {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subsequentReceiptsMap, setSubsequentReceiptsMap] = useState<{ [key: string]: number }>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReturnLogs = async () => {
    try {
      setLoading(true);
      const { data: rtnData, error: rtnError } = await supabase
        .from('purchase_returns')
        .select('*')
        .order('created_at', { ascending: false });

      if (rtnError) throw rtnError;

      const { data: recData, error: recError } = await supabase
        .from('purchase_return_receipts')
        .select('return_no, amount_received');

      if (recError) throw recError;

      const receiptTotals: { [key: string]: number } = {};
      if (recData) {
        recData.forEach((r: any) => {
          const code = (r.return_no || '').toUpperCase().trim();
          receiptTotals[code] = (receiptTotals[code] || 0) + (Number(r.amount_received) || 0);
        });
      }

      setSubsequentReceiptsMap(receiptTotals);
      setReturns(rtnData || []);
    } catch (err: any) {
      toast.error('Data Fetching Failure: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnLogs();
  }, []);

  const handleDeleteReturnRecord = async (id: string | number) => {
    if (!window.confirm('Are you certain you want to permanently delete this return record note?')) return;

    try {
      const { data: targetRecord } = await supabase.from('purchase_returns').select('items, source_warehouse').eq('id', id).single();
      if (targetRecord?.items) {
        for (const item of targetRecord.items) {
          const qty = Number(item.qty || item.quantity || 0);
          const pName = item.itemName || item.product_name;

          if (pName) {
            // 1. Increase Master Product Stock (+)
            const { data: prod } = await supabase.from('products').select('current_stock').ilike('product_name', pName).maybeSingle();
            if (prod) {
              await supabase.from('products').update({ current_stock: (Number(prod.current_stock) || 0) + qty }).ilike('product_name', pName);
            }

            // 2. Increase Source Location Warehouse Stock (+)
            if (targetRecord.source_warehouse) {
              const { data: p } = await supabase.from('warehouse_inventory').select('id, quantity').ilike('product_name', pName).ilike('warehouse_name', targetRecord.source_warehouse).maybeSingle();
              if (p) {
                await supabase.from('warehouse_inventory').update({ quantity: (Number(p.quantity) || 0) + qty }).eq('id', p.id);
              } else {
                await supabase.from('warehouse_inventory').insert([{ product_name: pName, warehouse_name: targetRecord.source_warehouse, quantity: qty }]);
              }
            }
          }
        }
      }
      const { error } = await supabase.from('purchase_returns').delete().eq('id', id);
      if (error) throw error;
      toast.success('Return note dropped safely!');
      fetchReturnLogs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredReturns = returns.filter(r =>
    (r.return_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEntries = filteredReturns.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedReturns = filteredReturns.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);
  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-black dark:text-bodydark text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Vendor Purchase Returns Registry (Debit Notes)</h2>
          <p className="text-xs text-gray-400">Trace outbound product returns and warehouse shelf offsets</p>
        </div>
        <button type="button" onClick={() => navigate('/Purchase/Purchase-Return/Add')} className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white shadow-sm cursor-pointer">+ Log New Return</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Show</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none text-black dark:text-white font-bold">
              {[10, 25, 50, 100].map((size) => <option key={size} value={size} className="dark:bg-boxdark">{size}</option>)}
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2 text-sm w-full sm:w-auto text-gray-500 dark:text-gray-400">
            <span>Search:</span>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by note..." className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none text-black dark:text-white text-xs font-semibold" />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                <th className="py-4 px-4 font-semibold w-16">S#</th>
                <th className="py-4 px-4 font-semibold">Return No</th>
                <th className="py-4 px-4 font-semibold">Vendor Profile</th>
                <th className="py-4 px-4 font-semibold">Source Warehouse</th>
                <th className="py-4 px-4 text-center font-semibold">Entry Date</th>
                <th className="py-4 px-4 text-center font-semibold">Return Status</th>
                <th className="py-4 px-4 text-right pr-6 font-semibold">Total Offset</th>
                <th className="py-4 px-4 w-24 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm"><Spinner /></td></tr>
              ) : paginatedReturns.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-sm text-gray-500 dark:text-gray-400 italic">No outbound supply return records found.</td></tr>
              ) : (
                paginatedReturns.map((rtn, idx) => {
                  const serialNumber = startIndex + idx + 1;
                  const totalAmt = Number(rtn.total_amount) || 0;
                  const upfrontPaid = Number(rtn.amount_paid) || 0;
                  const subsequentCollected = subsequentReceiptsMap[(rtn.return_no || '').toUpperCase().trim()] || 0;
                  const aggregatedPaidValue = upfrontPaid + subsequentCollected;

                  let returnStatusText = 'Unpaid';
                  let returnStatusColor = 'bg-danger/10 text-danger border-danger/20';

                  if (aggregatedPaidValue >= totalAmt - 1 && totalAmt > 0) {
                    returnStatusText = 'Paid';
                    returnStatusColor = 'bg-success/10 text-success border-success/20';
                  } else if (aggregatedPaidValue > 0 && aggregatedPaidValue < totalAmt) {
                    returnStatusText = 'On Credit';
                    returnStatusColor = 'bg-purple-50 text-purple-600 border-purple-200';
                  }

                  return (
                    <tr key={rtn.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-black dark:text-white text-xs">
                      <td className="py-3.5 px-4 text-gray-400">{serialNumber}</td>
                      <td className="py-3.5 px-4 font-mono font-black text-primary">{rtn.return_no}</td>
                      <td className="py-3.5 px-4 flex items-center gap-1.5"><MdPerson className="text-gray-400" size={16} />{rtn.vendor_name}</td>
                      <td className="py-3.5 px-4"><span className="bg-purple-50 dark:bg-meta-4 text-purple-600 dark:text-white px-2.5 py-1 rounded-sm text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1"><MdStore size={12} />{rtn.source_warehouse}</span></td>
                      <td className="py-3.5 px-4 text-center text-gray-500"><span className="inline-flex items-center gap-1 text-[11px]"><MdEvent size={13} />{rtn.return_date}</span></td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${returnStatusColor}`}>
                          {returnStatusText}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-success pr-6">Rs. {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-center">
                        <TableActions
                          onEdit={() => navigate('/Purchase/Purchase-Return/Add', { state: { returnRecord: rtn } })}
                          onDelete={() => handleDeleteReturnRecord(rtn.id)}
                          editTitle="Edit Return"
                          deleteTitle="Delete Return"
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

export default PurchaseReturnList;
