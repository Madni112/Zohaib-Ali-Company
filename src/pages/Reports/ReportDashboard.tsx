import React, { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { supabase } from '../../Context/supabaseClient';
import { fetchFinancialMetrics, FinancialSummary } from '../../service/financialCalculations';
import Spinner from '../../ui/Spinner';
import { MdTrendingUp, MdLocalMall, MdLayers, MdAccountBalanceWallet, MdAccountBalance, MdAssessment, MdAssignment, MdFileDownload } from 'react-icons/md';
import { exportMultiSheetExcel, ExcelColumn } from '../../utils/excelExport';
import { toast } from 'react-hot-toast';

const ReportDashboard = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase' | 'stock' | 'accounts' | 'bank' | 'cash' | 'balancesheet'>('sales');
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const [salesData, setSalesData] = useState<any[]>([]);
  const [purchaseData, setPurchaseData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [voucherData, setVoucherData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<FinancialSummary | null>(null);

  const fetchSystemReports = async () => {
    try {
      setLoading(true);
      const { data: sales } = await supabase.from('sales_invoices').select('*');
      const { data: purchases } = await supabase.from('supplier_purchases').select('*');
      const { data: stock } = await supabase.from('warehouse_inventory').select('*');
      const { data: vouchers } = await supabase.from('financial_vouchers').select('*');
      const finMetrics = await fetchFinancialMetrics();

      setSalesData(sales || []);
      setPurchaseData(purchases || []);
      setStockData(stock || []);
      setVoucherData(vouchers || []);
      setMetrics(finMetrics);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemReports();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // --- Chart Configurations ---
  const trend = metrics.monthlySalesTrend || [];
  const salesVsPurchasesOptions: any = {
    chart: { type: 'bar', height: 260, toolbar: { show: false } },
    colors: ['#10B981', '#E74C3C'],
    plotOptions: { bar: { columnWidth: '45%', borderRadius: 3 } },
    dataLabels: { enabled: false },
    xaxis: { categories: trend.map(m => m.month) },
    yaxis: {
      labels: {
        formatter: (val: number) => {
          if (val === undefined || val === null || isNaN(val)) return 'Rs. 0k';
          return `Rs. ${(val / 1000).toFixed(0)}k`;
        }
      }
    },
    tooltip: {
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
    if (!metrics) return;
    try {
      setExporting(true);

      // Sheet 1: Executive KPIs
      const kpiCols: ExcelColumn[] = [
        { header: 'Financial Indicator KPI', key: 'indicator', width: 34 },
        { header: 'Current Balance / Valuation (Rs.)', key: 'value', width: 28, type: 'currency' }
      ];
      const kpiData = [
        { indicator: 'Gross Monthly Sales Revenue', value: metrics.thisMonthSales || 0 },
        { indicator: 'App Liquid Cash in Hand', value: metrics.cashBalance || 0 },
        { indicator: 'Total Bank Ledger Balances', value: metrics.totalBankBalance || 0 },
        { indicator: 'Accounts Receivable (Customers)', value: metrics.totalReceivables || metrics.accountsReceivable || 0 },
        { indicator: 'Merchandise Inventory Stock Valuation', value: metrics.inventoryAssetValue || 0 },
        { indicator: 'Total Balance Sheet Assets', value: metrics.totalAssets || 0 },
        { indicator: 'Total Accounts Payable (Suppliers)', value: metrics.totalPayables || metrics.accountsPayable || 0 },
        { indicator: 'Total Owner Equity & Retained Earnings', value: metrics.totalEquity || 0 }
      ];

      // Sheet 2: Recent Sales Invoices
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
        invoiceNo: `INV-${s.id}`,
        date: s.sale_date || String(s.created_at || '').split('T')[0],
        customerName: s.customer_name || 'Counter Retail Buyer',
        salesman: s.salesman || 'Direct',
        mode: (s.settlement_mode || s.payment_term || 'Cash').toUpperCase(),
        amount: Number(s.total_amount || 0)
      }));

      // Sheet 3: Recent Purchases
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
        companyName: 'ZOHAIB ALI & COMPANY',
        sheets: [
          {
            sheetName: 'Financial KPIs',
            reportTitle: 'Executive Financial Performance Summary',
            columns: kpiCols,
            data: kpiData,
            summaryRow: false,
            theme: 'navy'
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
            theme: 'purple'
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

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-black dark:text-bodydark text-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Corporate Analytics Reporting Center</h2>
          <p className="text-xs text-gray-400">Generate, filter and inspect transactional audit sheets, bank balances, and balance sheets</p>
        </div>

        <button
          type="button"
          disabled={exporting}
          onClick={handleExportConsolidatedPack}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
        >
          <MdFileDownload size={18} />
          {exporting ? 'Exporting Pack...' : 'Export Executive Excel Pack (.xlsx)'}
        </button>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark flex items-center justify-between">
          <div>
            <span className="text-gray-400 font-bold block uppercase text-[10px]">Gross Monthly Sales</span>
            <b className="text-success text-base font-black font-mono">Rs. {metrics.thisMonthSales.toLocaleString()}</b>
          </div>
          <div className="p-2.5 bg-success/10 rounded text-success"><MdTrendingUp size={22} /></div>
        </div>

        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark flex items-center justify-between">
          <div>
            <span className="text-gray-400 font-bold block uppercase text-[10px]">App Cash Balance</span>
            <b className="text-emerald-600 text-base font-black font-mono">Rs. {metrics.cashBalance.toLocaleString()}</b>
          </div>
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded text-emerald-600"><MdAccountBalanceWallet size={22} /></div>
        </div>

        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark flex items-center justify-between">
          <div>
            <span className="text-gray-400 font-bold block uppercase text-[10px]">Monthly Bank Balance</span>
            <b className="text-primary text-base font-black font-mono">Rs. {metrics.totalBankBalance.toLocaleString()}</b>
          </div>
          <div className="p-2.5 bg-primary/10 rounded text-primary"><MdAccountBalance size={22} /></div>
        </div>

        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark flex items-center justify-between">
          <div>
            <span className="text-gray-400 font-bold block uppercase text-[10px]">Balance Sheet Assets</span>
            <b className="text-purple-600 text-base font-black font-mono">Rs. {metrics.totalAssets.toLocaleString()}</b>
          </div>
          <div className="p-2.5 bg-purple-100 dark:bg-purple-950/20 rounded text-purple-600"><MdAssignment size={22} /></div>
        </div>
      </div>

      {/* Embedded Executive Graph */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-5">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-sm text-black dark:text-white uppercase tracking-wider">Executive Sales vs. Purchases Performance Graph</h3>
          <span className="text-xs text-gray-400 font-mono">Monthly Comparative</span>
        </div>
        <ReactApexChart options={salesVsPurchasesOptions} series={salesVsPurchasesSeries} type="bar" height={240} />
      </div>

      {/* Tabs Container */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 border-b border-stroke dark:border-strokedark pb-4">
          <div className="flex flex-wrap border border-stroke dark:border-strokedark rounded p-1 bg-gray-50 dark:bg-meta-4/20 gap-1">
            {(['sales', 'purchase', 'stock', 'accounts', 'bank', 'cash', 'balancesheet'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`py-1.5 px-3 rounded text-[11px] font-bold uppercase transition tracking-wide cursor-pointer ${
                  activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-black dark:hover:text-white'
                }`}
              >
                {tab === 'bank' ? 'Bank Balances' : tab === 'cash' ? 'Cash Audit' : tab === 'balancesheet' ? 'Balance Sheet' : `${tab} Report`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-stroke dark:border-strokedark rounded p-1.5 bg-transparent font-bold outline-none text-black dark:text-white" />
            <span className="text-gray-400 font-bold">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-stroke dark:border-strokedark rounded p-1.5 bg-transparent font-bold outline-none text-black dark:text-white" />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          {/* Sales Report Tab */}
          {activeTab === 'sales' && (
            <table className="w-full table-auto border-collapse text-left">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-bold text-black dark:text-white border-b border-stroke uppercase tracking-wider text-[10px]">
                  <th className="p-3 w-16">S#</th>
                  <th className="p-3">Invoice Code</th>
                  <th className="p-3">Client Customer</th>
                  <th className="p-3">Sale Mode</th>
                  <th className="p-3 text-right pr-6">Gross Amount</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((s, i) => (
                  <tr key={s.id} className="border-b font-semibold border-stroke dark:border-strokedark text-black dark:text-white hover:bg-slate-50/50">
                    <td className="p-3 text-gray-400">{i + 1}</td>
                    <td className="p-3 font-mono font-black text-primary">INV-{s.id}</td>
                    <td className="p-3">{s.customer_name}</td>
                    <td className="p-3 uppercase">{s.settlement_mode || s.payment_term || 'Cash'}</td>
                    <td className="p-3 text-right font-mono font-black text-success pr-6">Rs. {Number(s.total_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Purchase Report Tab */}
          {activeTab === 'purchase' && (
            <table className="w-full table-auto border-collapse text-left">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-bold text-black dark:text-white border-b border-stroke uppercase tracking-wider text-[10px]">
                  <th className="p-3 w-16">S#</th>
                  <th className="p-3">Purchase Code</th>
                  <th className="p-3">Supplier Merchant</th>
                  <th className="p-3">Warehouse Bin</th>
                  <th className="p-3 text-right pr-6">Bill Payables</th>
                </tr>
              </thead>
              <tbody>
                {purchaseData.map((p, i) => (
                  <tr key={p.id} className="border-b font-semibold border-stroke dark:border-strokedark text-black dark:text-white hover:bg-slate-50/50">
                    <td className="p-3 text-gray-400">{i + 1}</td>
                    <td className="p-3 font-mono font-black text-primary">{p.purchase_no}</td>
                    <td className="p-3">{p.supplier_name}</td>
                    <td className="p-3 text-gray-400 uppercase font-bold">{p.target_warehouse}</td>
                    <td className="p-3 text-right font-mono font-black text-success pr-6">Rs. {Number(p.total_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Stock Report Tab */}
          {activeTab === 'stock' && (
            <table className="w-full table-auto border-collapse text-left">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-bold text-black dark:text-white border-b border-stroke uppercase tracking-wider text-[10px]">
                  <th className="p-3 w-16">S#</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Assigned Location</th>
                  <th className="p-3 text-center">Available Stock Units</th>
                </tr>
              </thead>
              <tbody>
                {stockData.map((st, i) => (
                  <tr key={st.id} className="border-b font-semibold border-stroke dark:border-strokedark text-black dark:text-white hover:bg-slate-50/50">
                    <td className="p-3 text-gray-400">{i + 1}</td>
                    <td className="p-3 font-bold text-black dark:text-white">{st.product_name}</td>
                    <td className="p-3"><span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{st.warehouse_name}</span></td>
                    <td className="p-3 text-center font-mono font-black text-warning">{Number(st.quantity || 0).toLocaleString()} Units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Financial Vouchers Tab */}
          {activeTab === 'accounts' && (
            <table className="w-full table-auto border-collapse text-left">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-bold text-black dark:text-white border-b border-stroke uppercase tracking-wider text-[10px]">
                  <th className="p-3 w-16">S#</th>
                  <th className="p-3">Voucher Code</th>
                  <th className="p-3">Description Narrative</th>
                  <th className="p-3 text-center">Voucher Type</th>
                  <th className="p-3 text-right pr-6">Fund Amount</th>
                </tr>
              </thead>
              <tbody>
                {voucherData.map((v, i) => {
                  const isDisbursement = v.voucher_type?.includes('Payment');
                  return (
                    <tr key={v.id} className="border-b font-semibold border-stroke dark:border-strokedark text-black dark:text-white hover:bg-slate-50/50">
                      <td className="p-3 text-gray-400">{i + 1}</td>
                      <td className="p-3 font-mono font-black text-primary">{v.voucher_no}</td>
                      <td className="p-3 text-gray-500 max-w-xs truncate">{v.narration || v.notes}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isDisbursement ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                          {v.voucher_type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-mono font-black pr-6 ${isDisbursement ? 'text-danger' : 'text-success'}`}>
                        {isDisbursement ? '-' : '+'} Rs. {Number(v.total_amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* MONTHLY BANK BALANCES TAB (Calculated from App) */}
          {activeTab === 'bank' && (
            <div>
              <div className="mb-4 bg-primary/5 p-3 rounded border border-primary/20 flex justify-between items-center">
                <span className="font-bold text-black dark:text-white">Corporate Bank Accounts Ledgers Overview</span>
                <b className="text-primary font-mono text-sm font-black">Total Bank Liquidity: Rs. {metrics.totalBankBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
              </div>
              <table className="w-full table-auto border-collapse text-left">
                <thead>
                  <tr className="bg-gray-100 dark:bg-meta-4 font-bold text-black dark:text-white border-b border-stroke uppercase tracking-wider text-[10px]">
                    <th className="p-3">Bank Profile</th>
                    <th className="p-3">Account Title</th>
                    <th className="p-3 text-right">Opening Balance</th>
                    <th className="p-3 text-right text-success">Total Inflows (+)</th>
                    <th className="p-3 text-right text-danger">Total Outflows (-)</th>
                    <th className="p-3 text-right pr-6">Calculated Ending Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.bankAccounts.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400 italic">No bank profiles recorded.</td></tr>
                  ) : (
                    metrics.bankAccounts.map((b) => (
                      <tr key={b.id} className="border-b font-mono font-semibold border-stroke dark:border-strokedark text-black dark:text-white hover:bg-slate-50/50">
                        <td className="p-3 font-sans font-bold">{b.bankName}</td>
                        <td className="p-3 font-sans">{b.accountTitle}</td>
                        <td className="p-3 text-right text-gray-500">Rs. {b.openingBalance.toLocaleString()}</td>
                        <td className="p-3 text-right text-success">+ Rs. {b.totalInflow.toLocaleString()}</td>
                        <td className="p-3 text-right text-danger">- Rs. {b.totalOutflow.toLocaleString()}</td>
                        <td className="p-3 text-right font-black text-primary pr-6">Rs. {b.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* CASH BALANCE AUDIT TAB */}
          {activeTab === 'cash' && (
            <div>
              <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded border border-emerald-200 flex justify-between items-center">
                <span className="font-bold text-black dark:text-white">App Cash Drawer & Counter Cash-Box Liquidity Audit</span>
                <b className="text-emerald-600 font-mono text-sm font-black">Net Cash Balance: Rs. {metrics.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
              </div>
              <p className="text-gray-400 text-xs mb-4">
                Calculated automatically across all Cash Invoices, Customer Recoveries, Cash Vouchers, and Cash Procurement Payments.
              </p>
            </div>
          )}

          {/* BALANCE SHEET TAB */}
          {activeTab === 'balancesheet' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                {/* Assets */}
                <div className="border border-stroke dark:border-strokedark p-4 rounded bg-gray-50/50 dark:bg-meta-4/10">
                  <h4 className="font-bold text-sm text-black dark:text-white border-b pb-2 mb-3 uppercase font-sans flex justify-between">
                    <span>Current Assets</span>
                    <b className="text-success">Rs. {metrics.totalAssets.toLocaleString()}</b>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span>Cash in Hand:</span><b className="text-emerald-600 dark:text-emerald-400">Rs. {metrics.cashBalance.toLocaleString()}</b></div>
                    <div className="flex justify-between"><span>Bank Accounts Total:</span><b className="text-teal-600 dark:text-teal-400">Rs. {metrics.totalBankBalance.toLocaleString()}</b></div>
                    <div className="flex justify-between"><span>Accounts Receivable:</span><b className="text-amber-600 dark:text-amber-400">Rs. {metrics.totalReceivables.toLocaleString()}</b></div>
                    <div className="flex justify-between"><span>Merchandise Inventory:</span><b className="text-emerald-700 dark:text-emerald-300">Rs. {metrics.inventoryAssetValue.toLocaleString()}</b></div>
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="border border-stroke dark:border-strokedark p-4 rounded bg-gray-50/50 dark:bg-meta-4/10">
                  <h4 className="font-bold text-sm text-black dark:text-white border-b pb-2 mb-3 uppercase font-sans flex justify-between">
                    <span>Liabilities & Equity</span>
                    <b className="text-danger">Rs. {(metrics.totalLiabilities + metrics.totalEquity).toLocaleString()}</b>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span>Accounts Payable:</span><b className="text-danger">Rs. {metrics.totalPayables.toLocaleString()}</b></div>
                    <div className="flex justify-between pt-2 border-t font-black text-primary"><span>Owner's Equity / Retained Earnings:</span><b>Rs. {metrics.totalEquity.toLocaleString()}</b></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportDashboard;
