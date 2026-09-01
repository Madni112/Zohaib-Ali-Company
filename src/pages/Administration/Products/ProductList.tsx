import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdSearch, MdAdd, MdWarning, MdClose, MdInfoOutline } from 'react-icons/md';
import TableActions from '../../../ui/TableActions';

const ProductList = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStockBreakdown, setSelectedStockBreakdown] = useState<any | null>(null);
  const [selectedModalWarehouse, setSelectedModalWarehouse] = useState<string>('ALL');
  const [masterLocations, setMasterLocations] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchInventoryProducts();
  }, []);


  const fetchInventoryProducts = async () => {
    try {
      setLoading(true);

      // Query products
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: baseProducts, error } = await query;

      if (error) throw error;

      if (baseProducts && baseProducts.length > 0) {
        const { data: openStocks } = await supabase.from('opening_stocks').select('*');
        const { data: purchases } = await supabase.from('supplier_purchases').select('items, payment_term, metadata');
        const { data: sales } = await supabase.from('sales_invoices').select('items, sale_status, receipt_status');
        const { data: sReturns } = await supabase.from('sales_returns').select('*');
        const { data: pReturns } = await supabase.from('purchase_returns').select('*');
        const { data: deliveryChallans } = await supabase.from('delivery_challans').select('*').order('created_at', { ascending: false });
        const { data: grnReceipts } = await supabase.from('grn_receipts').select('*, grn_items(*)');
        const { data: locationsMaster } = await supabase.from('inventory_locations').select('name');

        if (locationsMaster) {
          setMasterLocations(locationsMaster.map(l => String(l.name).trim()));
        }

        const unifiedProductPayload = baseProducts.map(product => {
          const name = String(product.product_name || '').trim().toLowerCase();

          const whBreakdowns: Record<string, any> = {};
          const getWh = (whName: string) => {
            const key = String(whName || 'Global / Unassigned').trim();
            if (!whBreakdowns[key]) {
              whBreakdowns[key] = { opening: 0, purchased: 0, sold: 0, salesReturned: 0, purchaseReturned: 0, hold: 0 };
            }
            return whBreakdowns[key];
          };

          // 1. Opening stock calculation
          let totalOpening = 0;
          (openStocks || []).forEach((os: any) => {
            const osName = String(os.product_name || os.item_name || os.itemName || os.item_details || os.itemDetails || '').trim().toLowerCase();
            if (osName === name || osName.includes(name) || name.includes(osName)) {
              const qty = Number(os.quantity || os.qty || 0);
              totalOpening += qty;
              getWh(os.location || 'Global / Unassigned').opening += qty;
            }
          });

          // 2. Purchased stock calculation
          let totalPurchased = 0;
          (purchases || []).forEach((p: any) => {
            const termClean = String(p.payment_term || '').trim().toLowerCase();
            // Skip purchases that have a linked GRN to prevent double-counting (the physical stock is counted in GRN calculation)
            if (termClean !== 'cancel' && termClean !== 'deleted' && termClean !== 'draft' && !p.metadata?.grn_id) {
              const itemsArray = Array.isArray(p.items) ? p.items : JSON.parse(p.items || '[]');
              itemsArray.forEach((item: any) => {
                const pName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                if (pName === name || pName.includes(name)) {
                  const qty = Number(item.qty || item.quantity || 0);
                  totalPurchased += qty;
                  getWh(item.warehouse || item.location || p.receiving_warehouse || p.warehouse || 'Global / Unassigned').purchased += qty;
                }
              });
            }
          });

          // 2.5 GRN stock calculation
          (grnReceipts || []).forEach((grn: any) => {
            if (grn.status === 'Confirm' || grn.status === 'Partially Received' || grn.status === 'Billed') {
              (grn.grn_items || []).forEach((item: any) => {
                const pName = String(item.product_name || '').trim().toLowerCase();
                if (pName === name || pName.includes(name)) {
                  // Only add stock if there's an accepted_qty (from QC) or fallback to qty for non-QC'd confirm
                  const qty = Number(item.accepted_qty ?? item.qty ?? 0);
                  totalPurchased += qty;
                  getWh(item.warehouse_name || 'Global / Unassigned').purchased += qty;
                }
              });
            }
          });

          // 3. Sold stock calculation
          let totalSold = 0;
          (sales || []).forEach((s: any) => {
            const statusClean = String(s.sale_status || '').trim().toLowerCase();
            if (statusClean !== 'cancel' && statusClean !== 'deleted') {
              const itemsArray = Array.isArray(s.items) ? s.items : JSON.parse(s.items || '[]');
              itemsArray.forEach((item: any) => {
                const sName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                if (sName === name || sName.includes(name)) {
                  const qty = Number(item.qty || item.quantity || 0);
                  totalSold += qty;
                  getWh(item.warehouse || item.location || s.dispatch_warehouse || s.warehouse || 'Global / Unassigned').sold += qty;
                }
              });
            }
          });

          // 4. Sales returns calculation (Stock coming back into warehouse)
          let totalSalesReturned = 0;
          (sReturns || []).forEach((sr: any) => {
            if (String(sr.status || '').trim().toLowerCase() !== 'cancel') {
              const itemsArray = Array.isArray(sr.items) ? sr.items : JSON.parse(sr.items || '[]');
              itemsArray.forEach((item: any) => {
                const srName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                if (srName === name || srName.includes(name)) {
                  const qty = Number(item.qty || item.quantity || 0);
                  totalSalesReturned += qty;
                  getWh(item.warehouse || item.location || sr.receiving_warehouse || sr.warehouse || 'Global / Unassigned').salesReturned += qty;
                }
              });
            }
          });

          // 5. Purchase returns calculation (Stock returned back to vendor)
          let totalPurchaseReturned = 0;
          (pReturns || []).forEach((pr: any) => {
            if (String(pr.status || '').trim().toLowerCase() !== 'cancel' && String(pr.status || '').trim().toLowerCase() !== 'deleted') {
              const itemsArray = Array.isArray(pr.items) ? pr.items : JSON.parse(pr.items || '[]');
              itemsArray.forEach((item: any) => {
                const prName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                if (prName === name || prName.includes(name)) {
                  const qty = Number(item.qty || item.quantity || 0);
                  totalPurchaseReturned += qty;
                  getWh(item.warehouse || item.location || pr.dispatch_warehouse || pr.warehouse || 'Global / Unassigned').purchaseReturned += qty;
                }
              });
            }
          });

          // 6. Committed Stock (Hold Units from Delivery Challans)
          let totalHold = 0;
          (deliveryChallans || []).forEach((dc: any) => {
            const statusClean = String(dc.status || '').trim().toLowerCase();
            if (statusClean !== 'cancel' && statusClean !== 'deleted') {
              const itemsArray = Array.isArray(dc.items) ? dc.items : (typeof dc.items === 'string' ? JSON.parse(dc.items || '[]') : []);
              itemsArray.forEach((item: any) => {
                const dcName = String(item.product_name || item.itemName || item.pDescription || '').trim().toLowerCase();
                if (dcName === name || dcName.includes(name)) {
                  const orderQty = Number(item.orderQty ?? item.qty ?? 0);
                  const dispatchedQty = Number(item.dispatchedQty ?? (dc.status === 'Approved' || dc.status === 'Dispatched' ? orderQty : 0));
                  const holdQty = Number(item.holdQty !== undefined ? item.holdQty : Math.max(0, orderQty - dispatchedQty));
                  totalHold += holdQty;
                  getWh(item.warehouse || item.location || dc.dispatch_warehouse || dc.warehouse || 'Global / Unassigned').hold += holdQty;
                }
              });
            }
          });

          // ✅ THE MATHEMATICALLY ACCURATE FORMULA MATCHING YOUR REPORTS
          const trueRemainingStock = (totalOpening + totalPurchased + totalSalesReturned) - totalSold - totalPurchaseReturned;

          const onHandStock = trueRemainingStock + totalHold;

          // Process the warehouseBreakdowns object to calculate onHand and available for each
          const finalWhBreakdowns: Record<string, any> = {};
          Object.keys(whBreakdowns).forEach(key => {
            const w = whBreakdowns[key];
            const wAvailable = (w.opening + w.purchased + w.salesReturned) - w.sold - w.purchaseReturned;
            const wOnHand = wAvailable + w.hold;
            finalWhBreakdowns[key] = {
              ...w,
              available: wAvailable,
              onHand: wOnHand
            };
          });

          return {
            ...product,
            current_stock: trueRemainingStock,
            breakdown: {
              opening: totalOpening,
              purchased: totalPurchased,
              sold: totalSold,
              salesReturned: totalSalesReturned,
              purchaseReturned: totalPurchaseReturned,
              hold: totalHold,
              onHand: onHandStock,
              available: trueRemainingStock
            },
            warehouseBreakdowns: finalWhBreakdowns
          };
        });

        setProducts(unifiedProductPayload);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      toast.error('Data Fetching Failure: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteProduct = async (id: string | number) => {
    if (!window.confirm('Are you certain you want to delete this product catalog entry?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Product removed from database catalog successfully.');
      fetchInventoryProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredProducts = products.filter(p =>
    p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );



  const totalEntries = filteredProducts.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-slate-800 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Product Stock Inventory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Master item catalog, stock availability & pricing ledger</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/Administration/Products/Add')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 px-4 text-xs font-bold text-white hover:bg-emerald-700 transition duration-150 shadow-sm hover:shadow-md cursor-pointer"
          >
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#111827] p-5 sm:p-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-5 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Catalog Inventory Overview
          </span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
            {products.length} Products Registered
          </span>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-200 py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-emerald-600 text-xs font-bold text-slate-800 dark:text-white transition"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size} className="dark:bg-slate-800">
                  {size}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2 text-xs w-full sm:w-auto text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Search:</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product, category, brand..."
              className="w-full sm:w-72 rounded-xl border border-slate-200 py-2 px-3.5 bg-slate-50/50 dark:bg-slate-800/60 dark:border-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-xs text-slate-800 dark:text-white transition"
            />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <th className="py-3.5 px-4 w-16">S#</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4 w-24 text-center">UOM</th>
                <th className="py-3.5 px-4 text-right">Purchase Price</th>
                <th className="py-3.5 px-4 text-right">Sale Price</th>
                <th className="py-3.5 px-4 text-center w-36">Available Stock</th>
                <th className="py-3.5 px-4 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-sm">
                    <Spinner />
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-xs text-slate-400 italic">
                    No product items registered.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, idx) => {
                  const serialNumber = startIndex + idx + 1;
                  const isLowStock = Number(product.current_stock) <= Number(product.min_stock_alert || 0);
                  return (
                    <tr
                      key={product.id}
                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 duration-150 text-xs"
                    >
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono">{serialNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{product.product_name}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{product.category || 'General'}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{product.brand || 'Local'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                          {product.uom}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {Number(product.purchase_price || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {Number(product.retail_price || product.mrp || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {(() => {
                          const rawPcs = Number(product.pieces_per_box || product.pcs_per_box || product.pieces_per_packing || 0);
                          const isTile = Boolean(
                            (String(product.category || '').toLowerCase().includes('tile') ||
                              String(product.scenario_name || '').toLowerCase().includes('tile')) &&
                            (rawPcs > 1 || String(product.scenario_name || '').toLowerCase().includes('tile'))
                          );

                          const pcsPerBox = rawPcs > 1 ? rawPcs : (isTile ? 4 : 1);
                          const totalStock = Number(product.current_stock || 0);

                          // If it's a tile product with fractional / loose breakdown
                          if (isTile && pcsPerBox > 1) {
                            const totalPieces = Math.round(totalStock * pcsPerBox);
                            const wholeBoxes = Math.floor(totalPieces / pcsPerBox);
                            const loosePieces = totalPieces % pcsPerBox;

                            return (
                              <div className="flex flex-col items-center justify-center gap-1 font-mono">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`font-extrabold text-xs px-2.5 py-0.5 rounded-md border ${isLowStock
                                        ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                      }`}
                                  >
                                    {wholeBoxes.toLocaleString()} Boxes
                                  </span>
                                  {isLowStock && <MdWarning size={14} className="text-rose-500" />}
                                </div>
                                {loosePieces > 0 ? (
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    +{loosePieces} Pcs loose
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                                    (0 loose pcs)
                                  </span>
                                )}
                                <button onClick={() => { setSelectedStockBreakdown(product); setSelectedModalWarehouse('ALL'); }} className="text-[9px] font-sans text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer mt-0.5">View Breakdown</button>
                              </div>
                            );
                          }

                          // Standard non-tile product display
                          return (
                            <div className="flex flex-col items-center justify-center gap-1 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-black text-xs px-2.5 py-0.5 rounded-full ${isLowStock
                                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                    }`}
                                >
                                  {totalStock.toLocaleString()} {product.uom || 'PCS'}
                                </span>
                                {isLowStock && <MdWarning size={14} className="text-rose-500" />}
                              </div>
                              <button onClick={() => { setSelectedStockBreakdown(product); setSelectedModalWarehouse('ALL'); }} className="text-[9px] font-sans text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer">View Breakdown</button>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <TableActions
                          onEdit={() => navigate('/Administration/Products/Add', { state: { product } })}
                          onDelete={() => handleDeleteProduct(product.id)}
                          editTitle="Edit Product"
                          deleteTitle="Delete Product"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{endIndex}</span> of{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{totalEntries}</span> entries
          </div>
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

      {/* Stock Breakdown Modal */}
      {selectedStockBreakdown && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-boxdark rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-strokedark overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-strokedark bg-slate-50 dark:bg-meta-4/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
                  <MdInfoOutline size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-tight">
                    Stock Breakdown
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate" title={selectedStockBreakdown.product_name}>
                    {selectedStockBreakdown.product_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStockBreakdown(null)}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
              >
                <MdClose size={20} />
              </button>
            </div>

            {/* Warehouse Switcher */}
            <div className="px-5 pt-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Select Location:</label>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(() => {
                  const hasUnassigned = Object.keys(selectedStockBreakdown.warehouseBreakdowns || {}).includes('Global / Unassigned');
                  const tabs = ['ALL', ...masterLocations.filter(m => m), ...(hasUnassigned ? ['Global / Unassigned'] : [])];

                  // Ensure we don't have duplicate tabs if masterLocations already had it
                  const uniqueTabs = Array.from(new Set(tabs));

                  return uniqueTabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSelectedModalWarehouse(tab)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition ${selectedModalWarehouse === tab ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'bg-white dark:bg-boxdark border-slate-200 dark:border-strokedark text-slate-500 dark:text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600'}`}
                    >
                      {tab === 'Global / Unassigned' ? 'Unassigned / Unknown' : tab}
                    </button>
                  ));
                })()}
              </div>
            </div>

            <div className="p-5 flex flex-col gap-3 font-sans">
              {(() => {
                const isTile = Boolean(
                  (String(selectedStockBreakdown.category || '').toLowerCase().includes('tile') ||
                    String(selectedStockBreakdown.scenario_name || '').toLowerCase().includes('tile')) &&
                  (Number(selectedStockBreakdown.pieces_per_box || selectedStockBreakdown.pcs_per_box || 0) > 1 || String(selectedStockBreakdown.scenario_name || '').toLowerCase().includes('tile'))
                );
                const rawPcs = Number(selectedStockBreakdown.pieces_per_box || selectedStockBreakdown.pcs_per_box || 0);
                const pcsPerBox = rawPcs > 1 ? rawPcs : (isTile ? 4 : 1);

                const formatVal = (val: number) => {
                  if (isTile && pcsPerBox > 1) {
                    const totalPieces = Math.round(val * pcsPerBox);
                    const b = Math.floor(totalPieces / pcsPerBox);
                    const p = totalPieces % pcsPerBox;
                    return (
                      <div className="text-right flex flex-col items-end">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{b} Boxes</span>
                        {p > 0 && <span className="text-[9px] font-bold text-slate-400">+{p} Pcs</span>}
                      </div>
                    );
                  }
                  return <span className="font-bold text-slate-700 dark:text-slate-200">{val.toLocaleString()} {selectedStockBreakdown.uom || 'PCS'}</span>;
                };

                const bData = selectedModalWarehouse === 'ALL'
                  ? selectedStockBreakdown.breakdown || {}
                  : selectedStockBreakdown.warehouseBreakdowns?.[selectedModalWarehouse] || { opening: 0, purchased: 0, sold: 0, salesReturned: 0, purchaseReturned: 0, hold: 0, available: 0, onHand: 0 };

                return (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-strokedark/50">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Opening Stock</span>
                      {formatVal(bData.opening || 0)}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-strokedark/50">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Purchases</span>
                      {formatVal(bData.purchased || 0)}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-strokedark/50">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Sales</span>
                      {formatVal(bData.sold || 0)}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-strokedark/50 bg-amber-50/50 dark:bg-amber-900/10 px-3 -mx-3 rounded-lg">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-500">Committed (Hold)</span>
                      <div className="text-amber-700 dark:text-amber-500">{formatVal(bData.hold || 0)}</div>
                    </div>
                    <div className="flex justify-between items-center py-3 mt-1 bg-emerald-50 dark:bg-emerald-900/20 px-3 -mx-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                      <span className="text-sm font-black tracking-tight text-emerald-800 dark:text-emerald-400">Available Stock <span className="text-[10px] font-bold opacity-70">(On Hand)</span></span>
                      <div className="text-emerald-700 dark:text-emerald-400">{formatVal(bData.available || 0)}</div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-meta-4/30 border-t border-slate-100 dark:border-strokedark flex justify-end">
              <button
                onClick={() => setSelectedStockBreakdown(null)}
                className="px-4 py-2 bg-white dark:bg-boxdark border border-slate-200 dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
