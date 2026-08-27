import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';

const SalesReport = () => {
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const [loading, setLoading] = useState(true);

    const [reportType, setReportType] = useState<'sale' | 'return' | 'invoice'>('sale');

    const [customers, setCustomers] = useState<any[]>([]);
    const [salesmen, setSalesmen] = useState<any[]>([]);
    const [transports, setTransportFleet] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [uoms, setUoms] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [criteria, setCriteria] = useState({
        customer: 'All', salesman: 'All', transport: 'All', category: 'All',
        uom: 'All', brand: 'All', product: 'All', location: 'All',
        saleType: 'All', saleMethod: 'All', invoiceNo: 'All',
        withLedgerSummary: false,
        dateFrom: new Date().toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const fetchCriteriaLookups = async () => {
            try {
                setLoading(true);
                const { data: cust } = await supabase.from('customers').select('id, customerName');
                const { data: sm } = await supabase.from('salesmen').select('id, name');
                const { data: trans } = await supabase.from('logistics_transportation').select('id, name');
                const { data: cat } = await supabase.from('inventory_categories').select('id, name');
                const { data: brnd } = await supabase.from('inventory_brands').select('id, name');
                const { data: prod } = await supabase.from('products').select('id, product_name');
                const { data: loc } = await supabase.from('inventory_locations').select('id, name');
                const { data: invData } = await supabase.from('sales_invoices').select('id, total_amount, customer_name').order('id', { ascending: false });

                const { data: uomData } = await supabase
                    .from('inventory_uom')
                    .select('id, short_code, full_name')
                    .eq('tenant_id', tenantId || 'bashir')
                    .eq('is_active', true);


                if (cust) setCustomers(cust);
                if (sm) setSalesmen(sm);
                if (trans) setTransportFleet(trans);
                if (cat) setCategories(cat);
                if (brnd) setBrands(brnd);
                if (prod) setProducts(prod);
                if (loc) setLocations(loc);
                if (invData) setAvailableInvoices(invData);

                if (uomData) {
                    const normalizedUoms = uomData.map((u: any) => ({
                        id: u.id,
                        name: `${u.short_code} = ${u.full_name}`
                    }));
                    setUoms(normalizedUoms);
                }
            } catch (err: any) {
                toast.error('Lookup Interruption: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCriteriaLookups();
    }, []);

    useEffect(() => {
        const closeDropdownOverlay = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.searchable-report-dropdown-container')) {
                document.getElementById('report-search-dropdown-list')?.classList.add('hidden');
            }
        };
        window.addEventListener('click', closeDropdownOverlay);
        return () => window.removeEventListener('click', closeDropdownOverlay);
    }, []);

    const handleInputChange = (field: string, value: any) => {
        setCriteria(prev => ({ ...prev, [field]: value }));
    };

    const getFilteredInvoices = () => {
        const term = searchQuery.trim().toLowerCase();
        if (!term) return availableInvoices;
        return availableInvoices.filter(i =>
            String(i.id).includes(term) ||
            String(i.customer_name || '').toLowerCase().includes(term)
        );
    };

    if (loading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-bodydark text-xs antialiased font-sans relative">
            <div>
                <h2 className="text-xl font-bold text-black dark:text-white">Commercial Sales Auditing Center</h2>
                <p className="text-xs text-gray-400">Isolate parameters and compile corporate distribution ledger records</p>
            </div>

            <div className="flex border-b border-stroke dark:border-strokedark gap-2 bg-white dark:bg-boxdark font-black tracking-wider text-[11px] uppercase text-gray-500">
                <button type="button" onClick={() => { setReportType('sale'); handleInputChange('invoiceNo', 'All'); setSearchQuery(''); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${reportType === 'sale' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black cursor-pointer'}`}>Sale Report</button>
                <button type="button" onClick={() => { setReportType('return'); handleInputChange('invoiceNo', 'All'); setSearchQuery(''); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${reportType === 'return' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black cursor-pointer'}`}>Sale Return Report</button>
                <button type="button" onClick={() => { setReportType('invoice'); handleInputChange('invoiceNo', 'All'); setSearchQuery(''); }} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${reportType === 'invoice' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black cursor-pointer'}`}>Sale Invoice Report</button>
            </div>

            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
                <h3 className="font-bold text-sm text-black dark:text-white mb-4 uppercase tracking-wider text-primary">Report Criteria Specification</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    {reportType === 'sale' && (
                        <>
                            <div><label className="block font-bold text-gray-500 mb-1">Customer Group:</label><select value={criteria.customer} onChange={(e) => handleInputChange('customer', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Customers</option>{customers.map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}</select></div>
                            <div><label className="block font-bold text-gray-500 mb-1">Sales Officer:</label><select value={criteria.salesman} onChange={(e) => handleInputChange('salesman', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Salesmen</option>{salesmen.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                            <div><label className="block text-gray-500 mb-1 font-bold">Logistics Fleet:</label><select value={criteria.transport} onChange={(e) => handleInputChange('transport', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Transportation</option>{transports.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></div>
                            <div><label className="block text-gray-500 mb-1 font-bold">Product Category:</label><select value={criteria.category} onChange={(e) => handleInputChange('category', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Categories</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                            <div><label className="block text-gray-500 mb-1 font-bold">Product Groups (UOM):</label><select value={criteria.uom} onChange={(e) => handleInputChange('uom', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All ProductGroups (UOM)</option>{uoms.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
                            <div><label className="block text-gray-500 mb-1 font-bold">Brands Allocation:</label><select value={criteria.brand} onChange={(e) => handleInputChange('brand', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Brands</option>{brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select></div>
                            <div><label className="block text-gray-500 mb-1 font-bold">Target Products:</label><select value={criteria.product} onChange={(e) => handleInputChange('product', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Products</option>{products.map(p => <option key={p.id} value={p.product_name}>{p.product_name}</option>)}</select></div>
                            <div><label className="block text-gray-500 mb-1 font-bold">Inventory Locations:</label><select value={criteria.location} onChange={(e) => handleInputChange('location', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Locations</option>{locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
                            <div><label className="block text-gray-500 mb-1 font-bold">Sale Type Allocation:</label><select value={criteria.saleType} onChange={(e) => handleInputChange('saleType', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Sale Types</option><option value="Cash">Cash Sale</option><option value="Credit">Credit Sale</option></select></div>
                            <div><label className="block text-gray-500 mb-1 font-bold">Sale Method Mode:</label><select value={criteria.saleMethod} onChange={(e) => handleInputChange('saleMethod', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Sale Methods</option><option value="Direct">Direct Sale</option><option value="Challan">Via Challan Link</option></select></div>
                        </>
                    )}
                    {reportType === 'return' && (
                        <>
                            <div><label className="block font-bold text-gray-500 mb-1">Customer Group:</label><select value={criteria.customer} onChange={(e) => handleInputChange('customer', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Customers</option>{customers.map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}</select></div>
                            <div><label className="block font-bold text-gray-500 mb-1">Product Category:</label><select value={criteria.category} onChange={(e) => handleInputChange('category', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Categories</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                            <div><label className="block font-bold text-gray-500 mb-1">Product Groups (UOM):</label><select value={criteria.uom} onChange={(e) => handleInputChange('uom', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All ProductGroups (UOM)</option>{uoms.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
                            <div><label className="block font-bold text-gray-500 mb-1">Brands Allocation:</label><select value={criteria.brand} onChange={(e) => handleInputChange('brand', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Brands</option>{brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select></div>
                            <div><label className="block font-bold text-gray-500 mb-1">Target Products:</label><select value={criteria.product} onChange={(e) => handleInputChange('product', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Products</option>{products.map(p => <option key={p.id} value={p.product_name}>{p.product_name}</option>)}</select></div>
                            <div><label className="block font-bold text-gray-500 mb-1">Inventory Locations:</label><select value={criteria.location} onChange={(e) => handleInputChange('location', e.target.value)} className="w-full border rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark"><option value="All">All Locations</option>{locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
                        </>
                    )}

                    {reportType === 'invoice' && (
                        <>
                            <div className="md:col-span-2 searchable-report-dropdown-container relative">
                                <label className="block font-bold text-gray-500 mb-1">Select Target Bill Invoice Profile: *</label>

                                <div
                                    onClick={() => document.getElementById('report-search-dropdown-list')?.classList.toggle('hidden')}
                                    className="w-full rounded border border-stroke dark:border-strokedark p-2 text-xs bg-white dark:bg-boxdark font-bold text-black dark:text-white cursor-pointer flex justify-between items-center h-[34px]"
                                >
                                    <span>
                                        {criteria.invoiceNo !== 'All' ? (() => {
                                            const matched = availableInvoices.find(i => String(i.id) === String(criteria.invoiceNo));
                                            return matched ? `INV-${String(matched.id).padStart(4, '0')} (Rs. {Number(matched.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})` : `INV-${criteria.invoiceNo}`;
                                        })() : `-- All Invoice Ledgers (${getFilteredInvoices().length} Found) --`}
                                    </span>
                                    <span className="text-gray-400 text-[9px]">▼</span>
                                </div>

                                <div id="report-search-dropdown-list" className="hidden absolute top-full left-0 w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark shadow-xl rounded-sm mt-1 z-99999 p-2 space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Type keywords to filter options list..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full rounded border border-stroke p-1.5 text-xs bg-transparent text-black dark:text-white outline-none focus:border-primary font-bold"
                                    />
                                    <div className="max-h-40 overflow-y-auto space-y-1 font-bold text-xs text-black dark:text-white">
                                        <div onClick={() => { handleInputChange('invoiceNo', 'All'); document.getElementById('report-search-dropdown-list')?.classList.add('hidden'); }} className="p-2 hover:bg-primary hover:text-white cursor-pointer rounded-sm text-gray-400 italic">-- All Invoice Ledgers --</div>
                                        {getFilteredInvoices().map(inv => (
                                            <div
                                                key={inv.id}
                                                onClick={() => { handleInputChange('invoiceNo', String(inv.id)); document.getElementById('report-search-dropdown-list')?.classList.add('hidden'); }}
                                                className="p-2 hover:bg-primary hover:text-white cursor-pointer rounded-sm transition-colors"
                                            >
                                                INV-{String(inv.id).padStart(4, '0')} (Rs. {Number(inv.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                                            </div>
                                        ))}
                                        {getFilteredInvoices().length === 0 && <div className="p-2 text-center text-gray-400 italic">No matching records.</div>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-5 md:col-span-2">
                                <input type="checkbox" id="withLedgerSummary" checked={criteria.withLedgerSummary} onChange={(e) => handleInputChange('withLedgerSummary', e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary border-stroke cursor-pointer" />
                                <label htmlFor="withLedgerSummary" className="font-bold text-gray-600 dark:text-white cursor-pointer select-none text-xs">With Customer Ledger Summary Master Report</label>
                            </div>
                        </>
                    )}

                    {reportType !== 'invoice' && (
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
                    <button
                        type="button"
                        onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Sales-Report/Print`, { state: { type: reportType, filters: criteria } })}
                        className="rounded bg-primary py-2.5 px-12 font-bold text-white hover:bg-opacity-90 transition text-xs shadow-sm h-9 cursor-pointer"
                    >
                        Show Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesReport;
