import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form, FieldArray } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { 
  MdStore, 
  MdPerson, 
  MdReceipt, 
  MdEvent, 
  MdDelete, 
  MdAdd, 
  MdSearch, 
  MdClear, 
  MdArrowBack, 
  MdCheckCircle, 
  MdAccountBalance, 
  MdKeyboardArrowDown,
  MdWarning
} from 'react-icons/md';

const AddPurchaseReturn = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);

  const [vendors, setVendors] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [productList, setProductList] = useState<any[]>([]);
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  const [purchaseOrdersList, setPurchaseOrdersList] = useState<any[]>([]);

  // Warehouse Autocomplete State
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState('');
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const [highlightedWarehouseIndex, setHighlightedWarehouseIndex] = useState(0);

  // Vendor Autocomplete State
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  const [highlightedVendorIndex, setHighlightedVendorIndex] = useState(0);
  const [selectedVendorObj, setSelectedVendorObj] = useState<any>(null);

  // PO Autocomplete State
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
  const [highlightedPoIndex, setHighlightedPoIndex] = useState(0);
  const [selectedPoNo, setSelectedPoNo] = useState('');
  const [selectedPoObj, setSelectedPoObj] = useState<any>(null);

  // Product Autocomplete per Row
  const [activeItemSearchIdx, setActiveItemSearchIdx] = useState<number | null>(null);
  const [highlightedProdIdx, setHighlightedProdIdx] = useState(0);

  const warehouseContainerRef = useRef<HTMLDivElement>(null);
  const vendorContainerRef = useRef<HTMLDivElement>(null);
  const poContainerRef = useRef<HTMLDivElement>(null);

  const editData = location.state?.returnRecord || location.state?.record;
  const isEditMode = !!editData;

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (warehouseContainerRef.current && !warehouseContainerRef.current.contains(e.target as Node)) {
        setIsWarehouseDropdownOpen(false);
      }
      if (vendorContainerRef.current && !vendorContainerRef.current.contains(e.target as Node)) {
        setIsVendorDropdownOpen(false);
      }
      if (poContainerRef.current && !poContainerRef.current.contains(e.target as Node)) {
        setIsPoDropdownOpen(false);
      }
      if (!(e.target as HTMLElement).closest('.product-search-cell')) {
        setActiveItemSearchIdx(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchReturnMetadata = async () => {
      try {
        setMetadataLoading(true);

        // 1. Fetch Vendors
        const { data: vData } = await supabase.from('vendors').select('*').order('vendor_name', { ascending: true });
        const normalizedVendors = (vData || []).map((v: any) => ({
          id: v.id,
          vendor_name: v.vendor_name || v.name || 'Unnamed Vendor',
          contact_name: v.contact_name || v.contact_person || '',
          phone: v.cell_no || v.phone_no || v.phone || '',
          city: v.city || '',
          address: v.address || ''
        }));
        setVendors(normalizedVendors);

        // 2. Fetch Locations / Warehouses
        const { data: locData } = await supabase.from('inventory_locations').select('*').order('name', { ascending: true });
        const normalizedLocs = (locData || []).map((l: any) => ({
          id: l.id,
          name: l.name || 'Warehouse',
          code: l.code || '',
          address: l.address || ''
        }));
        setLocations(normalizedLocs);

        // 3. Fetch Products
        const { data: prodData } = await supabase.from('products').select('*').order('product_name', { ascending: true });
        setProductList(prodData || []);

        // 4. Fetch Banks
        const { data: bankData } = await supabase.from('banks').select('id, bankName, accountTitle, accountNumber');
        if (bankData) setBankAccountsList(bankData);

        // 5. Fetch Purchases
        const { data: purData } = await supabase.from('supplier_purchases').select('*').order('id', { ascending: false });
        if (purData) setPurchaseOrdersList(purData);

        // If in Edit Mode, restore state
        if (isEditMode && editData) {
          const vName = editData.vendor_name || '';
          setVendorSearchQuery(vName);
          const matchedVendor = normalizedVendors.find(v => v.vendor_name.toLowerCase() === vName.toLowerCase());
          if (matchedVendor) setSelectedVendorObj(matchedVendor);

          const whName = editData.source_warehouse || '';
          setWarehouseSearchQuery(whName);

          const poRef = editData.purchase_no || editData.original_purchase_no || editData.metadata?.linkedPurchaseNo || '';
          if (poRef) {
            setSelectedPoNo(poRef);
            setPoSearchQuery(poRef);
            const cleanId = String(poRef).replace(/\D/g, '');
            const matchedPo = purData?.find(p => p.purchase_no === poRef || String(p.id) === cleanId);
            if (matchedPo) setSelectedPoObj(matchedPo);
          } else {
            setPoSearchQuery('-- General Return (Manual Items) --');
          }
        }
      } catch (err: any) {
        toast.error('Failed to load return lookup metadata: ' + err.message);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchReturnMetadata();
  }, [isEditMode, editData]);

  // Filtered lists
  const filteredVendors = vendors.filter(v =>
    (v.vendor_name || '').toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
    (v.contact_name || '').toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
    (v.phone || '').toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
    (v.city || '').toLowerCase().includes(vendorSearchQuery.toLowerCase())
  );

  const filteredWarehouses = locations.filter(l =>
    (l.name || '').toLowerCase().includes(warehouseSearchQuery.toLowerCase()) ||
    (l.code || '').toLowerCase().includes(warehouseSearchQuery.toLowerCase()) ||
    (l.address || '').toLowerCase().includes(warehouseSearchQuery.toLowerCase())
  );

  const vendorPurchases = purchaseOrdersList.filter(p =>
    vendorSearchQuery && (p.supplier_name || p.vendor_name || '').toLowerCase() === vendorSearchQuery.toLowerCase()
  );

  const filteredPurchases = vendorPurchases.filter(p => {
    if (!poSearchQuery || poSearchQuery.startsWith('-- General')) return true;
    return (
      (p.purchase_no || '').toLowerCase().includes(poSearchQuery.toLowerCase()) ||
      (p.purchase_date || '').toLowerCase().includes(poSearchQuery.toLowerCase()) ||
      (p.target_warehouse || '').toLowerCase().includes(poSearchQuery.toLowerCase())
    );
  });

  // Helper to extract products bought from the selected vendor
  const getVendorBoughtProducts = (vendorName: string) => {
    const vTrim = (vendorName || '').trim().toLowerCase();
    if (!vTrim) return [];

    const matchedPurchases = purchaseOrdersList.filter(p => {
      const sName = (p.supplier_name || p.vendor_name || '').trim().toLowerCase();
      return sName === vTrim || sName.includes(vTrim) || vTrim.includes(sName);
    });

    // If a specific PO is selected, show items from that PO
    if (selectedPoNo && selectedPoObj && selectedPoObj.items) {
      return (selectedPoObj.items || []).map((item: any) => {
        const pName = item.itemName || item.product_name || '';
        const matchingProd = productList.find(p => (p.product_name || '').toLowerCase() === pName.toLowerCase());
        return {
          id: matchingProd?.id || pName,
          product_name: pName,
          item_sr_no: item.sku || matchingProd?.item_sr_no || matchingProd?.sku || '',
          purchase_price: Number(item.rate || item.cost_price || matchingProd?.purchase_price || 0),
          uom: item.uom || matchingProd?.uom || 'Nos',
          totalBoughtQty: Number(item.qty || item.quantity || 0),
          lastPoNo: selectedPoNo,
          current_stock: matchingProd?.current_stock || 0
        };
      });
    }

    // Otherwise, collect all distinct items purchased from this vendor across all their POs
    const prodMap: Record<string, any> = {};
    matchedPurchases.forEach(pur => {
      (pur.items || []).forEach((item: any) => {
        const pName = item.itemName || item.product_name || '';
        if (!pName) return;
        const key = pName.toLowerCase();
        const matchingProd = productList.find(p => (p.product_name || '').toLowerCase() === key);
        const qty = Number(item.qty || item.quantity || 0);
        const price = Number(item.rate || item.cost_price || 0);

        if (!prodMap[key]) {
          prodMap[key] = {
            id: matchingProd?.id || pName,
            product_name: pName,
            item_sr_no: item.sku || matchingProd?.item_sr_no || matchingProd?.sku || '',
            purchase_price: price || Number(matchingProd?.purchase_price || 0),
            uom: item.uom || matchingProd?.uom || 'Nos',
            totalBoughtQty: qty,
            lastPoNo: pur.purchase_no,
            current_stock: matchingProd?.current_stock || 0
          };
        } else {
          prodMap[key].totalBoughtQty += qty;
          if (price > 0) prodMap[key].purchase_price = price;
        }
      });
    });

    return Object.values(prodMap);
  };

  const validationSchema = Yup.object().shape({
    vendorName: Yup.string().required('Wholesale Vendor selection is required'),
    sourceWarehouse: Yup.string().required('Source warehouse selection is required'),
    returnDate: Yup.string().required('Return date is required'),
    paymentTerm: Yup.string().required('Reimbursement method is required'),
    amountPaid: Yup.number().when('paymentTerm', {
      is: (val: string) => val === 'By Cash' || val === 'By Bank',
      then: () => Yup.number().typeError('Amount must be numeric').min(0, 'Cannot be negative'),
      otherwise: () => Yup.number().nullable()
    }),
    cashAmountPaid: Yup.number().when('paymentTerm', {
      is: 'Split',
      then: () => Yup.number().typeError('Cash must be numeric').min(0, 'Cannot be negative'),
      otherwise: () => Yup.number().nullable()
    }),
    bankAmountPaid: Yup.number().when('paymentTerm', {
      is: 'Split',
      then: () => Yup.number().typeError('Bank must be numeric').min(0, 'Cannot be negative'),
      otherwise: () => Yup.number().nullable()
    }),
    selectedBankId: Yup.string().when('paymentTerm', {
      is: (val: string) => val === 'By Bank' || val === 'Split',
      then: () => Yup.string().required('Please select the receiving bank account'),
      otherwise: () => Yup.string().nullable()
    }),
    items: Yup.array().of(
      Yup.object().shape({
        itemName: Yup.string().required('Product selection is required'),
        qty: Yup.number().typeError('Numeric only').min(0.01, 'Min 0.01').required('Quantity required'),
        rate: Yup.number().typeError('Numeric only').min(0, 'Min 0').required('Rate required')
      })
    ).min(1, 'At least one return line item is required')
  });

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  if (metadataLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl text-xs text-slate-800 dark:text-slate-200">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MdStore className="text-rose-600" size={24} />
            {isEditMode ? 'Modify Purchase Return (Debit Note)' : 'Create Outbound Purchase Return (Debit Note)'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Return damaged or excess inventory to wholesale supplier and generate balanced debit note credit line
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return/List`)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
        >
          <MdArrowBack size={16} /> Back to Log Registry
        </button>
      </div>

      <Formik
        initialValues={isEditMode && editData ? {
          returnNo: editData.return_no || '',
          vendorName: editData.vendor_name || '',
          sourceWarehouse: editData.source_warehouse || '',
          purchaseNo: editData.purchase_no || editData.original_purchase_no || editData.metadata?.linkedPurchaseNo || '',
          returnDate: editData.return_date || new Date().toISOString().split('T')[0],
          paymentTerm: editData.payment_term || (editData.metadata?.cashAmount && editData.metadata?.bankAmount ? 'Split' : 'By Cash'),
          selectedBankId: editData.metadata?.selectedBankId || '',
          amountPaid: editData.amount_paid || 0,
          cashAmountPaid: editData.metadata?.cashAmount || '',
          bankAmountPaid: editData.metadata?.bankAmount || '',
          remarks: editData.remarks || '',
          items: editData.items || [{ itemName: '', sku: '', qty: 1, rate: 0, uom: 'Nos', maxQty: 99999 }]
        } : {
          returnNo: `RTN-${Date.now().toString().slice(-6)}`,
          vendorName: '',
          sourceWarehouse: '',
          purchaseNo: '',
          returnDate: new Date().toISOString().split('T')[0],
          paymentTerm: 'On Credit',
          selectedBankId: '',
          amountPaid: 0,
          cashAmountPaid: '',
          bankAmountPaid: '',
          remarks: '',
          items: [{ itemName: '', sku: '', qty: 1, rate: 0, uom: 'Nos', maxQty: 99999 }]
        }}
        enableReinitialize={true}
        validationSchema={validationSchema}
        onSubmit={async (values) => {
          if (!values.vendorName) {
            toast.error('Validation Error: Please select a wholesale vendor first!');
            return;
          }
          if (!values.sourceWarehouse) {
            toast.error('Validation Error: Please select the source warehouse location!');
            return;
          }

          let grossReturnSum = 0;
          values.items.forEach((item: any) => {
            grossReturnSum += (Number(item.qty || 0) * Number(item.rate || 0));
          });

          if (grossReturnSum <= 0) {
            toast.error('Validation Error: Return items total value must be greater than 0 PKR!');
            return;
          }

          let cashRefund = 0;
          let bankRefund = 0;
          let totalRefundCollected = 0;

          if (values.paymentTerm === 'By Cash') {
            cashRefund = Number(values.amountPaid) || 0;
            totalRefundCollected = cashRefund;
          } else if (values.paymentTerm === 'By Bank') {
            bankRefund = Number(values.amountPaid) || 0;
            totalRefundCollected = bankRefund;
            if (!values.selectedBankId && bankRefund > 0) {
              toast.error('Please select the receiving bank account.');
              return;
            }
          } else if (values.paymentTerm === 'Split') {
            cashRefund = Number(values.cashAmountPaid) || 0;
            bankRefund = Number(values.bankAmountPaid) || 0;
            totalRefundCollected = cashRefund + bankRefund;
            if (!values.selectedBankId && bankRefund > 0) {
              toast.error('Please select the receiving bank account for the bank transfer refund.');
              return;
            }
          }

          if (totalRefundCollected > grossReturnSum) {
            toast.error(`Validation Error: Refund collected (Rs. ${formatMoney(totalRefundCollected)}) cannot exceed the total return value (Rs. ${formatMoney(grossReturnSum)}).`);
            return;
          }

          try {
            setLoading(true);

            // 1. Verify and check warehouse stock
            for (const item of values.items) {
              const reqQty = Number(item.qty || 0);
              const pName = item.itemName;

              const { data: whStock } = await supabase
                .from('warehouse_inventory')
                .select('id, quantity')
                .ilike('product_name', pName)
                .ilike('warehouse_name', values.sourceWarehouse)
                .maybeSingle();

              const availableQty = Number(whStock?.quantity || 0);

              if (!isEditMode && reqQty > availableQty) {
                toast.error(`Stock Shortage Alert: '${pName}' only has ${availableQty} units available in ${values.sourceWarehouse}.`);
                setLoading(false);
                return;
              }
            }

            const databasePayload = {
              return_no: values.returnNo,
              vendor_name: values.vendorName,
              source_warehouse: values.sourceWarehouse,
              purchase_no: values.purchaseNo || selectedPoNo || null,
              return_date: values.returnDate,
              payment_term: values.paymentTerm,
              remarks: values.remarks.trim(),
              total_amount: grossReturnSum,
              amount_paid: totalRefundCollected,
              items: values.items,
              metadata: { 
                selectedBankId: (values.paymentTerm === 'By Bank' || values.paymentTerm === 'Split') ? values.selectedBankId : null,
                linkedPurchaseNo: values.purchaseNo || selectedPoNo || null,
                cashAmount: values.paymentTerm === 'Split' ? cashRefund : (values.paymentTerm === 'By Cash' ? totalRefundCollected : 0),
                bankAmount: values.paymentTerm === 'Split' ? bankRefund : (values.paymentTerm === 'By Bank' ? totalRefundCollected : 0),
                paymentTerm: values.paymentTerm
              }
            };

            // 2. Process Stock Adjustments
            if (isEditMode) {
              // Roll back old return stock (+)
              const { data: oldRtn } = await supabase
                .from('purchase_returns')
                .select('items, source_warehouse')
                .eq('id', editData.id)
                .single();

              if (oldRtn?.items) {
                for (const oldItem of oldRtn.items) {
                  const oQty = Number(oldItem.qty || 0);
                  const oName = oldItem.itemName;

                  // Restore product master
                  const { data: prod } = await supabase.from('products').select('current_stock').ilike('product_name', oName).maybeSingle();
                  if (prod) {
                    await supabase.from('products').update({ current_stock: (Number(prod.current_stock) || 0) + oQty }).ilike('product_name', oName);
                  }

                  // Restore warehouse stock
                  const { data: whRow } = await supabase.from('warehouse_inventory').select('id, quantity').ilike('product_name', oName).ilike('warehouse_name', oldRtn.source_warehouse).maybeSingle();
                  if (whRow) {
                    await supabase.from('warehouse_inventory').update({ quantity: (Number(whRow.quantity) || 0) + oQty }).eq('id', whRow.id);
                  }
                }
              }

              // Update record
              const { error: updateErr } = await supabase
                .from('purchase_returns')
                .update(databasePayload)
                .eq('id', editData.id);
              if (updateErr) throw updateErr;

              // Deduct new return stock (-)
              for (const newItem of values.items) {
                const nQty = Number(newItem.qty || 0);
                const nName = newItem.itemName;

                const { data: prod } = await supabase.from('products').select('current_stock').ilike('product_name', nName).maybeSingle();
                if (prod) {
                  await supabase.from('products').update({ current_stock: Math.max(0, (Number(prod.current_stock) || 0) - nQty) }).ilike('product_name', nName);
                }

                const { data: whRow } = await supabase.from('warehouse_inventory').select('id, quantity').ilike('product_name', nName).ilike('warehouse_name', values.sourceWarehouse).maybeSingle();
                if (whRow) {
                  await supabase.from('warehouse_inventory').update({ quantity: Math.max(0, (Number(whRow.quantity) || 0) - nQty) }).eq('id', whRow.id);
                }
              }

            } else {
              // Insert new return record
              const { error: insertErr } = await supabase
                .from('purchase_returns')
                .insert([databasePayload]);
              if (insertErr) throw insertErr;

              // Deduct stock (-)
              for (const item of values.items) {
                const qty = Number(item.qty || 0);
                const pName = item.itemName;

                const { data: prod } = await supabase.from('products').select('current_stock').ilike('product_name', pName).maybeSingle();
                if (prod) {
                  await supabase.from('products').update({ current_stock: Math.max(0, (Number(prod.current_stock) || 0) - qty) }).ilike('product_name', pName);
                }

                const { data: whRow } = await supabase.from('warehouse_inventory').select('id, quantity').ilike('product_name', pName).ilike('warehouse_name', values.sourceWarehouse).maybeSingle();
                if (whRow) {
                  await supabase.from('warehouse_inventory').update({ quantity: Math.max(0, (Number(whRow.quantity) || 0) - qty) }).eq('id', whRow.id);
                }
              }
            }

            toast.success(isEditMode ? 'Purchase Return updated successfully!' : 'Purchase Return (Debit Note) logged successfully!');
            navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return/List`);

          } catch (err: any) {
            toast.error('Submission Error: ' + err.message);
          } finally {
            setLoading(false);
          }
        }}
      >
        {({ handleChange, values, setFieldValue, errors, touched }) => {
          let computedGrossTotal = 0;
          values.items.forEach((i: any) => {
            computedGrossTotal += (Number(i.qty || 0) * Number(i.rate || 0));
          });

          const currentLiquidRefund = values.paymentTerm === 'Split'
            ? (Number(values.cashAmountPaid || 0) + Number(values.bankAmountPaid || 0))
            : (values.paymentTerm === 'On Credit' ? 0 : Number(values.amountPaid || 0));

          const netCreditLineDebt = Math.max(0, computedGrossTotal - currentLiquidRefund);

          return (
            <Form className="space-y-6">
              
              {/* ── TOP SECTION: 4 SEARCHABLE HEADER CONTROLS ── */}
              <div className="bg-white dark:bg-boxdark rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* 1. Debit Note # (2 cols) */}
                <div className="md:col-span-2">
                  <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                    Debit Note Return #:
                  </label>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl font-mono font-black text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs">
                    {values.returnNo}
                  </div>
                </div>

                {/* 2. Target Wholesale Vendor (Searchable Autocomplete - 4 cols) */}
                <div className="md:col-span-4 relative" ref={vendorContainerRef}>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1 flex items-center gap-1.5">
                    <MdPerson size={15} className="text-rose-600" /> Target Vendor Profile: *
                  </label>
                  
                  <div className="relative">
                    <input
                      type="text"
                      disabled={isEditMode}
                      value={vendorSearchQuery}
                      onFocus={() => setIsVendorDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedVendorIndex(prev => Math.min(prev + 1, filteredVendors.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedVendorIndex(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredVendors[highlightedVendorIndex]) {
                            const v = filteredVendors[highlightedVendorIndex];
                            setFieldValue('vendorName', v.vendor_name);
                            setVendorSearchQuery(v.vendor_name);
                            setSelectedVendorObj(v);
                            setIsVendorDropdownOpen(false);
                          }
                        } else if (e.key === 'Escape') {
                          setIsVendorDropdownOpen(false);
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVendorSearchQuery(val);
                        setFieldValue('vendorName', val);
                        setIsVendorDropdownOpen(true);
                        setHighlightedVendorIndex(0);
                        if (!val) setSelectedVendorObj(null);
                      }}
                      placeholder="Type to search vendor name, contact, or city..."
                      className={`w-full border rounded-xl p-2.5 pr-9 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs ${
                        touched.vendorName && errors.vendorName ? 'border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-rose-600'
                      }`}
                    />

                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {values.vendorName && !isEditMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setFieldValue('vendorName', '');
                            setVendorSearchQuery('');
                            setSelectedVendorObj(null);
                          }}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <MdClear size={15} />
                        </button>
                      )}
                      <MdSearch className="text-slate-400" size={16} />
                    </div>
                  </div>

                  {/* Vendor Dropdown */}
                  {isVendorDropdownOpen && !isEditMode && (
                    <div className="absolute left-0 top-full mt-1.5 z-[9999] w-full max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredVendors.length > 0 ? (
                        filteredVendors.map((vendor, vIdx) => (
                          <div
                            key={vendor.id}
                            onMouseEnter={() => setHighlightedVendorIndex(vIdx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFieldValue('vendorName', vendor.vendor_name);
                              setVendorSearchQuery(vendor.vendor_name);
                              setSelectedVendorObj(vendor);
                              setIsVendorDropdownOpen(false);
                            }}
                            className={`p-2.5 cursor-pointer text-xs flex justify-between items-center transition ${
                              highlightedVendorIndex === vIdx || values.vendorName === vendor.vendor_name
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-xs">{vendor.vendor_name}</span>
                              {(vendor.contact_name || vendor.phone) && (
                                <span className="text-[10px] text-slate-400">
                                  {vendor.contact_name} {vendor.phone ? `• ${vendor.phone}` : ''}
                                </span>
                              )}
                            </div>
                            {vendor.city && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                                {vendor.city}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-400 italic">No matching vendors found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Source Warehouse (Searchable Autocomplete - 3 cols) */}
                <div className="md:col-span-3 relative" ref={warehouseContainerRef}>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1 flex items-center gap-1.5">
                    <MdStore size={15} className="text-rose-600" /> Source Warehouse / Location: *
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      value={warehouseSearchQuery}
                      onFocus={(e) => {
                        setIsWarehouseDropdownOpen(true);
                        e.target.select();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedWarehouseIndex(prev => Math.min(prev + 1, filteredWarehouses.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedWarehouseIndex(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredWarehouses[highlightedWarehouseIndex]) {
                            const wh = filteredWarehouses[highlightedWarehouseIndex];
                            setFieldValue('sourceWarehouse', wh.name);
                            setWarehouseSearchQuery(wh.name);
                            setIsWarehouseDropdownOpen(false);
                          }
                        } else if (e.key === 'Escape') {
                          setIsWarehouseDropdownOpen(false);
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWarehouseSearchQuery(val);
                        setFieldValue('sourceWarehouse', val);
                        setIsWarehouseDropdownOpen(true);
                        setHighlightedWarehouseIndex(0);
                      }}
                      placeholder="Type or select pull location..."
                      className={`w-full border rounded-xl p-2.5 pr-9 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs ${
                        touched.sourceWarehouse && errors.sourceWarehouse ? 'border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-rose-600'
                      }`}
                    />

                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {values.sourceWarehouse && (
                        <button
                          type="button"
                          onClick={() => {
                            setFieldValue('sourceWarehouse', '');
                            setWarehouseSearchQuery('');
                          }}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <MdClear size={15} />
                        </button>
                      )}
                      <MdKeyboardArrowDown className="text-slate-400" size={16} />
                    </div>
                  </div>

                  {/* Warehouse Dropdown */}
                  {isWarehouseDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1.5 z-[9999] w-full max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredWarehouses.length > 0 ? (
                        filteredWarehouses.map((wh, wIdx) => (
                          <div
                            key={wh.id}
                            onMouseEnter={() => setHighlightedWarehouseIndex(wIdx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFieldValue('sourceWarehouse', wh.name);
                              setWarehouseSearchQuery(wh.name);
                              setIsWarehouseDropdownOpen(false);
                            }}
                            className={`p-2.5 cursor-pointer text-xs flex justify-between items-center transition ${
                              highlightedWarehouseIndex === wIdx || values.sourceWarehouse === wh.name
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <MdStore className="text-rose-600" size={15} />
                              <span className="font-bold text-xs">{wh.name}</span>
                            </div>
                            {wh.code && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-mono">
                                {wh.code}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-400 italic">No matching warehouses found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Processing Return Date (3 cols) */}
                <div className="md:col-span-3">
                  <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                    Processing Return Date: *
                  </label>
                  <input
                    type="date"
                    name="returnDate"
                    onChange={handleChange}
                    value={values.returnDate}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 font-bold outline-none text-slate-900 dark:text-white text-xs focus:border-rose-600"
                  />
                </div>

              </div>

              {/* ── MIDDLE SECTION: OPTIONAL LINKED PURCHASE ORDER ── */}
              {values.vendorName && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 relative" ref={poContainerRef}>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MdReceipt size={15} className="text-rose-600" /> Link to Specific Purchase Consignment (Optional):
                    </span>
                    {selectedPoNo && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPoNo('');
                          setSelectedPoObj(null);
                          setPoSearchQuery('-- General Return (Manual Items) --');
                          setFieldValue('purchaseNo', '');
                        }}
                        className="text-[10px] text-rose-600 hover:underline font-bold"
                      >
                        Clear Selection (General Return)
                      </button>
                    )}
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      value={poSearchQuery}
                      onFocus={(e) => {
                        setIsPoDropdownOpen(true);
                        e.target.select();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedPoIndex(prev => Math.min(prev + 1, filteredPurchases.length));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedPoIndex(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (highlightedPoIndex === 0) {
                            setSelectedPoNo('');
                            setSelectedPoObj(null);
                            setPoSearchQuery('-- General Return (Manual Items) --');
                            setFieldValue('purchaseNo', '');
                            setIsPoDropdownOpen(false);
                          } else if (filteredPurchases[highlightedPoIndex - 1]) {
                            const p = filteredPurchases[highlightedPoIndex - 1];
                            setSelectedPoNo(p.purchase_no);
                            setSelectedPoObj(p);
                            setPoSearchQuery(p.purchase_no);
                            setFieldValue('purchaseNo', p.purchase_no);
                            if (p.target_warehouse) {
                              setFieldValue('sourceWarehouse', p.target_warehouse);
                              setWarehouseSearchQuery(p.target_warehouse);
                            }
                            if (p.items && p.items.length > 0) {
                              setFieldValue('items', p.items.map((i: any) => ({
                                itemName: i.itemName || i.product_name,
                                sku: i.sku || '',
                                qty: Number(i.qty || i.quantity || 1),
                                rate: Number(i.rate || i.cost_price || 0),
                                uom: i.uom || 'Nos',
                                maxQty: Number(i.qty || i.quantity || 9999)
                              })));
                            }
                            setIsPoDropdownOpen(false);
                          }
                        } else if (e.key === 'Escape') {
                          setIsPoDropdownOpen(false);
                        }
                      }}
                      onChange={(e) => {
                        setPoSearchQuery(e.target.value);
                        setIsPoDropdownOpen(true);
                        setHighlightedPoIndex(0);
                      }}
                      placeholder="Search PO # (e.g. PUR-275918), date, or warehouse..."
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pr-9 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs focus:border-rose-600"
                    />

                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <MdKeyboardArrowDown className="text-slate-400" size={16} />
                    </div>
                  </div>

                  {/* PO Dropdown */}
                  {isPoDropdownOpen && (
                    <div className="absolute left-4 right-4 top-full mt-1 z-[9999] max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-700/60">
                      <div
                        onMouseEnter={() => setHighlightedPoIndex(0)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedPoNo('');
                          setSelectedPoObj(null);
                          setPoSearchQuery('-- General Return (Manual Items) --');
                          setFieldValue('purchaseNo', '');
                          setIsPoDropdownOpen(false);
                        }}
                        className={`p-2.5 cursor-pointer text-xs flex justify-between items-center transition ${
                          highlightedPoIndex === 0 || !selectedPoNo
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        <span className="font-bold">-- General Return (Manual Line Entry) --</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                          General
                        </span>
                      </div>

                      {filteredPurchases.map((pur, pIdx) => (
                        <div
                          key={pur.id}
                          onMouseEnter={() => setHighlightedPoIndex(pIdx + 1)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedPoNo(pur.purchase_no);
                            setSelectedPoObj(pur);
                            setPoSearchQuery(pur.purchase_no);
                            setFieldValue('purchaseNo', pur.purchase_no);
                            if (pur.target_warehouse) {
                              setFieldValue('sourceWarehouse', pur.target_warehouse);
                              setWarehouseSearchQuery(pur.target_warehouse);
                            }
                            if (pur.items && pur.items.length > 0) {
                              setFieldValue('items', pur.items.map((i: any) => ({
                                itemName: i.itemName || i.product_name,
                                sku: i.sku || '',
                                qty: Number(i.qty || i.quantity || 1),
                                rate: Number(i.rate || i.cost_price || 0),
                                uom: i.uom || 'Nos',
                                maxQty: Number(i.qty || i.quantity || 9999)
                              })));
                            }
                            setIsPoDropdownOpen(false);
                            toast.success(`Consignment ${pur.purchase_no} items loaded!`);
                          }}
                          className={`p-2.5 cursor-pointer text-xs flex justify-between items-center transition ${
                            highlightedPoIndex === (pIdx + 1) || selectedPoNo === pur.purchase_no
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs">{pur.purchase_no}</span>
                            <span className="text-[10px] text-slate-400">{pur.purchase_date || 'N/A'} • {pur.target_warehouse || 'Warehouse'}</span>
                          </div>
                          <strong className="font-mono font-black text-slate-900 dark:text-white">Rs. {formatMoney(pur.total_amount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── PRODUCT ITEM CATALOG ENTRY TABLE ── */}
              <div className="bg-white dark:bg-boxdark rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <MdReceipt className="text-rose-600" size={18} /> Returned Product Inventory Manifest
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Total Return Line Items: <strong>{values.items.length}</strong>
                  </span>
                </div>

                <FieldArray name="items">
                  {({ push, remove }) => (
                    <div className="overflow-x-auto overflow-y-visible min-h-[280px] pb-20">
                      <table className="w-full table-auto border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <th className="p-3 w-12 text-center">S#</th>
                            <th className="p-3 min-w-[280px]">Product / Item Description (Search)</th>
                            <th className="p-3 w-28 text-center">UOM Unit</th>
                            <th className="p-3 w-36 text-center">Return Quantity</th>
                            <th className="p-3 w-40 text-right">Cost Price (PKR)</th>
                            <th className="p-3 w-44 text-right pr-4">Net Offset (PKR)</th>
                            <th className="p-3 w-16 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {values.items.map((item: any, idx: number) => {
                            const lineTotal = (Number(item.qty || 0) * Number(item.rate || 0));

                            const activeVendor = (values.vendorName || vendorSearchQuery || '').trim();
                            const boughtProducts = getVendorBoughtProducts(activeVendor);

                            const filteredBought = boughtProducts.filter(p =>
                              (p.product_name || '').toLowerCase().includes((item.itemName || '').toLowerCase()) ||
                              (p.item_sr_no || p.sku || '').toLowerCase().includes((item.itemName || '').toLowerCase())
                            );

                            const otherCatalogProds = productList.filter(p => {
                              const isAlreadyInBought = boughtProducts.some(bp => (bp.product_name || '').toLowerCase() === (p.product_name || '').toLowerCase());
                              if (isAlreadyInBought) return false;
                              return (
                                (p.product_name || '').toLowerCase().includes((item.itemName || '').toLowerCase()) ||
                                (p.item_sr_no || p.sku || '').toLowerCase().includes((item.itemName || '').toLowerCase())
                              );
                            });

                            const totalMatchingCount = filteredBought.length + otherCatalogProds.length;

                            return (
                              <tr key={idx} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition relative ${activeItemSearchIdx === idx ? 'z-50' : 'z-1'}`}>
                                <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                                {/* Product Search Cell */}
                                <td className={`p-2 relative product-search-cell ${activeItemSearchIdx === idx ? 'z-50' : 'z-10'}`}>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={item.itemName || ''}
                                      onFocus={() => {
                                        setActiveItemSearchIdx(idx);
                                        setHighlightedProdIdx(0);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                          e.preventDefault();
                                          setHighlightedProdIdx(prev => Math.min(prev + 1, totalMatchingCount - 1));
                                        } else if (e.key === 'ArrowUp') {
                                          e.preventDefault();
                                          setHighlightedProdIdx(prev => Math.max(prev - 1, 0));
                                        } else if (e.key === 'Enter') {
                                          e.preventDefault();
                                          let chosen: any = null;
                                          if (highlightedProdIdx < filteredBought.length) {
                                            chosen = filteredBought[highlightedProdIdx];
                                          } else {
                                            chosen = otherCatalogProds[highlightedProdIdx - filteredBought.length];
                                          }
                                          if (chosen) {
                                            setFieldValue(`items.${idx}.itemName`, chosen.product_name);
                                            setFieldValue(`items.${idx}.rate`, Number(chosen.purchase_price || chosen.price || 0));
                                            setFieldValue(`items.${idx}.uom`, chosen.uom || 'Nos');
                                            setFieldValue(`items.${idx}.sku`, chosen.item_sr_no || chosen.sku || '');
                                            setActiveItemSearchIdx(null);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setActiveItemSearchIdx(null);
                                        }
                                      }}
                                      onChange={(e) => {
                                        setFieldValue(`items.${idx}.itemName`, e.target.value);
                                        setActiveItemSearchIdx(idx);
                                        setHighlightedProdIdx(0);
                                      }}
                                      placeholder={activeVendor ? `Search products bought from ${activeVendor}...` : "Search products catalog..."}
                                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-rose-600"
                                    />

                                    {item.itemName && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFieldValue(`items.${idx}.itemName`, '');
                                          setFieldValue(`items.${idx}.rate`, 0);
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                                      >
                                        <MdClear size={14} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Floating Product Dropdown */}
                                  {activeItemSearchIdx === idx && (
                                    <div className="absolute left-2 right-2 top-full mt-1 z-[999999] min-w-[320px] max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-700/60">
                                      {/* 1. Products Purchased from Selected Vendor */}
                                      {filteredBought.length > 0 && (
                                        <div>
                                          {activeVendor && (
                                            <div className="px-3 py-1.5 bg-rose-50/90 dark:bg-rose-950/40 text-[10px] font-black uppercase text-rose-700 dark:text-rose-300 border-b border-rose-100 dark:border-rose-900/60 flex items-center justify-between">
                                              <span>🛒 Products Purchased from {activeVendor}</span>
                                              <span className="font-mono">{filteredBought.length} items</span>
                                            </div>
                                          )}
                                          {filteredBought.map((prod, pIdx) => (
                                            <div
                                              key={prod.id || pIdx}
                                              onMouseEnter={() => setHighlightedProdIdx(pIdx)}
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                setFieldValue(`items.${idx}.itemName`, prod.product_name);
                                                setFieldValue(`items.${idx}.rate`, Number(prod.purchase_price || prod.price || 0));
                                                setFieldValue(`items.${idx}.uom`, prod.uom || 'Nos');
                                                setFieldValue(`items.${idx}.sku`, prod.item_sr_no || prod.sku || '');
                                                setActiveItemSearchIdx(null);
                                              }}
                                              className={`p-2.5 cursor-pointer text-xs flex justify-between items-center transition ${
                                                highlightedProdIdx === pIdx
                                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold'
                                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
                                              }`}
                                            >
                                              <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-xs">{prod.product_name}</span>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                  {(prod.item_sr_no || prod.sku) && (
                                                    <span className="font-mono">SKU: {prod.item_sr_no || prod.sku}</span>
                                                  )}
                                                  {prod.totalBoughtQty && (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded">
                                                      Bought from Vendor: {prod.totalBoughtQty} {prod.uom || 'Nos'}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <span className="text-[10px] font-mono block text-rose-600 dark:text-rose-400 font-black">
                                                  Inward Cost: Rs. {formatMoney(prod.purchase_price || prod.price || 0)}
                                                </span>
                                                <span className="text-[9px] text-slate-400">
                                                  Total Stock: {prod.current_stock || 0} {prod.uom || 'Nos'}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* 2. Other Catalog Products */}
                                      {otherCatalogProds.length > 0 && (
                                        <div>
                                          {activeVendor && filteredBought.length > 0 && (
                                            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700/60 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
                                              Other General Products
                                            </div>
                                          )}
                                          {otherCatalogProds.map((prod, pIdx) => {
                                            const overallIdx = filteredBought.length + pIdx;
                                            return (
                                              <div
                                                key={prod.id || overallIdx}
                                                onMouseEnter={() => setHighlightedProdIdx(overallIdx)}
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  setFieldValue(`items.${idx}.itemName`, prod.product_name);
                                                  setFieldValue(`items.${idx}.rate`, Number(prod.purchase_price || prod.price || 0));
                                                  setFieldValue(`items.${idx}.uom`, prod.uom || 'Nos');
                                                  setFieldValue(`items.${idx}.sku`, prod.item_sr_no || prod.sku || '');
                                                  setActiveItemSearchIdx(null);
                                                }}
                                                className={`p-2.5 cursor-pointer text-xs flex justify-between items-center transition ${
                                                  highlightedProdIdx === overallIdx
                                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
                                                }`}
                                              >
                                                <div className="flex flex-col gap-0.5">
                                                  <span className="font-bold text-xs">{prod.product_name}</span>
                                                  {(prod.item_sr_no || prod.sku) && (
                                                    <span className="text-[10px] text-slate-400 font-mono">SKU: {prod.item_sr_no || prod.sku}</span>
                                                  )}
                                                </div>
                                                <div className="text-right">
                                                  <span className="text-[10px] font-mono block text-slate-600 dark:text-slate-300 font-bold">
                                                    Cost: Rs. {formatMoney(prod.purchase_price || prod.price || 0)}
                                                  </span>
                                                  <span className="text-[9px] text-slate-400">
                                                    Total Stock: {prod.current_stock || 0} {prod.uom || 'Nos'}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {filteredBought.length === 0 && otherCatalogProds.length === 0 && (
                                        <div className="p-3 text-center text-xs text-slate-400 italic">No matching products found</div>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* UOM Unit */}
                                <td className="p-2 text-center font-bold text-slate-600 dark:text-slate-400 uppercase font-mono">
                                  {item.uom || 'Nos'}
                                </td>

                                {/* Return Qty */}
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    name={`items.${idx}.qty`}
                                    onKeyDown={blockInvalidChar}
                                    onChange={handleChange}
                                    value={item.qty}
                                    placeholder="Qty"
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center font-mono font-black text-slate-900 dark:text-white text-xs outline-none focus:border-rose-600"
                                  />
                                </td>

                                {/* Rate */}
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    name={`items.${idx}.rate`}
                                    onKeyDown={blockInvalidChar}
                                    onChange={handleChange}
                                    value={item.rate}
                                    placeholder="Rate"
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-right font-mono font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-rose-600"
                                  />
                                </td>

                                {/* Net Total */}
                                <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400 pr-4 text-xs">
                                  Rs. {formatMoney(lineTotal)}
                                </td>

                                {/* Delete Action */}
                                <td className="p-2 text-center">
                                  {values.items.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => remove(idx)}
                                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                                      title="Remove item row"
                                    >
                                      <MdDelete size={16} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => push({ itemName: '', sku: '', qty: 1, rate: 0, uom: 'Nos', maxQty: 99999 })}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl hover:bg-rose-100 transition cursor-pointer"
                        >
                          <MdAdd size={16} /> Add Another Return Item Row
                        </button>
                      </div>
                    </div>
                  )}
                </FieldArray>
              </div>

              {/* ── BOTTOM SECTION: REIMBURSEMENT & FINANCIAL BREAKDOWN ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Reimbursement Source & Notes (7 cols) */}
                <div className="lg:col-span-7 bg-white dark:bg-boxdark rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                    <MdAccountBalance className="text-rose-600" size={18} /> Vendor Settlement & Refund Channel
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                        Reimbursement Channel: *
                      </label>
                      <select
                        name="paymentTerm"
                        onChange={(e) => {
                          const val = e.target.value;
                          setFieldValue('paymentTerm', val);
                          if (val === 'On Credit') {
                            setFieldValue('amountPaid', 0);
                            setFieldValue('cashAmountPaid', '');
                            setFieldValue('bankAmountPaid', '');
                          }
                        }}
                        value={values.paymentTerm}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs focus:border-rose-600"
                      >
                        <option value="On Credit">📝 On Credit (Deduct from Vendor Payable Ledger)</option>
                        <option value="By Cash">💵 Cash Refund Received from Vendor</option>
                        <option value="By Bank">🏦 Bank Wire Refund from Vendor</option>
                        <option value="Split">💳 Split Refund (Cash + Bank)</option>
                      </select>
                    </div>

                    {(values.paymentTerm === 'By Bank' || values.paymentTerm === 'Split') && (
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                          Deposited Bank Account: *
                        </label>
                        <select
                          name="selectedBankId"
                          onChange={handleChange}
                          value={values.selectedBankId}
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs focus:border-rose-600"
                        >
                          <option value="">-- Choose Receiving Bank --</option>
                          {bankAccountsList.map(b => (
                            <option key={b.id} value={b.bankName}>
                              {b.bankName} - {b.accountTitle} ({b.accountNumber || '-'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Split Refund Inputs */}
                  {values.paymentTerm === 'Split' && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-500 font-bold text-[10px] uppercase mb-1">
                          Cash Refund (PKR):
                        </label>
                        <input
                          type="number"
                          name="cashAmountPaid"
                          placeholder="0"
                          onKeyDown={blockInvalidChar}
                          onChange={handleChange}
                          value={values.cashAmountPaid}
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-3 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-rose-600"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold text-[10px] uppercase mb-1">
                          Bank Refund (PKR):
                        </label>
                        <input
                          type="number"
                          name="bankAmountPaid"
                          placeholder="0"
                          onKeyDown={blockInvalidChar}
                          onChange={handleChange}
                          value={values.bankAmountPaid}
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-3 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-rose-600"
                        />
                      </div>
                    </div>
                  )}

                  {/* Single Cash / Bank Refund Input */}
                  {(values.paymentTerm === 'By Cash' || values.paymentTerm === 'By Bank') && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-rose-600 dark:text-rose-400 font-black uppercase text-[11px]">
                          Liquid Refund Collected (PKR):
                        </label>
                        {computedGrossTotal > 0 && (
                          <button
                            type="button"
                            onClick={() => setFieldValue('amountPaid', computedGrossTotal)}
                            className="text-[11px] font-black text-rose-600 hover:underline cursor-pointer"
                          >
                            ⚡ Full Cash Refund (Rs. {formatMoney(computedGrossTotal)})
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">Rs.</span>
                        <input
                          type="number"
                          name="amountPaid"
                          placeholder="0"
                          onKeyDown={blockInvalidChar}
                          onChange={handleChange}
                          value={values.amountPaid}
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 bg-white dark:bg-slate-800 font-mono font-black text-slate-950 dark:text-white text-sm outline-none focus:border-rose-600"
                        />
                      </div>
                    </div>
                  )}

                  {/* Remarks */}
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                      Return Reason & Quality Inspection Notes:
                    </label>
                    <textarea
                      name="remarks"
                      rows={2}
                      onChange={handleChange}
                      value={values.remarks}
                      placeholder="Describe fault metrics, batch breakage, or debit credit arrangement..."
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-rose-600"
                    />
                  </div>

                </div>

                {/* Right Side: Financial Summary Card (5 cols) */}
                <div className="lg:col-span-5 bg-white dark:bg-boxdark rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <MdAccountBalance className="text-rose-600" size={18} /> Financial Debit Note Breakdown
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                      PKR
                    </span>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span className="font-sans font-bold">Gross Outbound Return Value:</span>
                      <strong className="text-slate-950 dark:text-white font-black text-base">
                        Rs. {formatMoney(computedGrossTotal)}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400">
                      <span className="font-sans font-medium">Reimbursement Cash Collected:</span>
                      <strong className="font-black">
                        - Rs. {formatMoney(currentLiquidRefund)}
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex justify-between items-center text-rose-900 dark:text-rose-300">
                      <div className="font-sans">
                        <span className="block text-[10px] font-black uppercase tracking-wider">
                          Net Debit Note Credit Line:
                        </span>
                        <span className="text-[11px] text-rose-700 dark:text-rose-400">
                          {netCreditLineDebt > 0 ? 'Deducts from Vendor Payable Balance' : 'Fully Settled / No Debt Offset'}
                        </span>
                      </div>
                      <strong className="font-mono font-black text-base text-rose-700 dark:text-rose-300">
                        Rs. {formatMoney(netCreditLineDebt)}
                      </strong>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return/List`)}
                      className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 px-5 font-bold text-slate-700 dark:text-slate-300 transition text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !values.vendorName || !values.sourceWarehouse}
                      className="rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 px-7 font-black text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                    >
                      {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Return Note' : 'Post Return & Debit Note'}</span>}
                    </button>
                  </div>

                </div>

              </div>

            </Form>
          );
        }}
      </Formik>

    </div>
  );
};

export default AddPurchaseReturn;
