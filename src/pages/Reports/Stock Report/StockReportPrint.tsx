import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdPrint, MdArrowBack, MdFileDownload } from 'react-icons/md';
import { useAuth } from '../../../Context/Auth';
import { exportToExcel, ExcelColumn } from '../../../utils/excelExport';

const StockReportPrint = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { businessName, tenantId } = useAuth();
    const [loading, setLoading] = useState(true);

    const [reportRows, setReportRows] = useState<any[]>([]);

    const config = location.state || { tab: 1, filters: {} };
    const { tab: activeTab, filters } = config;

    useEffect(() => {
        const compileTrueDynamicStockDataset = async () => {
            try {
                setLoading(true);

                // Handling Stock Transfer Statement (Tab 4) separately
                if (activeTab === 4) {
                    let transferQuery = supabase.from('stock_transfers').select('*').order('created_at', { ascending: false });
                    const { data: transfers, error: transferError } = await transferQuery;
                    if (transferError) throw transferError;

                    const dateFromClean = filters.dateFrom ? String(filters.dateFrom).trim() : '';
                    const dateToClean = filters.dateTo ? String(filters.dateTo).trim() : '';
                    const targetLocation = String(filters.location || 'All').trim().toLowerCase();
                    const targetEmployee = String(filters.employee || 'All').trim().toLowerCase();
                    const targetProduct = String(filters.product || 'All').trim().toLowerCase();

                    const filteredTransfers = (transfers || []).filter((t: any) => {
                        const tDate = String(t.transfer_date || t.created_at || '').split('T')[0].split(' ')[0];
                        if (dateFromClean && tDate < dateFromClean) return false;
                        if (dateToClean && tDate > dateToClean) return false;

                        if (targetLocation !== 'all') {
                            const fromLoc = String(t.from_location || '').trim().toLowerCase();
                            const toLoc = String(t.to_location || '').trim().toLowerCase();
                            if (fromLoc !== targetLocation && toLoc !== targetLocation) return false;
                        }

                        if (targetEmployee !== 'all') {
                            const emp = String(t.employee || t.created_by || '').trim().toLowerCase();
                            if (!emp.includes(targetEmployee)) return false;
                        }

                        if (targetProduct !== 'all') {
                            const itemsArray = Array.isArray(t.items) ? t.items : JSON.parse(t.items || '[]');
                            const hasProd = itemsArray.some((i: any) =>
                                String(i.itemName || i.product_name || i.item_name || '').trim().toLowerCase().includes(targetProduct)
                            );
                            if (!hasProd) return false;
                        }

                        return true;
                    });

                    setReportRows(filteredTransfers);
                    return;
                }

                // 1. Fetch base product list mapping
                let prodQuery = supabase.from('products').select('*');
                if (filters.brand && filters.brand !== 'All') prodQuery = prodQuery.eq('brand', filters.brand);
                if (filters.category && filters.category !== 'All') prodQuery = prodQuery.eq('category', filters.category);

                const { data: baseProducts, error: prodError } = await prodQuery;
                if (prodError) throw prodError;

                // 2. Fetch live data streams from all transaction tables
                const { data: openStocks } = await supabase.from('opening_stocks').select('*');
                const { data: purchases } = await supabase.from('supplier_purchases').select('*');
                const { data: sales } = await supabase.from('sales_invoices').select('*');
                const { data: pReturns } = await supabase.from('purchase_returns').select('*');
                const { data: sReturns } = await supabase.from('sales_returns').select('*');

                const asOfDateClean = (activeTab === 3 && filters.asOfDate) ? String(filters.asOfDate).trim() : '';
                const dateFromClean = filters.dateFrom ? String(filters.dateFrom).trim() : '';
                const dateToClean = asOfDateClean || (filters.dateTo ? String(filters.dateTo).trim() : '');

                const parseDateStr = (item: any, dateFields: string[]) => {
                    for (const f of dateFields) {
                        if (item[f]) {
                            const str = String(item[f]).trim();
                            if (str.includes('T')) return str.split('T')[0];
                            if (str.includes(' ')) return str.split(' ')[0];
                            return str;
                        }
                    }
                    return '';
                };

                const calculatedAggregatedRows = (baseProducts || []).map(product => {
                    const name = String(product.product_name || '').trim().toLowerCase();
                    const targetLocation = String(filters.location || 'All').trim().toLowerCase();

                    // A. Calculate Base Opening Stock from initial opening_stocks table
                    const baseOpening = (openStocks || [])
                        .filter((os: any) => {
                            const osName = String(os.product_name || os.item_name || os.itemName || '').trim().toLowerCase();
                            const osLoc = String(os.location || os.target_warehouse || '').trim().toLowerCase();
                            const matchName = (osName === name || osName.includes(name));
                            const matchLoc = (targetLocation === 'all' || osLoc === targetLocation);
                            return matchName && matchLoc;
                        })
                        .reduce((sum: number, os: any) => sum + (Number(os.quantity || os.qty || 0)), 0);

                    let priorIn = 0;
                    let priorOut = 0;
                    let periodIn = 0;
                    let periodOut = 0;

                    // B. Purchases
                    (purchases || []).forEach((p: any) => {
                        const pLoc = String(p.target_warehouse || p.location || '').trim().toLowerCase();
                        const matchLoc = (targetLocation === 'all' || pLoc === targetLocation);

                        if (matchLoc && String(p.status).toLowerCase() !== 'cancel' && String(p.status).toLowerCase() !== 'deleted') {
                            const pDate = parseDateStr(p, ['purchase_date', 'created_at', 'date']);
                            const itemsArray = Array.isArray(p.items) ? p.items : JSON.parse(p.items || '[]');

                            itemsArray.forEach((item: any) => {
                                const pName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                                if (pName === name || pName.includes(name)) {
                                    const qty = Number(item.qty || item.quantity || 0);
                                    if (dateFromClean && pDate < dateFromClean) {
                                        priorIn += qty;
                                    } else if ((!dateFromClean || pDate >= dateFromClean) && (!dateToClean || pDate <= dateToClean)) {
                                        periodIn += qty;
                                    }
                                }
                            });
                        }
                    });

                    // C. Sales Returns (Stock In)
                    (sReturns || []).forEach((sr: any) => {
                        const srLoc = String(sr.dispatch_warehouse || sr.location || '').trim().toLowerCase();
                        const matchLoc = (targetLocation === 'all' || srLoc === targetLocation);

                        if (matchLoc && String(sr.status).toLowerCase() !== 'cancel') {
                            const srDate = parseDateStr(sr, ['return_date', 'created_at', 'date']);
                            const itemsArray = Array.isArray(sr.items) ? sr.items : JSON.parse(sr.items || '[]');

                            itemsArray.forEach((item: any) => {
                                const srName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                                if (srName === name || srName.includes(name)) {
                                    const qty = Number(item.qty || item.quantity || 0);
                                    if (dateFromClean && srDate < dateFromClean) {
                                        priorIn += qty;
                                    } else if ((!dateFromClean || srDate >= dateFromClean) && (!dateToClean || srDate <= dateToClean)) {
                                        periodIn += qty;
                                    }
                                }
                            });
                        }
                    });

                    // D. Sales Invoices (Stock Out)
                    (sales || []).forEach((s: any) => {
                        const sLoc = String(s.dispatch_warehouse || s.location || '').trim().toLowerCase();
                        const matchLoc = (targetLocation === 'all' || sLoc === targetLocation);
                        const statusClean = String(s.sale_status || '').trim().toLowerCase();
                        if (matchLoc && statusClean !== 'cancel' && statusClean !== 'deleted') {
                            const sDate = parseDateStr(s, ['sale_date', 'created_at', 'date']);
                            const itemsArray = Array.isArray(s.items) ? s.items : JSON.parse(s.items || '[]');

                            itemsArray.forEach((item: any) => {
                                const sName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                                if (sName === name || sName.includes(name)) {
                                    const qty = Number(item.qty || item.quantity || 0);
                                    if (dateFromClean && sDate < dateFromClean) {
                                        priorOut += qty;
                                    } else if ((!dateFromClean || sDate >= dateFromClean) && (!dateToClean || sDate <= dateToClean)) {
                                        periodOut += qty;
                                    }
                                }
                            });
                        }
                    });

                    // E. Purchase Returns (Stock Out)
                    (pReturns || []).forEach((pr: any) => {
                        const prLoc = String(pr.source_warehouse || pr.location || '').trim().toLowerCase();
                        const matchLoc = (targetLocation === 'all' || prLoc === targetLocation);

                        if (matchLoc && String(pr.status).toLowerCase() !== 'cancel') {
                            const prDate = parseDateStr(pr, ['return_date', 'created_at', 'date']);
                            const itemsArray = Array.isArray(pr.items) ? pr.items : JSON.parse(pr.items || '[]');

                            itemsArray.forEach((item: any) => {
                                const prName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
                                if (prName === name || prName.includes(name)) {
                                    const qty = Number(item.qty || item.quantity || 0);
                                    if (dateFromClean && prDate < dateFromClean) {
                                        priorOut += qty;
                                    } else if ((!dateFromClean || prDate >= dateFromClean) && (!dateToClean || prDate <= dateToClean)) {
                                        periodOut += qty;
                                    }
                                }
                            });
                        }
                    });

                    const computedOpening = baseOpening + priorIn - priorOut;
                    const netActivity = periodIn - periodOut;
                    const trueRemainingStock = computedOpening + netActivity;

                    return {
                        ...product,
                        computed_opening: computedOpening,
                        period_stock_in: periodIn,
                        period_stock_out: periodOut,
                        net_activity: netActivity,
                        computed_true_stock: trueRemainingStock,
                        calculated_valuation: trueRemainingStock * Number(product.retail_price || product.sale_price || 0)
                    };
                });

                // --- 📍 TAB 8 SPECIFIC: PER-LOCATION DYNAMIC TRANSACTION LEDGER BREAKDOWN ---
                if (activeTab === 8) {
                    const { data: dbLocs } = await supabase.from('inventory_locations').select('name');
                    const registeredLocs = (dbLocs && dbLocs.length > 0)
                        ? dbLocs.map(l => String(l.name).trim())
                        : ['Market', 'Latifabad', 'Main Warehouse'];

                    const { data: transfers } = await supabase.from('stock_transfers').select('*');

                    const locationRows: any[] = [];
                    const targetLocFilter = String(filters.location || 'All').trim().toLowerCase();

                    for (const product of (baseProducts || [])) {
                        const name = String(product.product_name || '').trim().toLowerCase();
                        const rate = Number(product.retail_price || product.sale_price || product.price || 0);

                        const locationStockMap: { [loc: string]: number } = {};

                        const getNormalizedLocName = (rawLoc: string) => {
                            if (!rawLoc) return registeredLocs[0] || 'Market';
                            const clean = String(rawLoc).trim();
                            const matched = registeredLocs.find(l => l.toLowerCase() === clean.toLowerCase());
                            return matched || clean;
                        };

                        // 1. Opening Stock
                        (openStocks || []).forEach((os: any) => {
                            const osName = String(os.product_name || os.item_name || os.itemName || '').trim().toLowerCase();
                            if (osName === name || osName.includes(name)) {
                                const loc = getNormalizedLocName(os.location || os.target_warehouse || os.warehouse_name);
                                const qty = Number(os.quantity || os.qty || 0);
                                locationStockMap[loc] = (locationStockMap[loc] || 0) + qty;
                            }
                        });

                        // 2. Purchases (Stock In)
                        (purchases || []).forEach((p: any) => {
                            if (String(p.status).toLowerCase() !== 'cancel' && String(p.status).toLowerCase() !== 'deleted') {
                                const loc = getNormalizedLocName(p.target_warehouse || p.location);
                                const items = Array.isArray(p.items) ? p.items : JSON.parse(p.items || '[]');
                                items.forEach((i: any) => {
                                    const iName = String(i.product_name || i.itemName || i.item_name || '').trim().toLowerCase();
                                    if (iName === name || iName.includes(name)) {
                                        const qty = Number(i.qty || i.quantity || 0);
                                        locationStockMap[loc] = (locationStockMap[loc] || 0) + qty;
                                    }
                                });
                            }
                        });

                        // 3. Sales Returns (Stock In)
                        (sReturns || []).forEach((sr: any) => {
                            if (String(sr.status).toLowerCase() !== 'cancel') {
                                const loc = getNormalizedLocName(sr.dispatch_warehouse || sr.location);
                                const items = Array.isArray(sr.items) ? sr.items : JSON.parse(sr.items || '[]');
                                items.forEach((i: any) => {
                                    const iName = String(i.product_name || i.itemName || i.item_name || '').trim().toLowerCase();
                                    if (iName === name || iName.includes(name)) {
                                        const qty = Number(i.qty || i.quantity || 0);
                                        locationStockMap[loc] = (locationStockMap[loc] || 0) + qty;
                                    }
                                });
                            }
                        });

                        // 4. Stock Transfers (Movement between locations)
                        (transfers || []).forEach((t: any) => {
                            if (String(t.status).toLowerCase() !== 'cancelled') {
                                const fromLoc = getNormalizedLocName(t.from_location);
                                const toLoc = getNormalizedLocName(t.to_location);
                                const items = Array.isArray(t.items) ? t.items : JSON.parse(t.items || '[]');
                                items.forEach((i: any) => {
                                    const iName = String(i.product_name || i.itemName || i.item_name || '').trim().toLowerCase();
                                    if (iName === name || iName.includes(name)) {
                                        const qty = Number(i.qty || i.quantity || 0);
                                        locationStockMap[fromLoc] = (locationStockMap[fromLoc] || 0) - qty;
                                        locationStockMap[toLoc] = (locationStockMap[toLoc] || 0) + qty;
                                    }
                                });
                            }
                        });

                        // 5. Sales Invoices (Stock Out)
                        (sales || []).forEach((s: any) => {
                            const statusClean = String(s.sale_status || '').trim().toLowerCase();
                            if (statusClean !== 'cancel' && statusClean !== 'deleted') {
                                const loc = getNormalizedLocName(s.dispatch_warehouse || s.location);
                                const items = Array.isArray(s.items) ? s.items : JSON.parse(s.items || '[]');
                                items.forEach((i: any) => {
                                    const iName = String(i.product_name || i.itemName || i.item_name || '').trim().toLowerCase();
                                    if (iName === name || iName.includes(name)) {
                                        const qty = Number(i.qty || i.quantity || 0);
                                        locationStockMap[loc] = (locationStockMap[loc] || 0) - qty;
                                    }
                                });
                            }
                        });

                        // 6. Purchase Returns (Stock Out)
                        (pReturns || []).forEach((pr: any) => {
                            if (String(pr.status).toLowerCase() !== 'cancel') {
                                const loc = getNormalizedLocName(pr.source_warehouse || pr.location);
                                const items = Array.isArray(pr.items) ? pr.items : JSON.parse(pr.items || '[]');
                                items.forEach((i: any) => {
                                    const iName = String(i.product_name || i.itemName || i.item_name || '').trim().toLowerCase();
                                    if (iName === name || iName.includes(name)) {
                                        const qty = Number(i.qty || i.quantity || 0);
                                        locationStockMap[loc] = (locationStockMap[loc] || 0) - qty;
                                    }
                                });
                            }
                        });

                        const activeLocations = Object.keys(locationStockMap);
                        if (activeLocations.length === 0) {
                            activeLocations.push(registeredLocs[0] || 'Market');
                            locationStockMap[activeLocations[0]] = Number(product.current_stock || product.stock || 0);
                        }

                        for (const locName of activeLocations) {
                            const qty = locationStockMap[locName] || 0;
                            if (targetLocFilter === 'all' || locName.toLowerCase() === targetLocFilter) {
                                locationRows.push({
                                    ...product,
                                    id: `${product.id}_${locName}`,
                                    warehouse_location: locName,
                                    computed_true_stock: qty,
                                    calculated_valuation: qty * rate
                                });

                                try {
                                    await supabase.from('warehouse_inventory').upsert({
                                        product_name: product.product_name,
                                        warehouse_name: locName,
                                        quantity: qty
                                    }, { onConflict: 'product_name,warehouse_name' });
                                } catch (e) {}
                            }
                        }
                    }

                    let finalLocPool = locationRows;
                    if (filters.product && filters.product !== 'All') {
                        finalLocPool = finalLocPool.filter(p => p.product_name === filters.product);
                    }
                    setReportRows(finalLocPool);
                    setLoading(false);
                    return;
                }

                let finalFilteredPool = calculatedAggregatedRows;

                if (filters.product && filters.product !== 'All') {
                    finalFilteredPool = finalFilteredPool.filter(p => p.product_name === filters.product);
                }

                setReportRows(finalFilteredPool);
            } catch (err: any) {
                toast.error('Dynamic inventory matching trace failed: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        compileTrueDynamicStockDataset();
    }, [activeTab, filters]);

    const [exporting, setExporting] = useState(false);

    const handleExportExcel = async () => {
        try {
            setExporting(true);
            const tabTitles: Record<number, string> = {
                1: 'Stock Activity Report',
                2: 'Stock Balance Report',
                3: 'Stock Status Report',
                4: 'Stock Transfer Statement',
                5: 'Stock Detail With Price',
                6: 'Product Catalog Specs',
                7: 'Stock Status Detail',
                8: 'Per Location Stock Ledger'
            };

            const tabTitle = tabTitles[activeTab] || 'Stock Report';
            const filterMeta = {
                'Report Tab': tabTitle,
                'Brand': filters.brand || 'All',
                'Category': filters.category || 'All',
                'Product': filters.product || 'All',
                'Location': filters.location || 'All',
                'Date Window': filters.dateFrom || filters.dateTo ? `${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}` : 'All Time'
            };

            let columns: ExcelColumn[] = [];
            let exportData: any[] = [];

            if (activeTab === 1) {
                columns = [
                    { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
                    { header: 'Product Item Name', key: 'product_name', width: 28 },
                    { header: 'Brand', key: 'brand', width: 16 },
                    { header: 'Category', key: 'category', width: 16 },
                    { header: 'Opening Stock', key: 'computed_opening', width: 16, type: 'number' },
                    { header: 'Stock In', key: 'period_stock_in', width: 14, type: 'number' },
                    { header: 'Stock Out', key: 'period_stock_out', width: 14, type: 'number' },
                    { header: 'Net Movement', key: 'net_activity', width: 16, type: 'number' },
                    { header: 'Ending Stock', key: 'computed_true_stock', width: 16, type: 'number' },
                    { header: 'Valuation (Rs.)', key: 'calculated_valuation', width: 20, type: 'currency' }
                ];
                exportData = reportRows.map((r, i) => ({ idx: i + 1, ...r }));
            } else if (activeTab === 4) {
                columns = [
                    { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
                    { header: 'Transfer Date', key: 'date', width: 16, type: 'date' },
                    { header: 'Transfer ID', key: 'transfer_no', width: 16 },
                    { header: 'Origin Warehouse', key: 'from_location', width: 20 },
                    { header: 'Target Warehouse', key: 'to_location', width: 20 },
                    { header: 'Handler Employee', key: 'employee', width: 18 },
                    { header: 'Total Quantity', key: 'total_quantity', width: 16, type: 'number' }
                ];
                exportData = reportRows.map((r, i) => ({
                    idx: i + 1,
                    date: r.transfer_date || String(r.created_at || '').split('T')[0],
                    transfer_no: r.transfer_no || `TR-${r.id}`,
                    from_location: r.from_location,
                    to_location: r.to_location,
                    employee: r.employee || r.created_by || 'Officer',
                    total_quantity: Number(r.total_quantity || 0)
                }));
            } else {
                columns = [
                    { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
                    { header: 'Product Item Name', key: 'product_name', width: 28 },
                    { header: 'Brand', key: 'brand', width: 16 },
                    { header: 'Category', key: 'category', width: 16 },
                    { header: 'UOM', key: 'uom', width: 12 },
                    { header: 'Current Stock', key: 'current_stock', width: 16, type: 'number' },
                    { header: 'Unit Rate (Rs.)', key: 'price', width: 16, type: 'currency' },
                    { header: 'Valuation (Rs.)', key: 'valuation', width: 20, type: 'currency' }
                ];
                exportData = reportRows.map((r, i) => {
                    const stk = Number(r.computed_true_stock !== undefined ? r.computed_true_stock : r.current_stock || 0);
                    const prc = Number(r.retail_price || r.sale_price || r.price || 0);
                    return {
                        idx: i + 1,
                        product_name: r.product_name,
                        brand: r.brand || '-',
                        category: r.category || '-',
                        uom: r.uom || 'Pcs',
                        current_stock: stk,
                        price: prc,
                        valuation: stk * prc
                    };
                });
            }

            await exportToExcel({
                fileName: `Stock_Report_Tab${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`,
                sheetName: tabTitle.substring(0, 30),
                companyName: businessName || 'ZOHAIB ALI & COMPANY',
                reportTitle: `Master Dynamic Inventory - ${tabTitle}`,
                filterSummary: filterMeta,
                columns,
                data: exportData,
                theme: 'emerald'
            });

            toast.success('Excel workbook exported successfully!');
        } catch (err: any) {
            console.error(err);
            toast.error('Export failed: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;

    return (
        <div className="w-full bg-white text-black p-6 space-y-6 text-xs min-h-screen print:absolute print:top-0 print:left-0 print:w-screen print:h-screen print:p-0 print:m-0 print:bg-white print:text-black">
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          body * { visibility: hidden !important; }
          .print-root-container, .print-root-container * { visibility: visible !important; }
          .print-root-container { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; z-index: 999999 !important; background: white !important; }
          aside, header, nav, .print-hidden-element, button { display: none !important; visibility: hidden !important; }
        }
      `}} />

            <div className="print-root-container w-full bg-white p-4 space-y-6">
                <div className="flex justify-between items-center bg-gray-100 p-3 rounded border print-hidden-element print:hidden">
                    <button type="button" onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Stock-Report`)} className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer"><MdArrowBack size={16} /> Return to Auditing Center</button>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={exporting}
                            onClick={handleExportExcel}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-4 rounded font-bold cursor-pointer transition shadow-sm disabled:opacity-50"
                        >
                            <MdFileDownload size={16} /> {exporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}
                        </button>
                        <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 bg-primary text-white py-1.5 px-5 rounded font-black cursor-pointer hover:bg-opacity-90 transition shadow-sm"><MdPrint size={16} /> Print Workbook Report</button>
                    </div>
                </div>

                <div className="text-center space-y-1 py-4 border-b border-double border-black">
                    <h1 className="text-xl font-black uppercase tracking-widest font-serif">ZOHAIB ALI & COMPANY</h1>
                    <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Master Dynamic Inventory Valuation & Real-Time Stock Balance Ledger</p>

                    <div className="text-[10px] pt-1 font-mono flex justify-between px-2 text-gray-600">
                        <span>Workbook Subtype: <b className="text-black uppercase underline">
                            {activeTab === 1 && 'Stock Activity Report'}
                            {activeTab === 2 && 'Stock Balance Report'}
                            {activeTab === 3 && 'Stock Status Report'}
                            {activeTab === 4 && 'Stock Transfer Statement'}
                            {activeTab === 5 && 'Detailed Pricing Metrics Sheet'}
                            {activeTab === 6 && 'Core Product Specification Log'}
                            {activeTab === 7 && 'Status Detail Valuation Ledger'}
                            {activeTab === 8 && 'Location Stock Breakdown Statement'}
                        </b></span>
                        {(activeTab === 1 || activeTab === 4) && filters.dateFrom && filters.dateTo && (
                            <span className="font-bold text-primary">
                                Date Period: {filters.dateFrom} to {filters.dateTo}
                            </span>
                        )}
                        <span>
                            {(activeTab === 3 || activeTab === 8) && filters.asOfDate
                                ? `Audit Evaluation Date (As Of): ${filters.asOfDate}`
                                : `Live Audit Evaluation Date: ${new Date().toLocaleDateString()}`}
                        </span>
                    </div>
                </div>

                <div className="w-full overflow-x-auto">
                    {/* --- 📊 RENDER CHANNEL 1: STOCK ACTIVITY REPORT (TAB 1) --- */}
                    {activeTab === 1 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-10">Index</th>
                                    <th className="p-1.5 border border-black">Product Stock Asset Identifier</th>
                                    <th className="p-1.5 border border-black">Group (UOM)</th>
                                    <th className="p-1.5 border border-black">Brand / Category</th>
                                    <th className="p-1.5 border border-black text-right pr-2">Opening Stock</th>
                                    <th className="p-1.5 border border-black text-right pr-2 text-emerald-700">Stock In</th>
                                    <th className="p-1.5 border border-black text-right pr-2 text-rose-700">Stock Out</th>
                                    <th className="p-1.5 border border-black text-right pr-2">Net Movement</th>
                                    <th className="p-1.5 border border-black text-right pr-3 font-bold">Remaining Stock</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, idx) => (
                                    <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                        <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                                        <td className="p-1.5 border border-black font-bold text-black font-sans uppercase">{row.product_name}</td>
                                        <td className="p-1.5 border border-black uppercase">{row.uom || 'PC'}</td>
                                        <td className="p-1.5 border border-black font-sans"><span className="text-teal-700 font-bold">{row.brand || 'Generic'}</span> / <span className="text-gray-500">{row.category || 'General'}</span></td>
                                        <td className="p-1.5 border border-black text-right pr-2 font-mono text-gray-700">{Number(row.computed_opening || 0).toLocaleString()}</td>
                                        <td className="p-1.5 border border-black text-right pr-2 font-mono text-emerald-700 font-bold">+{Number(row.period_stock_in || 0).toLocaleString()}</td>
                                        <td className="p-1.5 border border-black text-right pr-2 font-mono text-rose-700 font-bold">-{Number(row.period_stock_out || 0).toLocaleString()}</td>
                                        <td className={`p-1.5 border border-black text-right pr-2 font-mono font-bold ${row.net_activity >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                            {row.net_activity > 0 ? `+${row.net_activity.toLocaleString()}` : row.net_activity.toLocaleString()}
                                        </td>
                                        <td className="p-1.5 border border-black text-right pr-3 text-success font-black font-mono">{Number(row.computed_true_stock || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t border-black font-black font-mono text-xs">
                                    <td colSpan={4} className="p-2 border border-black text-right uppercase tracking-wider text-gray-700">Total Consolidated Summary:</td>
                                    <td className="p-2 border border-black text-right pr-2 text-gray-700">{reportRows.reduce((s, r) => s + (r.computed_opening || 0), 0).toLocaleString()}</td>
                                    <td className="p-2 border border-black text-right pr-2 text-emerald-700">+{reportRows.reduce((s, r) => s + (r.period_stock_in || 0), 0).toLocaleString()}</td>
                                    <td className="p-2 border border-black text-right pr-2 text-red-700">-{reportRows.reduce((s, r) => s + (r.period_stock_out || 0), 0).toLocaleString()}</td>
                                    <td className="p-2 border border-black text-right pr-2 text-purple-700">{reportRows.reduce((s, r) => s + (r.net_activity || 0), 0).toLocaleString()}</td>
                                    <td className="p-2 border border-black text-right pr-3 text-success font-black">{reportRows.reduce((s, r) => s + (r.computed_true_stock || 0), 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {/* --- 📊 RENDER CHANNEL 2: STANDARD LEDGER BALANCES (TABS 2, 6) --- */}
                    {(activeTab === 2 || activeTab === 6) && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black">Product Stock Asset Identifier</th>
                                    <th className="p-1.5 border border-black">Group (UOM)</th>
                                    <th className="p-1.5 border border-black">Brand Link</th>
                                    <th className="p-1.5 border border-black">Category</th>
                                    <th className="p-1.5 border border-black text-right pr-3">Dynamic Remaining Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, idx) => (
                                    <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                        <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                                        <td className="p-1.5 border border-black font-bold text-black font-sans uppercase">{row.product_name}</td>
                                        <td className="p-1.5 border border-black uppercase">{row.uom || 'PC'}</td>
                                        <td className="p-1.5 border border-black text-purple-700 font-sans">{row.brand || 'Generic'}</td>
                                        <td className="p-1.5 border border-black font-sans text-gray-500">{row.category || 'General'}</td>
                                        <td className="p-1.5 border border-black text-right pr-3 text-success font-black">{Number(row.computed_true_stock || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t border-black font-black font-mono text-xs">
                                    <td colSpan={5} className="p-2 border border-black text-right uppercase tracking-wider text-gray-700">Total Consolidated Balance Sum:</td>
                                    <td className="p-2 border border-black text-right pr-3 text-success font-black text-sm">{reportRows.reduce((s, r) => s + (r.computed_true_stock || 0), 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {/* --- 📊 RENDER CHANNEL 3: STOCK STATUS REPORT (TAB 3) --- */}
                    {activeTab === 3 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black">Product Stock Asset Identifier</th>
                                    <th className="p-1.5 border border-black">Warehouse Location</th>
                                    <th className="p-1.5 border border-black">Brand / Category</th>
                                    <th className="p-1.5 border border-black text-center">Stock Availability Status</th>
                                    <th className="p-1.5 border border-black text-right pr-3">Dynamic Remaining Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, idx) => {
                                    const qty = Number(row.computed_true_stock || 0);
                                    const loc = filters.location && filters.location !== 'All' ? filters.location : 'All Warehouses';
                                    let statusBadge = (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-green-100 text-green-800 border border-green-300">
                                            In Stock
                                        </span>
                                    );
                                    if (qty <= 0) {
                                        statusBadge = (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-300">
                                                Out of Stock
                                            </span>
                                        );
                                    } else if (qty <= 10) {
                                        statusBadge = (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-yellow-100 text-yellow-800 border border-yellow-300">
                                                Low Stock
                                            </span>
                                        );
                                    }

                                    return (
                                        <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                            <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                                            <td className="p-1.5 border border-black font-bold text-black font-sans uppercase">{row.product_name}</td>
                                            <td className="p-1.5 border border-black font-sans text-gray-700 font-bold">{loc}</td>
                                            <td className="p-1.5 border border-black font-sans"><span className="text-purple-700 font-bold">{row.brand || 'Generic'}</span> / <span className="text-gray-500">{row.category || 'General'}</span></td>
                                            <td className="p-1.5 border border-black text-center">{statusBadge}</td>
                                            <td className="p-1.5 border border-black text-right pr-3 text-success font-black">{qty.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t border-black font-black font-mono text-xs">
                                    <td colSpan={5} className="p-2 border border-black text-right uppercase tracking-wider text-gray-700">Total Available Inventory Units:</td>
                                    <td className="p-2 border border-black text-right pr-3 text-success font-black text-sm">{reportRows.reduce((s, r) => s + (r.computed_true_stock || 0), 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {/* --- 📊 RENDER CHANNEL 3: STOCK TRANSFER STATEMENT (TAB 4) --- */}
                    {activeTab === 4 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black">Transfer Slip #</th>
                                    <th className="p-1.5 border border-black">Transfer Date</th>
                                    <th className="p-1.5 border border-black">From Location</th>
                                    <th className="p-1.5 border border-black">To Location</th>
                                    <th className="p-1.5 border border-black">Items Transferred</th>
                                    <th className="p-1.5 border border-black text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((tr, idx) => {
                                    const itemsArray = Array.isArray(tr.items) ? tr.items : JSON.parse(tr.items || '[]');
                                    const itemSummary = itemsArray.map((i: any) => `${i.itemName || i.product_name} (${i.qty || 1} ${i.uom || ''})`).join(', ');

                                    return (
                                        <tr key={tr.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                            <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                                            <td className="p-1.5 border border-black font-bold text-primary font-sans">{tr.transfer_no || `TRF-${tr.id}`}</td>
                                            <td className="p-1.5 border border-black">{tr.transfer_date || tr.created_at?.split('T')[0]}</td>
                                            <td className="p-1.5 border border-black font-sans text-red-700 font-bold">{tr.from_location}</td>
                                            <td className="p-1.5 border border-black font-sans text-green-700 font-bold">{tr.to_location}</td>
                                            <td className="p-1.5 border border-black font-sans text-gray-700">{itemSummary || 'N/A'}</td>
                                            <td className="p-1.5 border border-black text-center font-bold text-purple-700 uppercase">{tr.status || 'Confirmed'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* --- 📊 RENDER CHANNEL 4: REAL-TIME ADAPTIVE PRICING COLUMNS VISIBILITY SHEET (TAB 5) --- */}
                    {activeTab === 5 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black">Product Stock Asset Name</th>
                                    <th className="p-1.5 border border-black text-center w-16">Bal Qty</th>
                                    {filters.showSalePrice && <th className="p-1.5 border border-black text-right w-28">Retail Sale (PKR)</th>}
                                    {filters.showPurchasePrice && <th className="p-1.5 border border-black text-right w-28">Purchase Cost (PKR)</th>}
                                    {filters.showFinalPrice && <th className="p-1.5 border border-black text-right w-32 pr-3">Net Asset Valuation</th>}
                                    {filters.showSpecifications && <th className="p-1.5 border border-black font-sans text-gray-500">Technical Specifications Sheet Overview</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, idx) => {
                                    const qty = Number(row.computed_true_stock || 0);
                                    const sPrice = Number(row.sale_price ?? row.retail_price ?? row.price ?? row.unit_price ?? row.mrp ?? row.rp ?? 0);
                                    const pPrice = Number(row.purchase_price ?? row.cost_price ?? row.buy_price ?? row.cost ?? row.tp ?? 0);
                                    const netValue = qty * sPrice;

                                    return (
                                        <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                            <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                                            <td className="p-1.5 border border-black font-bold text-black font-sans uppercase">{row.product_name}</td>
                                            <td className="p-1.5 border border-black text-center text-primary font-black">{qty.toLocaleString()}</td>
                                            {filters.showSalePrice && <td className="p-1.5 border border-black text-right text-gray-600">Rs. {sPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                                            {filters.showPurchasePrice && <td className="p-1.5 border border-black text-right text-purple-700">Rs. {pPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                                            {filters.showFinalPrice && <td className="p-1.5 border border-black text-right text-success font-black pr-3">Rs. {netValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                                            {filters.showSpecifications && (
                                                <td className="p-1.5 border border-black font-sans text-[10px] text-gray-500 whitespace-normal break-words leading-relaxed max-w-sm">
                                                    {row.product_description || row.specifications || row.description || (row.hs_code ? `HS: ${row.hs_code}` : 'N/A')}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t border-black font-black font-mono text-xs">
                                    <td colSpan={2} className="p-2 border border-black text-right uppercase tracking-wider text-gray-700">Total Consolidated Assets Valuation:</td>
                                    <td className="p-2 border border-black text-center text-primary font-black">{reportRows.reduce((s, r) => s + (r.computed_true_stock || 0), 0).toLocaleString()}</td>
                                    {filters.showSalePrice && <td className="p-2 border border-black"></td>}
                                    {filters.showPurchasePrice && <td className="p-2 border border-black"></td>}
                                    {filters.showFinalPrice && (
                                        <td className="p-2 border border-black text-right pr-3 text-success font-black text-sm">
                                            Rs. {reportRows.reduce((s, r) => {
                                                const q = Number(r.computed_true_stock || 0);
                                                const sp = Number(r.sale_price ?? r.retail_price ?? r.price ?? r.unit_price ?? r.mrp ?? r.rp ?? 0);
                                                return s + (q * sp);
                                            }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    )}
                                    {filters.showSpecifications && <td className="p-2 border border-black"></td>}
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {/* --- 📊 RENDER CHANNEL 5: FINANCIAL REAL-TIME VALUE TIERS SUMMARY STATEMENT (TAB 7) --- */}
                    {activeTab === 7 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black">Stock Asset Description</th>
                                    <th className="p-1.5 border border-black">Brand Link</th>
                                    <th className="p-1.5 border border-black text-center w-20">Units Count</th>
                                    <th className="p-1.5 border border-black text-right w-24">Unit Rate</th>
                                    <th className="p-1.5 border border-black text-right w-36 pr-4 bg-green-50/30 text-success">Aggregated StockValue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, idx) => {
                                    const qty = Number(row.computed_true_stock || 0);
                                    const rate = Number(row.retail_price || row.sale_price || 0);

                                    return (
                                        <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                            <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                                            <td className="p-1.5 border border-black font-bold text-black font-sans uppercase">{row.product_name}</td>
                                            <td className="p-1.5 border border-black uppercase text-purple-700">{row.brand || 'Generic'}</td>
                                            <td className="p-1.5 border border-black text-center text-primary font-black">{qty.toLocaleString()}</td>
                                            <td className="p-1.5 border border-black text-right">Rs. {rate.toLocaleString()}</td>
                                            <td className="p-1.5 border border-black text-right pr-4 text-success font-black bg-success/5">Rs. {row.calculated_valuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                                    <td colSpan={5} className="p-2 border border-black text-right uppercase tracking-wider text-gray-500">Gross Consolidated StockValue Assets Allocation Sum (PKR):</td>
                                    <td className="p-2 border border-black text-right pr-4 text-success underline decoration-double text-sm bg-success/10 font-black">
                                        Rs. {reportRows.reduce((sum, r) => sum + (r.calculated_valuation || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {/* --- 📊 RENDER CHANNEL 6: LOCATION WAREHOUSE STOCK AUDIT STATEMENT (TAB 8) --- */}
                    {activeTab === 8 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black">Warehouse Location</th>
                                    <th className="p-1.5 border border-black">Product Stock Asset Name</th>
                                    <th className="p-1.5 border border-black">Group (UOM) / Brand</th>
                                    <th className="p-1.5 border border-black text-center w-28">Available Stock</th>
                                    <th className="p-1.5 border border-black text-right w-28">Unit Sale Rate</th>
                                    <th className="p-1.5 border border-black text-right w-36 pr-3 text-success">Location Asset Valuation</th>
                                    <th className="p-1.5 border border-black text-center w-28">Stock Availability</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, idx) => {
                                    const qty = Number(row.computed_true_stock || 0);
                                    const sPrice = Number(row.sale_price ?? row.retail_price ?? row.price ?? row.unit_price ?? row.mrp ?? row.rp ?? 0);
                                    const netValue = qty * sPrice;
                                    const locName = row.warehouse_location || (filters.location && filters.location !== 'All' ? filters.location : 'Main Warehouse');

                                    let statusBadge = (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-green-100 text-green-800 border border-green-300">
                                            In Stock
                                        </span>
                                    );
                                    if (qty <= 0) {
                                        statusBadge = (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-300">
                                                Out of Stock
                                            </span>
                                        );
                                    } else if (qty <= 10) {
                                        statusBadge = (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-yellow-100 text-yellow-800 border border-yellow-300">
                                                Low Stock
                                            </span>
                                        );
                                    }

                                    return (
                                        <tr key={row.id || idx} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                            <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                                            <td className="p-1.5 border border-black font-sans font-bold text-purple-800 uppercase bg-purple-50/40">{locName}</td>
                                            <td className="p-1.5 border border-black font-bold text-black font-sans uppercase">{row.product_name}</td>
                                            <td className="p-1.5 border border-black font-sans"><span className="text-gray-700">{row.uom || 'PC'}</span> / <span className="text-purple-700 font-bold">{row.brand || 'Generic'}</span></td>
                                            <td className="p-1.5 border border-black text-center text-primary font-black text-sm">{qty.toLocaleString()}</td>
                                            <td className="p-1.5 border border-black text-right text-gray-600">Rs. {sPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="p-1.5 border border-black text-right text-success font-black pr-3 bg-success/5">Rs. {netValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="p-1.5 border border-black text-center">{statusBadge}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t border-black font-black font-mono text-xs">
                                    <td colSpan={4} className="p-2 border border-black text-right uppercase tracking-wider text-gray-700">Total Location Stock & Valuation Summary:</td>
                                    <td className="p-2 border border-black text-center text-primary font-black text-sm">{reportRows.reduce((s, r) => s + (r.computed_true_stock || 0), 0).toLocaleString()}</td>
                                    <td className="p-2 border border-black"></td>
                                    <td className="p-2 border border-black text-right pr-3 text-success font-black text-sm bg-success/10">
                                        Rs. {reportRows.reduce((sum, r) => {
                                            const q = Number(r.computed_true_stock || 0);
                                            const sp = Number(r.sale_price ?? r.retail_price ?? r.price ?? r.unit_price ?? r.mrp ?? r.rp ?? 0);
                                            return sum + (q * sp);
                                        }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 border border-black"></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {reportRows.length === 0 && (
                        <div className="p-12 text-center border font-bold italic text-gray-400 bg-gray-50/50">No true live ledger rows discovered matching chosen criteria tokens.</div>
                    )}
                </div>

                <div className="mt-24 grid grid-cols-2 gap-20 text-center text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400">
                    <div className="border-t border-black pt-2">Warehouse Master Count Verifier</div>
                    <div className="border-t border-black pt-2">Corporate Internal Management Audit Release</div>
                </div>

                {/* 🏢 Software & Corporate Provider Footer */}
                <div className="mt-12 pt-3 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-sans print:border-gray-400">
                    <div className="flex items-center gap-2 font-bold">
                        <span className="text-black font-black uppercase">ZOHAIB ALI & COMPANY</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-700">Contact: <b className="text-black font-bold">03128039911</b></span>
                    </div>
                    <div className="text-[9px] text-gray-400 font-mono">
                        System Generated Report • Zohaib Ali & Company
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockReportPrint;

