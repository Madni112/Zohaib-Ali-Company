import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import SearchableDropdown from '../../../components/SearchableDropdown';

const StockReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);

  const initialTab = Number(location.state?.activeTab || location.state?.tab || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(initialTab);

  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [criteria, setCriteria] = useState(() => ({
    uom: location.state?.uom || location.state?.criteria?.uom || 'All',
    brand: location.state?.brand || location.state?.criteria?.brand || 'All',
    product: location.state?.product || location.state?.criteria?.product || 'All',
    location: location.state?.location || location.state?.criteria?.location || 'All',
    employee: 'All', category: 'All', stockValueTier: 'All',
    dateFrom: location.state?.dateFrom || location.state?.criteria?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    dateTo: location.state?.dateTo || location.state?.criteria?.dateTo || new Date().toISOString().split('T')[0],
    asOfDate: location.state?.asOfDate || location.state?.criteria?.asOfDate || new Date().toISOString().split('T')[0],
    showSalePrice: true,
    showPurchasePrice: true,
    showFinalPrice: true,
    showSpecifications: true
  }));

  useEffect(() => {
    const fetchStockCriteriaLookups = async () => {
      try {
        setLoading(true);
        const [catRes, brndRes, prodRes, locRes, empRes, uomRes] = await Promise.all([
          supabase.from('inventory_categories').select('id, name'),
          supabase.from('inventory_brands').select('id, name'),
          supabase.from('products').select('id, product_name, category, brand, uom'),
          supabase.from('inventory_locations').select('id, name'),
          supabase.from('salesmen').select('id, name'),
          supabase.from('inventory_uom').select('id, short_code, full_name').eq('tenant_id', tenantId || 'bashir').eq('is_active', true)
        ]);

        if (catRes.data) setCategories(catRes.data);
        if (brndRes.data) setBrands(brndRes.data);
        if (prodRes.data) setProducts(prodRes.data);
        if (locRes.data) setLocations(locRes.data);
        if (empRes.data) setEmployees(empRes.data);

        if (uomRes.data) {
          const normalizedUoms = uomRes.data.map((u: any) => ({
            id: u.id,
            name: `${u.short_code} = ${u.full_name}`
          }));
          setUoms(normalizedUoms);
        }
      } catch (err: any) {
        toast.error('Stock criteria aggregation error: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStockCriteriaLookups();
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
    if (!selectedBrandClean || selectedBrandClean === 'all') return products;
    return products.filter(p => String(p.brand || '').trim().toLowerCase() === selectedBrandClean);
  };

  const uomOptions = useMemo(() => uoms.map(u => u.name).filter(Boolean), [uoms]);
  const brandOptions = useMemo(() => brands.map(b => b.name).filter(Boolean), [brands]);
  const productOptions = useMemo(() => getContextualProductSelectionPool().map(p => p.product_name).filter(Boolean), [products, criteria.brand]);
  const locationOptions = useMemo(() => locations.map(l => l.name).filter(Boolean), [locations]);
  const categoryOptions = useMemo(() => categories.map(c => c.name).filter(Boolean), [categories]);
  const employeeOptions = useMemo(() => employees.map(e => e.name).filter(Boolean), [employees]);

  const handleDispatchReportView = () => {
    navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Stock-Report/Print`, {
      state: { tab: activeTab, filters: criteria }
    });
  };

  if (loading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-bodydark text-xs antialiased font-sans relative">
      <div>
        <h2 className="text-xl font-bold text-black dark:text-white uppercase tracking-wider">Enterprise Stock Auditing Center</h2>
        <p className="text-xs text-gray-400">Track structural inventory asset flows, location metrics, and ledger balances valuation</p>
      </div>

      <div className="flex flex-wrap border-b border-stroke dark:border-strokedark gap-1 bg-white dark:bg-boxdark font-black tracking-wider text-[10px] uppercase text-gray-500">
        <button type="button" onClick={() => setActiveTab(1)} className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${activeTab === 1 ? 'border-primary text-primary font-black bg-primary/5' : 'border-transparent text-gray-400 hover:text-black'}`}>Stock Activity</button>
        <button type="button" onClick={() => setActiveTab(2)} className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${activeTab === 2 ? 'border-primary text-primary font-black bg-primary/5' : 'border-transparent text-gray-400 hover:text-black'}`}>Stock Balance</button>
        <button type="button" onClick={() => setActiveTab(3)} className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${activeTab === 3 ? 'border-primary text-primary font-black bg-primary/5' : 'border-transparent text-gray-400 hover:text-black'}`}>Stock Status</button>
        <button type="button" onClick={() => setActiveTab(4)} className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${activeTab === 4 ? 'border-primary text-primary font-black bg-primary/5' : 'border-transparent text-gray-400 hover:text-black'}`}>Stock Transfer</button>
        <button type="button" onClick={() => setActiveTab(5)} className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${activeTab === 5 ? 'border-primary text-primary font-black bg-primary/5' : 'border-transparent text-gray-400 hover:text-black'}`}>Detail With Price</button>
        <button type="button" onClick={() => setActiveTab(6)} className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${activeTab === 6 ? 'border-primary text-primary font-black bg-primary/5' : 'border-transparent text-gray-400 hover:text-black'}`}>Product Report</button>
        <button type="button" onClick={() => setActiveTab(7)} className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${activeTab === 7 ? 'border-primary text-primary font-black bg-primary/5' : 'border-transparent text-gray-400 hover:text-black'}`}>Status Detail</button>
        <button type="button" onClick={() => setActiveTab(8)} className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${activeTab === 8 ? 'border-primary text-primary font-black bg-primary/5' : 'border-transparent text-gray-400 hover:text-black'}`}>Location Stock</button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        <h3 className="font-bold text-sm text-black dark:text-white mb-4 uppercase tracking-wider text-primary">Report Criteria Specification</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">

          {(activeTab === 1 || activeTab === 2 || activeTab === 5 || activeTab === 6) && (
            <>
              <SearchableDropdown label="Product Group (UOM):" placeholder="UOM Group" options={uomOptions} value={criteria.uom} onChange={(val) => handleInputChange('uom', val)} />
              <SearchableDropdown label="Brand Name:" placeholder="Brand" options={brandOptions} value={criteria.brand} onChange={(val) => handleInputChange('brand', val)} />
              <SearchableDropdown label="Select Product Asset:" placeholder="Product" options={productOptions} value={criteria.product} onChange={(val) => handleInputChange('product', val)} />
              
              {activeTab === 5 && (
                <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 dark:bg-meta-4/20 p-3 rounded border border-stroke dark:border-strokedark mt-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="showSalePrice" checked={criteria.showSalePrice} onChange={(e) => handleInputChange('showSalePrice', e.target.checked)} className="h-4 w-4 rounded text-primary border-stroke cursor-pointer" />
                    <label htmlFor="showSalePrice" className="font-bold text-gray-600 dark:text-white cursor-pointer select-none">Include Retail Sale Price</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="showPurchasePrice" checked={criteria.showPurchasePrice} onChange={(e) => handleInputChange('showPurchasePrice', e.target.checked)} className="h-4 w-4 rounded text-primary border-stroke cursor-pointer" />
                    <label htmlFor="showPurchasePrice" className="font-bold text-gray-600 dark:text-white cursor-pointer select-none">Include Inbound Purchase Cost</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="showFinalPrice" checked={criteria.showFinalPrice} onChange={(e) => handleInputChange('showFinalPrice', e.target.checked)} className="h-4 w-4 rounded text-primary border-stroke cursor-pointer" />
                    <label htmlFor="showFinalPrice" className="font-bold text-gray-600 dark:text-white cursor-pointer select-none">Include Final Net Value</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="showSpecifications" checked={criteria.showSpecifications} onChange={(e) => handleInputChange('showSpecifications', e.target.checked)} className="h-4 w-4 rounded text-primary border-stroke cursor-pointer" />
                    <label htmlFor="showSpecifications" className="font-bold text-gray-600 dark:text-white cursor-pointer select-none">Include Data Technical Specs</label>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 3 && (
            <>
              <SearchableDropdown label="Warehouse Location:" placeholder="Location" options={locationOptions} value={criteria.location} onChange={(val) => handleInputChange('location', val)} />
              <SearchableDropdown label="Target Product Asset:" placeholder="Product" options={productOptions} value={criteria.product} onChange={(val) => handleInputChange('product', val)} />
              <div><label className="block font-bold text-gray-500 mb-1">As Of Date Balance:</label><input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.asOfDate} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; if (e.target.value > today) handleInputChange('asOfDate', today); else handleInputChange('asOfDate', e.target.value); }} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none" /></div>
            </>
          )}

          {activeTab === 4 && (
            <>
              <SearchableDropdown label="Transfer Location:" placeholder="Location" options={locationOptions} value={criteria.location} onChange={(val) => handleInputChange('location', val)} />
              <SearchableDropdown label="Target Product Asset:" placeholder="Product" options={productOptions} value={criteria.product} onChange={(val) => handleInputChange('product', val)} />
              <SearchableDropdown label="Employee Logistics Link:" placeholder="Personnel Agent" options={employeeOptions} value={criteria.employee} onChange={(val) => handleInputChange('employee', val)} />
              <div><label className="block font-bold text-gray-500 mb-1">Transfer Start Date:</label><input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.dateFrom} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; if (e.target.value > today) handleInputChange('dateFrom', today); else handleInputChange('dateFrom', e.target.value); }} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none" /></div>
              <div><label className="block font-bold text-gray-500 mb-1">Transfer End Date:</label><input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.dateTo} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; if (e.target.value > today) handleInputChange('dateTo', today); else handleInputChange('dateTo', e.target.value); }} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none" /></div>
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

          {activeTab === 7 && (
            <>
              <SearchableDropdown label="Product Group (UOM):" placeholder="UOM Group" options={uomOptions} value={criteria.uom} onChange={(val) => handleInputChange('uom', val)} />
              <SearchableDropdown label="Brand Name:" placeholder="Brand" options={brandOptions} value={criteria.brand} onChange={(val) => handleInputChange('brand', val)} />
              <SearchableDropdown label="Product Category:" placeholder="Category" options={categoryOptions} value={criteria.category} onChange={(val) => handleInputChange('category', val)} />
              
              <div>
                <label className="block font-bold text-gray-500 mb-1">StockValue Tier Filter:</label>
                <select value={criteria.stockValueTier} onChange={(e) => handleInputChange('stockValueTier', e.target.value)} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none">
                  <option value="All">All Financial Valuations</option>
                  <option value="High">High Asset Value First (&gt; Rs. 100,000)</option>
                  <option value="Low">Low Cost Asset Pools (&lt; Rs. 10,000)</option>
                  <option value="Zero">Zero Valuation / Empty Inventory Sheets</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 8 && (
            <>
              <SearchableDropdown label="Target Warehouse Location:" placeholder="Location" options={locationOptions} value={criteria.location} onChange={(val) => handleInputChange('location', val)} />
              <SearchableDropdown label="Brand Name:" placeholder="Brand" options={brandOptions} value={criteria.brand} onChange={(val) => handleInputChange('brand', val)} />
              <SearchableDropdown label="Select Product Asset:" placeholder="Product" options={productOptions} value={criteria.product} onChange={(val) => handleInputChange('product', val)} />
              <div><label className="block font-bold text-gray-500 mb-1">As Of Date Cutoff:</label><input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.asOfDate} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; if (e.target.value > today) handleInputChange('asOfDate', today); else handleInputChange('asOfDate', e.target.value); }} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none" /></div>
            </>
          )}

          {activeTab === 1 && (
            <>
              <div><label className="block font-bold text-gray-500 mb-1">Date Bracket From:</label><input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.dateFrom} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; if (e.target.value > today) handleInputChange('dateFrom', today); else handleInputChange('dateFrom', e.target.value); }} className="w-full border border-stroke rounded p-2 bg-transparent font-semibold text-black dark:text-white text-xs outline-none dark:bg-boxdark" /></div>
              <div><label className="block font-bold text-gray-500 mb-1">Date Bracket To:</label><input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.dateTo} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; if (e.target.value > today) handleInputChange('dateTo', today); else handleInputChange('dateTo', e.target.value); }} className="w-full border border-stroke rounded p-2 bg-transparent font-semibold text-black dark:text-white text-xs outline-none dark:bg-boxdark" /></div>
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
          <button
            type="button"
            onClick={handleDispatchReportView}
            className="rounded bg-primary py-2.5 px-12 font-black text-white hover:bg-opacity-90 transition text-xs shadow-sm h-9 cursor-pointer uppercase tracking-wider"
          >
            Show Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockReport;
