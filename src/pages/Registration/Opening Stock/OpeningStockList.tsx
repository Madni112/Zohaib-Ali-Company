import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdInventory } from 'react-icons/md';

const OpeningStockList = () => {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opening_stocks')
        .select('*')
        .order('itemName', { ascending: true });

      if (error) throw error;
      setStocks(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this opening stock record?')) {
      return;
    }

    try {
      const targetRecord = stocks.find((s) => String(s.id) === String(id));
      if (!targetRecord) {
        toast.error('Record not found in current cache view.');
        return;
      }

      const activeProductLabel = targetRecord.itemName;
      const amountToDeduct = Number(targetRecord.quantity || targetRecord.qty || 0);

      if (activeProductLabel && amountToDeduct > 0) {
        const { data: currentProductMatch } = await supabase
          .from('products')
          .select('current_stock')
          .eq('product_name', activeProductLabel)
          .single();

        if (currentProductMatch) {
          const currentTotalStockInWarehouse = Number(currentProductMatch.current_stock) || 0;
          const freshlyCalculatedNetStockLevel = Math.max(0, currentTotalStockInWarehouse - amountToDeduct);

          await supabase
            .from('products')
            .update({ current_stock: freshlyCalculatedNetStockLevel })
            .eq('product_name', activeProductLabel);
        }
      }

      const { error } = await supabase.from('opening_stocks').delete().eq('id', id);
      if (error) throw error;

      toast.success('Opening stock record removed and warehouse stock balanced successfully');
      fetchStocks();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      <div className="flex justify-between items-center mb-6 border-b border-stroke dark:border-strokedark pb-4">
        <h4 className="text-xl font-semibold text-black dark:text-white flex items-center gap-2">
          <MdInventory className="text-primary text-2xl" /> Opening Stocks Directory
        </h4>
        <button 
          onClick={() => navigate('/Inventory/OpeningStock/Add')}
          className="bg-primary hover:bg-opacity-90 text-white font-medium py-2 px-4 rounded text-sm transition-all shadow-sm cursor-pointer"
        >
          + Initialize Opening Stock
        </button>
      </div>

      <div className="max-w-full overflow-x-auto">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="bg-gray-2 text-left dark:bg-meta-4">
              <th className="py-4 px-4 font-medium text-black dark:text-white">Stock No</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white">Item Details</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white">Batch & Location</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white text-center">Qty</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white text-right">Unit Cost (PKR)</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white text-right">Total Valuation</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white text-center">Opening Date</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white text-center">Expiry Date</th>
              <th className="py-4 px-4 font-medium text-black dark:text-white text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-10"><Spinner /></td></tr>
            ) : stocks.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-500 font-medium">No inventory data initialized yet.</td></tr>
            ) : (
              stocks.map((stock) => (
                <tr key={stock.id} className="border-b border-[#eee] dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/10 transition-colors">
                  <td className="py-5 px-4 font-mono text-xs font-bold text-textColor dark:text-white">
                    {stock.stockNo || stock.stock_no || 'N/A'}
                  </td>
                  
                  <td className="py-5 px-4 font-medium text-black dark:text-white">
                    <p className="font-semibold">{stock.itemName || stock.product_name}</p>
                    {stock.skuCode && <p className="text-[11px] font-mono text-primary font-bold">{stock.skuCode}</p>}
                  </td>
                  <td className="py-5 px-4">
                    <p className="font-mono text-xs text-gray-600 dark:text-bodydark">Batch: {stock.batchNumber || stock.batch_number || 'N/A'}</p>
                    <p className="text-xs text-primary font-semibold">Loc: {stock.location}</p>
                  </td>
                  
                  <td className="py-5 px-4 text-center font-bold text-black dark:text-white">
                    {stock.qty || stock.quantity}
                  </td>
                  
                  <td className="py-5 px-4 text-right font-mono font-bold text-black dark:text-white">
                    Rs. {Number(stock.purchase_price || stock.rate || stock.rp || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  
                  <td className="py-5 px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                    Rs. {Number(stock.amount || stock.total_amount || ((stock.qty || stock.quantity || 0) * (stock.purchase_price || stock.rate || stock.rp || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-5 px-4 text-center text-xs font-mono whitespace-nowrap text-gray-700 dark:text-bodydark">
                    {stock.openingDate || stock.opening_date || 'N/A'}
                  </td>
                  <td className="py-5 px-4 text-center text-xs font-mono whitespace-nowrap text-danger font-medium">
                    {stock.expiryDate || stock.expiry_date || 'N/A'}
                  </td>
                  
                  <td className="py-5 px-4 text-center">
                    <TableActions
                      onEdit={() => navigate('/Inventory/OpeningStock/Add', { state: { stock } })}
                      onDelete={() => handleDelete(stock.id)}
                      editTitle="Modify Stock Values"
                      deleteTitle="Remove Record"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OpeningStockList;
