import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { useAuth } from '../../../Context/Auth';
import { MdStore, MdPerson, MdEvent } from 'react-icons/md';

const PurchaseList = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProcurementLogs = async () => {
    try {
      setLoading(true);
      const { data: purData, error: purError } = await supabase
        .from('supplier_purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (purError) throw purError;
      setPurchases(purData || []);
    } catch (err: any) {
      toast.error('Data Fetching Failure: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcurementLogs();
  }, []);

  const handleDeletePurchaseRecord = async (id: string | number) => {
    if (!window.confirm('Are you certain you want to permanently erase this consignment registry? Shelf stock allocations will reverse!')) return;

    try {
      const { data: targetRecord } = await supabase.from('supplier_purchases').select('items, target_warehouse').eq('id', id).single();
      
      if (targetRecord?.items) {
        for (const item of targetRecord.items) {
          const qty = Number(item.qty || item.quantity || 0);
          const pName = item.itemName || item.product_name;

          if (pName) {
            // 1. Decrease Master Product Stock (-)
            const { data: prod } = await supabase.from('products').select('current_stock').ilike('product_name', pName).maybeSingle();
            if (prod) {
              const newStock = Math.max(0, (Number(prod.current_stock) || 0) - qty);
              await supabase.from('products').update({ current_stock: newStock }).ilike('product_name', pName);
            }

            // 2. Decrease Target Location Warehouse Stock (-)
            if (targetRecord.target_warehouse) {
              const { data: p } = await supabase.from('warehouse_inventory').select('id, quantity').ilike('product_name', pName).ilike('warehouse_name', targetRecord.target_warehouse).maybeSingle();
              if (p) {
                const newWhStock = Math.max(0, (Number(p.quantity) || 0) - qty);
                await supabase.from('warehouse_inventory').update({ quantity: newWhStock }).eq('id', p.id);
              }
            }
          }
        }
      }

      const { error } = await supabase.from('supplier_purchases').delete().eq('id', id);
      if (error) throw error;

      toast.success('Procurement consignment record dropped and stock levels reversed safely!');
      fetchProcurementLogs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredPurchases = purchases.filter(p =>
    (p.purchase_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.target_warehouse || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEntries = filteredPurchases.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedPurchases = filteredPurchases.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);
  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-black dark:text-bodydark text-xs">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Wholesale Purchase Log Registry</h2>
          <p className="text-xs text-gray-400">Manage inward vendor supply consignments and trace batch arrivals</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/Purchase/Purchases/Add')}
          className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-opacity-90 transition shadow-sm cursor-pointer"
        >
          + Log New Supply
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
              placeholder="Search by order # or vendor name..." 
              className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none text-black dark:text-white text-xs font-semibold" 
            />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                <th className="py-4 px-4 font-semibold w-16">S#</th>
                <th className="py-4 px-4 font-semibold">Purchase No</th>
                <th className="py-4 px-4 font-semibold">Vendor Profile</th>
                <th className="py-4 px-4 font-semibold">Stock Receiving Location</th>
                <th className="py-4 px-4 font-semibold text-center">Entry Date</th>
                <th className="py-4 px-4 font-semibold text-center">Payment Term</th>
                <th className="py-4 px-4 font-semibold text-right pr-6">Total Bill Payables</th>
                <th className="py-4 px-4 font-semibold w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm"><Spinner /></td></tr>
              ) : paginatedPurchases.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-sm text-gray-500 dark:text-gray-400 italic">No supply restock logs recorded yet.</td></tr>
              ) : (
                paginatedPurchases.map((pur, idx) => {
                  const serialNumber = startIndex + idx + 1;
                  const totalAmt = Number(pur.total_amount) || 0;
                  const term = pur.payment_term || 'On Credit';
                  const vendorName = pur.supplier_name || 'General Vendor';

                  return (
                    <tr key={pur.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-black dark:text-white text-xs">
                      <td className="py-3.5 px-4 text-gray-400">{serialNumber}</td>
                      <td className="py-3.5 px-4 font-mono font-black text-primary">{pur.purchase_no}</td>
                      <td className="py-3.5 px-4 flex items-center gap-1.5"><MdPerson className="text-gray-400" size={16} />{vendorName}</td>
                      <td className="py-3.5 px-4"><span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1"><MdStore size={12} />{pur.target_warehouse}</span></td>
                      <td className="py-3.5 px-4 text-center text-gray-500"><span className="inline-flex items-center gap-1 text-[11px]"><MdEvent size={13} />{pur.purchase_date}</span></td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${term === 'On Credit' ? 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300' : term === 'By Cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300'}`}>
                          {term}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-success pr-6">Rs. {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-center">
                        <TableActions
                          onPrint={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchases/Print/${pur.id}`)}
                          onEdit={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchases/Add`, { state: { purchaseRecord: pur } })}
                          onDelete={() => handleDeletePurchaseRecord(pur.id)}
                          printTitle="Print Goods Receiving Note"
                          editTitle="Edit Purchase"
                          deleteTitle="Delete Purchase"
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

export default PurchaseList;
