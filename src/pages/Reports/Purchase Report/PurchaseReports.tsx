import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import SearchableDropdown from '../../../components/SearchableDropdown';

const PurchaseReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);

  const initialTab = (location.state?.activeTab || location.state?.tab || 'purchase') as 'purchase' | 'return' | 'invoice';
  const [activeTab, setActiveTab] = useState<'purchase' | 'return' | 'invoice'>(initialTab);

  const [vendors, setVendors] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);

  const getPastWeekDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  };

  const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [criteria, setCriteria] = useState(() => ({
    vendor: location.state?.vendor || location.state?.criteria?.vendor || 'All',
    category: location.state?.category || location.state?.criteria?.category || 'All',
    uom: 'All', brand: 'All', product: 'All', location: 'All', purchaseType: 'All', invoiceNo: 'All',
    dateFrom: location.state?.dateFrom || location.state?.criteria?.dateFrom || getPastWeekDateString(),
    dateTo: location.state?.dateTo || location.state?.criteria?.dateTo || getTodayDateString()
  }));

  useEffect(() => {
    const fetchPurchaseCriteriaLookups = async () => {
      try {
        setLoading(true);
        const [vendRes, catRes, brndRes, prodRes, locRes, purInvRes, uomRes] = await Promise.all([
          supabase.from('vendors').select('id, vendor_name'),
          supabase.from('inventory_categories').select('id, name'),
          supabase.from('inventory_brands').select('id, name'),
          supabase.from('products').select('id, product_name, category, brand, uom'),
          supabase.from('inventory_locations').select('id, name'),
          supabase.from('supplier_purchases').select('id, total_amount, supplier_name, purchase_no').order('id', { ascending: false }),
          supabase.from('inventory_uom').select('id, short_code, full_name').eq('tenant_id', tenantId || 'bashir').eq('is_active', true)
        ]);

        if (vendRes.data) setVendors(vendRes.data);
        if (catRes.data) setCategories(catRes.data);
        if (brndRes.data) setBrands(brndRes.data);
        if (prodRes.data) setProducts(prodRes.data);
        if (locRes.data) setLocations(locRes.data);
        if (purInvRes.data) setAvailableInvoices(purInvRes.data);

        if (uomRes.data) {
          const normalizedUoms = uomRes.data.map((u: any) => ({
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
  }, [tenantId]);

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

  const vendorOptions = useMemo(() => vendors.map(v => v.vendor_name).filter(Boolean), [vendors]);
  const categoryOptions = useMemo(() => categories.map(c => c.name).filter(Boolean), [categories]);
  const uomOptions = useMemo(() => uoms.map(u => u.name).filter(Boolean), [uoms]);
  const brandOptions = useMemo(() => brands.map(b => b.name).filter(Boolean), [brands]);
  const productOptions = useMemo(() => getContextualProductSelectionPool().map(p => p.product_name).filter(Boolean), [products, criteria.brand]);
  const locationOptions = useMemo(() => locations.map(l => l.name).filter(Boolean), [locations]);
  const invoiceOptions = useMemo(() => availableInvoices.map(i => i.purchase_no || `PUR-${String(i.id).padStart(4, '0')}`), [availableInvoices]);

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
        <button type="button" onClick={() => { setActiveTab('purchase'); handleInputChange('invoiceNo', 'All'); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${activeTab === 'purchase' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'}`}>General Purchase Detail</button>
        <button type="button" onClick={() => { setActiveTab('return'); handleInputChange('invoiceNo', 'All'); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${activeTab === 'return' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'}`}>Purchase Return</button>
        <button type="button" onClick={() => { setActiveTab('invoice'); handleInputChange('invoiceNo', 'All'); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${activeTab === 'invoice' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'}`}>Purchase Invoice Detail</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        <h3 className="font-bold text-sm text-black dark:text-white mb-4 uppercase tracking-wider text-primary">Report Criteria Specification</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">

          {activeTab === 'purchase' && (
            <>
              <SearchableDropdown label="Procurement Vendor:" placeholder="Vendor" options={vendorOptions} value={criteria.vendor} onChange={(val) => handleInputChange('vendor', val)} />
              <SearchableDropdown label="Product Category:" placeholder="Category" options={categoryOptions} value={criteria.category} onChange={(val) => handleInputChange('category', val)} />
              <SearchableDropdown label="Product Groups (UOM):" placeholder="UOM" options={uomOptions} value={criteria.uom} onChange={(val) => handleInputChange('uom', val)} />
              <SearchableDropdown label="Brands Allocation:" placeholder="Brand" options={brandOptions} value={criteria.brand} onChange={(val) => handleInputChange('brand', val)} />
              <SearchableDropdown label="Target Stock Assets:" placeholder="Product" options={productOptions} value={criteria.product} onChange={(val) => handleInputChange('product', val)} />
              <SearchableDropdown label="Receiving Warehouses:" placeholder="Location" options={locationOptions} value={criteria.location} onChange={(val) => handleInputChange('location', val)} />
              
              <div>
                <label className="block font-bold text-gray-500 mb-1">Procurement Mode:</label>
                <select value={criteria.purchaseType} onChange={(e) => handleInputChange('purchaseType', e.target.value)} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none">
                  <option value="All">All Procurement Types</option>
                  <option value="Cash">Cash Purchases</option>
                  <option value="Credit">Credit Purchases</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'return' && (
            <>
              <SearchableDropdown label="Procurement Vendor:" placeholder="Vendor" options={vendorOptions} value={criteria.vendor} onChange={(val) => handleInputChange('vendor', val)} />
              <SearchableDropdown label="Product Category:" placeholder="Category" options={categoryOptions} value={criteria.category} onChange={(val) => handleInputChange('category', val)} />
              <SearchableDropdown label="Product Groups (UOM):" placeholder="UOM" options={uomOptions} value={criteria.uom} onChange={(val) => handleInputChange('uom', val)} />
              <SearchableDropdown label="Brands Allocation:" placeholder="Brand" options={brandOptions} value={criteria.brand} onChange={(val) => handleInputChange('brand', val)} />
              <SearchableDropdown label="Target Stock Assets:" placeholder="Product" options={productOptions} value={criteria.product} onChange={(val) => handleInputChange('product', val)} />
              <SearchableDropdown label="Receiving Warehouses:" placeholder="Location" options={locationOptions} value={criteria.location} onChange={(val) => handleInputChange('location', val)} />
            </>
          )}

          {activeTab === 'invoice' && (
            <>
              <div className="md:col-span-2">
                <SearchableDropdown
                  label="Select Supplier Purchase Invoice Profile: *"
                  placeholder="Purchase Invoice"
                  options={invoiceOptions}
                  value={criteria.invoiceNo}
                  onChange={(val) => handleInputChange('invoiceNo', val)}
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-bold text-gray-500 mb-1">Date Bracket From:</label>
            <input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.dateFrom} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; if (e.target.value > today) handleInputChange('dateFrom', today); else handleInputChange('dateFrom', e.target.value); }} className="w-full border border-stroke rounded p-2 bg-transparent font-semibold text-black dark:text-white text-xs outline-none dark:bg-boxdark" />
          </div>
          <div>
            <label className="block font-bold text-gray-500 mb-1">Date Bracket To:</label>
            <input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.dateTo} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; if (e.target.value > today) handleInputChange('dateTo', today); else handleInputChange('dateTo', e.target.value); }} className="w-full border border-stroke rounded p-2 bg-transparent font-semibold text-black dark:text-white text-xs outline-none dark:bg-boxdark" />
          </div>

          <div className="md:col-span-4 flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Quick Date Range:</span>
            <button type="button" onClick={() => { const t = getTodayDateString(); handleInputChange('dateFrom', t); handleInputChange('dateTo', t); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Today</button>
            <button type="button" onClick={() => { const y = new Date(); y.setDate(y.getDate() - 1); const ys = y.toISOString().split('T')[0]; handleInputChange('dateFrom', ys); handleInputChange('dateTo', ys); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Yesterday</button>
            <button type="button" onClick={() => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const s = new Date(d.setDate(diff)).toISOString().split('T')[0]; handleInputChange('dateFrom', s); handleInputChange('dateTo', getTodayDateString()); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">This Week</button>
            <button type="button" onClick={() => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; handleInputChange('dateFrom', s); handleInputChange('dateTo', getTodayDateString()); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">This Month</button>
            <button type="button" onClick={() => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]; const e = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]; handleInputChange('dateFrom', s); handleInputChange('dateTo', e); }} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Last Month</button>
          </div>

        </div>

        <div className="mt-8 pt-4 border-t border-stroke dark:border-strokedark flex justify-end">
          <button
            type="button"
            onClick={handleDispatchReportView}
            className="rounded bg-primary py-2.5 px-12 font-bold text-white hover:bg-opacity-90 transition text-xs shadow-sm h-9 cursor-pointer"
          >
            Generate Statement
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseReport;
