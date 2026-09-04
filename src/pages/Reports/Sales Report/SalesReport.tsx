import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import SearchableDropdown from '../../../components/SearchableDropdown';

const SalesReport = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { tenantId } = useAuth();
    const [loading, setLoading] = useState(true);

    const initialReportType = (location.state?.reportType || location.state?.tab || location.state?.activeTab || 'sale') as 'sale' | 'return' | 'invoice';
    const [reportType, setReportType] = useState<'sale' | 'return' | 'invoice'>(initialReportType);

    const [customers, setCustomers] = useState<any[]>([]);
    const [salesmen, setSalesmen] = useState<any[]>([]);
    const [transports, setTransportFleet] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [uoms, setUoms] = useState<any[]>([]);

    const [bins, setBins] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);

    const [criteria, setCriteria] = useState(() => location.state?.criteria || ({
        customer: location.state?.customer || location.state?.criteria?.customer || 'All',
        salesman: location.state?.salesman || location.state?.criteria?.salesman || 'All',
        transport: location.state?.transport || location.state?.criteria?.transport || 'All',
        category: location.state?.category || location.state?.criteria?.category || 'All',
        uom: 'All', bin: 'All', product: 'All', location: 'All',
        saleType: 'All', saleMethod: 'All', invoiceNo: 'All',
        withLedgerSummary: false,
        dateFrom: location.state?.dateFrom || location.state?.criteria?.dateFrom || new Date().toISOString().split('T')[0],
        dateTo: location.state?.dateTo || location.state?.criteria?.dateTo || new Date().toISOString().split('T')[0]
    }));

    useEffect(() => {
        navigate('.', { replace: true, state: { ...location.state, reportType, criteria } });
    }, [reportType, criteria, navigate]);

    useEffect(() => {
        const fetchCriteriaLookups = async () => {
            try {
                setLoading(true);
                const [custRes, smRes, transRes, catRes, binRes, prodRes, locRes, invRes, uomRes] = await Promise.all([
                    supabase.from('customers').select('id, customerName'),
                    supabase.from('salesmen').select('id, name'),
                    supabase.from('logistics_transportation').select('id, name'),
                    supabase.from('inventory_categories').select('id, name'),
                    supabase.from('inventory_surface_finishes').select('id, name'),
                    supabase.from('products').select('id, product_name'),
                    supabase.from('inventory_locations').select('id, name'),
                    supabase.from('sales_invoices').select('id, total_amount, customer_name').order('id', { ascending: false }),
                    supabase.from('inventory_uom').select('id, short_code, full_name').eq('tenant_id', tenantId || 'bashir').eq('is_active', true)
                ]);

                if (custRes.data) setCustomers(custRes.data);
                if (smRes.data) setSalesmen(smRes.data);
                if (transRes.data) setTransportFleet(transRes.data);
                if (catRes.data) setCategories(catRes.data);
                if (binRes.data) setBins(binRes.data);
                if (prodRes.data) setProducts(prodRes.data);
                if (locRes.data) setLocations(locRes.data);
                if (invRes.data) setAvailableInvoices(invRes.data);

                if (uomRes.data) {
                    const normalizedUoms = uomRes.data.map((u: any) => ({
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
    }, [tenantId]);

    const handleInputChange = (field: string, value: any) => {
        setCriteria(prev => ({ ...prev, [field]: value }));
    };

    const handleTabChange = (type: 'sale' | 'return' | 'invoice') => {
        setReportType(type);
        setCriteria(prev => ({
            customer: 'All',
            salesman: 'All',
            transport: 'All',
            category: 'All',
            uom: 'All', bin: 'All', product: 'All', location: 'All',
            saleType: 'All', saleMethod: 'All', invoiceNo: 'All',
            withLedgerSummary: false,
            dateFrom: prev.dateFrom,
            dateTo: prev.dateTo
        }));
    };

    const customerOptions = useMemo(() => customers.map(c => c.customerName).filter(Boolean), [customers]);
    const salesmanOptions = useMemo(() => salesmen.map(s => s.name).filter(Boolean), [salesmen]);
    const transportOptions = useMemo(() => transports.map(t => t.name).filter(Boolean), [transports]);
    const categoryOptions = useMemo(() => categories.map(c => c.name).filter(Boolean), [categories]);
    const uomOptions = useMemo(() => uoms.map(u => u.name).filter(Boolean), [uoms]);

    const binOptions = useMemo(() => bins.map(b => b.name).filter(Boolean), [bins]);
    const productOptions = useMemo(() => products.map(p => p.product_name).filter(Boolean), [products]);
    const locationOptions = useMemo(() => locations.map(l => l.name).filter(Boolean), [locations]);
    const invoiceOptions = useMemo(() => availableInvoices.map(i => `INV-${String(i.id).padStart(4, '0')}`), [availableInvoices]);

    if (loading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;

    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-bodydark text-xs antialiased font-sans relative">
            <div>
                <h2 className="text-xl font-bold text-black dark:text-white">Commercial Sales Auditing Center</h2>
                <p className="text-xs text-gray-400">Isolate parameters and compile corporate distribution ledger records</p>
            </div>

            <div className="flex border-b border-stroke dark:border-strokedark gap-2 bg-white dark:bg-boxdark font-black tracking-wider text-[11px] uppercase text-gray-500">
                <button type="button" onClick={() => handleTabChange('sale')} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${reportType === 'sale' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black cursor-pointer'}`}>Sale Report</button>
                <button type="button" onClick={() => handleTabChange('return')} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${reportType === 'return' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black cursor-pointer'}`}>Sale Return Report</button>
                <button type="button" onClick={() => handleTabChange('invoice')} className={`py-2.5 px-6 font-bold uppercase transition tracking-wide text-xs border-b-2 cursor-pointer ${reportType === 'invoice' ? 'border-primary text-primary font-black' : 'border-transparent text-gray-400 hover:text-black cursor-pointer'}`}>Sale Invoice Report</button>
            </div>

            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
                <h3 className="font-bold text-sm text-black dark:text-white mb-4 uppercase tracking-wider text-primary">Report Criteria Specification</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    {reportType === 'sale' && (
                        <>
                            <SearchableDropdown label="Customer Group:" placeholder="Customer" options={customerOptions} value={criteria.customer} onChange={(val) => handleInputChange('customer', val)} />
                            <SearchableDropdown label="Sales Officer:" placeholder="Salesman" options={salesmanOptions} value={criteria.salesman} onChange={(val) => handleInputChange('salesman', val)} />
                            <SearchableDropdown label="Logistics Fleet:" placeholder="Fleet" options={transportOptions} value={criteria.transport} onChange={(val) => handleInputChange('transport', val)} />
                            <SearchableDropdown label="Product Category:" placeholder="Category" options={categoryOptions} value={criteria.category} onChange={(val) => handleInputChange('category', val)} />
                            <SearchableDropdown label="Product Groups (UOM):" placeholder="UOM" options={uomOptions} value={criteria.uom} onChange={(val) => handleInputChange('uom', val)} />

                            <SearchableDropdown label="Bin Allocation:" placeholder="Bin" options={binOptions} value={criteria.bin} onChange={(val) => handleInputChange('bin', val)} />
                            <SearchableDropdown label="Target Products:" placeholder="Product" options={productOptions} value={criteria.product} onChange={(val) => handleInputChange('product', val)} />
                            <SearchableDropdown label="Inventory Locations:" placeholder="Location" options={locationOptions} value={criteria.location} onChange={(val) => handleInputChange('location', val)} />
                            
                            <div>
                                <label className="block text-gray-500 mb-1 font-bold">Sale Type Allocation:</label>
                                <select value={criteria.saleType} onChange={(e) => handleInputChange('saleType', e.target.value)} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none">
                                    <option value="All">All Sale Types</option>
                                    <option value="Cash">Cash Sale</option>
                                    <option value="Credit">Credit Sale</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-500 mb-1 font-bold">Sale Method Mode:</label>
                                <select value={criteria.saleMethod} onChange={(e) => handleInputChange('saleMethod', e.target.value)} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none">
                                    <option value="All">All Sale Methods</option>
                                    <option value="Direct">Direct Sale</option>
                                    <option value="Challan">Via Challan Link</option>
                                </select>
                            </div>
                        </>
                    )}
                    {reportType === 'return' && (
                        <>
                            <SearchableDropdown label="Customer Group:" placeholder="Customer" options={customerOptions} value={criteria.customer} onChange={(val) => handleInputChange('customer', val)} />
                            <SearchableDropdown label="Product Category:" placeholder="Category" options={categoryOptions} value={criteria.category} onChange={(val) => handleInputChange('category', val)} />
                            <SearchableDropdown label="Product Groups (UOM):" placeholder="UOM" options={uomOptions} value={criteria.uom} onChange={(val) => handleInputChange('uom', val)} />

                            <SearchableDropdown label="Bin Allocation:" placeholder="Bin" options={binOptions} value={criteria.bin} onChange={(val) => handleInputChange('bin', val)} />
                            <SearchableDropdown label="Target Products:" placeholder="Product" options={productOptions} value={criteria.product} onChange={(val) => handleInputChange('product', val)} />
                            <SearchableDropdown label="Inventory Locations:" placeholder="Location" options={locationOptions} value={criteria.location} onChange={(val) => handleInputChange('location', val)} />
                        </>
                    )}

                    {reportType === 'invoice' && (
                        <>
                            <div className="md:col-span-2">
                                <SearchableDropdown
                                    label="Select Target Bill Invoice Profile: *"
                                    placeholder="Invoice"
                                    options={invoiceOptions}
                                    value={criteria.invoiceNo === 'All' ? 'All' : `INV-${String(criteria.invoiceNo).padStart(4, '0')}`}
                                    onChange={(val) => {
                                        const cleanVal = val === 'All' ? 'All' : val.replace(/^INV-/i, '');
                                        handleInputChange('invoiceNo', cleanVal);
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-5 md:col-span-2">
                                <input type="checkbox" id="withLedgerSummary" checked={criteria.withLedgerSummary} onChange={(e) => handleInputChange('withLedgerSummary', e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary border-stroke cursor-pointer" />
                                <label htmlFor="withLedgerSummary" className="font-bold text-gray-600 dark:text-white cursor-pointer select-none text-xs">With Customer Ledger Summary Master Report</label>
                            </div>
                        </>
                    )}

                    {reportType !== 'invoice' && (
                        <>
                            <div><label className="block font-bold text-gray-500 mb-1">Date From (Start):</label><input type="date" max={new Date().toISOString().split('T')[0]} value={criteria.dateFrom} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; let newDateFrom = e.target.value; if (newDateFrom > today) newDateFrom = today; handleInputChange('dateFrom', newDateFrom); if (reportType === 'detailed' || reportType === 'customer' || reportType === 'product') { const dFrom = new Date(newDateFrom); const dTo = new Date(criteria.dateTo); const diffDays = Math.ceil(Math.abs(dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)); if (dTo < dFrom || diffDays > 90) { const maxAllowed = new Date(dFrom.setDate(dFrom.getDate() + 90)).toISOString().split('T')[0]; handleInputChange('dateTo', maxAllowed < today ? maxAllowed : today); } } }} className="w-full border border-stroke rounded p-2 bg-transparent font-semibold text-black dark:text-white text-xs outline-none dark:bg-boxdark" /></div>
                            <div><label className="block font-bold text-gray-500 mb-1">Date To (End Date):</label><input type="date" min={criteria.dateFrom} max={criteria.dateFrom && (reportType === 'detailed' || reportType === 'customer' || reportType === 'product') ? [new Date(new Date(criteria.dateFrom).setDate(new Date(criteria.dateFrom).getDate() + 90)).toISOString().split('T')[0], new Date().toISOString().split('T')[0]].sort()[0] : new Date().toISOString().split('T')[0]} value={criteria.dateTo} onChange={(e) => { const today = new Date().toISOString().split('T')[0]; const maxAllowed = criteria.dateFrom && (reportType === 'detailed' || reportType === 'customer' || reportType === 'product') ? [new Date(new Date(criteria.dateFrom).setDate(new Date(criteria.dateFrom).getDate() + 90)).toISOString().split('T')[0], today].sort()[0] : today; let newDateTo = e.target.value; if (newDateTo > maxAllowed) newDateTo = maxAllowed; if (newDateTo < criteria.dateFrom) newDateTo = criteria.dateFrom; handleInputChange('dateTo', newDateTo); }} className="w-full border border-stroke rounded p-2 bg-transparent font-semibold text-black dark:text-white text-xs outline-none dark:bg-boxdark" /></div>
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
                        onClick={() => {
                            if (reportType === 'detailed' || reportType === 'customer' || reportType === 'product') {
                                if (criteria.dateFrom && criteria.dateTo) {
                                    const start = new Date(criteria.dateFrom);
                                    const end = new Date(criteria.dateTo);
                                    const diffTime = Math.abs(end.getTime() - start.getTime());
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    if (diffDays > 93) {
                                        toast.error("Please select a date range of 3 months or less for detailed reports.");
                                        return;
                                    }
                                }
                            }
                            navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Sales-Report/Print`, { state: { type: reportType, filters: criteria } });
                        }}
                        className="rounded bg-primary py-2.5 px-12 font-bold text-white hover:bg-opacity-90 transition text-xs shadow-sm h-9 cursor-pointer"
                    >
                        Generate Statement
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesReport;
