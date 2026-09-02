import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdCheckCircle, MdArrowBack } from 'react-icons/md';
import { useAuth } from '../../../Context/Auth';

const VerifyInward = ({ inwardId, locationFilter, onSuccess, onCancel, readonly }: { inwardId?: string, locationFilter?: string, onSuccess?: () => void, onCancel?: () => void, readonly?: boolean }) => {
  const params = useParams();
  const idToUse = inwardId || params.id;
  const navigate = useNavigate();
  const { tenantId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [challan, setChallan] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);

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

      // Initialize items
      const initializedItems = await Promise.all(itemsData.map(async (item) => {
        // Fetch product info to support Box/Pieces UI for Tiles
        const { data: prodInfo } = await supabase
          .from('products')
          .select('category, pcs_per_box, pieces_per_box, pieces_per_packing')
          .ilike('product_name', item.product_name)
          .maybeSingle();

        const rawPcs = Number(prodInfo?.pieces_per_box ?? prodInfo?.pcs_per_box ?? prodInfo?.pieces_per_packing ?? 0);
        const isTile = String(prodInfo?.category || '').toUpperCase().includes('TILE');
        const pcsPerBox = rawPcs > 1 ? rawPcs : (isTile ? 4 : 1);

        const isUnverified = (item.accepted_qty == null) || (item.accepted_qty === 0 && item.rejected_qty === 0 && item.qty > 0);

        return {
          ...item,
          acceptedQty: isUnverified ? item.qty : item.accepted_qty,
          rejectedQty: isUnverified ? 0 : item.rejected_qty,
          rejectReason: item.reject_reason || '',
          isVerified: !isUnverified,
          isTile,
          pcsPerBox
        };
      }));
      
      setAllItems(initializedItems);

      // Filter UI items based on location filter
      let displayItems = initializedItems;
      if (locationFilter && locationFilter !== 'ALL') {
        displayItems = initializedItems.filter(item => {
          const isShop = String(item.warehouse_name).toUpperCase() === 'SHOP';
          return locationFilter === 'SHOP' ? isShop : !isShop;
        });
      }
      setItems(displayItems);

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
    
    if (field === 'rejectReason') {
      newItems[index][field] = value;
      setItems(newItems);
      return;
    }
    
    // For quantity fields, prevent invalid or negative inputs
    let val = Number(value);
    if (isNaN(val) || val < 0) val = 0;
    
    // Strictly cap the input value at the maximum expected quantity
    if (val > newItems[index].qty) {
      val = newItems[index].qty;
    }

    newItems[index][field] = val;

    // Auto-balance Accepted and Rejected quantities
    if (field === 'acceptedQty') {
      newItems[index].rejectedQty = Number((newItems[index].qty - val).toFixed(2));
    } else if (field === 'rejectedQty') {
      newItems[index].acceptedQty = Number((newItems[index].qty - val).toFixed(2));
    }
    
    setItems(newItems);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (items.some((item) => Number(item.rejectedQty) > 0 && !item.rejectReason)) {
      toast.error('Please provide a reason for all rejected items.');
      return;
    }
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
      const updatedAllItems = allItems.map(original => {
        const updated = items.find(i => i.id === original.id);
        // If it's being updated in the UI now, it's verified. 
        // If it's hidden (for another location), check if it was previously verified in the DB.
        const originalIsUnverified = (original.accepted_qty == null) || (original.accepted_qty === 0 && original.rejected_qty === 0 && original.qty > 0);
        const isVerified = updated ? true : !originalIsUnverified;
        
        return { 
          isVerified, 
          accepted_qty: updated ? updated.acceptedQty : (original.accepted_qty ?? 0),
          rejected_qty: updated ? updated.rejectedQty : (original.rejected_qty ?? 0)
        };
      });

      const allItemsVerified = updatedAllItems.every(i => i.isVerified);
      const hasRejections = updatedAllItems.some(i => Number(i.rejected_qty) > 0);
      const allRejected = updatedAllItems.every(i => Number(i.accepted_qty) === 0);

      let newStatus = 'Partially Received';
      if (allItemsVerified) {
        if (allRejected) newStatus = 'Rejected';
        else if (hasRejections) newStatus = 'Partially Received';
        else newStatus = 'Confirm';
      }

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
                  <td className="py-3 px-4 text-gray-500">
                    <div className="flex items-center gap-2">
                      {item.warehouse_name}
                      {readonly && item.isVerified && (
                        <MdCheckCircle className="text-emerald-500 text-base" title="Verified by this location" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold">
                    {item.isTile && item.pcsPerBox > 1 ? (
                      <div className="text-[13px] text-gray-700 dark:text-gray-300">
                        {Math.floor(Number(item.qty || 0))} Box + {Math.round((Number(item.qty || 0) - Math.floor(Number(item.qty || 0))) * item.pcsPerBox)} Pcs
                      </div>
                    ) : (
                      <>
                        {item.qty} {item.uom}
                      </>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {readonly ? (
                      !item.isVerified ? (
                        <div className="text-gray-400 font-bold italic text-[10px] uppercase">Pending</div>
                      ) : item.isTile && item.pcsPerBox > 1 ? (
                        <div className="font-mono font-bold text-emerald-700 text-[13px]">
                          {Math.floor(Number(item.acceptedQty || 0))} Box + {Math.round((Number(item.acceptedQty || 0) - Math.floor(Number(item.acceptedQty || 0))) * item.pcsPerBox)} Pcs
                        </div>
                      ) : (
                        <div className="font-mono font-bold text-emerald-700">
                          {item.acceptedQty}
                        </div>
                      )
                    ) : item.isTile && item.pcsPerBox > 1 ? (
                      <div className="flex items-start gap-1 bg-emerald-50 dark:bg-emerald-900/20 p-1.5 rounded-lg border border-emerald-200 min-w-[120px]">
                        <div className="flex-1 flex items-center bg-white dark:bg-boxdark border border-emerald-300 dark:border-emerald-700 rounded-md px-1 py-1 focus-within:border-emerald-500 shadow-sm mt-0.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={(() => {
                              const b = Math.floor(Number(item.acceptedQty || 0));
                              return b === 0 ? '' : b;
                            })()}
                            placeholder="0"
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              const newBoxes = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                              const currentLoose = Math.round((Number(item.acceptedQty || 0) - Math.floor(Number(item.acceptedQty || 0))) * item.pcsPerBox);
                              const newQty = Number((newBoxes + currentLoose / item.pcsPerBox).toFixed(3));
                              handleItemChange(index, 'acceptedQty', Math.min(Number(item.qty), newQty));
                            }}
                            className="w-full bg-transparent text-center font-mono font-bold text-emerald-700 outline-none text-xs min-w-[24px]"
                          />
                          <span className="text-[9px] font-bold text-emerald-700/60 dark:text-emerald-400/60 pr-1 select-none">Box</span>
                        </div>
                        <div className="text-emerald-400 font-black text-[10px] mt-2">+</div>
                        <div className="flex flex-col items-center flex-1">
                          <div className="w-full flex items-center bg-white dark:bg-boxdark border border-emerald-300 dark:border-emerald-700 rounded-md px-1 py-1 focus-within:border-emerald-500 shadow-sm mt-0.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={(() => {
                                const currentLoose = Math.round((Number(item.acceptedQty || 0) - Math.floor(Number(item.acceptedQty || 0))) * item.pcsPerBox);
                                return currentLoose === 0 ? '' : currentLoose;
                              })()}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                const enteredLoose = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                                const currentBoxes = Math.floor(Number(item.acceptedQty || 0));
                                const extraBoxes = Math.floor(enteredLoose / item.pcsPerBox);
                                const remLoose = enteredLoose % item.pcsPerBox;
                                const finalBoxes = currentBoxes + extraBoxes;
                                const newQty = Number((finalBoxes + remLoose / item.pcsPerBox).toFixed(3));
                                handleItemChange(index, 'acceptedQty', Math.min(Number(item.qty), newQty));
                              }}
                              className="w-full bg-transparent text-center font-mono font-bold text-emerald-700 outline-none text-xs min-w-[24px]"
                            />
                            <span className="text-[9px] font-bold text-emerald-700/60 dark:text-emerald-400/60 pl-1 select-none">Pcs</span>
                          </div>
                          <span className="text-[8px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5 font-bold leading-none">{item.pcsPerBox} pcs/box</span>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max={item.qty}
                        value={item.acceptedQty === 0 ? '' : item.acceptedQty}
                        onChange={(e) => handleItemChange(index, 'acceptedQty', e.target.value)}
                        className="w-24 rounded-lg border border-emerald-300 dark:border-emerald-700 py-1.5 px-3 bg-white dark:bg-boxdark outline-none focus:border-emerald-500 font-mono font-bold text-emerald-700 text-sm shadow-sm text-center mx-auto block"
                        placeholder="0"
                      />
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {readonly ? (
                      !item.isVerified ? (
                        <div className="text-gray-400 font-bold italic text-[10px] uppercase">-</div>
                      ) : item.isTile && item.pcsPerBox > 1 ? (
                        <div className="font-mono font-bold text-rose-700 text-[13px]">
                          {Math.floor(Number(item.rejectedQty || 0))} Box + {Math.round((Number(item.rejectedQty || 0) - Math.floor(Number(item.rejectedQty || 0))) * item.pcsPerBox)} Pcs
                        </div>
                      ) : (
                        <div className="font-mono font-bold text-rose-700">
                          {item.rejectedQty}
                        </div>
                      )
                    ) : item.isTile && item.pcsPerBox > 1 ? (
                      <div className="flex items-start gap-1 bg-rose-50 dark:bg-rose-900/20 p-1.5 rounded-lg border border-rose-200 min-w-[120px]">
                        <div className="flex-1 flex items-center bg-white dark:bg-boxdark border border-rose-300 dark:border-rose-700 rounded-md px-1 py-1 focus-within:border-rose-500 shadow-sm mt-0.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={(() => {
                              const b = Math.floor(Number(item.rejectedQty || 0));
                              return b === 0 ? '' : b;
                            })()}
                            placeholder="0"
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              const newBoxes = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                              const currentLoose = Math.round((Number(item.rejectedQty || 0) - Math.floor(Number(item.rejectedQty || 0))) * item.pcsPerBox);
                              const newQty = Number((newBoxes + currentLoose / item.pcsPerBox).toFixed(3));
                              handleItemChange(index, 'rejectedQty', Math.min(Number(item.qty), newQty));
                            }}
                            className="w-full bg-transparent text-center font-mono font-bold text-rose-700 outline-none text-xs min-w-[24px]"
                          />
                          <span className="text-[9px] font-bold text-rose-700/60 dark:text-rose-400/60 pr-1 select-none">Box</span>
                        </div>
                        <div className="text-rose-400 font-black text-[10px] mt-2">+</div>
                        <div className="flex flex-col items-center flex-1">
                          <div className="w-full flex items-center bg-white dark:bg-boxdark border border-rose-300 dark:border-rose-700 rounded-md px-1 py-1 focus-within:border-rose-500 shadow-sm mt-0.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={(() => {
                                const currentLoose = Math.round((Number(item.rejectedQty || 0) - Math.floor(Number(item.rejectedQty || 0))) * item.pcsPerBox);
                                return currentLoose === 0 ? '' : currentLoose;
                              })()}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                const enteredLoose = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                                const currentBoxes = Math.floor(Number(item.rejectedQty || 0));
                                const extraBoxes = Math.floor(enteredLoose / item.pcsPerBox);
                                const remLoose = enteredLoose % item.pcsPerBox;
                                const finalBoxes = currentBoxes + extraBoxes;
                                const newQty = Number((finalBoxes + remLoose / item.pcsPerBox).toFixed(3));
                                handleItemChange(index, 'rejectedQty', Math.min(Number(item.qty), newQty));
                              }}
                              className="w-full bg-transparent text-center font-mono font-bold text-rose-700 outline-none text-xs min-w-[24px]"
                            />
                            <span className="text-[9px] font-bold text-rose-700/60 dark:text-rose-400/60 pl-1 select-none">Pcs</span>
                          </div>
                          <span className="text-[8px] text-rose-600/70 dark:text-rose-400/70 mt-0.5 font-bold">{item.pcsPerBox} pcs/box</span>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max={item.qty}
                        value={item.rejectedQty === 0 ? '' : item.rejectedQty}
                        onChange={(e) => handleItemChange(index, 'rejectedQty', e.target.value)}
                        className="w-24 rounded-lg border border-rose-300 dark:border-rose-700 py-1.5 px-3 bg-white dark:bg-boxdark outline-none focus:border-rose-500 font-mono font-bold text-rose-700 text-sm shadow-sm text-center mx-auto block"
                        placeholder="0"
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
                        className={`w-full rounded border px-2 py-1.5 outline-none focus:border-primary disabled:opacity-50 dark:bg-boxdark ${
                          submitted && Number(item.rejectedQty) > 0 && !item.rejectReason
                            ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500 placeholder-rose-300'
                            : 'border-stroke dark:border-strokedark'
                        }`}
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
