import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdCheckCircle, MdArrowBack } from 'react-icons/md';
import { useAuth } from '../../../Context/Auth';

const VerifyInward = ({ inwardId, onSuccess, onCancel, readonly }: { inwardId?: string, onSuccess?: () => void, onCancel?: () => void, readonly?: boolean }) => {
  const params = useParams();
  const idToUse = inwardId || params.id;
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [challan, setChallan] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchChallanData();
  }, [idToUse]);

  const fetchChallanData = async () => {
    setLoading(true);
    try {
      // Fetch Header
      const { data: grnData, error: grnError } = await supabase
        .from('grn_receipts')
        .select('*')
        .eq('id', idToUse)
        .single();
        
      if (grnError) throw grnError;
      setChallan(grnData);

      // Fetch Items
      const { data: itemsData, error: itemsError } = await supabase
        .from('grn_items')
        .select('*')
        .eq('grn_id', idToUse);

      if (itemsError) throw itemsError;
      
      // Initialize items with acceptedQty = expected qty, rejectedQty = 0
      const initializedItems = itemsData.map(item => ({
        ...item,
        acceptedQty: item.accepted_qty || item.qty,
        rejectedQty: item.rejected_qty || 0,
        rejectReason: item.reject_reason || ''
      }));
      setItems(initializedItems);

    } catch (err: any) {
      toast.error('Error fetching challan details.');
      if (onSuccess) onSuccess();
      else navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Inward-Challan/List`);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    // Auto-balance quantities
    if (field === 'acceptedQty') {
      const val = Number(value);
      if (val <= newItems[index].qty) {
        newItems[index].rejectedQty = newItems[index].qty - val;
      }
    } else if (field === 'rejectedQty') {
      const val = Number(value);
      if (val <= newItems[index].qty) {
        newItems[index].acceptedQty = newItems[index].qty - val;
      }
    }
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!window.confirm('Are you sure you want to confirm this Inward Challan? Stock will be updated.')) return;
    
    setSubmitting(true);
    try {
      // 1. Update Items
      for (const item of items) {
        await supabase
          .from('grn_items')
          .update({
            accepted_qty: Number(item.acceptedQty),
            rejected_qty: Number(item.rejectedQty),
            reject_reason: item.rejectReason
          })
          .eq('id', item.id);
          
        // 2. Update Live Inventory (Only for Accepted Qty)
        if (Number(item.acceptedQty) > 0) {
          const { data: existingStock, error: stockCheckErr } = await supabase
            .from('warehouse_inventory')
            .select('id, quantity')
            .ilike('product_name', item.product_name)
            .ilike('warehouse_name', item.warehouse_name)
            .maybeSingle();

          if (stockCheckErr) throw stockCheckErr;

          if (existingStock) {
            await supabase
              .from('warehouse_inventory')
              .update({ quantity: Number(existingStock.quantity) + Number(item.acceptedQty) })
              .eq('id', existingStock.id);
          } else {
            await supabase
              .from('warehouse_inventory')
              .insert([{
                product_name: item.product_name,
                warehouse_name: item.warehouse_name,
                quantity: Number(item.acceptedQty),
                uom: item.uom
              }]);
          }
        }
      }

      // 3. Update GRN Header
      const hasRejections = items.some(i => Number(i.rejectedQty) > 0);
      const allRejected = items.every(i => Number(i.acceptedQty) === 0);
      
      let newStatus = 'Confirm';
      if (allRejected) newStatus = 'Rejected';
      else if (hasRejections) newStatus = 'Partially Received';
      
      const { error: grnError } = await supabase
        .from('grn_receipts')
        .update({ status: newStatus })
        .eq('id', challan.id);

      if (grnError) throw grnError;

      toast.success(`Inward Challan Verified Successfully! Status: ${newStatus}`);
      if (onSuccess) onSuccess();
      else navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Inward-Challan/List`);
    } catch (err: any) {
      toast.error('Failed to verify challan: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center bg-white dark:bg-boxdark"><Spinner /></div>;
  if (!challan) return null;

  return (
    <div className={`mx-auto max-w-7xl text-black dark:text-bodydark text-xs ${inwardId ? '' : 'pb-12'}`}>
      {!inwardId && (
        <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
          <MdCheckCircle className="text-emerald-600" size={24} />
          {readonly ? 'View GRN Details' : 'Verify Inward Challan (QC)'}
        </h2>
        <button
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Inward-Challan/List`)}
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline cursor-pointer"
        >
          <MdArrowBack /> Back to List
        </button>
      </div>
      )}

      <div className={inwardId ? '' : 'rounded-2xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6'}>
        {/* Header Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-6 border-b border-stroke dark:border-strokedark">
          <div>
            <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Challan / GRN #</p>
            <p className="text-lg font-mono font-bold text-black dark:text-white">{challan.grn_no}</p>
          </div>
          <div>
            <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Vendor Name</p>
            <p className="text-sm font-bold text-black dark:text-white">{challan.vendor_name}</p>
          </div>
          <div>
            <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Expected Receipt Date</p>
            <p className="text-sm font-bold text-black dark:text-white">{challan.receipt_date}</p>
          </div>
        </div>

        {/* Items Grid */}
        <h3 className="font-bold text-sm mb-4">Inspection Checklist</h3>
        <div className="max-w-full overflow-x-auto mb-8">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 dark:bg-meta-4 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-white">
                <th className="py-3 px-4 border-b border-stroke dark:border-strokedark">Product Item</th>
                <th className="py-3 px-4 border-b border-stroke dark:border-strokedark">Destination Warehouse</th>
                <th className="py-3 px-4 border-b border-stroke dark:border-strokedark text-center">Expected Qty</th>
                <th className="py-3 px-4 border-b border-stroke dark:border-strokedark text-center text-emerald-600 dark:text-emerald-400">Accepted Qty</th>
                <th className="py-3 px-4 border-b border-stroke dark:border-strokedark text-center text-rose-600 dark:text-rose-400">Rejected Qty</th>
                <th className="py-3 px-4 border-b border-stroke dark:border-strokedark">Reject Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/20">
                  <td className="py-3 px-4 font-bold">{item.product_name}</td>
                  <td className="py-3 px-4 text-gray-500">{item.warehouse_name}</td>
                  <td className="py-3 px-4 text-center font-mono font-bold">{item.qty} {item.uom}</td>
                  <td className="py-2 px-2 text-center">
                    {readonly ? (
                      <div className="font-mono font-bold text-emerald-700">{item.acceptedQty}</div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max={item.qty}
                        value={item.acceptedQty}
                        onChange={(e) => handleItemChange(index, 'acceptedQty', e.target.value)}
                        className="w-20 rounded border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-center font-mono font-bold text-emerald-700 outline-none focus:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-400"
                      />
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {readonly ? (
                      <div className="font-mono font-bold text-rose-700">{item.rejectedQty}</div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max={item.qty}
                        value={item.rejectedQty}
                        onChange={(e) => handleItemChange(index, 'rejectedQty', e.target.value)}
                        className="w-20 rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-center font-mono font-bold text-rose-700 outline-none focus:border-rose-500 dark:bg-rose-900/20 dark:text-rose-400"
                      />
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {readonly ? (
                      <div className="text-gray-600 dark:text-gray-300">{item.rejectReason || '-'}</div>
                    ) : (
                      <input
                        type="text"
                        value={item.rejectReason}
                        onChange={(e) => handleItemChange(index, 'rejectReason', e.target.value)}
                        placeholder="e.g. Damaged box"
                        disabled={Number(item.rejectedQty) === 0}
                        className="w-full rounded border border-stroke px-2 py-1.5 outline-none focus:border-primary disabled:opacity-50 dark:border-strokedark dark:bg-boxdark"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 border-t border-stroke dark:border-strokedark pt-6">
          <button
            type="button"
            onClick={() => {
              if (onCancel) onCancel();
              else if (onSuccess) onSuccess();
              else navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Inward-Challan/List`);
            }}
            className="rounded-lg border border-stroke px-6 py-2 font-medium hover:bg-slate-50 dark:border-strokedark dark:hover:bg-meta-4 transition"
            disabled={submitting}
          >
            {readonly ? 'Close' : 'Cancel'}
          </button>
          {!readonly && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {submitting ? <Spinner /> : <MdCheckCircle size={16} />}
              Confirm Inward Verification
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyInward;
