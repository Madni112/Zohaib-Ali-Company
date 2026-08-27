import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdSearch, MdAdd, MdWarning } from 'react-icons/md';
import TableActions from '../../../ui/TableActions';

const ProductList = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        const { data: purchases } = await supabase.from('supplier_purchases').select('items, payment_term');
        const { data: sales } = await supabase.from('sales_invoices').select('items, sale_status, receipt_status');
        const { data: sReturns } = await supabase.from('sales_returns').select('*');
        const { data: pReturns } = await supabase.from('purchase_returns').select('*');

        const unifiedProductPayload = baseProducts.map(product => {
          const name = String(product.product_name || '').trim().toLowerCase();

          // 1. Opening stock calculation
          const totalOpening = (openStocks || [])
            .filter((os: any) => {
              const osName = String(os.product_name || os.item_name || os.itemName || os.item_details || os.itemDetails || '').trim().toLowerCase();
              return osName === name || osName.includes(name) || name.includes(osName);
            })
            .reduce((sum: number, os: any) => sum + (Number(os.quantity || os.qty || 0)), 0);

          // 2. Purchased stock calculation
          let totalPurchased = 0;
          (purchases || []).forEach((p: any) => {
            const termClean = String(p.payment_term || '').trim().toLowerCase();
            if (termClean !== 'cancel' && termClean !== 'deleted' && termClean !== 'draft') {
              const itemsArray = Array.isArray(p.items) ? p.items : JSON.parse(p.items || '[]');
              itemsArray.forEach((item: any) => {
                const pName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                if (pName === name || pName.includes(name)) {
                  totalPurchased += (Number(item.qty || item.quantity || 0));
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
                  totalSold += (Number(item.qty || item.quantity || 0));
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
                  totalSalesReturned += (Number(item.qty || item.quantity || 0));
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
                  totalPurchaseReturned += (Number(item.qty || item.quantity || 0));
                }
              });
            }
          });

          // ✅ THE MATHEMATICALLY ACCURATE FORMULA MATCHING YOUR REPORTS
          const trueRemainingStock = (totalOpening + totalPurchased + totalSalesReturned) - totalSold - totalPurchaseReturned;

          return {
            ...product,
            current_stock: trueRemainingStock
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
                <th className="py-3.5 px-4">Product Name</th>
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
                                    className={`font-extrabold text-xs px-2.5 py-0.5 rounded-md border ${
                                      isLowStock
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
                              </div>
                            );
                          }

                          // Standard non-tile product display
                          return (
                            <div className="flex items-center justify-center gap-1.5 font-mono">
                              <span
                                className={`font-black text-xs px-2.5 py-0.5 rounded-full ${
                                  isLowStock
                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                }`}
                              >
                                {totalStock.toLocaleString()} {product.uom || 'PCS'}
                              </span>
                              {isLowStock && <MdWarning size={14} className="text-rose-500" />}
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
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-30 cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    currentPage === i + 1
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-30 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductList;
