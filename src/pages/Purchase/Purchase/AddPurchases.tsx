import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form, FieldArray } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { FiTrash2, FiPlus, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';

const AddPurchases = () => {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [hasAttempted, setHasAttempted] = useState(false);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [productList, setProductList] = useState<any[]>([]);
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  const [activeSkuIndex, setActiveSkuIndex] = useState<number | null>(null);
  const [highlightedSkuIndex, setHighlightedSkuIndex] = useState<number>(0);
  const [activeProdNameIndex, setActiveProdNameIndex] = useState<number | null>(null);
  const [highlightedProdNameIndex, setHighlightedProdNameIndex] = useState<number>(0);

  const [defaultPurchaseNo] = useState(() => `PUR-${Math.floor(100000 + Math.random() * 900000)}`);

  const location = useLocation();
  const navigate = useNavigate();

  const editData = location.state?.purchaseRecord;
  const isEditMode = !!editData;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sku-container')) {
        setActiveSkuIndex(null);
      }
      if (!target.closest('.prod-name-container')) {
        setActiveProdNameIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchPurchaseMetadata = async () => {
      try {
        setMetadataLoading(true);
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('*');

        if (vendorError) throw vendorError;

        const normalizedVendors = (vendorData || []).map((v: any) => ({
          id: v.id,
          vendor_name: v.vendor_name || v.name || 'Unnamed Vendor'
        })).sort((a: any, b: any) => a.vendor_name.localeCompare(b.vendor_name));

        const { data: locData } = await supabase.from('inventory_locations').select('id, name').order('name', { ascending: true });
        const { data: prodData } = await supabase.from('products').select('id, product_name, purchase_price, uom, item_sr_no, pieces_per_box');
        const { data: bankData } = await supabase.from('banks').select('id, bankName, accountTitle, accountNumber');

        setSuppliers(normalizedVendors);
        if (locData) setLocations(locData);
        if (prodData) setProductList(prodData);
        if (bankData) setBankAccountsList(bankData);
      } catch (err: any) {
        toast.error('Failed to load system procurement metadata lookup profiles: ' + err.message);
      } finally {
        setMetadataLoading(false);
      }
    };
    fetchPurchaseMetadata();
  }, []);

  const validationSchema = Yup.object().shape({
    supplierName: Yup.string().required('Wholesale Vendor selection is required'),
    targetWarehouse: Yup.string().required('Destination Receiving Warehouse is required'),
    purchaseDate: Yup.string().required('Inbound Date is required'),
    settlementMode: Yup.string().required('Payment Method is required'),
    selectedBankTitle: Yup.string().when('settlementMode', {
      is: (val: string) => val === 'Bank' || val === 'Split',
      then: () => Yup.string().required('Please select a Bank account profile'),
      otherwise: () => Yup.string().nullable()
    }),
    cashAmountPaid: Yup.number().when('settlementMode', {
      is: (val: string) => val === 'Cash' || val === 'Split',
      then: () => Yup.number().typeError('Must be numeric').min(0, 'Cannot be negative'),
      otherwise: () => Yup.number().nullable()
    }),
    bankAmountPaid: Yup.number().when('settlementMode', {
      is: (val: string) => val === 'Bank' || val === 'Split',
      then: () => Yup.number().typeError('Must be numeric').min(0, 'Cannot be negative'),
      otherwise: () => Yup.number().nullable()
    }),
    items: Yup.array().of(
      Yup.object().shape({
        itemName: Yup.string().required('Product selection is required'),
        qty: Yup.number().typeError('Numeric lines only').min(0.001, 'Min 0.001').required('Required'),
        rate: Yup.number().typeError('Numeric lines only').min(0, 'Min 0').required('Required'),
        gstRate: Yup.number().min(0).nullable(),
        gstAmt: Yup.number().min(0).nullable(),
        discountPer: Yup.number().min(0).nullable(),
        discountAmt: Yup.number().min(0).nullable()
      })
    ).min(1, 'At least one product item is required')
  });

  const calculatePurchaseLineTotals = (item: any, applyTax: boolean) => {
    const qty = Math.max(0, Number(item.qty) || 0);
    const rate = Math.max(0, Number(item.rate) || 0);
    const grossTotal = qty * rate;
    const discountAmt = Math.max(0, Number(item.discountAmt) || 0);
    const remainingCost = Math.max(0, grossTotal - discountAmt);

    if (!applyTax) {
      return { grossTotal, gstAmt: 0, discountAmt, netTotal: remainingCost };
    }

    const gstAmt = Math.max(0, Number(item.gstAmt) || 0);
    const netTotal = Math.max(0, remainingCost + gstAmt);

    return { grossTotal, gstAmt, discountAmt, netTotal };
  };

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  const formInitialValues = React.useMemo(() => {
    if (isEditMode && editData) {
      const rawItems = Array.isArray(editData.items) ? editData.items : JSON.parse(editData.items || '[]');
      const paymentTerm = editData.payment_term || 'Cash';
      const settlementMode = paymentTerm.includes('Bank') && paymentTerm.includes('Cash')
        ? 'Split'
        : paymentTerm.includes('Bank')
        ? 'Bank'
        : 'Cash';

      return {
        purchaseNo: editData.purchase_no || '',
        supplierName: editData.supplier_name || '',
        targetWarehouse: editData.target_warehouse || '',
        purchaseDate: editData.purchase_date || new Date().toISOString().split('T')[0],
        applyTax: editData.purchase_type && editData.purchase_type !== 'No Tax',
        showDiscount: rawItems.some((i: any) => Number(i.discountAmt || i.discount_amt || 0) > 0),
        settlementMode: settlementMode,
        selectedBankTitle: editData.metadata?.selectedBankTitle || editData.selected_bank_title || '',
        cashAmountPaid: Number(editData.cash_amount_paid ?? (settlementMode === 'Cash' ? editData.amount_paid : 0)),
        bankAmountPaid: Number(editData.bank_amount_paid ?? (settlementMode === 'Bank' ? editData.amount_paid : 0)),
        remarks: editData.remarks || '',
        items: rawItems.map((it: any) => ({
          ...it,
          skuCode: it.skuCode || it.item_sr_no || it.item_code || '',
          warehouse: it.warehouse || it.target_warehouse || '',
          rate: Number(it.rate ?? it.cost_price ?? 0),
          qty: Number(it.qty ?? it.quantity ?? 1),
          gstRate: Number(it.gstRate ?? it.gst_rate ?? 18),
          gstAmt: Number(it.gstAmt ?? it.gst_amt ?? 0),
          discountPer: Number(it.discountPer ?? it.discount_per ?? 0),
          discountAmt: Number(it.discountAmt ?? it.discount_amt ?? 0)
        }))
      };
    }
    return {
      purchaseNo: defaultPurchaseNo,
      supplierName: '',
      targetWarehouse: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      applyTax: false,
      showDiscount: false,
      settlementMode: 'Cash',
      selectedBankTitle: '',
      cashAmountPaid: 0,
      bankAmountPaid: 0,
      remarks: '',
      items: [
        {
          itemName: '',
          skuCode: '',
          warehouse: '',
          qty: 1,
          rate: 0,
          discountPer: 0,
          discountAmt: 0,
          gstRate: 18,
          gstAmt: 0
        }
      ]
    };
  }, [isEditMode, editData, defaultPurchaseNo]);

  if (metadataLoading) return <div className="flex h-64 items-center justify-center bg-white"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-7xl text-black dark:text-bodydark text-xs pb-12">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        
        {/* Header Bar */}
        <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex flex-wrap justify-between items-center gap-4">
          <div>
            <h3 className="font-bold text-black dark:text-white text-lg tracking-tight">
              {isEditMode ? 'Modify Purchase / Inbound Stock Batch' : 'Log New Supplier Stock Purchase'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Record vendor procurement, receive physical inventory into destination warehouse & settle supplier payables</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchases/List`)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20"
          >
            <FiArrowLeft size={14} /> Back to Purchases History
          </button>
        </div>

        <Formik
          initialValues={formInitialValues}
          validationSchema={validationSchema}
          enableReinitialize={true}
          onSubmit={async (values) => {
            try {
              setLoading(true);

              const totalBillAmount = values.items.reduce((acc, item) => {
                return acc + calculatePurchaseLineTotals(item, values.applyTax).netTotal;
              }, 0);

              const totalPaid = (values.settlementMode === 'Cash' ? Number(values.cashAmountPaid || 0) : 0) +
                                (values.settlementMode === 'Bank' ? Number(values.bankAmountPaid || 0) : 0) +
                                (values.settlementMode === 'Split' ? (Number(values.cashAmountPaid || 0) + Number(values.bankAmountPaid || 0)) : 0);

              const remainingBalance = Math.max(0, totalBillAmount - totalPaid);

              let paymentTermLabel = 'By Cash';
              if (values.settlementMode === 'Bank') paymentTermLabel = 'By Bank';
              else if (values.settlementMode === 'Split') paymentTermLabel = 'Cash & Bank Combined';

              const databasePayload = {
                purchase_no: values.purchaseNo,
                supplier_name: values.supplierName,
                target_warehouse: values.targetWarehouse,
                purchase_date: values.purchaseDate,
                purchase_type: values.applyTax ? 'GST Standard Item' : 'No Tax',
                payment_term: paymentTermLabel,
                amount_paid: totalPaid,
                cash_amount_paid: values.settlementMode === 'Bank' ? 0 : Number(values.cashAmountPaid || 0),
                bank_amount_paid: values.settlementMode === 'Cash' ? 0 : Number(values.bankAmountPaid || 0),
                selected_bank_title: values.selectedBankTitle || null,
                total_amount: totalBillAmount,
                remaining_balance: remainingBalance,
                remarks: values.remarks.trim() || null,
                items: values.items,
                metadata: {
                  settlementMode: values.settlementMode,
                  selectedBankTitle: values.selectedBankTitle,
                  cashAmountPaid: values.cashAmountPaid,
                  bankAmountPaid: values.bankAmountPaid,
                  applyTax: values.applyTax
                }
              };

              if (isEditMode) {
                const { error } = await supabase.from('supplier_purchases').update(databasePayload).eq('id', editData.id);
                if (error) throw error;
              } else {
                const { error } = await supabase.from('supplier_purchases').insert([databasePayload]);
                if (error) throw error;

                // Restock receiving warehouse inventory bins
                for (const item of values.items) {
                  const effectiveWarehouse = item.warehouse || values.targetWarehouse;
                  if (!effectiveWarehouse || !item.itemName) continue;
                  const { data: p } = await supabase.from('warehouse_inventory').select('id, quantity').ilike('product_name', item.itemName).ilike('warehouse_name', effectiveWarehouse).maybeSingle();
                  if (p) {
                    await supabase.from('warehouse_inventory').update({ quantity: Number(p.quantity) + Number(item.qty) }).eq('id', p.id);
                  } else {
                    await supabase.from('warehouse_inventory').insert([{ product_name: item.itemName, warehouse_name: effectiveWarehouse, quantity: Number(item.qty) }]);
                  }
                }
              }

              toast.success('Procurement inventory batch recorded successfully!');
              navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchases/List`);

            } catch (err: any) {
              toast.error('Submission Interrupted: ' + err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ handleChange, values, errors, touched, setFieldValue, submitForm }) => {
            const totalBillAmount = values.items.reduce((acc, item) => {
              return acc + calculatePurchaseLineTotals(item, values.applyTax).netTotal;
            }, 0);

            const totalPaid = (values.settlementMode === 'Cash' ? Number(values.cashAmountPaid || 0) : 0) +
                              (values.settlementMode === 'Bank' ? Number(values.bankAmountPaid || 0) : 0) +
                              (values.settlementMode === 'Split' ? (Number(values.cashAmountPaid || 0) + Number(values.bankAmountPaid || 0)) : 0);

            const remainingBalance = Math.max(0, totalBillAmount - totalPaid);

            return (
              <Form className="p-6 space-y-6">
                
                {/* ── TOP 3-COLUMN HEADER BAR (MATCHING SALES INVOICE UX) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-meta-4/5 p-4 rounded-sm border border-stroke dark:border-strokedark">
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Inbound Purchase Date: *</label>
                    <input
                      type="date"
                      name="purchaseDate"
                      value={values.purchaseDate}
                      onChange={handleChange}
                      className={`w-full rounded border p-2 text-sm bg-transparent font-bold outline-none text-black dark:text-white ${hasAttempted && errors.purchaseDate ? 'border-red-500 bg-red-50/10' : 'border-stroke dark:border-strokedark focus:border-primary'}`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Wholesale Vendor: *</label>
                    <select
                      name="supplierName"
                      value={values.supplierName}
                      onChange={handleChange}
                      className={`w-full rounded border p-2 text-sm bg-white dark:bg-boxdark font-bold outline-none text-black dark:text-white ${hasAttempted && errors.supplierName ? 'border-red-500 bg-red-50/10' : 'border-stroke dark:border-strokedark focus:border-primary'}`}
                    >
                      <option value="">-- Choose Vendor --</option>
                      {suppliers.map(s => <option key={s.id} value={s.vendor_name}>{s.vendor_name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Destination Receiving Warehouse: *</label>
                    <select
                      name="targetWarehouse"
                      value={values.targetWarehouse}
                      onChange={handleChange}
                      className={`w-full rounded border p-2 text-sm bg-white dark:bg-boxdark font-bold outline-none text-black dark:text-white ${hasAttempted && errors.targetWarehouse ? 'border-red-500 bg-red-50/10' : 'border-stroke dark:border-strokedark focus:border-primary'}`}
                    >
                      <option value="">-- Choose Stock Destination Bin --</option>
                      {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* 🌟 TAX & DISCOUNT TOGGLE BAR: CLEAN & UNCLUTTERED DEFAULT UI */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-meta-4/20 border border-stroke dark:border-strokedark rounded-sm">
                  <div className="flex items-center gap-6">
                    {/* Tax Invoicing Toggle (Commented out - ready to be re-enabled if client requests GST/FBR Purchase Tax) */}
                    {/*
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={values.applyTax}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFieldValue('applyTax', isChecked);
                          if (!isChecked) {
                            values.items.forEach((_: any, idx: number) => {
                              setFieldValue(`items.${idx}.gstRate`, 0);
                              setFieldValue(`items.${idx}.gstAmt`, 0);
                            });
                          } else {
                            values.items.forEach((item: any, idx: number) => {
                              const r = 18;
                              setFieldValue(`items.${idx}.gstRate`, r);
                              const cost = (Number(item.qty) || 0) * (Number(item.rate) || 0) - (Number(item.discountAmt) || 0);
                              setFieldValue(`items.${idx}.gstAmt`, Number(((cost * r) / 100).toFixed(2)));
                            });
                          }
                        }}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                      />
                      <span className="font-bold text-xs text-black dark:text-white">Enable GST / FBR Purchase Tax</span>
                    </label>
                    */}

                    {/* Discount Column Toggle */}
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={values.showDiscount}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFieldValue('showDiscount', isChecked);
                          if (!isChecked) {
                            values.items.forEach((_: any, idx: number) => {
                              setFieldValue(`items.${idx}.discountPer`, 0);
                              setFieldValue(`items.${idx}.discountAmt`, 0);
                            });
                          }
                        }}
                        className="w-4 h-4 text-amber-600 rounded cursor-pointer accent-amber-600"
                      />
                      <span className="font-bold text-xs text-black dark:text-white">Enable Line Discounts (%)</span>
                    </label>
                  </div>

                  <span className="text-[11px] text-gray-500 font-mono">
                    Purchase Order Ref: <strong className="text-primary font-bold">{values.purchaseNo}</strong>
                  </span>
                </div>

                {/* ── PRODUCT ITEM CATALOG ENTRY TABLE ── */}
                <div className="border border-stroke dark:border-strokedark rounded-sm relative z-30 overflow-visible">
                  <div className="w-full overflow-visible">
                    <table className="w-full table-auto border-collapse text-left">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-meta-4 text-[10px] font-black uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                          <th className="p-3 w-10 text-center">S#</th>
                          <th className="p-3 w-48">SKU Code (Search)</th>
                          <th className="p-3 min-w-[240px]">Product Description</th>
                          <th className="p-3 w-44">Destination Warehouse</th>
                          <th className="p-3 w-28 text-center">Arrived Qty</th>
                          <th className="p-3 w-32 text-right">Cost Price (PKR)</th>
                          {values.showDiscount && (
                            <>
                              <th className="p-3 w-20 text-center text-amber-700 bg-amber-50/40 dark:bg-amber-950/20">Disc %</th>
                              <th className="p-3 w-28 text-right text-amber-700 bg-amber-50/40 dark:bg-amber-950/20">Disc Amt</th>
                            </>
                          )}
                          {values.applyTax && (
                            <>
                              <th className="p-3 w-20 text-center text-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20">GST %</th>
                              <th className="p-3 w-28 text-right text-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20">GST Amt</th>
                            </>
                          )}
                          <th className="p-3 w-36 text-right pr-4">Net Total Line</th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <FieldArray name="items">
                        {({ push, remove }) => (
                          <tbody className="divide-y divide-stroke dark:divide-strokedark">
                            {values.items.map((item: any, idx: number) => {
                              const matchedProduct = productList.find(p => p.product_name === item.itemName);
                              const uomString = matchedProduct ? matchedProduct.uom : 'NOS';
                              const lineTotals = calculatePurchaseLineTotals(item, values.applyTax);
                              const isCurrentActive = activeSkuIndex === idx;
                              const isCurrentProdNameActive = activeProdNameIndex === idx;

                              const handleProductSelection = (p: any) => {
                                const displaySku = p.item_sr_no || `SKU-${p.id}`;
                                const price = Number(p.purchase_price ?? p.cost_price ?? 0);
                                const updatedItems = [...values.items];
                                const cur = updatedItems[idx] || {};
                                const qty = Number(cur.qty) || 1;
                                const dPer = Number(cur.discountPer) || 0;
                                const dAmt = dPer > 0 ? Number(((price * qty * dPer) / 100).toFixed(2)) : (Number(cur.discountAmt) || 0);

                                updatedItems[idx] = {
                                  ...cur,
                                  skuCode: displaySku,
                                  itemName: p.product_name,
                                  rate: price,
                                  discountAmt: dAmt
                                };

                                setFieldValue('items', updatedItems);
                                setActiveProdNameIndex(null);
                                setActiveSkuIndex(null);
                              };

                              return (
                                <tr key={idx} className={`border-b border-stroke dark:border-strokedark text-xs transition ${isCurrentActive || isCurrentProdNameActive ? 'relative z-50 bg-slate-50/90 dark:bg-meta-4/20' : 'relative z-10 bg-white dark:bg-boxdark hover:bg-slate-50 dark:hover:bg-meta-4/10'}`}>
                                  <td className="p-3 text-center text-gray-400 font-sans">{idx + 1}</td>

                                  {/* Searchable SKU Code */}
                                  <td className="p-3 relative sku-container">
                                    {(() => {
                                      const filteredProds = productList.filter(p => {
                                        if (!item.skuCode) return true;
                                        const query = item.skuCode.toLowerCase().trim();
                                        const sku = (p.item_sr_no || `SKU-${p.id}`).toLowerCase();
                                        const name = (p.product_name || '').toLowerCase();
                                        return sku.includes(query) || name.includes(query);
                                      });

                                      return (
                                        <>
                                          <input
                                            type="text"
                                            autoComplete="off"
                                            value={item.skuCode || ''}
                                            onFocus={() => {
                                              setActiveSkuIndex(idx);
                                              setActiveProdNameIndex(null);
                                              setHighlightedSkuIndex(0);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setHighlightedSkuIndex(prev => prev < filteredProds.length - 1 ? prev + 1 : 0);
                                              } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setHighlightedSkuIndex(prev => prev > 0 ? prev - 1 : filteredProds.length - 1);
                                              } else if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (filteredProds[highlightedSkuIndex]) {
                                                  handleProductSelection(filteredProds[highlightedSkuIndex]);
                                                }
                                              } else if (e.key === 'Escape' || e.key === 'Tab') {
                                                setActiveSkuIndex(null);
                                              }
                                            }}
                                            onChange={(e) => {
                                              setFieldValue(`items.${idx}.skuCode`, e.target.value);
                                              setActiveSkuIndex(idx);
                                            }}
                                            placeholder="TYPE SKU..."
                                            className="w-full rounded border border-stroke dark:border-strokedark p-1.5 bg-transparent font-mono font-bold text-xs uppercase outline-none focus:border-primary"
                                          />

                                          {isCurrentActive && filteredProds.length > 0 && (
                                            <div className="absolute left-0 top-full mt-1.5 z-[99999] w-72 max-h-52 overflow-y-auto bg-white dark:bg-[#1A222C] border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl divide-y divide-slate-100 dark:divide-slate-800">
                                              {filteredProds.map((prod, pIdx) => (
                                                <div
                                                  key={prod.id}
                                                  onMouseEnter={() => setHighlightedSkuIndex(pIdx)}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleProductSelection(prod);
                                                  }}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleProductSelection(prod);
                                                  }}
                                                  className={`p-2.5 cursor-pointer text-xs flex justify-between items-center ${highlightedSkuIndex === pIdx ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                                                >
                                                  <div>
                                                    <p className="font-bold text-black dark:text-white">{prod.product_name}</p>
                                                    <p className="text-[10px] font-mono text-gray-400">{prod.item_sr_no || `SKU-${prod.id}`}</p>
                                                  </div>
                                                  <span className="font-mono font-bold text-emerald-600">Rs. {Number(prod.purchase_price || 0).toLocaleString()}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </td>

                                  {/* Product Name & Description (Searchable Two-Way Input with Rich Dropdown matching Sales page) */}
                                  <td className="p-3 relative prod-name-container min-w-[260px]">
                                    {(() => {
                                      const query = (item.itemName || '').toLowerCase().trim();
                                      const filteredByName = productList.filter(p => {
                                        if (!query) return true;
                                        const name = (p.product_name || '').toLowerCase();
                                        const sku = (p.item_sr_no || `SKU-${p.id}`).toLowerCase();
                                        return name.includes(query) || sku.includes(query);
                                      });

                                      return (
                                        <div className="relative">
                                          <input
                                            type="text"
                                            autoComplete="off"
                                            value={item.itemName || ''}
                                            onFocus={() => {
                                              setActiveProdNameIndex(idx);
                                              setActiveSkuIndex(null);
                                              setHighlightedProdNameIndex(0);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setHighlightedProdNameIndex(prev => prev < filteredByName.length - 1 ? prev + 1 : 0);
                                              } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setHighlightedProdNameIndex(prev => prev > 0 ? prev - 1 : filteredByName.length - 1);
                                              } else if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (filteredByName[highlightedProdNameIndex]) {
                                                  handleProductSelection(filteredByName[highlightedProdNameIndex]);
                                                }
                                              } else if (e.key === 'Escape' || e.key === 'Tab') {
                                                setActiveProdNameIndex(null);
                                              }
                                            }}
                                            onChange={(e) => {
                                              const typed = e.target.value;
                                              setFieldValue(`items.${idx}.itemName`, typed);
                                              setActiveProdNameIndex(idx);
                                              setHighlightedProdNameIndex(0);

                                              const matched = productList.find(
                                                p => p.product_name && p.product_name.toLowerCase() === typed.trim().toLowerCase()
                                              );
                                              if (matched) {
                                                handleProductSelection(matched);
                                              }
                                            }}
                                            placeholder="Search Product Name..."
                                            className="w-full bg-white dark:bg-boxdark font-bold border border-stroke dark:border-strokedark rounded p-1.5 outline-none text-xs text-black dark:text-white focus:border-primary shadow-xs"
                                          />

                                          {/* Rich Dropdown */}
                                          {isCurrentProdNameActive && filteredByName.length > 0 && (
                                            <div className="absolute left-0 top-full mt-1.5 z-[99999] min-w-[340px] max-w-[420px] max-h-[290px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A222C] shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 scrollbar-thin scrollbar-thumb-slate-300">
                                              {filteredByName.map((p, pIdx) => {
                                                const displaySku = p.item_sr_no || `SKU-${p.id}`;
                                                const isHighlighted = pIdx === highlightedProdNameIndex;
                                                return (
                                                  <div
                                                    key={p.id}
                                                    onMouseEnter={() => setHighlightedProdNameIndex(pIdx)}
                                                    onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      handleProductSelection(p);
                                                    }}
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      handleProductSelection(p);
                                                    }}
                                                    className={`p-3 cursor-pointer transition flex items-center justify-between group ${
                                                      isHighlighted
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                                                    }`}
                                                  >
                                                    <div className="flex flex-col gap-0.5 text-left pr-2">
                                                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 leading-tight">
                                                        {p.product_name}
                                                      </span>
                                                      <span className="font-mono text-[10px] text-slate-400">
                                                        {displaySku}
                                                      </span>
                                                    </div>
                                                    <div className="text-right font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                                                      Rs. {Number(p.purchase_price || 0).toLocaleString()}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  {/* ROW-LEVEL DESTINATION WAREHOUSE */}
                                  <td className="p-3 w-44">
                                    <select
                                      value={item.warehouse || values.targetWarehouse || ''}
                                      onChange={(e) => {
                                        setFieldValue(`items.${idx}.warehouse`, e.target.value);
                                      }}
                                      className="w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded p-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-primary shadow-xs"
                                    >
                                      <option value="">Default ({values.targetWarehouse || 'None'})</option>
                                      {locations.map((loc) => (
                                        <option key={loc.id} value={loc.name}>
                                          {loc.name}
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Arrived Qty */}
                                  <td className="p-3">
                                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 border border-stroke dark:border-strokedark">
                                      <input
                                        type="number"
                                        min="0.001"
                                        step="any"
                                        onKeyDown={blockInvalidChar}
                                        name={`items.${idx}.qty`}
                                        value={item.qty === 0 ? '' : item.qty}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const num = val === '' ? 0 : Math.max(0, Number(val) || 0);
                                          setFieldValue(`items.${idx}.qty`, val === '' ? '' : num);

                                          // Auto recalculate discount and tax
                                          const cost = num * (Number(item.rate) || 0);
                                          if (Number(item.discountPer) > 0) {
                                            setFieldValue(`items.${idx}.discountAmt`, Number(((cost * Number(item.discountPer)) / 100).toFixed(2)));
                                          }
                                        }}
                                        placeholder="1"
                                        className="w-full bg-transparent text-center font-black text-xs text-primary outline-none"
                                      />
                                      <span className="text-[10px] font-bold text-gray-500 uppercase select-none">{uomString}</span>
                                    </div>
                                  </td>

                                  {/* Cost Price */}
                                  <td className="p-3">
                                    <input
                                      type="number"
                                      min="0"
                                      onKeyDown={blockInvalidChar}
                                      name={`items.${idx}.rate`}
                                      value={item.rate}
                                      onChange={(e) => {
                                        const newRate = Math.max(0, Number(e.target.value) || 0);
                                        setFieldValue(`items.${idx}.rate`, newRate);
                                        const cost = (Number(item.qty) || 0) * newRate;
                                        if (Number(item.discountPer) > 0) {
                                          setFieldValue(`items.${idx}.discountAmt`, Number(((cost * Number(item.discountPer)) / 100).toFixed(2)));
                                        }
                                      }}
                                      className="w-full rounded border border-stroke dark:border-strokedark p-1.5 bg-transparent font-black font-mono text-right outline-none focus:border-primary text-xs"
                                    />
                                  </td>

                                  {/* Discount Columns */}
                                  {values.showDiscount && (
                                    <>
                                      <td className="p-3 bg-amber-50/30 dark:bg-amber-950/10">
                                        <input
                                          type="number"
                                          min="0"
                                          onKeyDown={blockInvalidChar}
                                          name={`items.${idx}.discountPer`}
                                          value={item.discountPer ?? 0}
                                          onChange={(e) => {
                                            const dPer = Math.max(0, Number(e.target.value) || 0);
                                            setFieldValue(`items.${idx}.discountPer`, dPer);
                                            const gross = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                                            setFieldValue(`items.${idx}.discountAmt`, Number(((gross * dPer) / 100).toFixed(2)));
                                          }}
                                          placeholder="0"
                                          className="w-full text-center font-bold font-mono text-amber-700 bg-white dark:bg-boxdark border border-amber-300 rounded p-1 text-xs outline-none"
                                        />
                                      </td>
                                      <td className="p-3 bg-amber-50/30 dark:bg-amber-950/10">
                                        <input
                                          type="number"
                                          min="0"
                                          onKeyDown={blockInvalidChar}
                                          name={`items.${idx}.discountAmt`}
                                          value={item.discountAmt ?? 0}
                                          onChange={(e) => {
                                            const dAmt = Math.max(0, Number(e.target.value) || 0);
                                            setFieldValue(`items.${idx}.discountAmt`, dAmt);
                                            const gross = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                                            const per = gross > 0 ? (dAmt / gross) * 100 : 0;
                                            setFieldValue(`items.${idx}.discountPer`, Number(per.toFixed(2)));
                                          }}
                                          placeholder="0"
                                          className="w-full text-right font-bold font-mono text-amber-700 bg-white dark:bg-boxdark border border-amber-300 rounded p-1 text-xs outline-none"
                                        />
                                      </td>
                                    </>
                                  )}

                                  {/* GST Columns */}
                                  {values.applyTax && (
                                    <>
                                      <td className="p-3 bg-emerald-50/30 dark:bg-emerald-950/10">
                                        <input
                                          type="number"
                                          min="0"
                                          onKeyDown={blockInvalidChar}
                                          name={`items.${idx}.gstRate`}
                                          value={item.gstRate ?? 18}
                                          onChange={(e) => {
                                            const r = Math.max(0, Number(e.target.value) || 0);
                                            setFieldValue(`items.${idx}.gstRate`, r);
                                            const cost = (Number(item.qty) || 0) * (Number(item.rate) || 0) - (Number(item.discountAmt) || 0);
                                            setFieldValue(`items.${idx}.gstAmt`, Number(((cost * r) / 100).toFixed(2)));
                                          }}
                                          className="w-full text-center font-bold font-mono text-emerald-700 bg-white dark:bg-boxdark border border-emerald-300 rounded p-1 text-xs outline-none"
                                        />
                                      </td>
                                      <td className="p-3 bg-emerald-50/30 dark:bg-emerald-950/10">
                                        <input
                                          type="number"
                                          min="0"
                                          onKeyDown={blockInvalidChar}
                                          name={`items.${idx}.gstAmt`}
                                          value={item.gstAmt ?? 0}
                                          onChange={(e) => setFieldValue(`items.${idx}.gstAmt`, Math.max(0, Number(e.target.value) || 0))}
                                          className="w-full text-right font-bold font-mono text-emerald-700 bg-white dark:bg-boxdark border border-emerald-300 rounded p-1 text-xs outline-none"
                                        />
                                      </td>
                                    </>
                                  )}

                                  {/* Net Line Total */}
                                  <td className="p-3 text-right pr-4 text-emerald-600 dark:text-emerald-400 font-black font-mono">
                                    Rs. {lineTotals.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>

                                  {/* Delete Row */}
                                  <td className="p-3 text-center">
                                    {values.items.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => remove(idx)}
                                        className="text-gray-400 hover:text-danger transition cursor-pointer"
                                      >
                                        <FiTrash2 size={14} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        )}
                      </FieldArray>
                    </table>
                  </div>

                  <div className="p-3 bg-gray-50/50 dark:bg-meta-4/10 border-t border-stroke dark:border-strokedark">
                    <FieldArray name="items">
                      {({ push }) => (
                        <button
                          type="button"
                          onClick={() => push({ itemName: '', skuCode: '', warehouse: values.targetWarehouse || '', qty: 1, rate: 0, discountPer: 0, discountAmt: 0, gstRate: 18, gstAmt: 0 })}
                          className="inline-flex items-center gap-1 bg-primary text-white font-bold py-1.5 px-3.5 rounded text-xs hover:bg-opacity-90 transition cursor-pointer shadow-xs"
                        >
                          <FiPlus size={12} /> Add Row Line
                        </button>
                      )}
                    </FieldArray>
                  </div>
                </div>

                {/* ── BOTTOM SETTLEMENT BAR: CASH / BANK / SPLIT SWITCHER ── */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 border border-stroke dark:border-strokedark p-5 rounded-sm bg-slate-50/40 dark:bg-meta-4/5 mt-6">
                  
                  {/* Left: Payment Method Controls */}
                  <div className="w-full md:w-1/2 space-y-4">
                    <div>
                      <span className="font-bold text-gray-500 block mb-1">Payment Method / Settlement Mode: *</span>
                      <select
                        name="settlementMode"
                        value={values.settlementMode}
                        onChange={(e) => {
                          handleChange(e);
                          if (e.target.value === 'Cash') {
                            setFieldValue('selectedBankTitle', '');
                            setFieldValue('bankAmountPaid', 0);
                          } else if (e.target.value === 'Bank') {
                            setFieldValue('cashAmountPaid', 0);
                          }
                        }}
                        className="w-full border rounded border-stroke dark:border-strokedark p-2 text-xs bg-white dark:bg-boxdark font-black outline-none text-black dark:text-white focus:border-primary"
                      >
                        <option value="Cash">Cash Only</option>
                        <option value="Bank">Bank Transfer Only</option>
                        <option value="Split">Cash & Bank Combined (Split)</option>
                      </select>
                    </div>

                    {/* Bank Selection Profile */}
                    {(values.settlementMode === 'Bank' || values.settlementMode === 'Split') && (
                      <div>
                        <span className="font-bold text-gray-500 block mb-1">Corporate Source Vault Bank: *</span>
                        <select
                          name="selectedBankTitle"
                          value={values.selectedBankTitle}
                          onChange={handleChange}
                          className={`w-full border rounded p-2 text-xs bg-white dark:bg-boxdark font-bold outline-none text-black dark:text-white ${hasAttempted && errors.selectedBankTitle ? 'border-red-500 bg-red-50/10' : 'border-stroke dark:border-strokedark focus:border-primary'}`}
                        >
                          <option value="">-- Choose Corporate Bank --</option>
                          {bankAccountsList.map(b => (
                            <option key={b.id} value={b.bankName}>{b.bankName} - {b.accountTitle} ({b.accountNumber || '-'})</option>
                          ))}
                        </select>
                        {hasAttempted && errors.selectedBankTitle && <p className="text-red-500 text-[10px] font-bold mt-1">{String(errors.selectedBankTitle)}</p>}
                      </div>
                    )}

                    {/* Amount Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(values.settlementMode === 'Cash' || values.settlementMode === 'Split') && (
                        <div>
                          <span className="font-bold text-rose-600 block mb-1">Cash Payment Amount (PKR):</span>
                          <input
                            type="number"
                            min="0"
                            onKeyDown={blockInvalidChar}
                            name="cashAmountPaid"
                            value={values.cashAmountPaid === 0 ? '' : values.cashAmountPaid}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFieldValue('cashAmountPaid', val === '' ? 0 : Math.max(0, Number(val) || 0));
                            }}
                            placeholder="0"
                            className="w-full rounded border border-stroke dark:border-strokedark p-2 bg-white dark:bg-boxdark text-right font-black font-mono text-rose-600 text-sm outline-none focus:border-primary"
                          />
                        </div>
                      )}

                      {(values.settlementMode === 'Bank' || values.settlementMode === 'Split') && (
                        <div>
                          <span className="font-bold text-primary block mb-1">Bank Payment Amount (PKR):</span>
                          <input
                            type="number"
                            min="0"
                            onKeyDown={blockInvalidChar}
                            name="bankAmountPaid"
                            value={values.bankAmountPaid === 0 ? '' : values.bankAmountPaid}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFieldValue('bankAmountPaid', val === '' ? 0 : Math.max(0, Number(val) || 0));
                            }}
                            placeholder="0"
                            className="w-full rounded border border-stroke dark:border-strokedark p-2 bg-white dark:bg-boxdark text-right font-black font-mono text-primary text-sm outline-none focus:border-primary"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="font-bold text-gray-500 block mb-1">Purchase Order Memo / Remarks:</span>
                      <input
                        type="text"
                        name="remarks"
                        value={values.remarks}
                        onChange={handleChange}
                        placeholder="e.g. Factory restock shipment, consignment bill #889"
                        className="w-full border border-stroke dark:border-strokedark rounded p-2 text-xs bg-white dark:bg-boxdark outline-none focus:border-primary font-medium"
                      />
                    </div>
                  </div>

                  {/* Right: Net Summary & Action Buttons */}
                  <div className="w-full md:w-1/2 flex flex-col justify-between self-stretch bg-white dark:bg-boxdark p-5 rounded-xl border border-stroke dark:border-strokedark shadow-xs">
                    <div className="space-y-3 font-mono">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-sans font-bold">Total Bill Value:</span>
                        <strong className="text-black dark:text-white font-black text-base">
                          Rs. {totalBillAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center text-sm text-emerald-600">
                        <span className="font-sans font-bold">Paid Upfront:</span>
                        <strong className="font-black text-base">
                          Rs. {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center text-sm text-rose-600 pt-2 border-t border-stroke dark:border-strokedark">
                        <span className="font-sans font-bold">Remaining Vendor Payable:</span>
                        <strong className="font-black text-base">
                          Rs. {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stroke dark:border-strokedark">
                      <button
                        type="button"
                        onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchases/List`)}
                        className="px-5 py-2.5 rounded-lg border border-stroke dark:border-strokedark font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHasAttempted(true);
                          submitForm();
                        }}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition cursor-pointer"
                      >
                        {loading ? <Spinner /> : <><FiCheckCircle /> {isEditMode ? 'Update Purchase' : 'Save & Restock'}</>}
                      </button>
                    </div>
                  </div>

                </div>

              </Form>
            );
          }}
        </Formik>

      </div>
    </div>
  );
};

export default AddPurchases;
