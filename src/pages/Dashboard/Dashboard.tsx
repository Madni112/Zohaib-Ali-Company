import React, { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useNavigate } from 'react-router-dom';
import { fetchFinancialMetrics, FinancialSummary } from '../../service/financialCalculations';
import Spinner from '../../ui/Spinner';
import {
  MdShoppingCart,
  MdLocalMall,
  MdAddBox,
  MdCompareArrows,
  MdAssessment,
  MdAccountBalanceWallet,
  MdAccountBalance,
  MdTrendingUp,
  MdArrowUpward,
  MdArrowDownward,
  MdReceiptLong
} from 'react-icons/md';
import StatCard from '../../ui/StatCard';
import ActionCard from '../../ui/ActionCard';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      const data = await fetchFinancialMetrics();
      setMetrics(data);
      setLoading(false);
    };
    loadDashboard();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // --- ApexCharts Configurations ---
  const hasMonthlyTrend = Boolean(metrics.monthlySalesTrend && metrics.monthlySalesTrend.length > 0);
  const monthlyCategories = hasMonthlyTrend ? metrics.monthlySalesTrend.map((m) => m.month) : ['Jan', 'Feb', 'Mar'];
  const grossSalesData = hasMonthlyTrend ? metrics.monthlySalesTrend.map((m) => m.sales) : [0, 0, 0];
  const procurementData = hasMonthlyTrend ? metrics.monthlySalesTrend.map((m) => m.purchases) : [0, 0, 0];

  // 1. Sales vs Purchases Trend Chart
  const salesVsPurchasesOptions: any = {
    chart: {
      type: 'area',
      height: 310,
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    colors: ['#059669', '#D97706'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: monthlyCategories,
      labels: { style: { colors: '#64748B', fontSize: '11px' } }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `Rs. ${(val / 1000).toFixed(0)}k`,
        style: { colors: '#64748B', fontSize: '11px' }
      }
    },
    tooltip: {
      y: { formatter: (val: number) => `Rs. ${val.toLocaleString()}` }
    },
    legend: { position: 'top', horizontalAlign: 'right' }
  };

  const salesVsPurchasesSeries = [
    { name: 'Gross Sales', data: grossSalesData },
    { name: 'Procurement Purchases', data: procurementData }
  ];

  // 2. Cash Flow Chart (Inflow vs Outflow)
  const hasCashFlow = Boolean(metrics.cashFlowTrend && metrics.cashFlowTrend.length > 0);
  const cashCategories = hasCashFlow ? metrics.cashFlowTrend.map((m) => m.month) : ['Jan', 'Feb', 'Mar'];
  const cashInflowData = hasCashFlow ? metrics.cashFlowTrend.map((m) => m.inflow) : [0, 0, 0];
  const cashOutflowData = hasCashFlow ? metrics.cashFlowTrend.map((m) => m.outflow) : [0, 0, 0];

  const cashFlowOptions: any = {
    chart: { type: 'bar', height: 310, toolbar: { show: false } },
    colors: ['#059669', '#E11D48'],
    plotOptions: { bar: { columnWidth: '40%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: cashCategories,
      labels: { style: { colors: '#64748B', fontSize: '11px' } }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `Rs. ${(val / 1000).toFixed(0)}k`,
        style: { colors: '#64748B', fontSize: '11px' }
      }
    },
    tooltip: { y: { formatter: (val: number) => `Rs. ${val.toLocaleString()}` } }
  };

  const cashFlowSeries = [
    { name: 'Cash Received (Inflow)', data: cashInflowData },
    { name: 'Cash Paid (Outflow)', data: cashOutflowData }
  ];

  // 3. Bank Balance Distribution Donut Chart
  const bankDonutOptions: any = {
    chart: { type: 'donut' },
    colors: ['#059669', '#0D9488', '#D97706', '#0284C7', '#475569'],
    labels: metrics.bankAccounts && metrics.bankAccounts.length > 0 ? metrics.bankAccounts.map((b) => b.accountTitle) : ['Default Bank'],
    legend: { position: 'bottom' },
    tooltip: { y: { formatter: (val: number) => `Rs. ${val.toLocaleString()}` } }
  };

  const bankDonutSeries = metrics.bankAccounts && metrics.bankAccounts.length > 0
    ? metrics.bankAccounts.map((b) => Math.max(0, b.netBalance))
    : [1];

  return (

    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-slate-800 dark:text-slate-100 text-xs">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Executive Management Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time fiscal monitoring, procurement velocity & liquidity metrics</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 shadow-sm">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <button
            onClick={() => navigate('/Reports/Balance-Sheet')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-xl font-bold transition shadow-sm hover:shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <span>Balance Sheet Statement</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* --- TOP ACTION TILES GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-5">
        <ActionCard title="Add Sale" subtitle="New Customer Bill" Icon={MdShoppingCart} bgGradient="bg-gradient-to-br from-emerald-600 to-teal-800" onClick={() => navigate('/sales/invoice/add')} />
        <ActionCard title="Add Purchase" subtitle="Stock Procurement" Icon={MdLocalMall} bgGradient="bg-gradient-to-br from-amber-600 to-amber-800" onClick={() => navigate('/Purchase/Purchases/Add')} />
        <ActionCard title="Add Product" subtitle="Catalog Item" Icon={MdAddBox} bgGradient="bg-gradient-to-br from-teal-600 to-cyan-800" onClick={() => navigate('/Administration/Products/Add')} />
        <ActionCard title="Stock Transfer" subtitle="Bin to Warehouse" Icon={MdCompareArrows} bgGradient="bg-gradient-to-br from-slate-700 to-slate-900" onClick={() => navigate('/Administration/StockTransfer/Add')} />
        <ActionCard title="Stock Report" subtitle="Inventory Audit" Icon={MdAssessment} bgGradient="bg-gradient-to-br from-emerald-700 to-teal-900" onClick={() => navigate('/Reports/Stock-Report')} />
        <ActionCard title="Today's Sale" subtitle={`Rs. ${metrics.todaysSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} Icon={MdTrendingUp} bgGradient="bg-gradient-to-br from-teal-500 to-emerald-700" onClick={() => { }} />
        <ActionCard title="This Month Sales" subtitle={`Rs. ${metrics.thisMonthSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} Icon={MdArrowUpward} bgGradient="bg-gradient-to-br from-emerald-800 to-slate-900" onClick={() => { }} />
        <ActionCard title="This Month Purchases" subtitle={`Rs. ${metrics.thisMonthPurchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} Icon={MdArrowDownward} bgGradient="bg-gradient-to-br from-amber-700 to-stone-900" onClick={() => { }} />
      </div>

      {/* --- APP CALCULATED CASH & BANK BALANCES METRICS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Calculated Cash Balance"
          value={metrics.cashBalance}
          Icon={MdAccountBalanceWallet}
          bgColor="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <StatCard
          title="Monthly Bank Balance"
          value={metrics.totalBankBalance}
          Icon={MdAccountBalance}
          bgColor="bg-gradient-to-br from-teal-600 to-cyan-700"
        />
        <StatCard
          title="Customer Receivables"
          value={metrics.totalReceivables}
          Icon={MdReceiptLong}
          bgColor="bg-gradient-to-br from-amber-500 to-amber-700"
        />
        <StatCard
          title="Total Assets"
          value={metrics.totalAssets}
          Icon={MdAssessment}
          bgColor="bg-gradient-to-br from-emerald-700 to-slate-900"
        />
      </div>

      {/* --- CHARTS SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Sales vs Purchases Trend */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Sales Volume vs Procurement Trend
              </h3>
              <p className="text-[11px] text-slate-400">Monthly Comparative Velocity</p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold font-mono">Live Sync</span>
          </div>
          <ReactApexChart options={salesVsPurchasesOptions} series={salesVsPurchasesSeries} type="area" height={310} />
        </div>

        {/* Chart 2: Cash Flow Inflow vs Outflow */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Cash Drawer Dynamics
              </h3>
              <p className="text-[11px] text-slate-400">Inflows vs Settlement Outflows</p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold font-mono">Cash Ledger</span>
          </div>
          <ReactApexChart options={cashFlowOptions} series={cashFlowSeries} type="bar" height={310} />
        </div>
      </div>

      {/* --- BANK ACCOUNT BALANCE DISTRIBUTION & BALANCE SHEET SUMMARY GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bank Allocation Donut Chart */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            Bank Ledgers Allocation
          </h3>
          <ReactApexChart options={bankDonutOptions} series={bankDonutSeries} type="donut" height={260} />
        </div>

        {/* Corporate Bank Ledgers List Table */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Corporate Bank Account Balances
              </h3>
              <p className="text-[11px] text-slate-400">Real-time ledger reconciliation</p>
            </div>
            <button
              onClick={() => navigate('/Reports/Account-Report')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline text-xs flex items-center gap-1"
            >
              <span>View General Ledger</span>
              <span>→</span>
            </button>
          </div>

          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full table-auto border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 text-left text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Bank Title</th>
                  <th className="py-3 px-4">Account Number</th>
                  <th className="py-3 px-4 text-right">Debit (+In)</th>
                  <th className="py-3 px-4 text-right">Credit (-Out)</th>
                  <th className="py-3 px-4 text-right font-black">Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {metrics.bankAccounts && metrics.bankAccounts.length > 0 ? (
                  metrics.bankAccounts.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 duration-150"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                        <span className="p-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                          <MdAccountBalance size={14} />
                        </span>
                        {b.bankName} - {b.accountTitle}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{b.accountNumber || '-'}</td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-semibold">
                        {b.totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-500 font-semibold">
                        {b.totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        Rs. {b.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No corporate bank accounts registered.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
