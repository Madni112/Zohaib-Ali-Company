import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form, FieldArray } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../Context/supabaseClient';
import { useAuth } from '../../../Context/Auth';
import Spinner from '../../../ui/Spinner';
import { FiTrash2 } from 'react-icons/fi';
import { MdInventory, MdArrowBack } from 'react-icons/md';

const AddGRN = () => {
  const { tenantId } = useAuth();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);
  const [productList, setProductList] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [openDropdownRowIndex, setOpenDropdownRowIndex] = useState<number | null>(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  const [highlightedVendorIndex, setHighlightedVendorIndex] = useState(0);
  const [activeSkuIndex, setActiveSkuIndex] = useState<number | null>(null);
  const [highlightedSkuIndex, setHighlightedSkuIndex] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.vendor-search-container')) {
        setIsVendorDropdownOpen(false);
      }
      if (!target.closest('.sku-container')) {
        setActiveSkuIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formInitialValues = React.useMemo(() => {
    return {
      grnNo: '',
      vendorName: '',
      receiptDate: new Date().toISOString().split('T')[0],
      status: 'Confirm',
      remarks: '',
      items: [{ itemName: '', skuCode: '', qty: 1, uom: 'Nos', warehouseName: '' }]
    };
  }, []);

  const [initialValues, setInitialValues] = useState(formInitialValues);
  const [originalGrn, setOriginalGrn] = useState<any>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setMetadataLoading(true);
        const [venRes, prodRes, locRes, grnCountRes] = await Promise.all([
          supabase.from('vendors').select('vendor_name').order('vendor_name'),
          supabase.from('products').select('id, product_name, uom, item_sr_no, category, pieces_per_box, pcs_per_box, pieces_per_packing, product_description').order('product_name'),
          supabase.from('inventory_locations').select('name, location_type').order('name'),
          supabase.from('grn_receipts').select('*', { count: 'exact', head: true })
        ]);

        if (venRes.data) setVendors(venRes.data);
        if (prodRes.data) setProductList(prodRes.data);
        if (locRes.data) setLocations(locRes.data);

        if (id) {
          const { data: grn, error: grnErr } = await supabase.from('grn_receipts').select('*').eq('id', id).single();
          if (grnErr) throw grnErr;
          
          const { data: items, error: itemsErr } = await supabase.from('grn_items').select('*').eq('grn_id', id);
          if (itemsErr) throw itemsErr;
          
          setOriginalGrn({ ...grn, grn_items: items });
          setInitialValues({
            grnNo: grn.grn_no,
            vendorName: grn.vendor_name,
            receiptDate: grn.receipt_date,
            status: grn.status,
            remarks: grn.remarks || '',
            items: items.map((i: any) => {
              const matchedProd = prodRes.data?.find(p => p.product_name === i.product_name);
              return {
                itemName: i.product_name,
                skuCode: matchedProd ? (matchedProd.item_sr_no || `SKU-${matchedProd.id}`) : '',
                qty: i.qty,
                uom: i.uom,
                warehouseName: i.warehouse_name
              };
            })
          });
        } else {
          const nextGrnNo = `GRN-${String((grnCountRes.count || 0) + 1).padStart(4, '0')}`;
          setInitialValues(prev => ({ ...prev, grnNo: nextGrnNo }));
        }
      } catch (err) {
        toast.error('Failed to load data.');
      } finally {
        setMetadataLoading(false);
      }
    };
    fetchMetadata();
  }, [id]);

  const validationSchema = Yup.object().shape({
    grnNo: Yup.string().required('GRN # is mandatory'),
    vendorName: Yup.string().required('Vendor is mandatory'),
    receiptDate: Yup.string().required('Date is mandatory'),
    items: Yup.array().of(
      Yup.object().shape({
        itemName: Yup.string().required('Product is mandatory'),
        warehouseName: Yup.string().required('Warehouse is mandatory'),
        qty: Yup.number().min(0.01, 'Must be > 0').required('Qty is required')
      })
    ).min(1, 'At least one item is required')
  });

  if (metadataLoading) return <div className="flex h-64 items-center justify-center bg-white dark:bg-boxdark"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-7xl text-black dark:text-bodydark text-xs pb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
          <MdInventory className="text-primary" size={24} />
          {id ? 'Edit Goods Receipt Note (GRN)' : 'Create Goods Receipt Note (GRN)'}
        </h2>
        <button
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/GRN/List`)}
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <MdArrowBack /> Back to List
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <Formik
          initialValues={initialValues}
          enableReinitialize={true}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            setLoading(true);
            try {
              let finalStatus = values.status;
              
              // Smart Routing: Check if any selected warehouse is a Storage Point
              if (finalStatus === 'Confirm') {
                const hasStoragePoint = values.items.some(item => {
                  const loc = locations.find(l => l.name === item.warehouseName);
                  return loc && loc.location_type === 'Storage Point';
                });
                
                if (hasStoragePoint) {
                  finalStatus = 'Pending Inward';
                }
              }

              let grnIdToUse = '';

              if (id) {
                // EDIT MODE
                // 1. Revert Old Inventory if original was Confirm
                if (originalGrn?.status === 'Confirm') {
                  for (const oldItem of originalGrn.grn_items) {
                    const { data: oldStock, error: errStk } = await supabase
                      .from('warehouse_inventory')
                      .select('id, quantity')
                      .ilike('product_name', oldItem.product_name)
                      .ilike('warehouse_name', oldItem.warehouse_name)
                      .maybeSingle();

                    if (!errStk && oldStock) {
                      await supabase
                        .from('warehouse_inventory')
                        .update({ quantity: Math.max(0, Number(oldStock.quantity) - Number(oldItem.qty)) })
                        .eq('id', oldStock.id);
                    }
                  }
                }

                // 2. Update Header
                const { error: updateErr } = await supabase
                  .from('grn_receipts')
                  .update({
                    grn_no: values.grnNo,
                    vendor_name: values.vendorName,
                    receipt_date: values.receiptDate,
                    status: finalStatus,
                    remarks: values.remarks
                  })
                  .eq('id', id);

                if (updateErr) throw updateErr;
                grnIdToUse = id;

                // 3. Delete Old Items
                await supabase.from('grn_items').delete().eq('grn_id', id);

              } else {
                // CREATE MODE
                const { data: grnData, error: grnError } = await supabase
                  .from('grn_receipts')
                  .insert([{
                    grn_no: values.grnNo,
                    vendor_name: values.vendorName,
                    receipt_date: values.receiptDate,
                    status: finalStatus,
                    remarks: values.remarks
                  }])
                  .select()
                  .single();

                if (grnError) throw grnError;
                grnIdToUse = grnData.id;
              }

              // 4. Insert New Items
              const itemsToInsert = values.items.map(item => ({
                grn_id: grnIdToUse,
                product_name: item.itemName,
                warehouse_name: item.warehouseName,
                qty: Number(item.qty),
                uom: item.uom
              }));

              const { error: itemsError } = await supabase.from('grn_items').insert(itemsToInsert);
              if (itemsError) throw itemsError;

              // 5. Apply New Warehouse Inventory if Confirmed (and NOT Pending Inward)
              if (finalStatus === 'Confirm') {
                for (const item of values.items) {
                  const { data: existingStock, error: stockCheckErr } = await supabase
                    .from('warehouse_inventory')
                    .select('id, quantity')
                    .ilike('product_name', item.itemName)
                    .ilike('warehouse_name', item.warehouseName)
                    .maybeSingle();

                  if (stockCheckErr) throw stockCheckErr;

                  if (existingStock) {
                    await supabase
                      .from('warehouse_inventory')
                      .update({ quantity: Number(existingStock.quantity) + Number(item.qty) })
                      .eq('id', existingStock.id);
                  } else {
                    await supabase.from('warehouse_inventory')
                      .insert([{
                        product_name: item.itemName,
                        warehouse_name: item.warehouseName,
                        quantity: Number(item.qty),
                        uom: item.uom
                      }]);
                  }
                }
              }

              if (finalStatus === 'Confirm') {
                toast.success(`GRN ${id ? 'Updated' : 'Confirmed'}! Stock updated instantly.`);
              } else if (finalStatus === 'Pending Inward') {
                toast.success(`GRN ${id ? 'Updated' : 'Saved'}! Sent to Warehouse "Inward Challan" for QC Verification.`);
              } else {
                toast.success(`GRN ${id ? 'Updated' : 'Saved'} as Draft.`);
              }
              navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/GRN/List`);
            } catch (err: any) {
              toast.error('Transaction Failed: ' + err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ values, errors, touched, setFieldValue, handleChange }) => (
            <Form className="p-6.5 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">GRN #: *</label>
                  <input 
                    type="text" 
                    name="grnNo"
                    value={values.grnNo} 
                    readOnly
                    className={`w-full border rounded p-2 bg-gray-50 dark:bg-meta-4 text-gray-500 font-bold font-mono outline-none cursor-not-allowed ${touched.grnNo && errors.grnNo ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} 
                  />
                </div>

                <div className="md:col-span-2 relative vendor-search-container">
                  <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">Vendor Profile: *</label>
                  <input
                    type="text"
                    name="vendorName"
                    value={values.vendorName}
                    autoComplete="new-password"
                    onChange={(e) => {
                      setFieldValue('vendorName', e.target.value);
                      setIsVendorDropdownOpen(true);
                      setHighlightedVendorIndex(0);
                    }}
                    onFocus={() => { setIsVendorDropdownOpen(true); setHighlightedVendorIndex(0); }}
                    onKeyDown={(e) => {
                      const filtered = vendors.filter(v => (v.vendor_name || '').toLowerCase().includes(String(values.vendorName || '').toLowerCase()));
                      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedVendorIndex(prev => prev < filtered.length - 1 ? prev + 1 : 0); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedVendorIndex(prev => prev > 0 ? prev - 1 : filtered.length - 1); }
                      else if (e.key === 'Enter' && filtered.length > 0) {
                        e.preventDefault();
                        setFieldValue('vendorName', filtered[highlightedVendorIndex]?.vendor_name || filtered[0].vendor_name);
                        setIsVendorDropdownOpen(false);
                      } else if (e.key === 'Tab' || e.key === 'Escape') { setIsVendorDropdownOpen(false); }
                    }}
                    placeholder="Search Supply Vendor..."
                    className={`w-full rounded border p-2 bg-transparent dark:bg-boxdark outline-none font-bold focus:border-primary ${touched.vendorName && errors.vendorName ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                  />
                  {isVendorDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 z-[99999] w-full max-h-64 overflow-y-auto bg-white dark:bg-boxdark border border-stroke dark:border-strokedark shadow-xl divide-y divide-stroke dark:divide-strokedark rounded-lg">
                      {(() => {
                        const filtered = vendors.filter(v => (v.vendor_name || '').toLowerCase().includes(String(values.vendorName || '').toLowerCase()));
                        return filtered.length > 0 ? filtered.map((v, vIdx) => (
                          <div
                            key={v.vendor_name}
                            onMouseEnter={() => setHighlightedVendorIndex(vIdx)}
                            onMouseDown={(e) => {
                              e.preventDefault(); e.stopPropagation();
                              setFieldValue('vendorName', v.vendor_name);
                              setIsVendorDropdownOpen(false);
                            }}
                            className={`p-2.5 cursor-pointer text-xs font-semibold ${highlightedVendorIndex === vIdx ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-meta-4/30'}`}
                          >
                            {v.vendor_name}
                          </div>
                        )) : <div className="p-4 text-center italic text-gray-400">No vendors found</div>;
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">Receipt Date: *</label>
                  <input type="date" name="receiptDate" value={values.receiptDate} onChange={handleChange} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent outline-none font-bold focus:border-primary" />
                </div>
              </div>

              <div className="border border-stroke dark:border-strokedark rounded-sm overflow-x-auto min-h-max pb-4">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-meta-4 text-[10px] font-black uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                      <th className="p-3 w-10 text-center">S#</th>
                      <th className="p-3 w-48">Code (Search)</th>
                      <th className="p-3 min-w-[240px]">Product Description</th>
                      <th className="p-3 w-48">Receiving Warehouse</th>
                      <th className="p-3 w-36 text-right">Quantity</th>
                      <th className="p-3 w-24 text-center">UOM</th>
                      <th className="p-3 w-12 text-center">X</th>
                    </tr>
                  </thead>
                  <FieldArray name="items">
                    {({ push, remove }) => (
                      <tbody>
                        {values.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-stroke dark:border-strokedark relative">
                            <td className="p-3 text-center text-gray-500">{idx + 1}</td>

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
                                        setOpenDropdownRowIndex(null);
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
                                            const p = filteredProds[highlightedSkuIndex];
                                            setFieldValue(`items.${idx}.skuCode`, p.item_sr_no || `SKU-${p.id}`);
                                            setFieldValue(`items.${idx}.itemName`, p.product_name);
                                            setFieldValue(`items.${idx}.uom`, p.uom || 'Nos');
                                            setActiveSkuIndex(null);
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
                                      className="w-full rounded border border-stroke dark:border-strokedark p-2 bg-transparent font-mono font-bold text-xs uppercase outline-none focus:border-primary"
                                    />

                                    {activeSkuIndex === idx && filteredProds.length > 0 && (
                                      <div className="absolute left-0 top-full mt-1 z-[99999] w-72 max-h-52 overflow-y-auto bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-lg shadow-2xl divide-y divide-stroke dark:divide-strokedark">
                                        {filteredProds.map((prod, pIdx) => (
                                          <div
                                            key={prod.id}
                                            onMouseEnter={() => setHighlightedSkuIndex(pIdx)}
                                            onMouseDown={(e) => {
                                              e.preventDefault(); e.stopPropagation();
                                              setFieldValue(`items.${idx}.skuCode`, prod.item_sr_no || `SKU-${prod.id}`);
                                              setFieldValue(`items.${idx}.itemName`, prod.product_name);
                                              setFieldValue(`items.${idx}.uom`, prod.uom || 'Nos');
                                              setActiveSkuIndex(null);
                                            }}
                                            className={`p-2.5 cursor-pointer text-xs flex justify-between gap-2 ${highlightedSkuIndex === pIdx ? 'bg-primary/10' : 'hover:bg-gray-100 dark:hover:bg-meta-4/30'}`}
                                          >
                                            <div className="font-bold font-mono text-primary truncate min-w-[80px]">{prod.item_sr_no || `SKU-${prod.id}`}</div>
                                            <div className="text-gray-600 dark:text-gray-300 truncate font-semibold" title={prod.product_name}>{prod.product_name}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </td>

                            <td className="p-3">
                              <div className="relative">
                                <input
                                  type="text"
                                  name={`items.${idx}.itemName`}
                                  value={item.itemName}
                                  autoComplete="new-password"
                                  onChange={(e) => {
                                    setFieldValue(`items.${idx}.itemName`, e.target.value);
                                    setOpenDropdownRowIndex(idx);
                                    setActiveSkuIndex(null);
                                    setHighlightedProductIndex(0);
                                  }}
                                  onFocus={() => { setOpenDropdownRowIndex(idx); setActiveSkuIndex(null); setHighlightedProductIndex(0); }}
                                  onBlur={() => setTimeout(() => setOpenDropdownRowIndex(null), 200)}
                                  onKeyDown={(e) => {
                                    const filtered = productList.filter((p: any) => p.product_name.toLowerCase().includes(String(item.itemName || '').toLowerCase()));
                                    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedProductIndex(prev => prev < filtered.length - 1 ? prev + 1 : 0); }
                                    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedProductIndex(prev => prev > 0 ? prev - 1 : filtered.length - 1); }
                                    else if (e.key === 'Enter' && filtered.length > 0) {
                                      e.preventDefault();
                                      const p = filtered[highlightedProductIndex] || filtered[0];
                                      setFieldValue(`items.${idx}.itemName`, p.product_name);
                                      setFieldValue(`items.${idx}.skuCode`, p.item_sr_no || `SKU-${p.id}`);
                                      setFieldValue(`items.${idx}.uom`, p.uom || 'Nos');
                                      setOpenDropdownRowIndex(null);
                                    } else if (e.key === 'Tab' || e.key === 'Escape') { setOpenDropdownRowIndex(null); }
                                  }}
                                  placeholder="Search Product..."
                                  className={`w-full rounded border p-2 bg-transparent font-bold outline-none focus:border-primary ${touched.items?.[idx]?.itemName && (errors.items as any)?.[idx]?.itemName ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                />
                                {openDropdownRowIndex === idx && (
                                  <div className="absolute left-0 top-full mt-1 z-[99999] w-full max-h-64 overflow-y-auto bg-white dark:bg-boxdark border border-stroke dark:border-strokedark shadow-xl divide-y divide-stroke dark:divide-strokedark rounded-lg">
                                    {(() => {
                                      const filtered = productList.filter((p: any) => p.product_name.toLowerCase().includes(String(item.itemName || '').toLowerCase()));
                                      return filtered.length > 0 ? filtered.map((p, pIdx) => (
                                        <div
                                          key={p.product_name}
                                          onMouseEnter={() => setHighlightedProductIndex(pIdx)}
                                          onMouseDown={(e) => {
                                            e.preventDefault(); e.stopPropagation();
                                            setFieldValue(`items.${idx}.itemName`, p.product_name);
                                            setFieldValue(`items.${idx}.skuCode`, p.item_sr_no || `SKU-${p.id}`);
                                            setFieldValue(`items.${idx}.uom`, p.uom || 'Nos');
                                            setOpenDropdownRowIndex(null);
                                          }}
                                          className={`p-2.5 cursor-pointer text-xs font-semibold ${highlightedProductIndex === pIdx ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-meta-4/30'}`}
                                        >
                                          {p.product_name}
                                        </div>
                                      )) : <div className="p-4 text-center italic text-gray-400">No products found</div>;
                                    })()}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="p-3">
                              <select
                                name={`items.${idx}.warehouseName`}
                                value={item.warehouseName}
                                onChange={handleChange}
                                className={`w-full rounded border p-2 bg-transparent dark:bg-boxdark font-bold outline-none focus:border-primary ${touched.items?.[idx]?.warehouseName && (errors.items as any)?.[idx]?.warehouseName ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                              >
                                <option value="">Select...</option>
                                {locations.map((l, i) => <option key={i} value={l.name}>{l.name}</option>)}
                              </select>
                            </td>

                            <td className="p-3">
                              {(() => {
                                const selectedProd = productList.find(p => p.product_name === item.itemName);
                                const isTile = String(selectedProd?.category || '').toLowerCase() === 'tiles';
                                const rawPcs = Number(selectedProd?.pieces_per_box || selectedProd?.pcs_per_box || selectedProd?.pieces_per_packing || 0);
                                const pcsPerBox = rawPcs > 1 ? rawPcs : (isTile ? 4 : 1);

                                if (isTile && pcsPerBox > 1) {
                                  return (
                                    <div className="flex items-center gap-1 p-1 rounded bg-slate-50 dark:bg-slate-800 border border-stroke dark:border-strokedark">
                                      {/* BOXES */}
                                      <div className="flex-1 flex items-center bg-white dark:bg-boxdark rounded px-1 focus-within:border-primary shadow-sm border border-stroke dark:border-strokedark">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={(() => {
                                            const b = Math.floor(Number(item.qty || 0));
                                            return b === 0 ? '' : b;
                                          })()}
                                          placeholder="0"
                                          onChange={(e) => {
                                            const val = e.target.value.trim();
                                            const newBoxes = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                                            const currentLoose = Math.round((Number(item.qty || 0) - Math.floor(Number(item.qty || 0))) * pcsPerBox);
                                            const combinedQty = Number((newBoxes + currentLoose / pcsPerBox).toFixed(3));
                                            setFieldValue(`items.${idx}.qty`, combinedQty);
                                          }}
                                          onKeyDown={(e) => { if (!/[0-9BackspaceTabEnterArrowLeftArrowRight]/.test(e.key)) e.preventDefault(); }}
                                          className="w-full bg-transparent text-center font-bold text-sm text-primary outline-none min-w-[28px] py-1"
                                        />
                                        <span className="text-[10px] font-bold text-gray-400 select-none pr-1">Box</span>
                                      </div>
                                      <span className="text-gray-400 font-bold text-xs">+</span>
                                      {/* PCS */}
                                      <div className="flex-1 flex items-center bg-white dark:bg-boxdark rounded px-1 focus-within:border-emerald-500 shadow-sm border border-stroke dark:border-strokedark">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={(() => {
                                            const currentLoose = Math.round((Number(item.qty || 0) - Math.floor(Number(item.qty || 0))) * pcsPerBox);
                                            return currentLoose === 0 ? '' : currentLoose;
                                          })()}
                                          placeholder={`${pcsPerBox}`}
                                          onChange={(e) => {
                                            const val = e.target.value.trim();
                                            const enteredLoose = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                                            const currentBoxes = Math.floor(Number(item.qty || 0));
                                            
                                            const extraBoxes = Math.floor(enteredLoose / pcsPerBox);
                                            const remLoose = enteredLoose % pcsPerBox;
                                            const finalBoxes = currentBoxes + extraBoxes;
                                            const combinedQty = remLoose > 0
                                              ? Number((finalBoxes + remLoose / pcsPerBox).toFixed(3))
                                              : finalBoxes;
                                            setFieldValue(`items.${idx}.qty`, combinedQty);
                                          }}
                                          onKeyDown={(e) => { if (!/[0-9BackspaceTabEnterArrowLeftArrowRight]/.test(e.key)) e.preventDefault(); }}
                                          className="w-full bg-transparent text-center font-bold text-sm text-emerald-600 outline-none min-w-[28px] py-1"
                                        />
                                        <span className="text-[10px] font-bold text-gray-400 select-none pr-1">Pcs</span>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <input
                                    type="number" 
                                    min="0" 
                                    step={['kg', 'ltr', 'cm', 'mm', 'yd', 'm', 'g', 'ml', 'ton', 'sqm', 'sqft', 'cbm'].includes(String(item.uom).toLowerCase()) ? '0.01' : '1'}
                                    name={`items.${idx}.qty`}
                                    value={item.qty}
                                    onKeyDown={(e) => {
                                      const decimalUoms = ['kg', 'ltr', 'cm', 'mm', 'yd', 'm', 'g', 'ml', 'ton', 'sqm', 'sqft', 'cbm'];
                                      const isDecimalAllowed = decimalUoms.includes(String(item.uom).toLowerCase());
                                      if (!isDecimalAllowed && e.key === '.') {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) => {
                                      const decimalUoms = ['kg', 'ltr', 'cm', 'mm', 'yd', 'm', 'g', 'ml', 'ton', 'sqm', 'sqft', 'cbm'];
                                      const isDecimalAllowed = decimalUoms.includes(String(item.uom).toLowerCase());
                                      let valStr = e.target.value;
                                      if (!isDecimalAllowed && valStr.includes('.')) {
                                        valStr = valStr.split('.')[0];
                                      }
                                      setFieldValue(`items.${idx}.qty`, Math.max(0, Number(valStr) || 0));
                                    }}
                                    className={`w-full text-right rounded border p-2 bg-transparent font-bold font-mono outline-none focus:border-primary ${touched.items?.[idx]?.qty && (errors.items as any)?.[idx]?.qty ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                  />
                                );
                              })()}
                            </td>

                            <td className="p-3 font-mono text-center">
                              {(() => {
                                const selectedProd = productList.find(p => p.product_name === item.itemName);
                                const isTile = String(selectedProd?.category || '').toLowerCase() === 'tiles';
                                const rawPcs = Number(selectedProd?.pieces_per_box || selectedProd?.pcs_per_box || selectedProd?.pieces_per_packing || 0);
                                const pcsPerBox = rawPcs > 1 ? rawPcs : (isTile ? 4 : 1);
                                if (isTile && pcsPerBox > 1) {
                                  return (
                                    <div className="flex flex-col items-center">
                                      <span className="text-xs font-bold">{item.uom || 'BOX'}</span>
                                      <span className="text-[9px] text-gray-500 font-bold whitespace-nowrap">({pcsPerBox} Pcs/Box)</span>
                                    </div>
                                  );
                                }
                                return <span className="text-xs font-bold">{item.uom || 'Nos'}</span>;
                              })()}
                            </td>

                            <td className="p-3 text-center">
                              {values.items.length > 1 && (
                                <button type="button" onClick={() => remove(idx)} className="text-gray-400 hover:text-danger">
                                  <FiTrash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={7} className="p-3 text-left">
                            <button
                              type="button"
                              onClick={() => push({ itemName: '', skuCode: '', qty: 1, uom: 'Nos', warehouseName: '' })}
                              className="text-primary font-bold hover:underline"
                            >
                              + Add Item Line
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    )}
                  </FieldArray>
                </table>
              </div>

              <div>
                <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">Remarks (Optional):</label>
                <textarea
                  name="remarks"
                  value={values.remarks}
                  onChange={handleChange}
                  rows={2}
                  className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent outline-none focus:border-primary"
                  placeholder="e.g. Received via transport #XYZ"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-stroke dark:border-strokedark">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-primary text-white font-bold rounded shadow hover:bg-opacity-90 disabled:bg-gray-400"
                >
                  {loading ? 'Saving GRN...' : 'Confirm Goods Received'}
                </button>
              </div>

            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default AddGRN;
