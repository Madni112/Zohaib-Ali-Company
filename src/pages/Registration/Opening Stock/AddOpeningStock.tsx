import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';

const AddOpeningStock = () => {
    const [loading, setLoading] = useState(false);
    const [locations, setLocations] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [showSkuDropdown, setShowSkuDropdown] = useState(false);
    const [highlightedSkuIndex, setHighlightedSkuIndex] = useState<number>(0);
    const skuDropdownRef = useRef<HTMLDivElement>(null);

    const location = useLocation();
    const navigate = useNavigate();

    const editData = location.state?.stock;
    const isEditMode = !!editData;

    const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
        ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const { data: locData } = await supabase.from('inventory_locations').select('*');
                if (locData) setLocations(locData);

                const { data: prodData } = await supabase.from('products').select('id, product_name, purchase_price, retail_price, mrp, item_sr_no, uom');
                if (prodData) setProducts(prodData);
            } catch (err: any) {
                console.error('Metadata fetch error:', err.message);
            }
        };
        fetchMetadata();

        // Close dropdown when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (skuDropdownRef.current && !skuDropdownRef.current.contains(event.target as Node)) {
                setShowSkuDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const validationSchema = Yup.object().shape({
        itemName: Yup.string().required('Required'),
        batchNumber: Yup.string().required('Required'),
        location: Yup.string().required('Required'),
        qty: Yup.number().min(1, 'Min 1').required('Required'),
        purchasePrice: Yup.number().min(0, 'Min 0').required('Required'),
        openingDate: Yup.string().required('Required'),
        expiryDate: Yup.string().nullable(),
    });
    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            const finalValues = {
                ...values,
                amount: Number(values.qty) * Number(values.rp),
                expiryDate: values.expiryDate === "" ? null : values.expiryDate
            };

            if (isEditMode) {
                const oldQty = Number(editData.qty) || 0;
                const newQty = Number(values.qty) || 0;
                const qtyDifference = newQty - oldQty;

                const { error: stockError } = await supabase
                    .from('opening_stocks')
                    .update(finalValues)
                    .eq('id', editData.id);

                if (stockError) throw stockError;

                if (qtyDifference !== 0) {
                    const { data: currentProduct } = await supabase
                        .from('products')
                        .select('current_stock')
                        .eq('product_name', values.itemName)
                        .single();

                    if (currentProduct) {
                        await supabase
                            .from('products')
                            .update({ current_stock: (Number(currentProduct.current_stock) || 0) + qtyDifference })
                            .eq('product_name', values.itemName);
                    }

                    const { data: locStock } = await supabase
                        .from('warehouse_inventory')
                        .select('id, quantity')
                        .ilike('product_name', values.itemName)
                        .ilike('warehouse_name', values.location)
                        .maybeSingle();

                    if (locStock) {
                        await supabase
                            .from('warehouse_inventory')
                            .update({ quantity: (Number(locStock.quantity) || 0) + qtyDifference })
                            .eq('id', locStock.id);
                    } else {
                        await supabase
                            .from('warehouse_inventory')
                            .insert([{ product_name: values.itemName, warehouse_name: values.location, quantity: newQty }]);
                    }
                }

                toast.success('Stock profile updated and warehouse partitions synchronized!');
                navigate('/Inventory/OpeningStock/List');

            } else {
                const { error: stockError } = await supabase
                    .from('opening_stocks')
                    .insert([finalValues]);

                if (stockError) throw stockError;

                const { data: currentProduct } = await supabase
                    .from('products')
                    .select('current_stock')
                    .eq('product_name', values.itemName)
                    .single();

                if (currentProduct) {
                    await supabase
                        .from('products')
                        .update({ current_stock: (Number(currentProduct.current_stock) || 0) + Number(values.qty) })
                        .eq('product_name', values.itemName);
                }

                const { data: locStock } = await supabase
                    .from('warehouse_inventory')
                    .select('id, quantity')
                    .ilike('product_name', values.itemName)
                    .ilike('warehouse_name', values.location)
                    .maybeSingle();

                if (locStock) {
                    await supabase
                        .from('warehouse_inventory')
                        .update({ quantity: (Number(locStock.quantity) || 0) + Number(values.qty) })
                        .eq('id', locStock.id);
                } else {
                    await supabase
                        .from('warehouse_inventory')
                        .insert([{ product_name: values.itemName, warehouse_name: values.location, quantity: Number(values.qty) }]);
                }

                toast.success('Opening stock initialized and warehouse quantity updated successfully!');
                navigate('/Inventory/OpeningStock/List');
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateUniqueStockNo = () => {
        const timestamp = Date.now().toString().slice(-6);
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        return `STK-${timestamp}-${randomCode}`;
    };
    return (
        <div className="mx-auto max-w-270 text-black dark:text-bodydark text-xs">
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
                    <h3 className="font-medium text-black dark:text-white text-base">
                        {isEditMode ? `Modify Stock: ${editData.stockNo}` : 'Initialize Opening Stock'}
                    </h3>
                    <span onClick={() => navigate('/Inventory/OpeningStock/List')} className="text-sm text-primary font-medium hover:underline cursor-pointer">
                        {isEditMode ? '← Back to List' : '👁 See List'}
                    </span>
                </div>

                <Formik
                    initialValues={useMemo(() => (editData ? {
                        stockNo: editData.stockNo || '',
                        skuCode: editData.skuCode || editData.item_code || '',
                        itemName: editData.itemName || editData.product_name || '',
                        batchNumber: editData.batchNumber || editData.batch_number || '',
                        location: editData.location || '',
                        qty: editData.qty || editData.quantity || 1,
                        purchasePrice: editData.purchasePrice || editData.purchase_price || editData.rate || editData.rp || 0,
                        amount: editData.amount || editData.total_amount || 0,
                        openingDate: editData.openingDate || editData.opening_date || new Date().toISOString().split('T')[0],
                        expiryDate: editData.expiryDate || editData.expiry_date || ''
                    } : {
                        stockNo: generateUniqueStockNo(),
                        skuCode: '',
                        itemName: '', 
                        batchNumber: '', 
                        location: '',
                        qty: 1, 
                        purchasePrice: 0, 
                        amount: 0,
                        openingDate: new Date().toISOString().split('T')[0],
                        expiryDate: ''
                    }), [editData])}
                    enableReinitialize={false}
                    validationSchema={validationSchema}
                    onSubmit={async (values) => {
                        setLoading(true);
                        try {
                            const unitCost = Number(values.purchasePrice) || 0;
                            const quantity = Number(values.qty) || 0;
                            const totalValuation = quantity * unitCost;

                            const finalValues = {
                                stockNo: values.stockNo,
                                skuCode: values.skuCode,
                                item_code: values.skuCode,
                                itemName: values.itemName,
                                product_name: values.itemName,
                                batchNumber: values.batchNumber,
                                location: values.location,
                                qty: quantity,
                                quantity: quantity,
                                purchase_price: unitCost,
                                rate: unitCost,
                                amount: totalValuation,
                                total_amount: totalValuation,
                                openingDate: values.openingDate,
                                expiryDate: values.expiryDate === "" ? null : values.expiryDate
                            };

                            if (isEditMode) {
                                const oldQty = Number(editData.qty || editData.quantity) || 0;
                                const newQty = quantity;
                                const qtyDifference = newQty - oldQty;

                                const { error: stockError } = await supabase
                                    .from('opening_stocks')
                                    .update(finalValues)
                                    .eq('id', editData.id);

                                if (stockError) throw stockError;

                                if (qtyDifference !== 0) {
                                    const { data: currentProduct } = await supabase
                                        .from('products')
                                        .select('current_stock')
                                        .eq('product_name', values.itemName)
                                        .single();

                                    if (currentProduct) {
                                        await supabase
                                            .from('products')
                                            .update({ current_stock: (Number(currentProduct.current_stock) || 0) + qtyDifference })
                                            .eq('product_name', values.itemName);
                                    }

                                    const { data: locStock } = await supabase
                                        .from('warehouse_inventory')
                                        .select('id, quantity')
                                        .ilike('product_name', values.itemName)
                                        .ilike('warehouse_name', values.location)
                                        .maybeSingle();

                                    if (locStock) {
                                        await supabase
                                            .from('warehouse_inventory')
                                            .update({ quantity: (Number(locStock.quantity) || 0) + qtyDifference })
                                            .eq('id', locStock.id);
                                    } else {
                                        await supabase
                                            .from('warehouse_inventory')
                                            .insert([{ product_name: values.itemName, warehouse_name: values.location, quantity: newQty }]);
                                    }
                                }

                                toast.success('Opening stock updated successfully!');
                                navigate('/Inventory/OpeningStock/List');

                            } else {
                                const { error: stockError } = await supabase
                                    .from('opening_stocks')
                                    .insert([finalValues]);

                                if (stockError) throw stockError;

                                const { data: currentProduct } = await supabase
                                    .from('products')
                                    .select('current_stock')
                                    .eq('product_name', values.itemName)
                                    .single();

                                if (currentProduct) {
                                    await supabase
                                        .from('products')
                                        .update({ current_stock: (Number(currentProduct.current_stock) || 0) + quantity })
                                        .eq('product_name', values.itemName);
                                }

                                const { data: locStock } = await supabase
                                    .from('warehouse_inventory')
                                    .select('id, quantity')
                                    .ilike('product_name', values.itemName)
                                    .ilike('warehouse_name', values.location)
                                    .maybeSingle();

                                if (locStock) {
                                    await supabase
                                        .from('warehouse_inventory')
                                        .update({ quantity: (Number(locStock.quantity) || 0) + quantity })
                                        .eq('id', locStock.id);
                                } else {
                                    await supabase
                                        .from('warehouse_inventory')
                                        .insert([{ product_name: values.itemName, warehouse_name: values.location, quantity: quantity }]);
                                }

                                toast.success('Opening stock initialized successfully!');
                                navigate('/Inventory/OpeningStock/List');
                            }
                        } catch (err: any) {
                            toast.error('Operation Failed: ' + err.message);
                        } finally {
                            setLoading(false);
                        }
                    }}
                >
                    {({ handleChange, setFieldValue, values, errors, touched }) => {
                        const calculatedAmount = (Number(values.qty || 0) * Number(values.purchasePrice || 0)).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                        return (
                            <Form className="p-6.5 space-y-6">
                                <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">Stock Number (Auto Generated)</label>
                                        <input name="stockNo" readOnly value={values.stockNo} className="w-full rounded border border-stroke bg-gray-50 dark:bg-meta-4/10 px-3 h-10 text-xs font-bold outline-none text-black dark:text-white" />
                                    </div>

                                    {/* 1. SKU Code Typeable Search with Custom Full-Width Dropdown */}
                                    <div className="relative" ref={skuDropdownRef}>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">SKU Code (Search & Auto-Select)</label>
                                        {(() => {
                                            const filteredProds = products.filter(p => {
                                                if (!values.skuCode) return true;
                                                const query = values.skuCode.toLowerCase().trim();
                                                const sku = (p.item_sr_no || `SKU-${p.id}`).toLowerCase();
                                                const name = (p.product_name || '').toLowerCase();
                                                return sku.includes(query) || name.includes(query);
                                            });

                                            return (
                                                <>
                                                    <input
                                                        type="text"
                                                        name="skuCode"
                                                        autoComplete="off"
                                                        value={values.skuCode || ''}
                                                        onFocus={() => {
                                                            setShowSkuDropdown(true);
                                                            setHighlightedSkuIndex(0);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                setHighlightedSkuIndex((prev) => 
                                                                    prev < filteredProds.length - 1 ? prev + 1 : 0
                                                                );
                                                            } else if (e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                setHighlightedSkuIndex((prev) => 
                                                                    prev > 0 ? prev - 1 : filteredProds.length - 1
                                                                );
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (filteredProds.length > 0) {
                                                                    const selected = filteredProds[highlightedSkuIndex] || filteredProds[0];
                                                                    const displaySku = selected.item_sr_no || `SKU-${selected.id}`;
                                                                    setFieldValue('skuCode', displaySku);
                                                                    setFieldValue('itemName', selected.product_name);
                                                                    setFieldValue('purchasePrice', selected.purchase_price || 0);
                                                                    setShowSkuDropdown(false);
                                                                }
                                                            } else if (e.key === 'Tab' || e.key === 'Escape') {
                                                                setShowSkuDropdown(false);
                                                            }
                                                        }}
                                                        onChange={(e) => {
                                                            const typed = e.target.value;
                                                            setFieldValue('skuCode', typed);
                                                            setShowSkuDropdown(true);
                                                            setHighlightedSkuIndex(0);

                                                            // Only auto-fill if the user has typed the EXACT FULL SKU code (e.g. SKU-002)
                                                            const matched = products.find(
                                                                p => p.item_sr_no && p.item_sr_no.toLowerCase() === typed.trim().toLowerCase()
                                                            );
                                                            if (matched) {
                                                                setFieldValue('itemName', matched.product_name);
                                                                setFieldValue('purchasePrice', matched.purchase_price || 0);
                                                            }
                                                        }}
                                                        placeholder="Type or select SKU Code..."
                                                        className="w-full rounded border border-stroke px-3 h-10 bg-transparent text-xs font-mono font-bold outline-none focus:border-primary dark:bg-boxdark text-black dark:text-white uppercase"
                                                    />

                                                    {/* FULL WIDTH MODERN DROPDOWN */}
                                                    {showSkuDropdown && (
                                                        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-[290px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A222C] shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                                                            {filteredProds.map((p, pIdx) => {
                                                                const displaySku = p.item_sr_no || `SKU-${p.id}`;
                                                                const isHighlighted = pIdx === highlightedSkuIndex;
                                                                return (
                                                                    <div
                                                                        key={p.id}
                                                                        onMouseEnter={() => setHighlightedSkuIndex(pIdx)}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
                                                                            setFieldValue('skuCode', displaySku);
                                                                            setFieldValue('itemName', p.product_name);
                                                                            setFieldValue('purchasePrice', p.purchase_price || 0);
                                                                            setShowSkuDropdown(false);
                                                                        }}
                                                                        className={`p-3 cursor-pointer transition flex items-center justify-between group ${
                                                                            isHighlighted
                                                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500'
                                                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                                                                        }`}
                                                                    >
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="font-mono font-bold text-xs text-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                                                                {displaySku}
                                                                            </span>
                                                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                                                                {p.product_name}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right font-mono text-[11px] text-slate-400 dark:text-slate-500">
                                                                            Cost: <span className="font-bold text-slate-800 dark:text-white">Rs. {Number(p.purchase_price || 0).toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {filteredProds.length === 0 && (
                                                                <div className="p-4 text-center text-xs text-slate-400 italic">
                                                                    No matching products or SKUs found
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">Item Name (Product) *</label>
                                        <select
                                            name="itemName"
                                            value={values.itemName}
                                            onChange={(e) => {
                                                const selectedProd = products.find(p => p.product_name === e.target.value);
                                                setFieldValue('itemName', e.target.value);
                                                if (selectedProd) {
                                                    setFieldValue('skuCode', selectedProd.item_sr_no || `SKU-${selectedProd.id}`);
                                                    setFieldValue('purchasePrice', selectedProd.purchase_price || 0);
                                                }
                                            }}
                                            className={`w-full rounded border px-3 h-10 bg-transparent text-xs font-bold outline-none focus:border-primary dark:bg-boxdark text-black dark:text-white ${touched.itemName && errors.itemName ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                        >
                                            <option value="" className="dark:bg-boxdark">-- Select Existing Product --</option>
                                            {products.map((p) => <option key={p.id} value={p.product_name} className="dark:bg-boxdark">{p.product_name}</option>)}
                                        </select>
                                        {touched.itemName && errors.itemName && <p className="text-red-500 text-[10px] mt-1 font-semibold">{String(errors.itemName)}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">Batch Number *</label>
                                        <input name="batchNumber" onChange={handleChange} value={values.batchNumber} placeholder="e.g., BN-001" className={`w-full rounded border px-3 h-10 bg-transparent text-xs text-black dark:text-white ${touched.batchNumber && errors.batchNumber ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} />
                                        {touched.batchNumber && errors.batchNumber && <p className="text-red-500 text-[10px] mt-1 font-semibold">{String(errors.batchNumber)}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">Location / Warehouse *</label>
                                        <select
                                            name="location"
                                            onChange={handleChange}
                                            value={values.location}
                                            className={`w-full rounded border px-3 h-10 bg-transparent text-xs font-bold outline-none focus:border-primary dark:bg-boxdark text-black dark:text-white ${touched.location && errors.location ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                        >
                                            <option value="" className="dark:bg-boxdark">-- Select Warehouse --</option>
                                            {locations.map((loc) => {
                                                const label = loc.name || loc.locationName || loc.location_name;
                                                return <option key={loc.id} value={label} className="dark:bg-boxdark">{label}</option>;
                                            })}
                                        </select>
                                        {touched.location && errors.location && <p className="text-red-500 text-[10px] mt-1 font-semibold">{String(errors.location)}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">Opening Stock Quantity *</label>
                                        <input type="number" name="qty" min="1" onKeyDown={blockInvalidChar} onChange={handleChange} value={values.qty} className={`w-full rounded border px-3 h-10 bg-transparent text-xs text-right font-bold text-black dark:text-white ${touched.qty && errors.qty ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} />
                                        {touched.qty && errors.qty && <p className="text-red-500 text-[10px] mt-1 font-semibold">{String(errors.qty)}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">Purchase Price / Unit Cost (PKR) *</label>
                                        <input type="number" name="purchasePrice" min="0" onKeyDown={blockInvalidChar} onChange={handleChange} value={values.purchasePrice} className={`w-full rounded border px-3 h-10 bg-slate-50/50 dark:bg-meta-4/20 text-xs text-right font-mono font-bold text-black dark:text-white ${touched.purchasePrice && errors.purchasePrice ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} />
                                        {touched.purchasePrice && errors.purchasePrice && <p className="text-red-500 text-[10px] mt-1 font-semibold">{String(errors.purchasePrice)}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">Opening Date *</label>
                                        <input type="date" name="openingDate" onChange={handleChange} value={values.openingDate} className={`w-full rounded border px-3 h-10 bg-transparent text-xs text-black dark:text-white ${touched.openingDate && errors.openingDate ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} />
                                        {touched.openingDate && errors.openingDate && <p className="text-red-500 text-[10px] mt-1 font-semibold">{String(errors.openingDate)}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold text-gray-500">Expiry Date (Optional)</label>
                                        <input type="date" name="expiryDate" onChange={handleChange} value={values.expiryDate || ''} className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-transparent text-xs text-black dark:text-white" />
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col md:flex-row justify-between items-center bg-gray-50 dark:bg-meta-4/20 p-4 rounded border border-stroke dark:border-strokedark">
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Total Valuation Asset Amount (PKR):</span>
                                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                                        Rs. {calculatedAmount}
                                    </span>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-stroke dark:border-strokedark">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/Inventory/OpeningStock/List')}
                                        className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                                    >
                                        {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Stock' : 'Save Stock'}</span>}
                                    </button>
                                </div>
                            </Form>
                        );
                    }}
                </Formik>
            </div>
        </div>
    );
};

export default AddOpeningStock;
