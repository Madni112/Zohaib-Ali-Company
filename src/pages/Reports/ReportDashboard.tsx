import React, { useState, useEffect, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../Context/supabaseClient';
import { fetchFinancialMetrics, FinancialSummary } from '../../service/financialCalculations';
import Spinner from '../../ui/Spinner';
import {
  MdTrendingUp,
  MdLocalMall,
  MdLayers,
  MdAccountBalanceWallet,
  MdAccountBalance,
  MdAssessment,
  MdAssignment,
  MdFileDownload,
  MdSearch,
  MdClear,
  MdArrowForward,
  MdPauseCircleFilled,
  MdReceipt,
  MdPeople,
  MdStorefront
} from 'react-icons/md';
import { exportMultiSheetExcel, ExcelColumn } from '../../utils/excelExport';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../Context/Auth';

const defaultMetrics: FinancialSummary = {
  cashBalance: 0,
  totalBankBalance: 0,
  bankAccounts: [],
  todaysSales: 0,
  thisMonthSales: 0,
  thisMonthPurchases: 0,
  totalReceivables: 0,
  totalPayables: 0,
  inventoryAssetValue: 0,
  totalAssets: 0,
  totalLiabilities: 0,
  totalEquity: 0,
  monthlySalesTrend: [
    { month: 'Jan', sales: 0, purchases: 0 },
    { month: 'Feb', sales: 0, purchases: 0 },
    { month: 'Mar', sales: 0, purchases: 0 }
  ],
  cashFlowTrend: [
    { month: 'Jan', inflow: 0, outflow: 0 },
    { month: 'Feb', inflow: 0, outflow: 0 },
    { month: 'Mar', inflow: 0, outflow: 0 }
  ]
};

const ReportDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const initialTab = (location.state?.activeTab || location.state?.tab || 'sales') as any;
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase' | 'stock' | 'accounts' | 'bank' | 'cash' | 'balancesheet'>(initialTab);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonthStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const [searchQuery, setSearchQuery] = useState('');

  const [salesData, setSalesData] = useState<any[]>([]);
  const [purchaseData, setPurchaseData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [voucherData, setVoucherData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<FinancialSummary>(defaultMetrics);

  const fetchSystemReports = async () => {
    try {
      setLoading(true);
      const [salesRes, purchasesRes, stockRes, vouchersRes, finMetricsRes] = await Promise.allSettled([
        supabase.from('sales_invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('supplier_purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('warehouse_inventory').select('*'),
        supabase.from('financial_vouchers').select('*').order('created_at', { ascending: false }),
        fetchFinancialMetrics()
      ]);

      if (salesRes.status === 'fulfilled' && Array.isArray(salesRes.value.data)) {
        setSalesData(salesRes.value.data);
      }
      if (purchasesRes.status === 'fulfilled' && Array.isArray(purchasesRes.value.data)) {
        setPurchaseData(purchasesRes.value.data);
      }
      if (stockRes.status === 'fulfilled' && Array.isArray(stockRes.value.data)) {
        setStockData(stockRes.value.data);
      }
      if (vouchersRes.status === 'fulfilled' && Array.isArray(vouchersRes.value.data)) {
        setVoucherData(vouchersRes.value.data);
      }
      if (finMetricsRes.status === 'fulfilled' && finMetricsRes.value) {
        setMetrics(finMetricsRes.value);
      }
    } catch (err: any) {
      console.error('Report dashboard fetch failure:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemReports();
  }, []);

  // --- Dynamic Formatted ApexChart Options ---
  const trend = (metrics && metrics.monthlySalesTrend && metrics.monthlySalesTrend.length > 0)
    ? metrics.monthlySalesTrend
    : [{ month: 'Jan', sales: 0, purchases: 0 }];

  const salesVsPurchasesOptions: any = {
    chart: { type: 'bar', height: 280, toolbar: { show: false } },
    colors: ['#10B981', '#F43F5E'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 3, colors: ['transparent'] },
    xaxis: {
      categories: trend.map(m => m.month || ''),
      labels: { style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 600 } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 600 },
        formatter: (val: number) => {
          if (val === undefined || val === null || isNaN(val) || val === 0) return 'Rs. 0';
          if (Math.abs(val) >= 1000000) return `Rs. ${(val / 1000000).toFixed(1)}M`;
          if (Math.abs(val) >= 1000) return `Rs. ${(val / 1000).toFixed(0)}k`;
          return `Rs. ${val}`;
        }
      }
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } }
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => {
          if (val === undefined || val === null || isNaN(val)) return 'Rs. 0';
          return `Rs. ${Number(val).toLocaleString()}`;
        }
      }
    }
  };

  const salesVsPurchasesSeries = [
    { name: 'Gross Sales', data: trend.map(m => Number(m.sales || 0)) },
    { name: 'Procurement Expenses', data: trend.map(m => Number(m.purchases || 0)) }
  ];

  const [exporting, setExporting] = useState(false);

  const handleExportConsolidatedPack = async () => {
    try {
      setExporting(true);

      const kpiCols: ExcelColumn[] = [
        { header: 'Financial Indicator KPI', key: 'indicator', width: 36 },
        { header: 'Current Balance / Valuation (Rs.)', key: 'value', width: 28, type: 'currency' }
      ];
      const kpiData = [
        { indicator: 'Gross Monthly Sales Revenue', value: metrics.thisMonthSales || 0 },
        { indicator: 'App Liquid Cash in Hand', value: metrics.cashBalance || 0 },
        { indicator: 'Total Bank Ledger Balances', value: metrics.totalBankBalance || 0 },
        { indicator: 'Accounts Receivable (Customers)', value: metrics.totalReceivables || 0 },
        { indicator: 'Merchandise Inventory Stock Valuation', value: metrics.inventoryAssetValue || 0 },
        { indicator: 'Total Balance Sheet Assets', value: metrics.totalAssets || 0 },
        { indicator: 'Total Accounts Payable (Suppliers)', value: metrics.totalPayables || 0 },
        { indicator: 'Total Owner Equity & Retained Earnings', value: metrics.totalEquity || 0 }
      ];

      const salesCols: ExcelColumn[] = [
        { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
        { header: 'Invoice Code', key: 'invoiceNo', width: 16 },
        { header: 'Date', key: 'date', width: 14, type: 'date' },
        { header: 'Client Customer', key: 'customerName', width: 28 },
        { header: 'Salesman', key: 'salesman', width: 20 },
        { header: 'Sale Mode', key: 'mode', width: 16 },
        { header: 'Gross Amount (Rs.)', key: 'amount', width: 22, type: 'currency' }
      ];
      const salesExport = salesData.map((s, i) => ({
        idx: i + 1,
        invoiceNo: s.invoice_no || `INV-${s.id}`,
        date: s.sale_date || String(s.created_at || '').split('T')[0],
        customerName: s.customer_name || 'Counter Retail Buyer',
        salesman: s.salesman || 'Direct',
        mode: (s.settlement_mode || s.payment_term || 'Cash').toUpperCase(),
        amount: Number(s.total_amount || 0)
      }));

      const purCols: ExcelColumn[] = [
        { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
        { header: 'Purchase Code', key: 'purchaseNo', width: 18 },
        { header: 'Date', key: 'date', width: 14, type: 'date' },
        { header: 'Supplier Merchant', key: 'supplierName', width: 28 },
        { header: 'Warehouse Bin', key: 'warehouse', width: 18 },
        { header: 'Bill Payables (Rs.)', key: 'amount', width: 22, type: 'currency' }
      ];
      const purExport = purchaseData.map((p, i) => ({
        idx: i + 1,
        purchaseNo: p.purchase_no || `PUR-${p.id}`,
        date: p.purchase_date || String(p.created_at || '').split('T')[0],
        supplierName: p.supplier_name || 'Vendor',
        warehouse: p.target_warehouse || 'Main Warehouse',
        amount: Number(p.total_amount || 0)
      }));

      await exportMultiSheetExcel({
        fileName: `Corporate_Executive_Financial_Pack_${new Date().toISOString().split('T')[0]}.xlsx`,
        companyName: 'ZOAIB ALI & COMPANY',
        sheets: [
          {
            sheetName: 'Financial KPIs',
            reportTitle: 'Executive Financial Performance Summary',
            columns: kpiCols,
            data: kpiData,
            summaryRow: false,
            theme: 'emerald'
          },
          {
            sheetName: 'Sales Invoices',
            reportTitle: 'Sales Invoices Ledger Snapshot',
            columns: salesCols,
            data: salesExport,
            theme: 'emerald'
          },
          {
            sheetName: 'Procurement Purchases',
            reportTitle: 'Supplier Purchases Ledger Snapshot',
            columns: purCols,
            data: purExport,
            theme: 'emerald'
          }
        ]
      });

      toast.success('Executive Multi-Tab Excel Pack exported successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Filter lists by date range & search query
  const filteredSales = useMemo(() => {
    return salesData.filter(item => {
      const rawDate = item.sale_date || String(item.created_at || '').split('T')[0];
      if (dateFrom && rawDate < dateFrom) return false;
      if (dateTo && rawDate > dateTo) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = String(item.invoice_no || `INV-${item.id}`).toLowerCase();
        const cust = String(item.customer_name || '').toLowerCase();
        const sm = String(item.salesman || '').toLowerCase();
        if (!code.includes(q) && !cust.includes(q) && !sm.includes(q)) return false;
      }
      return true;
    });
  }, [salesData, dateFrom, dateTo, searchQuery]);

  const filteredPurchases = useMemo(() => {
    return purchaseData.filter(item => {
      const rawDate = item.purchase_date || String(item.created_at || '').split('T')[0];
      if (dateFrom && rawDate < dateFrom) return false;
      if (dateTo && rawDate > dateTo) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = String(item.purchase_no || `PUR-${item.id}`).toLowerCase();
        const supp = String(item.supplier_name || '').toLowerCase();
        if (!code.includes(q) && !supp.includes(q)) return false;
      }
      return true;
    });
  }, [purchaseData, dateFrom, dateTo, searchQuery]);

  if (loading && !salesData.length && !purchaseData.length && !stockData.length) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-slate-800 dark:text-slate-100 text-xs antialiased font-sans pb-12">
      
      {/* ── TOP HEADER WITH EXCEL EXPORT ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-900 to-emerald-800 dark:from-emerald-950 dark:to-emerald-900 p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-emerald-600/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute left-1/4 -bottom-10 w-48 h-48 bg-emerald-400/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-white/10 text-emerald-100 font-bold backdrop-blur-sm border border-white/10 shadow-sm">
              <MdAssessment size={24} />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Corporate Analytics & Reporting
            </h1>
          </div>
          <p className="text-[13px] text-emerald-100/70 mt-2 max-w-xl leading-relaxed">
            Real-time audit performance metrics across Sales, Purchases, Stock, Bank Ledgers & GAAP Balance Sheet.
          </p>
        </div>

        <button
          type="button"
          disabled={exporting}
          onClick={handleExportConsolidatedPack}
          className="relative z-10 px-5 py-3 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl font-black text-[13px] transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
        >
          <MdFileDownload size={20} className="text-emerald-600" />
          <span>{exporting ? 'Exporting Pack...' : 'Export Executive Excel Pack (.xlsx)'}</span>
        </button>
      </div>

      {/* ── TOP 4 EXECUTIVE SCORECARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-[#111827] dark:to-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
          <div>
            <span className="text-slate-400 font-bold block uppercase text-[10px] tracking-wider mb-1">Gross Monthly Sales</span>
            <b className="text-slate-800 dark:text-slate-100 text-2xl font-black font-mono tracking-tight block">
              Rs. {Number(metrics.thisMonthSales || 0).toLocaleString()}
            </b>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Confirmed</span>
              <span className="text-[11px] text-slate-400">sales revenue</span>
            </div>
          </div>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-sm">
            <MdTrendingUp size={28} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-[#111827] dark:to-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
          <div>
            <span className="text-slate-400 font-bold block uppercase text-[10px] tracking-wider mb-1">App Cash Balance</span>
            <b className="text-slate-800 dark:text-slate-100 text-2xl font-black font-mono tracking-tight block">
              Rs. {Number(metrics.cashBalance || 0).toLocaleString()}
            </b>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md">Liquid</span>
              <span className="text-[11px] text-slate-400">counter drawer</span>
            </div>
          </div>
          <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 rounded-2xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform shadow-sm">
            <MdAccountBalanceWallet size={28} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-[#111827] dark:to-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
          <div>
            <span className="text-slate-400 font-bold block uppercase text-[10px] tracking-wider mb-1">Monthly Bank Balance</span>
            <b className="text-slate-800 dark:text-slate-100 text-2xl font-black font-mono tracking-tight block">
              Rs. {Number(metrics.totalBankBalance || 0).toLocaleString()}
            </b>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="flex items-center text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 rounded-md">Logged</span>
              <span className="text-[11px] text-slate-400">bank accounts</span>
            </div>
          </div>
          <div className="p-3.5 bg-teal-50 dark:bg-teal-500/10 rounded-2xl text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform shadow-sm">
            <MdAccountBalance size={28} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-[#111827] dark:to-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
          <div>
            <span className="text-slate-400 font-bold block uppercase text-[10px] tracking-wider mb-1">Balance Sheet Assets</span>
            <b className="text-slate-800 dark:text-slate-100 text-2xl font-black font-mono tracking-tight block">
              Rs. {Number(metrics.totalAssets || 0).toLocaleString()}
            </b>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="flex items-center text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.5 rounded-md">GAAP</span>
              <span className="text-[11px] text-slate-400">capital value</span>
            </div>
          </div>
          <div className="p-3.5 bg-purple-50 dark:bg-purple-500/10 rounded-2xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform shadow-sm">
            <MdLayers size={28} />
          </div>
        </div>
      </div>

      {/* ── 6 REPORT LAUNCHER SHORTCUT CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Sales-Report`)}
          className="group p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center space-y-2 hover:-translate-y-1"
        >
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform"><MdTrendingUp size={22} /></div>
          <div>
            <span className="font-black text-[13px] text-slate-800 dark:text-white block">Sales</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Audits & Invoices</span>
          </div>
        </div>

        <div
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Purchase-Report`)}
          className="group p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center space-y-2 hover:-translate-y-1"
        >
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl group-hover:scale-110 transition-transform"><MdStorefront size={22} /></div>
          <div>
            <span className="font-black text-[13px] text-slate-800 dark:text-white block">Purchase</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Procurement & Vendors</span>
          </div>
        </div>

        <div
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Stock-Report`)}
          className="group p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center space-y-2 hover:-translate-y-1"
        >
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl group-hover:scale-110 transition-transform"><MdLayers size={22} /></div>
          <div>
            <span className="font-black text-[13px] text-slate-800 dark:text-white block">Stock</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Inventory & Warehouses</span>
          </div>
        </div>

        <div
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Holding-Report`)}
          className="group p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center space-y-2 hover:-translate-y-1"
        >
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl group-hover:scale-110 transition-transform"><MdPauseCircleFilled size={22} /></div>
          <div>
            <span className="font-black text-[13px] text-slate-800 dark:text-white block">Holding</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Committed Stock</span>
          </div>
        </div>

        <div
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Account-Report`)}
          className="group p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center space-y-2 hover:-translate-y-1"
        >
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"><MdAccountBalance size={22} /></div>
          <div>
            <span className="font-black text-[13px] text-slate-800 dark:text-white block">Account</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Ledger & Aging</span>
          </div>
        </div>

        <div
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Balance-Sheet`)}
          className="group p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center space-y-2 hover:-translate-y-1"
        >
          <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-xl group-hover:scale-110 transition-transform"><MdAssessment size={22} /></div>
          <div>
            <span className="font-black text-[13px] text-slate-800 dark:text-white block">Balance Sheet</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">GAAP Statements</span>
          </div>
        </div>
      </div>

      {/* ── SALES VS PURCHASES PERFORMANCE GRAPH ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Executive Sales vs. Purchases Performance Graph
            </h3>
            <p className="text-[11px] text-slate-400">Comparative revenue vs procurement outflow trends</p>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Monthly Trend</span>
        </div>

        <div className="w-full min-h-[280px]">
          <ReactApexChart
            options={salesVsPurchasesOptions}
            series={salesVsPurchasesSeries}
            type="bar"
            height={280}
          />
        </div>
      </div>

      {/* ── DATATABLE AUDIT SYSTEM WITH TABBED SWITCHING & LIVE SEARCH ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm space-y-4">
        
        {/* Tab Headers + Live Search + Restricted Date Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          
          <div className="flex flex-wrap gap-1 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl font-bold text-xs">
            <button
              onClick={() => setActiveTab('sales')}
              className={`py-2 px-3.5 rounded-lg transition cursor-pointer ${
                activeTab === 'sales' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Sales Ledger ({filteredSales.length})
            </button>

            <button
              onClick={() => setActiveTab('purchase')}
              className={`py-2 px-3.5 rounded-lg transition cursor-pointer ${
                activeTab === 'purchase' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Purchase Ledger ({filteredPurchases.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-56">
              <MdSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit records..."
                className="w-full pl-9 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <MdClear size={14} />
                </button>
              )}
            </div>

            {/* Date Pickers with Today Max Restriction */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold">
              <input
                type="date"
                max={todayStr}
                value={dateFrom}
                onChange={(e) => { if (e.target.value > todayStr) setDateFrom(todayStr); else setDateFrom(e.target.value); }}
                className="bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                max={todayStr}
                value={dateTo}
                onChange={(e) => { if (e.target.value > todayStr) setDateTo(todayStr); else setDateTo(e.target.value); }}
                className="bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 1. SALES INVOICES DATA TABLE */}
        {activeTab === 'sales' && (
          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full table-auto border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700 text-left text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3.5 text-center w-12">S#</th>
                  <th className="py-2.5 px-3.5">Invoice Code</th>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5">Client Customer</th>
                  <th className="py-2.5 px-3.5">Sales Officer</th>
                  <th className="py-2.5 px-3.5 text-center">Sale Mode</th>
                  <th className="py-2.5 px-3.5 text-right font-black">Gross Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.length > 0 ? (
                  filteredSales.slice(0, 15).map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {row.invoice_no || `INV-${row.id}`}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">
                        {row.sale_date || String(row.created_at || '').split('T')[0]}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                        {row.customer_name || 'Counter Retail Buyer'}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-300">{row.salesman || 'Direct'}</td>
                      <td className="py-2.5 px-3.5 text-center font-bold uppercase text-[10px]">
                        <span className={`px-2 py-0.5 rounded-md ${
                          String(row.settlement_mode || row.payment_term || '').toLowerCase() === 'credit'
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}>
                          {row.settlement_mode || row.payment_term || 'Cash'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                        Rs. {Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 italic">No sales invoices found matching the current date & search filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. PURCHASES DATA TABLE */}
        {activeTab === 'purchase' && (
          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full table-auto border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700 text-left text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3.5 text-center w-12">S#</th>
                  <th className="py-2.5 px-3.5">Purchase Code</th>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5">Supplier Vendor</th>
                  <th className="py-2.5 px-3.5">Target Warehouse</th>
                  <th className="py-2.5 px-3.5 text-right font-black">Bill Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPurchases.length > 0 ? (
                  filteredPurchases.slice(0, 15).map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {row.purchase_no || `PUR-${row.id}`}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">
                        {row.purchase_date || String(row.created_at || '').split('T')[0]}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                        {row.supplier_name || 'Vendor'}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-300">{row.target_warehouse || 'Main Warehouse'}</td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                        Rs. {Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 italic">No purchase records found matching the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReportDashboard;
