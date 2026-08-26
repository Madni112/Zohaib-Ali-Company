import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { MdSquareFoot, MdViewModule, MdAttachMoney, MdLayers } from 'react-icons/md';

interface UomItem {
  id: number;
  short_code: string;
  full_name: string;
  category: string;
  is_active: boolean;
}

const AddProduct = () => {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);
  
  // Master database lists
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [surfaceFinishes, setSurfaceFinishes] = useState<any[]>([]);
  const [groupedUoms, setGroupedUoms] = useState<{ [key: string]: UomItem[] }>({});

  const location = useLocation();
  const navigate = useNavigate();

  const editData = location.state?.product;
  const isEditMode = !!editData;

  useEffect(() => {
    const fetchAllMasterMetadata = async () => {
      try {
        setMetadataLoading(true);
        const activeTenant = tenantId || 'bashir';
        
        const { data: catData } = await supabase
          .from('inventory_categories')
          .select('id, name')
          .order('name', { ascending: true });
        const { data: brandData } = await supabase
          .from('inventory_brands')
          .select('id, name')
          .order('name', { ascending: true });
        
        try {
          const { data: finishData } = await supabase
            .from('inventory_surface_finishes')
            .select('id, name')
            .order('name', { ascending: true });
          if (finishData && finishData.length > 0) {
            setSurfaceFinishes(finishData);
          } else {
            const local = localStorage.getItem('zac_surface_finishes');
            if (local) setSurfaceFinishes(JSON.parse(local));
          }
        } catch (e) {
          const local = localStorage.getItem('zac_surface_finishes');
          if (local) setSurfaceFinishes(JSON.parse(local));
        }

        const { data: uomData } = await supabase
          .from('inventory_uom')
          .select('*')
          .eq('tenant_id', activeTenant)
          .eq('is_active', true)
          .order('category', { ascending: true })
          .order('short_code', { ascending: true });

        if (catData) setCategories(catData);
        if (brandData) setBrands(brandData);
        
        if (uomData) {
          const groups = uomData.reduce((acc: { [key: string]: UomItem[] }, curr: UomItem) => {
            if (!acc[curr.category]) acc[curr.category] = [];
            acc[curr.category].push(curr);
            return acc;
          }, {});
          setGroupedUoms(groups);
        }
      } catch (err: any) {
        console.error('Metadata aggregation error: ', err.message);
        toast.error('Failed to load setup configurations');
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchAllMasterMetadata();
  }, []);

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) => 
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  if (metadataLoading) {
    return (
      <div className="flex h-48 items-center justify-center bg-white dark:bg-boxdark rounded-2xl border border-stroke dark:border-strokedark">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12 font-sans">
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#111827] overflow-hidden">
        
        {/* HEADER BAR */}
        <div className="border-b border-slate-100 py-4.5 px-6.5 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              {isEditMode ? `Edit Product: ${editData.product_name}` : 'Add New Product Master Item'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select category to automatically load product or tile-specific dimension & packaging fields
            </p>
          </div>
          <button
            onClick={() => navigate('/Administration/Products/List')}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            ← Back to List
          </button>
        </div>

        <Formik
          initialValues={editData ? {
            productName: editData.product_name || '',
            category: editData.category || '',
            brand: editData.brand || '',
            uom: editData.uom || 'PCS',
            productDescription: editData.product_description || '',
            profit: editData.profit || 0,
            purchasePrice: editData.purchase_price || 0,
            scenarioName: editData.scenario_name || '',
            mrp: editData.mrp || editData.retail_price || 0,
            retailPrice: editData.retail_price || 0,
            minStockAlert: editData.min_stock_alert !== undefined && editData.min_stock_alert !== null ? editData.min_stock_alert : '',
            hsCode: editData.hs_code || '',
            itemSrNo: editData.item_sr_no || '',
            sroScheduleNo: editData.sro_schedule_no || '',
            // Tile specific fields
            tileHeight: 60,
            tileWidth: 60,
            tileThickness: '',
            piecesPerBox: (() => {
              const raw = Number(editData.pieces_per_box || editData.pcs_per_box || editData.pieces_per_packing || 0);
              if (raw > 1) return raw;
              // Fallback to extract from product_description e.g. "Box: 10 pcs"
              const match = String(editData.product_description || '').match(/Box:\s*(\d+)\s*pcs/i);
              if (match && Number(match[1]) > 0) return Number(match[1]);
              return raw > 0 ? raw : 4;
            })(),
            finishType: 'Glazed Polished',
            weightPerBox: 28,
          } : {
            productName: '',
            category: '',
            brand: '',
            uom: '',
            productDescription: '',
            profit: 0,
            purchasePrice: '',
            scenarioName: '',
            mrp: '',
            retailPrice: '',
            minStockAlert: '',
            hsCode: '',
            itemSrNo: '',
            sroScheduleNo: '',
            // Tile specific defaults
            tileHeight: 60,
            tileWidth: 60,
            tileThickness: '',
            piecesPerBox: 4,
            finishType: 'Glazed Polished',
            weightPerBox: 28,
          }}
          enableReinitialize={true}
          validationSchema={Yup.object().shape({
            productName: Yup.string().required('Product Name is required'),
            category: Yup.string().required('Category is required'),
            purchasePrice: Yup.number().typeError('Must be a number').min(0).required('Required'),
            retailPrice: Yup.number().typeError('Must be a number').min(0).required('Required'),
            minStockAlert: Yup.number().typeError('Must be a valid quantity number').min(0, 'Cannot be negative').nullable(),
          })}
          onSubmit={async (values) => {
            setLoading(true);
            const isTileCategory = String(values.category || '').trim().toLowerCase().includes('tile');
            const computedProfit = (Number(values.retailPrice) || 0) - (Number(values.purchasePrice) || 0);

            let finalDescription = values.productDescription?.trim() || '';
            let finalUom = values.uom;
            let finalHsCode = values.hsCode?.trim() || '';
            let finalItemSrNo = values.itemSrNo?.trim() || '';
            const pcs = Number(values.piecesPerBox) || 1;

            if (isTileCategory) {
              const h = Number(values.tileHeight) || 0;
              const w = Number(values.tileWidth) || 0;
              const sqMetersPerTile = (h * w) / 10000;
              const totalSqMetersPerBox = sqMetersPerTile * pcs;
              const tileSizeFormatted = `${h} × ${w} cm`;

              finalDescription = `[TILE PRODUCT] Size: ${tileSizeFormatted} | Box: ${pcs} pcs (${totalSqMetersPerBox.toFixed(2)} sq.m / box) | Finish: ${values.finishType}${values.tileThickness ? ` | Thickness: ${values.tileThickness}` : ''}${values.weightPerBox ? ` | Wt: ${values.weightPerBox}kg` : ''}${values.productDescription ? ` — ${values.productDescription}` : ''}`;
              finalUom = values.uom || 'BOX';
              finalHsCode = values.hsCode?.trim() || '6907.2100';
              finalItemSrNo = values.itemSrNo?.trim() || tileSizeFormatted;
            }

            const databasePayload = {
              product_name: values.productName.trim(),
              category: values.category,
              brand: values.brand,
              uom: finalUom || 'PCS',
              product_description: finalDescription,
              profit: computedProfit,
              purchase_price: Number(values.purchasePrice) || 0,
              scenario_name: values.scenarioName || (isTileCategory ? 'Tile Metric' : ''),
              mrp: Number(values.mrp) || Number(values.retailPrice) || 0,
              retail_price: Number(values.retailPrice) || 0,
              min_stock_alert: values.minStockAlert !== '' && values.minStockAlert !== null ? Number(values.minStockAlert) : 0,
              pieces_per_box: pcs,
              pcs_per_box: pcs,
              pieces_per_packing: pcs,
              hs_code: finalHsCode,
              item_sr_no: finalItemSrNo,
              sro_schedule_no: values.sroScheduleNo?.trim() || '',
            };

            try {
              // 🔍 SKU Uniqueness Validation: Prevent duplicate SKU codes
              if (finalItemSrNo) {
                let skuQuery = supabase
                  .from('products')
                  .select('id, product_name, item_sr_no')
                  .ilike('item_sr_no', finalItemSrNo.trim());

                if (isEditMode && editData?.id) {
                  skuQuery = skuQuery.neq('id', editData.id);
                }

                const { data: existingSku, error: skuCheckError } = await skuQuery;
                if (skuCheckError) console.warn('SKU Check warning:', skuCheckError);

                if (existingSku && existingSku.length > 0) {
                  toast.error(`SKU Code "${finalItemSrNo}" is already assigned to "${existingSku[0].product_name}". Each product must have a unique SKU!`, {
                    duration: 5000,
                  });
                  setLoading(false);
                  return;
                }
              }

              if (isEditMode) {
                const { error } = await supabase
                  .from('products')
                  .update(databasePayload)
                  .eq('id', editData.id);

                if (error) throw error;
                toast.success('Product updated successfully!');
              } else {
                const { error } = await supabase
                  .from('products')
                  .insert([databasePayload]);

                if (error) throw error;
                toast.success('Product saved successfully!');
              }
              navigate('/Administration/Products/List');
            } catch (err: any) {
              toast.error('Database Operation Failure: ' + err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ handleChange, values, errors, touched, setFieldValue }) => {
            const isTileCategory = String(values.category || '').trim().toLowerCase().includes('tile');

            // Tile Live Calculations
            const tileH = Number(values.tileHeight) || 0;
            const tileW = Number(values.tileWidth) || 0;
            const tilePcs = Number(values.piecesPerBox) || 1;
            const sqMetersPerTile = tileH > 0 && tileW > 0 ? (tileH * tileW) / 10000 : 0;
            const totalSqMetersPerBox = sqMetersPerTile * tilePcs;
            const tileSizeFormatted = `${tileH} × ${tileW} cm`;

            const numSale = Number(values.retailPrice) || 0;
            const numPurchase = Number(values.purchasePrice) || 0;
            const numSqm = totalSqMetersPerBox > 0 ? totalSqMetersPerBox : 1;

            const salePerSqm = (numSale / numSqm).toFixed(2);
            const salePerPiece = (numSale / tilePcs).toFixed(2);
            const purchasePerSqm = (numPurchase / numSqm).toFixed(2);
            const purchasePerPiece = (numPurchase / tilePcs).toFixed(2);

            const profit = numSale - numPurchase;
            const profitMarginPercent = numPurchase > 0 ? ((profit / numPurchase) * 100).toFixed(1) : '0';

            useEffect(() => {
              setFieldValue('profit', (numSale - numPurchase).toFixed(2));
              if (isTileCategory && !values.uom) {
                setFieldValue('uom', 'BOX');
              }
            }, [numSale, numPurchase, isTileCategory, setFieldValue]);

            return (
              <Form className="p-6.5 text-xs text-slate-700 dark:text-slate-200 space-y-6">
                
                {/* 1. CORE PRODUCT ATTRIBUTES (Always visible) */}
                <div className="bg-slate-50/50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                      <MdLayers className="text-emerald-600 text-lg" />
                      <span>Product Category & Identity</span>
                    </div>
                    {isTileCategory && (
                      <span className="bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-teal-500/30 uppercase tracking-wider">
                        Tile Mode Active
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* 1. Category Selector */}
                    <div>
                      <label className="mb-1.5 block font-bold text-slate-800 dark:text-slate-100">
                        Product Category *
                      </label>
                      <select
                        name="category"
                        onChange={handleChange}
                        value={values.category}
                        className={`w-full rounded-xl border p-2.5 bg-white dark:bg-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold text-slate-900 dark:text-white ${
                          touched.category && errors.category ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                        {!categories.some(c => c.name.toLowerCase() === 'tiles' || c.name.toLowerCase() === 'tile') && (
                          <option value="Tiles">Tiles</option>
                        )}
                      </select>
                      {touched.category && errors.category && (
                        <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.category as string}</p>
                      )}
                    </div>

                    {/* 2. SKU Code (Placed right after Category) */}
                    <div>
                      <label className="mb-1.5 block font-bold text-slate-800 dark:text-slate-100">
                        SKU Code
                      </label>
                      <input
                        type="text"
                        name="itemSrNo"
                        onChange={handleChange}
                        value={values.itemSrNo}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 outline-none focus:border-emerald-600 text-xs text-slate-800 dark:text-white font-mono"
                        placeholder="Enter SKU Code"
                      />
                    </div>

                    {/* 3. Product Name */}
                    <div className="sm:col-span-2 md:col-span-1 lg:col-span-1">
                      <label className="mb-1.5 block font-bold text-slate-800 dark:text-slate-100">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        name="productName"
                        onChange={handleChange}
                        value={values.productName}
                        className={`w-full rounded-xl border p-2.5 bg-white dark:bg-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-xs text-slate-900 dark:text-white ${
                          touched.productName && errors.productName ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                        placeholder={isTileCategory ? "e.g. Master Tiles Calacatta White 60x60 (Glazed Polished)" : "Enter Product Name"}
                      />
                      {touched.productName && errors.productName && (
                        <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.productName as string}</p>
                      )}
                    </div>

                    {/* 4. Brand */}
                    <div>
                      <label className="mb-1.5 block font-bold text-slate-800 dark:text-slate-100">Brand *</label>
                      <select
                        name="brand"
                        onChange={handleChange}
                        value={values.brand}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 outline-none focus:border-emerald-600 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="">Select Brand</option>
                        {brands.map(b => (
                          <option key={b.id} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                        {isTileCategory && (
                          <>
                            {!brands.some(b => b.name === 'Master Tiles') && <option value="Master Tiles">Master Tiles</option>}
                            {!brands.some(b => b.name === 'Karam Ceramics') && <option value="Karam Ceramics">Karam Ceramics</option>}
                            {!brands.some(b => b.name === 'Sonex') && <option value="Sonex">Sonex</option>}
                            {!brands.some(b => b.name === 'Imported Porcelain') && <option value="Imported Porcelain">Imported Porcelain</option>}
                          </>
                        )}
                      </select>
                    </div>

                    {/* 5. UOM */}
                    <div>
                      <label className="mb-1.5 block font-bold text-slate-800 dark:text-slate-100">
                        {isTileCategory ? 'Inventory UOM (e.g. BOX)' : 'UOM *'}
                      </label>
                      <select
                        name="uom"
                        onChange={handleChange}
                        value={values.uom || (isTileCategory ? 'BOX' : '')}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 outline-none focus:border-emerald-600 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                      >
                        <option value="">Select UOM</option>
                        {isTileCategory && (
                          <>
                            <option value="BOX">BOX = Master Tile Box</option>
                            <option value="SQM">SQM = Square Meter</option>
                            <option value="SQFT">SQFT = Square Feet</option>
                            <option value="PCS">PCS = Pieces</option>
                          </>
                        )}
                        {Object.keys(groupedUoms).map((categoryName) => (
                          <optgroup key={categoryName} label={categoryName} className="bg-slate-100 dark:bg-slate-700 text-[10px] uppercase font-bold text-emerald-600 py-1">
                            {groupedUoms[categoryName].map((u) => (
                              <option key={u.id} value={u.short_code}>
                                {`${u.short_code} = ${u.full_name}`}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. DYNAMIC TILE SPECIFIC SECTION (Only shown when category = Tile) */}
                {isTileCategory && (
                  <div className="bg-white dark:bg-boxdark rounded-2xl border border-teal-500/30 dark:border-teal-500/20 shadow-sm p-5 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-sm">
                        <MdSquareFoot className="text-xl" />
                        <span>Tile Sizing (Centimeters) & Box Packaging Setup</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">Unit: Centimeters (cm) | Area: Square Meters (sq.m)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {/* Dimension Unit - Fixed Static */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                          Dimension Unit
                        </label>
                        <input
                          type="text"
                          readOnly
                          value="Centimeters (cm)"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-100 dark:bg-slate-800 outline-none text-xs font-bold text-teal-700 dark:text-teal-400 cursor-not-allowed"
                        />
                      </div>

                      {/* Height (cm) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                          Tile Height (cm) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          name="tileHeight"
                          value={values.tileHeight}
                          onChange={handleChange}
                          placeholder="e.g. 60"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-50/50 dark:bg-slate-800/80 outline-none focus:border-teal-600 text-xs font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Width (cm) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                          Tile Width (cm) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          name="tileWidth"
                          value={values.tileWidth}
                          onChange={handleChange}
                          placeholder="e.g. 60 or 120"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-50/50 dark:bg-slate-800/80 outline-none focus:border-teal-600 text-xs font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Pieces Per Box */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                          Pieces Per Box *
                        </label>
                        <input
                          type="number"
                          min="1"
                          name="piecesPerBox"
                          value={values.piecesPerBox}
                          onChange={handleChange}
                          placeholder="e.g. 4"
                          className="w-full rounded-xl border border-teal-500/50 dark:border-teal-500/50 p-2.5 bg-teal-50/30 dark:bg-teal-950/20 outline-none focus:border-teal-600 text-xs font-mono font-black text-teal-800 dark:text-teal-300"
                        />
                      </div>

                      {/* Thickness (Optional) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                          Thickness <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          name="tileThickness"
                          value={values.tileThickness}
                          onChange={handleChange}
                          placeholder="e.g. 9 mm"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-50/50 dark:bg-slate-800/80 outline-none focus:border-teal-600 text-xs text-slate-800 dark:text-white"
                        />
                      </div>

                      {/* Surface Finish */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                          Surface Finish
                        </label>
                        <select
                          name="finishType"
                          value={values.finishType}
                          onChange={handleChange}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-50/50 dark:bg-slate-800/80 outline-none focus:border-teal-600 text-xs text-slate-800 dark:text-slate-200"
                        >
                          {surfaceFinishes.length > 0 ? (
                            surfaceFinishes.map((f: any) => (
                              <option key={f.id} value={f.name}>
                                {f.name}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="Glazed Polished">Glazed Polished (High Gloss)</option>
                              <option value="Super White Matte">Matte / Satin Finish</option>
                              <option value="Carving / Sugar">Carving / Sugar Finish</option>
                              <option value="Rustic Anti-Slip">Rustic / Anti-Slip</option>
                              <option value="Wooden Planks">Wooden Grain Finish</option>
                              <option value="Full Body Porcelain">Full Body Porcelain</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* LIVE COMPUTED SQUARE METER BADGES */}
                    <div className="bg-teal-50 dark:bg-teal-950/40 rounded-xl p-4 border border-teal-200 dark:border-teal-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📐</span>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Formatted Tile Size:</span>
                          <strong className="text-teal-800 dark:text-teal-300 font-bold text-sm">{tileSizeFormatted}</strong>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Area per Tile:</span>
                        <strong className="text-slate-900 dark:text-white font-mono font-bold text-sm">
                          {sqMetersPerTile.toFixed(4)} sq.m
                        </strong>
                      </div>

                      <div className="bg-white dark:bg-slate-900 px-5 py-2.5 rounded-xl border border-teal-300 dark:border-teal-700 shadow-xs">
                        <span className="text-teal-600 dark:text-teal-400 block text-[10px] font-bold uppercase tracking-wider">
                          Total Coverage Per Box:
                        </span>
                        <strong className="text-teal-800 dark:text-teal-300 font-mono font-black text-lg">
                          {totalSqMetersPerBox.toFixed(2)} sq.m
                        </strong>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono ml-2">
                          / Box
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. NON-TILE FIELDS (Only shown for regular products) */}
                {!isTileCategory && (
                  <div className="bg-slate-50/30 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <div>
                      <label className="mb-1.5 block font-bold text-slate-800 dark:text-slate-100">Product Description</label>
                      <input
                        type="text"
                        name="productDescription"
                        onChange={handleChange}
                        value={values.productDescription}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 outline-none focus:border-emerald-600 text-xs text-slate-800 dark:text-white"
                        placeholder="Enter Description details"
                      />
                    </div>
                  </div>
                )}

                {/* 4. PRICING SECTION (Clean Purchase Price & Sale Price) */}
                <div className="bg-white dark:bg-boxdark rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                      <MdAttachMoney className="text-emerald-600 text-xl" />
                      <span>{isTileCategory ? 'Tile Box Pricing & Rate Breakdown' : 'Product Pricing & Margin'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-semibold">Calculated Margin:</span>
                      <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        +{profitMarginPercent}% (Rs. {profit.toFixed(2)}/{isTileCategory ? 'box' : (values.uom || 'unit')})
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {/* Purchase Price Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                        {isTileCategory ? 'Purchase Price (Per Box) *' : 'Purchase Price *'}
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        name="purchasePrice"
                        onKeyDown={blockInvalidChar}
                        value={values.purchasePrice}
                        onChange={handleChange}
                        placeholder="0.00"
                        className={`w-full rounded-xl border p-3 bg-slate-50/50 dark:bg-slate-800/80 outline-none focus:border-emerald-600 text-sm font-mono font-bold text-slate-900 dark:text-white ${
                          touched.purchasePrice && errors.purchasePrice ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      {isTileCategory && (
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] mt-2 font-mono">
                          <span className="bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/60 dark:border-slate-600">
                            ≈ Rs. {purchasePerPiece} <span className="text-[10px] text-slate-500 font-normal">/ tile (pc)</span>
                          </span>
                          <span className="text-slate-500">
                            ≈ Rs. {purchasePerSqm} / sq.m
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sale Price Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                        {isTileCategory ? 'Sale Price (Per Box) *' : 'Sale Price (Retail Rate) *'}
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        name="retailPrice"
                        onKeyDown={blockInvalidChar}
                        value={values.retailPrice}
                        onChange={handleChange}
                        placeholder="0.00"
                        className={`w-full rounded-xl border p-3 bg-emerald-50/20 dark:bg-emerald-950/20 outline-none focus:border-emerald-600 text-sm font-mono font-black text-emerald-700 dark:text-emerald-300 ${
                          touched.retailPrice && errors.retailPrice ? 'border-rose-500' : 'border-emerald-500/50 dark:border-emerald-500/50'
                        }`}
                      />
                      {isTileCategory && (
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] mt-2 font-mono">
                          <span className="bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/60 dark:border-emerald-700/60">
                            ≈ Rs. {salePerPiece} <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">/ tile (loose pc)</span>
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            ≈ Rs. {salePerSqm} / sq.m
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Minimum Stock Alert Input (Optional) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center justify-between">
                        <span>Minimum Stock Alert</span>
                        <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="minStockAlert"
                        onKeyDown={blockInvalidChar}
                        value={values.minStockAlert}
                        onChange={handleChange}
                        placeholder={isTileCategory ? "e.g. 20 (Boxes)" : "e.g. 10 (Units)"}
                        className={`w-full rounded-xl border p-3 bg-slate-50/50 dark:bg-slate-800/80 outline-none focus:border-amber-500 text-sm font-mono font-bold text-slate-900 dark:text-white ${
                          touched.minStockAlert && errors.minStockAlert ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                        Turns stock count <span className="text-rose-500 font-bold">RED</span> when remaining inventory hits or drops below this quantity.
                      </p>
                    </div>
                  </div>
                </div>

                {/* FORM ACTIONS */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/Administration/Products/List')}
                    className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                  >
                    {loading ? <Spinner /> : <MdViewModule className="text-base" />}
                    <span>{isEditMode ? 'Update Product' : isTileCategory ? 'Save Tile Product' : 'Save Product'}</span>
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

export default AddProduct;
