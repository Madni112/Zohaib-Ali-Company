import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchFinancialMetrics, FinancialSummary } from '../../service/financialCalculations';
import Spinner from '../../ui/Spinner';
import {
  MdAccountBalance,
  MdAccountBalanceWallet,
  MdMonetizationOn,
  MdInventory,
  MdTrendingUp,
  MdPrint,
  MdFileDownload,
  MdChevronRight,
  MdExpandMore,
  MdArrowForward,
  MdCheckCircle,
  MdWarning,
  MdPeople,
  MdStorefront,
  MdPieChart
} from 'react-icons/md';
import { useAuth } from '../../Context/Auth';
import { exportToExcel, ExcelColumn } from '../../utils/excelExport';
import { toast } from 'react-hot-toast';

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
  monthlySalesTrend: [],
  cashFlowTrend: []
};

const BalanceSheet: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { businessName, tenantId } = useAuth();
  const [metrics, setMetrics] = useState<FinancialSummary>(defaultMetrics);
  const [loading, setLoading] = useState(true);

  const initialAsOfDate = location.state?.asOfDate || location.state?.date || new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState(initialAsOfDate);

  // Accordion Expand States
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    cash: true,
    bank: true,
    receivables: false,
    inventory: false,
    payables: false,
    equity: false
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchFinancialMetrics();
      if (res) setMetrics(res);
    } catch (err: any) {
      console.error('BalanceSheet loadData failure:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const columns: ExcelColumn[] = [
        { header: 'Account Classification Code', key: 'code', width: 24 },
        { header: 'Account Description / Group', key: 'title', width: 38 },
        { header: 'Category Type', key: 'category', width: 18 },
        { header: 'Debit Balance (Rs.)', key: 'debit', width: 22, type: 'currency' },
        { header: 'Credit Balance (Rs.)', key: 'credit', width: 22, type: 'currency' }
      ];

      const exportData = [
        { code: '1010', title: 'Cash Box & Liquid App Drawer', category: 'ASSET', debit: metrics.cashBalance || 0, credit: 0 },
        { code: '1020', title: 'Corporate Bank Ledger Accounts', category: 'ASSET', debit: metrics.totalBankBalance || 0, credit: 0 },
        { code: '1030', title: 'Accounts Receivable (Customers Debt)', category: 'ASSET', debit: metrics.totalReceivables || 0, credit: 0 },
        { code: '1040', title: 'Merchandise Inventory Stock Assets', category: 'ASSET', debit: metrics.inventoryAssetValue || 0, credit: 0 },
        { code: 'TOTAL ASSETS', title: 'TOTAL COMMERCIAL ASSETS', category: 'ASSETS TOTAL', debit: metrics.totalAssets || 0, credit: 0 },
        { code: '2010', title: 'Accounts Payable (Supplier Unpaid Bills)', category: 'LIABILITY', debit: 0, credit: metrics.totalPayables || 0 },
        { code: 'TOTAL LIAB', title: 'TOTAL LIABILITIES', category: 'LIABILITIES TOTAL', debit: 0, credit: metrics.totalLiabilities || 0 },
        { code: '3010', title: 'Owner Equity & Retained Earnings', category: 'EQUITY', debit: 0, credit: metrics.totalEquity || 0 },
        { code: 'TOTAL LIAB+EQ', title: 'TOTAL LIABILITIES & EQUITY', category: 'BALANCE TOTAL', debit: 0, credit: (metrics.totalLiabilities || 0) + (metrics.totalEquity || 0) }
      ];

      await exportToExcel({
        fileName: `Corporate_Balance_Sheet_${asOfDate}.xlsx`,
        sheetName: 'Balance Sheet',
        companyName: businessName || 'ZOAIB ALI & COMPANY',
        reportTitle: `Corporate GAAP Balance Sheet Statement (As of ${asOfDate})`,
        filterSummary: { 'As Of Date': asOfDate, 'Accounting Standard': 'GAAP (Assets = Liabilities + Equity)' },
        columns,
        data: exportData,
        summaryRow: false,
        theme: 'emerald'
      });

      toast.success('Balance Sheet exported to Excel successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const totalLiabEq = (metrics.totalLiabilities || 0) + (metrics.totalEquity || 0);
  const isBalanced = Math.abs((metrics.totalAssets || 0) - totalLiabEq) < 1;

  // Percentage calculations for visual solvency meter
  const assetsVal = metrics.totalAssets || 1;
  const liabPct = Math.min(100, Math.round(((metrics.totalLiabilities || 0) / assetsVal) * 100));
  const equityPct = Math.max(0, 100 - liabPct);

  if (loading && !metrics.totalAssets && !metrics.totalLiabilities) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-slate-800 dark:text-slate-100 text-xs antialiased font-sans pb-12 print:p-0">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden !important; }
          .balance-sheet-print-container, .balance-sheet-print-container * { visibility: visible !important; }
          .balance-sheet-print-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            z-index: 999999 !important;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          aside, header, nav, button, input, .print-hidden-element {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}} />

      {/* ── TOP HEADER WITH ACTIONS & DATE FILTER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-900 to-emerald-800 dark:from-emerald-950 dark:to-emerald-900 p-6 rounded-2xl shadow-lg relative overflow-hidden print-hidden-element">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-emerald-600/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute left-1/4 -bottom-10 w-48 h-48 bg-emerald-400/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-white/10 text-emerald-100 font-bold backdrop-blur-sm border border-white/10 shadow-sm">
              <MdAccountBalance size={24} />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Corporate Balance Sheet & Financial Statement
            </h1>
          </div>
          <p className="text-[13px] text-emerald-100/70 mt-2 max-w-xl leading-relaxed">
            Real-time GAAP Statement <strong className="text-white font-mono font-black">(Assets = Liabilities + Equity)</strong> calculated from general ledger records.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-end gap-3 w-full md:w-auto ml-auto">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2.5">
            <span className="text-[11px] font-bold text-emerald-200">As Of Date:</span>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={asOfDate}
              onChange={(e) => {
                const today = new Date().toISOString().split('T')[0];
                if (e.target.value > today) {
                  setAsOfDate(today);
                  return;
                }
                setAsOfDate(e.target.value);
              }}
              className="bg-transparent font-bold text-xs text-white outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            disabled={exporting}
            onClick={handleExportExcel}
            className="px-5 py-3 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl font-black text-[13px] transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
          >
            <MdFileDownload size={20} className="text-emerald-600" />
            <span>{exporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-3 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-black text-[13px] transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer flex items-center gap-2 border border-slate-800"
          >
            <MdPrint size={20} />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      <div className="balance-sheet-print-container flex flex-col gap-6">
        
        {/* Printable Header for physical paper prints */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-black text-black uppercase tracking-wider">{businessName || 'ZOAIB ALI & COMPANY'}</h1>
          <h2 className="text-lg font-bold text-gray-700">CORPORATE GAAP BALANCE SHEET STATEMENT</h2>
          <p className="text-xs text-gray-500 font-mono">Statement Cutoff As Of: {asOfDate}</p>
        </div>

        {/* ── AUDIT STATUS BANNER WITH CAPITAL SOLVENCY GAUGE ── */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-[#111827] dark:to-slate-900 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl shadow-sm ${isBalanced ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'}`}>
                {isBalanced ? <MdCheckCircle size={32} /> : <MdWarning size={32} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    GAAP Audit Status:
                  </h3>
                  <span className={`px-2.5 py-1 rounded-full font-black text-[10px] tracking-wide uppercase ${isBalanced ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60' : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'}`}>
                    {isBalanced ? 'Balanced Statement ✅' : 'Unbalanced Discrepancy ⚠️'}
                  </span>
                </div>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 font-mono bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md inline-block">
                  Assets (Rs. {Number(metrics.totalAssets || 0).toLocaleString()}) = Liabilities (Rs. {Number(metrics.totalLiabilities || 0).toLocaleString()}) + Equity (Rs. {Number(metrics.totalEquity || 0).toLocaleString()})
                </p>
              </div>
            </div>

            {/* 3 Executive KPI Chips */}
            <div className="flex flex-wrap items-center gap-3 font-mono">
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 p-3.5 rounded-xl min-w-[140px] text-right shadow-sm">
                <span className="text-emerald-700 dark:text-emerald-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Total Assets</span>
                <b className="text-emerald-700 dark:text-emerald-300 text-[15px] font-black">
                  Rs. {Number(metrics.totalAssets || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </b>
              </div>

              <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/50 p-3.5 rounded-xl min-w-[140px] text-right shadow-sm">
                <span className="text-rose-700 dark:text-rose-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Total Liabilities</span>
                <b className="text-rose-700 dark:text-rose-300 text-[15px] font-black">
                  Rs. {Number(metrics.totalLiabilities || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </b>
              </div>

              <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/50 p-3.5 rounded-xl min-w-[140px] text-right shadow-sm">
                <span className="text-purple-700 dark:text-purple-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Net Owner Equity</span>
                <b className="text-purple-700 dark:text-purple-300 text-[15px] font-black">
                  Rs. {Number(metrics.totalEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </b>
              </div>
            </div>
          </div>

          {/* Visual Capital Ratio Progress Bar */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
                Owner Equity ({equityPct}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                External Liabilities ({liabPct}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div style={{ width: `${equityPct}%` }} className="bg-purple-600 h-full transition-all duration-500" title={`Equity: ${equityPct}%`}></div>
              <div style={{ width: `${liabPct}%` }} className="bg-rose-500 h-full transition-all duration-500" title={`Liabilities: ${liabPct}%`}></div>
            </div>
          </div>
        </div>

        {/* ── TWO-COLUMN GAAP BALANCE SHEET INTERACTIVE GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ═════════ LEFT COLUMN: ASSETS ═════════ */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <MdMonetizationOn className="text-emerald-600" size={20} />
                Current & Fixed Assets
              </h3>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Assets</span>
                <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                  Rs. {Number(metrics.totalAssets || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 font-sans">
              
              {/* 1. CASH IN HAND ACCORDION */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div
                  onClick={() => toggleSection('cash')}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {expandedSections.cash ? <MdExpandMore size={20} /> : <MdChevronRight size={20} />}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center">
                      <MdAccountBalanceWallet size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">Cash in Hand (Counter Liquidity)</h4>
                      <span className="text-[10px] text-slate-400">App Cash Register Ledger Balance</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    Rs. {Number(metrics.cashBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {expandedSections.cash && (
                  <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-slate-800 text-xs flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">Primary Physical Cash Box Drawer</span>
                    <button
                      onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Account-Report`, { state: { activeTab: 1 } })}
                      className="text-emerald-600 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Cash Ledger</span>
                      <MdArrowForward size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* 2. CORPORATE BANK ACCOUNTS ACCORDION */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div
                  onClick={() => toggleSection('bank')}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {expandedSections.bank ? <MdExpandMore size={20} /> : <MdChevronRight size={20} />}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-teal-600/10 text-teal-600 font-bold flex items-center justify-center">
                      <MdAccountBalance size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">Corporate Bank Accounts</h4>
                      <span className="text-[10px] text-slate-400">{metrics.bankAccounts?.length || 0} Bank Accounts Logged</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-xs">
                    Rs. {Number(metrics.totalBankBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {expandedSections.bank && (
                  <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {(!metrics.bankAccounts || metrics.bankAccounts.length === 0) ? (
                      <div className="text-slate-400 italic text-[11px] text-center py-2">No bank accounts logged.</div>
                    ) : (
                      metrics.bankAccounts.map((b) => (
                        <div key={b.id} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-none text-xs">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">🏦 {b.bankName}</span>
                            <span className="text-[10px] text-slate-400">{b.accountTitle} {b.accountNumber ? `(${b.accountNumber})` : ''}</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-600">
                            Rs. {Number(b.netBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 3. ACCOUNTS RECEIVABLE ACCORDION */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div
                  onClick={() => toggleSection('receivables')}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {expandedSections.receivables ? <MdExpandMore size={20} /> : <MdChevronRight size={20} />}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 font-bold flex items-center justify-center">
                      <MdPeople size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">Accounts Receivable</h4>
                      <span className="text-[10px] text-slate-400">Client Debt Outstanding</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                    Rs. {Number(metrics.totalReceivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {expandedSections.receivables && (
                  <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-500 text-[11px]">Uncollected customer sales invoices</span>
                    <button
                      onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Account-Report`, { state: { activeTab: 12 } })}
                      className="text-blue-600 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Receivables Aging</span>
                      <MdArrowForward size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* 4. MERCHANDISE INVENTORY ASSETS ACCORDION */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div
                  onClick={() => toggleSection('inventory')}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {expandedSections.inventory ? <MdExpandMore size={20} /> : <MdChevronRight size={20} />}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-600 font-bold flex items-center justify-center">
                      <MdInventory size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">Merchandise Inventory Valuation</h4>
                      <span className="text-[10px] text-slate-400">Warehouse Stock Cost Valuation</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs">
                    Rs. {Number(metrics.inventoryAssetValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {expandedSections.inventory && (
                  <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-500 text-[11px]">Current warehouse inventory holdings</span>
                    <button
                      onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Stock-Report`, { state: { activeTab: 2 } })}
                      className="text-purple-600 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Stock Valuation</span>
                      <MdArrowForward size={14} />
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* TOTAL ASSETS FOOTER */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center font-mono font-black text-sm">
              <span className="uppercase text-slate-900 dark:text-white tracking-wider">TOTAL ASSETS</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-base">
                Rs. {Number(metrics.totalAssets || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* ═════════ RIGHT COLUMN: LIABILITIES & EQUITY ═════════ */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <MdAccountBalance className="text-rose-600" size={20} />
                Liabilities & Owner Equity
              </h3>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Liabilities & Equity</span>
                <span className="text-sm font-mono font-black text-rose-600 dark:text-rose-400">
                  Rs. {Number(totalLiabEq).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 font-sans">
              
              {/* SECTION HEADER: CURRENT LIABILITIES */}
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 pt-1">
                Current Liabilities (Supplier Credit & Debts)
              </div>

              {/* 1. ACCOUNTS PAYABLE ACCORDION */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div
                  onClick={() => toggleSection('payables')}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {expandedSections.payables ? <MdExpandMore size={20} /> : <MdChevronRight size={20} />}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-rose-600/10 text-rose-600 font-bold flex items-center justify-center">
                      <MdStorefront size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">Accounts Payable (Vendor Debt)</h4>
                      <span className="text-[10px] text-slate-400">Supplier Unpaid Credit Invoices</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                    Rs. {Number(metrics.totalPayables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {expandedSections.payables && (
                  <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-500 text-[11px]">Outstanding procurement payables</span>
                    <button
                      onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Account-Report`, { state: { activeTab: 6 } })}
                      className="text-rose-600 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Vendor Outstanding</span>
                      <MdArrowForward size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* TOTAL LIABILITIES SUB-ROW */}
              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl flex justify-between items-center">
                <span className="font-bold text-rose-800 dark:text-rose-300 text-xs uppercase">Total Current Liabilities</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs">
                  Rs. {Number(metrics.totalLiabilities || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* SECTION HEADER: OWNER EQUITY */}
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 pt-3">
                Owner's Equity & Retained Earnings
              </div>

              {/* 2. OWNER EQUITY ACCORDION */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div
                  onClick={() => toggleSection('equity')}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {expandedSections.equity ? <MdExpandMore size={20} /> : <MdChevronRight size={20} />}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-600 font-bold flex items-center justify-center">
                      <MdPieChart size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">Net Capital & Retained Earnings</h4>
                      <span className="text-[10px] text-slate-400">Accumulated Retained Operating Income</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs">
                    Rs. {Number(metrics.totalEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {expandedSections.equity && (
                  <div className="p-3 bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-500 text-[11px]">Net Worth = Assets - Liabilities</span>
                    <button
                      onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Account-Report`, { state: { activeTab: 4 } })}
                      className="text-purple-600 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Income Statement</span>
                      <MdArrowForward size={14} />
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* TOTAL LIABILITIES & EQUITY FOOTER */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center font-mono font-black text-sm">
              <span className="uppercase text-slate-900 dark:text-white tracking-wider">TOTAL LIABILITIES & EQUITY</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-base">
                Rs. {Number(totalLiabEq).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default BalanceSheet;
