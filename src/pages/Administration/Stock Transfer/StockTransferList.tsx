import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdEdit, MdDelete, MdCompareArrows } from 'react-icons/md';
import { useAuth } from '../../../Context/Auth';

const StockTransferList = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchTransferHistory();
  }, []);

  const fetchTransferHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_transfers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
    } catch (err: any) {
      toast.error('Failed to aggregate stock transfers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransferRecord = async (id: string | number) => {
    if (!window.confirm('Are you certain you want to permanently delete this stock transfer record?')) return;

    try {
      const { data: targetRecord, error: fetchError } = await supabase
        .from('stock_transfers')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Only revert physical warehouse stocks if the transfer slip was CONFIRMED (Drafts never moved stock)
      if (targetRecord && targetRecord.status === 'Confirm' && targetRecord.items) {
        const itemsArr = Array.isArray(targetRecord.items) ? targetRecord.items : JSON.parse(targetRecord.items || '[]');
        const fromLoc = targetRecord.from_location;
        const toLoc = targetRecord.to_location;


        for (const item of itemsArr) {
          const qty = Number(item.qty || item.quantity || 0);
          const pName = item.itemName || item.product_name;

          if (pName && qty > 0) {
            // 1. Revert Destination Warehouse (TO) -> DECREASE (-)
            if (toLoc) {
              const { data: destStock } = await supabase
                .from('warehouse_inventory')
                .select('id, quantity')
                .ilike('product_name', pName)
                .ilike('warehouse_name', toLoc)
                .maybeSingle();

              if (destStock) {
                const newDestStock = Math.max(0, (Number(destStock.quantity) || 0) - qty);
                await supabase.from('warehouse_inventory').update({ quantity: newDestStock }).eq('id', destStock.id);
              }
            }

            // 2. Revert Source Warehouse (FROM) -> INCREASE (+)
            if (fromLoc) {
              const { data: sourceStock } = await supabase
                .from('warehouse_inventory')
                .select('id, quantity')
                .ilike('product_name', pName)
                .ilike('warehouse_name', fromLoc)
                .maybeSingle();

              if (sourceStock) {
                const newSourceStock = (Number(sourceStock.quantity) || 0) + qty;
                await supabase.from('warehouse_inventory').update({ quantity: newSourceStock }).eq('id', sourceStock.id);
              } else {
                await supabase.from('warehouse_inventory').insert([{
                  product_name: pName,
                  warehouse_name: fromLoc,
                  quantity: qty
                }]);
              }
            }
          }
        }
      }

      const { error: deleteError } = await supabase.from('stock_transfers').delete().eq('id', id);
      if (deleteError) throw deleteError;

      toast.success('Stock transfer record deleted cleanly. Location stock levels reversed!');
      fetchTransferHistory();
    } catch (err: any) {
      toast.error('Deletion Failure: ' + err.message);
    }
  };

  const filteredTransfers = transfers.filter((t) =>
    t.from_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.to_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.transfer_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEntries = filteredTransfers.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedTransfers = filteredTransfers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-xs">
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
          Internal Stock Transfers Ledger
        </h2>
        <button
          type="button"
          onClick={() => navigate('/Administration/StockTransfer/Add')}
          className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-opacity-90 transition duration-150 shadow-sm"
        >
          + New Stock Transfer
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        <div className="border-b border-stroke dark:border-strokedark pb-3 mb-4 flex items-center justify-between">
          <span className="text-xs font-bold text-black dark:text-white">
            Stock Transfer Transactions
          </span>
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 font-mono">
            {transfers.length} Transfers Recorded
          </span>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Show</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none text-xs font-semibold text-black dark:text-white">
              {[10, 25, 50, 100].map((size) => <option key={size} value={size} className="dark:bg-boxdark">{size}</option>)}
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-2 text-xs w-full sm:w-auto text-gray-500 dark:text-gray-400">
            <span>Search:</span>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search transfer no, warehouse..." className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none text-xs text-black dark:text-white" />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                <th className="py-4 px-4 font-semibold w-16">S#</th>
                <th className="py-4 px-4 font-semibold">Transfer Slip No</th>
                <th className="py-4 px-4 font-semibold">Source Warehouse (From)</th>
                <th className="py-4 px-4 font-semibold">Destination Warehouse (To)</th>
                <th className="py-4 px-4 font-semibold">Transfer Date</th>
                <th className="py-4 px-4 font-semibold text-center w-24">Status</th>
                <th className="py-4 px-4 font-semibold text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><Spinner /></td></tr>
              ) : paginatedTransfers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No stock transfer log rows documented.</td></tr>
              ) : (
                paginatedTransfers.map((item, idx) => {
                  const serialNumber = startIndex + idx + 1;
                  const isConfirmed = item.status === 'Confirm';

                  return (
                    <tr key={item.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150">
                      <td className="py-3.5 px-4 font-medium text-black dark:text-white">{serialNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-primary tracking-wide">{item.transfer_no || `TRF-${String(item.id).padStart(4, '0')}`}</td>
                      <td className="py-3.5 px-4 text-gray-700 dark:text-white font-semibold">{item.from_location}</td>
                      <td className="py-3.5 px-4 text-gray-700 dark:text-white font-semibold flex items-center gap-1.5"><MdCompareArrows size={14} className="text-gray-400" /> {item.to_location}</td>
                      <td className="py-3.5 px-4 text-gray-500 font-medium">{item.transfer_date}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isConfirmed ? 'bg-success/10 text-success' : 'bg-amber-50 text-amber-600'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <TableActions
                          onEdit={() => navigate('/Administration/StockTransfer/Add', { state: { transfer: item } })}
                          onDelete={() => handleDeleteTransferRecord(item.id)}
                          editTitle="View or Modify Transfer"
                          deleteTitle="Delete Stock Transfer"
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

export default StockTransferList;
