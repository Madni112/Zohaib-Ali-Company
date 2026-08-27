import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';

const PurchaseReport = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'purchase' | 'return' | 'invoice'>('purchase');

  const [vendors, setVendors] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const getPastWeekDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  };

  const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [criteria, setCriteria] = useState({
    vendor: 'All', category: 'All', uom: 'All', brand: 'All',
    product: 'All', location: 'All', purchaseType: 'All',
    invoiceNo: 'All',
    dateFrom: getPastWeekDateString(),
    dateTo: getTodayDateString()
  });
  useEffect(() => {
    const fetchPurchaseCriteriaLookups = async () => {
      try {
        setLoading(true);
        const { data: vend } = await supabase.from('vendors').select('id, vendor_name');
        const { data: cat } = await supabase.from('inventory_categories').select('id, name');
        const { data: brnd } = await supabase.from('inventory_brands').select('id, name');
        const { data: prod } = await supabase.from('products').select('id, product_name, category, brand, uom');
        const { data: loc } = await supabase.from('inventory_locations').select('id, name');

        const { data: purInvoices } = await supabase
          .from('supplier_purchases')
          .select('id, total_amount, supplier_name, purchase_no')
          .order('id', { ascending: false });

        const { data: uomData } = await supabase
          .from('inventory_uom')
          .select('id, short_code, full_name')
          .eq('tenant_id', tenantId || 'bashir')
          .eq('is_active', true);


        if (vend) setVendors(vend);
        if (cat) setCategories(cat);
        if (brnd) setBrands(brnd);
        if (prod) setProducts(prod);
        if (loc) setLocations(loc);
        if (purInvoices) setAvailableInvoices(purInvoices);

        if (uomData) {
          const normalizedUoms = uomData.map((u: any) => ({
            id: u.id,
            name: `${u.short_code} = ${u.full_name}`
          }));
          setUoms(normalizedUoms);
        }
      } catch (err: any) {
        toast.error('Purchase registry lookup interruption: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchaseCriteriaLookups();
  }, []);

  useEffect(() => {
    const closePurchaseDropdownOverlay = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.searchable-purchase-dropdown-container')) {
        document.getElementById('purchase-search-dropdown-list')?.classList.add('hidden');
      }
    };
    window.addEventListener('click', closePurchaseDropdownOverlay);
    return () => window.removeEventListener('click', closePurchaseDropdownOverlay);
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setCriteria(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'brand') updated.product = 'All';
      return updated;
    });
  };

  const getContextualProductSelectionPool = () => {
    const selectedBrandClean = String(criteria.brand || '').trim().toLowerCase();
    if (!selectedBrandClean || selectedBrandClean === 'all' || selectedBrandClean === 'all brands') {
      return products;
    }
    return products.filter(p => String(p.brand || '').trim().toLowerCase() === selectedBrandClean);
  };

  const getFilteredPurchaseInvoices = () => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return availableInvoices;
    return availableInvoices.filter(i =>
      String(i.id).includes(term) ||
      String(i.purchase_no || '').toLowerCase().includes(term) ||
      String(i.supplier_name || '').toLowerCase().includes(term)
    );
  };

  const handleDispatchReportView = () => {
    if (activeTab === 'invoice' && criteria.invoiceNo === 'All') {
      toast.error('Please isolate or choose a target document profile reference ID');
      return;
    }
    navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Purchase-Report/Print`, { state: { type: activeTab, filters: criteria } });
  };


  if (loading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-bodydark text-xs antialiased font-sans relative">
      <div>
        <h2 className="text-xl font-bold text-black dark:text-white uppercase tracking-wider">Corporate Purchase Auditing Center</h2>
        <p className="text-xs text-gray-400">Isolate procurement parameters and compile vendor distribution sheets metrics</p>
      </div>

      <div className="flex border-b border-stroke dark:border-strokedark gap-2 bg-white dark:bg-boxdark font-black tracking-wider text-[11px] uppercase text-gray-500">
        <button type="button" onClick={() => { setActiveTab('purchase'); handleInputChange('invoiceNo', 'All'); setSearchQuery(''); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${activeTab === 'purchase' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'}`}>General Purchase Detail</button>
        <button type="button" onClick={() => { setActiveTab('return'); handleInputChange('invoiceNo', 'All'); setSearchQuery(''); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${activeTab === 'return' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'}`}>Purchase Return</button>
        <button type="button" onClick={() => { setActiveTab('invoice'); handleInputChange('invoiceNo', 'All'); setSearchQuery(''); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${activeTab === 'invoice' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'}`}>Purchase Invoice Detail</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        <h3 className="font-bold text-sm text-black dark:text-white mb-4 uppercase tracking-wider text-primary">Report Criteria Specification</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">

          {activeTab === 'purchase' && (
            <>
              <div><label className="block font-bold text-gray-500 mb-1">Procurement Vendor:</label><select value={criteria.vendor} onChange={(e) => handleInputChange('vendor', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Vendors</option>{vendors.map(v => <option key={v.id} value={v.vendor_name}>{v.vendor_name}</option>)}</select></div>
              <div><label className="block font-bold text-gray-500 mb-1">Product Category:</label><select value={criteria.category} onChange={(e) => handleInputChange('category', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Categories</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div><label className="block font-bold text-gray-500 mb-1">Product Groups (UOM):</label><select value={criteria.uom} onChange={(e) => handleInputChange('uom', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Groups</option>{uoms.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
              <div><label className="block font-bold text-gray-500 mb-1">Brands Allocation:</label><select value={criteria.brand} onChange={(e) => handleInputChange('brand', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Brands</option>{brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select></div>
              <div>
                <label className="block font-bold text-gray-500 mb-1">Target Stock Assets:</label>
                <select value={criteria.product} onChange={(e) => handleInputChange('product', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark">
                  <option value="All">All Products ({getContextualProductSelectionPool().length} Options Available)</option>
                  {getContextualProductSelectionPool().map(p => <option key={p.id} value={p.product_name}>{p.product_name}</option>)}
                </select>
              </div>
              <div><label className="block font-bold text-gray-500 mb-1">Warehouse Locations:</label><select value={criteria.location} onChange={(e) => handleInputChange('location', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Bins</option>{locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
              <div><label className="block font-bold text-gray-500 mb-1">Purchase Type Settlement:</label><select value={criteria.purchaseType} onChange={(e) => handleInputChange('purchaseType', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Flows</option><option value="Cash">Cash Basis</option><option value="Credit">On Corporate Credit</option></select></div>
            </>
          )}
          {activeTab === 'return' && (
            <>
              <div><label className="block font-bold text-gray-500 mb-1">Procurement Vendor:</label><select value={criteria.vendor} onChange={(e) => handleInputChange('vendor', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Vendors</option>{vendors.map(v => <option key={v.id} value={v.vendor_name}>{v.vendor_name}</option>)}</select></div>
              <div><label className="block font-bold text-gray-500 mb-1">Product Category:</label><select value={criteria.category} onChange={(e) => handleInputChange('category', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Categories</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div><label className="block font-bold text-gray-500 mb-1">Product Groups (UOM):</label><select value={criteria.uom} onChange={(e) => handleInputChange('uom', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Groups</option>{uoms.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
              <div><label className="block font-bold text-gray-500 mb-1">Brands Allocation:</label><select value={criteria.brand} onChange={(e) => handleInputChange('brand', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Brands</option>{brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select></div>
              <div>
                <label className="block font-bold text-gray-500 mb-1">Target Stock Assets:</label>
                <select value={criteria.product} onChange={(e) => handleInputChange('product', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark">
                  <option value="All">All Products ({getContextualProductSelectionPool().length} Options Available)</option>
                  {getContextualProductSelectionPool().map(p => <option key={p.id} value={p.product_name}>{p.product_name}</option>)}
                </select>
              </div>
              <div><label className="block font-bold text-gray-500 mb-1">Warehouse Locations:</label><select value={criteria.location} onChange={(e) => handleInputChange('location', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Bins</option>{locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
            </>
          )}

          {activeTab === 'invoice' && (
            <div className="md:col-span-3 searchable-purchase-dropdown-container relative">
              <label className="block font-bold text-gray-500 mb-1">Select Target Purchase Invoice Profile: *</label>
              <div
                onClick={(e) => { e.stopPropagation(); document.getElementById('purchase-search-dropdown-list')?.classList.toggle('hidden'); }}
                className="w-full rounded border border-stroke dark:border-strokedark p-2 text-xs bg-white dark:bg-boxdark font-bold text-black dark:text-white cursor-pointer flex justify-between items-center h-[34px]"
              >
                <span>
                  {criteria.invoiceNo !== 'All' ? (() => {
                    const matched = availableInvoices.find(i => String(i.id) === String(criteria.invoiceNo));
                    return matched ? `${matched.purchase_no || `ID: ${matched.id}`} (${matched.supplier_name})` : `PUR-INV-${criteria.invoiceNo}`;
                  })() : `-- Choose Available Purchase Records List (${getFilteredPurchaseInvoices().length} Found) --`}
                </span>
                <span className="text-gray-400 text-[9px]">▼</span>
              </div>

              <div id="purchase-search-dropdown-list" className="hidden absolute top-full left-0 w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark shadow-xl rounded-sm mt-1 z-99999 p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  placeholder="Search vendor name or transaction code parameters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded border border-stroke p-1.5 text-xs bg-transparent text-black dark:text-white outline-none focus:border-primary font-bold"
                />
                <div className="max-h-40 overflow-y-auto space-y-1 font-bold text-xs text-black dark:text-white">
                  <div onClick={() => { handleInputChange('invoiceNo', 'All'); document.getElementById('purchase-search-dropdown-list')?.classList.add('hidden'); }} className="p-2 hover:bg-primary hover:text-white cursor-pointer rounded-sm text-gray-400 italic">-- All Invoice Ledgers --</div>
                  {getFilteredPurchaseInvoices().map(inv => (
                    <div key={inv.id} onClick={() => { handleInputChange('invoiceNo', String(inv.id)); document.getElementById('purchase-search-dropdown-list')?.classList.add('hidden'); }} className="p-2 hover:bg-primary hover:text-white cursor-pointer rounded-sm transition-colors">
                      {inv.purchase_no || `ID: ${inv.id}`} ({inv.supplier_name}) - Rs. {Number(inv.total_amount || 0).toLocaleString()}
                    </div>
                  ))}
                  {getFilteredPurchaseInvoices().length === 0 && <div className="p-2 text-center text-gray-400 italic">No procurement records found.</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'invoice' && (
            <>
              <div><label className="block font-bold text-gray-500 mb-1">Date From (Start):</label><input type="date" value={criteria.dateFrom} onChange={(e) => handleInputChange('dateFrom', e.target.value)} className="w-full border border-stroke rounded p-2 bg-transparent font-semibold text-black dark:text-white text-xs outline-none dark:bg-boxdark" /></div>
              <div><label className="block font-bold text-gray-500 mb-1">Date To (End Date):</label><input type="date" value={criteria.dateTo} onChange={(e) => handleInputChange('dateTo', e.target.value)} className="w-full border border-stroke rounded p-2 bg-transparent font-semibold text-black dark:text-white text-xs outline-none dark:bg-boxdark" /></div>
              <div className="md:col-span-4 flex flex-wrap items-center gap-1.5 pt-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Quick Dates:</span>
                <button type="button" onClick={() => { const t = new Date().toISOString().split('T')[0]; handleInputChange('dateFrom', t); handleInputChange('dateTo', t); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Today</button>
                <button type="button" onClick={() => { const y = new Date(); y.setDate(y.getDate() - 1); const ys = y.toISOString().split('T')[0]; handleInputChange('dateFrom', ys); handleInputChange('dateTo', ys); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Yesterday</button>
                <button type="button" onClick={() => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const s = new Date(d.setDate(diff)).toISOString().split('T')[0]; handleInputChange('dateFrom', s); handleInputChange('dateTo', new Date().toISOString().split('T')[0]); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">This Week</button>
                <button type="button" onClick={() => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; handleInputChange('dateFrom', s); handleInputChange('dateTo', new Date().toISOString().split('T')[0]); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">This Month</button>
                <button type="button" onClick={() => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]; const e = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]; handleInputChange('dateFrom', s); handleInputChange('dateTo', e); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Last Month</button>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 pt-4 border-t border-stroke dark:border-strokedark flex justify-end">
          <button type="button" onClick={handleDispatchReportView} className="rounded bg-primary py-2.5 px-12 font-bold text-white hover:bg-opacity-90 transition text-xs shadow-sm h-9 cursor-pointer uppercase tracking-wider">Show Report</button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseReport;
