import React, { useEffect, useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../Context/supabaseClient';
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
  MdReceiptLong,
  MdWarning,
  MdPauseCircleFilled,
  MdCheckCircle,
  MdPerson,
  MdWarehouse,
  MdSearch,
  MdFilterList,
  MdCalendarToday,
  MdLocalFireDepartment,
  MdAttachMoney,
  MdOutlineReceipt
} from 'react-icons/md';
import StatCard from '../../ui/StatCard';
import ActionCard from '../../ui/ActionCard';
import { QtyBadge } from '../../utils/QtyBadge';

// Types for Dashboard Operational Intelligence
interface ReceivableInvoice {
  id: string | number;
  invoiceNo: string;
  customerName: string;
  salesman: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  daysPending: number;
}

interface TrendingProduct {
  id: string | number;
  name: string;
  category: string;
  sku: string;
  totalRevenue: number;
  unitsSold: number;
  transactionCount: number;
  percentageOfTotal: number;
}

interface LowStockAlert {
  id: string | number;
  name: string;
  category: string;
  warehouse: string;
  currentStock: number;
  minLimit: number;
  deficit: number;
  unit: string;
}

interface HoldingItemData {
  id: string;
  dcId: number | string;
  gatepassNo: string;
  invoiceNo: string;
  customerName: string;
  salesman: string;
  warehouseGuy: string;
  productName: string;
  orderQty: number;
  dispatchedQty: number;
  holdQty: number;
  rate: number;
  heldAmount: number;
  date: string;
}

interface CashTransaction {
  id: string | number;
  date: string;
  type: 'Inflow' | 'Outflow';
  source: string;
  party: string;
  amount: number;
  description: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Operational Data States
  const [receivablesList, setReceivablesList] = useState<ReceivableInvoice[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockAlert[]>([]);
  const [holdingItems, setHoldingItems] = useState<HoldingItemData[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);

  // Interactive Tab Controllers
  const [chartViewTab, setChartViewTab] = useState<'daily' | 'monthly'>('monthly');
  const [holdingTab, setHoldingTab] = useState<'warehouse' | 'invoice'>('warehouse');
  const [selectedWarehouseGuy, setSelectedWarehouseGuy] = useState<string>('All');
  const [selectedHoldingInvoice, setSelectedHoldingInvoice] = useState<string>('All');
  const [liquidityTab, setLiquidityTab] = useState<'bank' | 'cash'>('bank');

  // Customer Sales Graph Data
  const [customerSalesDaily, setCustomerSalesDaily] = useState<{ dates: string[]; sales: number[] }>({ dates: [], sales: [] });
  const [customerSalesMonthly, setCustomerSalesMonthly] = useState<{ months: string[]; sales: number[] }>({ months: [], sales: [] });

  useEffect(() => {
    loadCompleteDashboard();
  }, []);

  const loadCompleteDashboard = async () => {
    try {
      setLoading(true);

      // Fetch financial metrics & database tables in parallel
      const [
        metricsData,
        invoicesRes,
        productsRes,
        openStocksRes,
        purchasesRes,
        salesReturnsRes,
        purchaseReturnsRes,
        vouchersRes,
        dcsRes,
        custRecoveriesRes
      ] = await Promise.all([
        fetchFinancialMetrics(),
        supabase.from('sales_invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('opening_stocks').select('*'),
        supabase.from('supplier_purchases').select('*'),
        supabase.from('sales_returns').select('*'),
        supabase.from('purchase_returns').select('*'),
        supabase.from('financial_vouchers').select('*').order('created_at', { ascending: false }),
        supabase.from('delivery_challans').select('*').order('created_at', { ascending: false }),
        supabase.from('customer_recoveries').select('*')
      ]);

      setMetrics(metricsData);

      const invoices = invoicesRes.data || [];
      const products = productsRes.data || [];
      const openStocks = openStocksRes.data || [];
      const purchases = purchasesRes.data || [];
      const salesReturns = salesReturnsRes.data || [];
      const purchaseReturns = purchaseReturnsRes.data || [];
      const vouchers = vouchersRes.data || [];
      const dcs = dcsRes.data || [];
      const recoveries = custRecoveriesRes.data || [];

      // ==========================================
      // 1. CUSTOMER RECEIVABLES WITH AGING PENDING
      // ==========================================
      // Map recoveries per invoice
      const invoiceRecoveriesMap: Record<string, number> = {};
      recoveries.forEach((rec: any) => {
        const invId = String(rec.invoice_id || rec.invoiceId || rec.invoice_no || '').trim();
        if (invId) {
          const amt = Number(rec.net_collected_amount || rec.amount_paid || rec.amount || 0);
          invoiceRecoveriesMap[invId] = (invoiceRecoveriesMap[invId] || 0) + amt;
        }
      });

      // Map sales returns per invoice
      const invoiceReturnsMap: Record<string, number> = {};
      salesReturns.forEach((ret: any) => {
        const invNo = String(ret.invoice_no || ret.invoice_id || '').trim();
        if (invNo) {
          const retAmt = Number(ret.total_amount || ret.total_net_amount || 0);
          invoiceReturnsMap[invNo] = (invoiceReturnsMap[invNo] || 0) + retAmt;
        }
      });

      const today = new Date();
      const extractedReceivables: ReceivableInvoice[] = [];

      invoices.forEach((inv: any) => {
        const total = Number(inv.total_amount || 0);
        const initialPaid = Number(inv.cash_amount_paid || inv.paid_amount || 0);
        const invKey = String(inv.id).trim();
        const invNoKey = String(inv.invoice_no || '').trim();

        const extraRecoveries = (invoiceRecoveriesMap[invKey] || 0) + (invNoKey ? (invoiceRecoveriesMap[invNoKey] || 0) : 0);
        const retDeductions = (invoiceReturnsMap[invKey] || 0) + (invNoKey ? (invoiceReturnsMap[invNoKey] || 0) : 0);

        const outstanding = Math.max(0, total - initialPaid - extraRecoveries - retDeductions);

        if (outstanding > 0.5) {
          const rawDate = inv.sale_date || inv.invoice_date || inv.created_at || '';
          const invDate = rawDate ? new Date(rawDate) : today;
          const diffTime = Math.max(0, today.getTime() - invDate.getTime());
          const daysPending = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          extractedReceivables.push({
            id: inv.id,
            invoiceNo: inv.invoice_no || `INV-${String(inv.id).padStart(4, '0')}`,
            customerName: inv.customer_name || 'Walk-in Customer',
            salesman: inv.salesman || 'Direct Sales',
            invoiceDate: rawDate ? rawDate.split('T')[0] : 'Today',
            totalAmount: total,
            paidAmount: initialPaid + extraRecoveries,
            outstandingBalance: outstanding,
            daysPending
          });
        }
      });

      // Keep last 10 sale transactions with pending receivables
      setReceivablesList(extractedReceivables.slice(0, 10));

      // ==========================================
      // 2. TRENDING PRODUCTS (REVENUE & VELOCITY)
      // ==========================================
      const productSalesMap: Record<string, { name: string; category: string; sku: string; revenue: number; units: number; count: number }> = {};
      let totalSalesGross = 0;

      invoices.forEach((inv: any) => {
        let items: any[] = [];
        if (Array.isArray(inv.items)) {
          items = inv.items;
        } else if (typeof inv.items === 'string') {
          try {
            items = JSON.parse(inv.items);
          } catch (_) {
            items = [];
          }
        }

        items.forEach((item: any) => {
          const pName = String(item.product_name || item.itemName || item.pDescription || item.name || 'Standard Product').trim();
          const qty = Number(item.qty || item.quantity || item.orderQty || 1);
          const rate = Number(item.rate || item.rp || item.price || 0);
          const lineTotal = Number(item.amount || item.total || (qty * rate));

          if (!productSalesMap[pName]) {
            productSalesMap[pName] = {
              name: pName,
              category: item.category || 'General Catalog',
              sku: item.sku || item.skuCode || 'SKU-GEN',
              revenue: 0,
              units: 0,
              count: 0
            };
          }

          productSalesMap[pName].revenue += lineTotal;
          productSalesMap[pName].units += qty;
          productSalesMap[pName].count += 1;
          totalSalesGross += lineTotal;
        });
      });

      const rankedProducts: TrendingProduct[] = Object.keys(productSalesMap)
        .map((key, idx) => {
          const p = productSalesMap[key];
          const pct = totalSalesGross > 0 ? (p.revenue / totalSalesGross) * 100 : 0;
          return {
            id: idx + 1,
            name: p.name,
            category: p.category,
            sku: p.sku,
            totalRevenue: p.revenue,
            unitsSold: p.units,
            transactionCount: p.count,
            percentageOfTotal: Math.min(100, Math.max(1, pct))
          };
        })
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 8);

      setTrendingProducts(rankedProducts);

      // ==========================================
      // 3. LOW STOCK / MINIMUM LIMIT ALERTS
      // ==========================================
      const stockAlerts: LowStockAlert[] = [];

      products.forEach((prod: any) => {
        const prodName = String(prod.product_name || '').trim().toLowerCase();
        const minLimit = Number(prod.min_stock || prod.reorder_level || prod.minimum_limit || 10);

        // Opening Stock
        const totalOpening = openStocks
          .filter((os: any) => {
            const osName = String(os.product_name || os.item_name || os.itemName || '').trim().toLowerCase();
            return osName === prodName || (prodName && osName.includes(prodName));
          })
          .reduce((sum: number, os: any) => sum + Number(os.quantity || os.qty || 0), 0);

        // Purchases
        let totalPurchased = 0;
        purchases.forEach((p: any) => {
          const pItems = Array.isArray(p.items) ? p.items : (typeof p.items === 'string' ? JSON.parse(p.items || '[]') : []);
          pItems.forEach((pi: any) => {
            const piName = String(pi.product_name || pi.itemName || pi.itemDetails || '').trim().toLowerCase();
            if (piName === prodName || (prodName && piName.includes(prodName))) {
              totalPurchased += Number(pi.quantity || pi.qty || 0);
            }
          });
        });

        // Sales
        let totalSold = 0;
        invoices.forEach((inv: any) => {
          const invItems = Array.isArray(inv.items) ? inv.items : (typeof inv.items === 'string' ? JSON.parse(inv.items || '[]') : []);
          invItems.forEach((ii: any) => {
            const iiName = String(ii.product_name || ii.itemName || ii.pDescription || '').trim().toLowerCase();
            if (iiName === prodName || (prodName && iiName.includes(prodName))) {
              totalSold += Number(ii.qty || ii.quantity || 0);
            }
          });
        });

        // Sales Returns (+stock)
        let totalReturned = 0;
        salesReturns.forEach((sr: any) => {
          const srItems = Array.isArray(sr.items) ? sr.items : (typeof sr.items === 'string' ? JSON.parse(sr.items || '[]') : []);
          srItems.forEach((sri: any) => {
            const sriName = String(sri.product_name || sri.item_name || sri.itemName || '').trim().toLowerCase();
            if (sriName === prodName || (prodName && sriName.includes(prodName))) {
              totalReturned += Number(sri.quantity || sri.qty || 0);
            }
          });
        });

        const currentStock = Math.max(0, totalOpening + totalPurchased - totalSold + totalReturned);

        // Alert condition: currentStock is at or below minimum threshold
        if (currentStock <= minLimit) {
          stockAlerts.push({
            id: prod.id,
            name: prod.product_name || 'Item',
            category: prod.category || 'Standard Catalog',
            warehouse: prod.warehouse || prod.location || 'Main Warehouse',
            currentStock,
            minLimit,
            deficit: Math.max(0, minLimit - currentStock),
            unit: prod.unit || 'Units'
          });
        }
      });

      // Sort by greatest deficit first and show up to 10
      stockAlerts.sort((a, b) => b.deficit - a.deficit);
      setLowStockProducts(stockAlerts.slice(0, 10));

      // ==========================================
      // 4. HOLDING ITEMS (WAREHOUSE & INVOICE WISE)
      // ==========================================
      const extractedHolding: HoldingItemData[] = [];

      dcs.forEach((dc: any) => {
        let items: any[] = [];
        if (Array.isArray(dc.items)) {
          items = dc.items;
        } else if (typeof dc.items === 'string') {
          try {
            items = JSON.parse(dc.items);
          } catch (_) {
            items = [];
          }
        }

        const gatepassNo = dc.challan_no || `DC-${String(dc.id).padStart(4, '0')}`;
        const invoiceNo = dc.invoice_no || `INV-${String(dc.invoice_id || dc.id).padStart(4, '0')}`;
        const customerName = dc.customer_name || 'Direct Buyer';
        const salesman = dc.salesman || 'Direct Staff';
        const warehouseGuy = dc.warehouse_guy || dc.warehouse_incharge || dc.dispatch_warehouse || dc.created_by || 'Main Warehouse Storekeeper';
        const docDate = dc.challan_date || dc.dc_date || String(dc.created_at || '').split('T')[0];

        items.forEach((item: any, idx: number) => {
          const orderQty = Number(item.orderQty ?? item.qty ?? item.quantity ?? 0);
          const dispatchedQty = Number(item.dispatchedQty ?? (dc.status === 'Approved' || dc.status === 'Dispatched' ? orderQty : 0));
          const holdQty = Number(item.holdQty !== undefined ? item.holdQty : Math.max(0, orderQty - dispatchedQty));
          const rate = Number(item.rate || item.rp || 0);

          if (holdQty > 0) {
            extractedHolding.push({
              id: `${dc.id}-${idx}`,
              dcId: dc.id,
              gatepassNo,
              invoiceNo,
              customerName,
              salesman,
              warehouseGuy,
              productName: item.pDescription || item.itemName || item.product_name || 'Inventory Item',
              orderQty,
              dispatchedQty,
              holdQty,
              rate,
              heldAmount: holdQty * rate,
              date: docDate
            });
          }
        });
      });

      setHoldingItems(extractedHolding);

      // ==========================================
      // 5. CUSTOMER SALES GRAPH (DAILY & MONTHLY)
      // ==========================================
      // Daily: Last 14 days aggregation
      const dailyMap: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dailyMap[key] = 0;
      }

      invoices.forEach((inv: any) => {
        const rawDate = String(inv.sale_date || inv.invoice_date || inv.created_at || '').split('T')[0];
        if (dailyMap.hasOwnProperty(rawDate)) {
          dailyMap[rawDate] += Number(inv.total_amount || 0);
        }
      });

      setCustomerSalesDaily({
        dates: Object.keys(dailyMap).map(d => {
          const dt = new Date(d);
          return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        sales: Object.values(dailyMap)
      });

      // Monthly: Current Year 12 Months aggregation
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlySalesMap: Record<number, number> = {};
      monthNames.forEach((_, idx) => { monthlySalesMap[idx] = 0; });
      const currentYear = new Date().getFullYear();

      invoices.forEach((inv: any) => {
        const rawDate = inv.sale_date || inv.invoice_date || inv.created_at || '';
        if (rawDate) {
          const d = new Date(rawDate);
          if (d.getFullYear() === currentYear) {
            monthlySalesMap[d.getMonth()] += Number(inv.total_amount || 0);
          }
        }
      });

      setCustomerSalesMonthly({
        months: monthNames,
        sales: monthNames.map((_, idx) => monthlySalesMap[idx])
      });

      // ==========================================
      // 6. CASH DRAWER TRANSACTIONS LEDGER
      // ==========================================
      const cashTxns: CashTransaction[] = [];

      // Vouchers Cash In/Out
      vouchers.forEach((v: any) => {
        const mode = String(v.mode_of_payment || v.voucher_type || '').toLowerCase();
        if (!mode.includes('bank')) {
          const isReceipt = String(v.voucher_type || '').toLowerCase().includes('receipt');
          cashTxns.push({
            id: `v-${v.id}`,
            date: v.voucher_date || String(v.created_at || '').split('T')[0],
            type: isReceipt ? 'Inflow' : 'Outflow',
            source: v.voucher_type || 'Cash Voucher',
            party: v.party_name || v.account_title || 'General Account',
            amount: Number(v.total_amount || v.amount || 0),
            description: v.narration || v.remarks || 'Cash settlement'
          });
        }
      });

      // Cash Invoices
      invoices.slice(0, 15).forEach((inv: any) => {
        const cashPaid = Number(inv.cash_amount_paid || (inv.settlement_mode === 'Cash' ? inv.total_amount : 0) || 0);
        if (cashPaid > 0) {
          cashTxns.push({
            id: `inv-${inv.id}`,
            date: inv.sale_date || String(inv.created_at || '').split('T')[0],
            type: 'Inflow',
            source: `Sale Bill ${inv.invoice_no || inv.id}`,
            party: inv.customer_name || 'Counter Customer',
            amount: cashPaid,
            description: 'Direct Cash Counter Collection'
          });
        }
      });

      setCashTransactions(cashTxns.slice(0, 15));

    } catch (err: any) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Distinct Filter Lists for Holding Items
  const warehouseGuysList = useMemo(() => {
    const set = new Set<string>();
    holdingItems.forEach(h => {
      if (h.warehouseGuy) set.add(h.warehouseGuy);
    });
    return ['All', ...Array.from(set).sort()];
  }, [holdingItems]);

  const holdingInvoicesList = useMemo(() => {
    const set = new Set<string>();
    holdingItems.forEach(h => {
      if (h.invoiceNo) set.add(h.invoiceNo);
    });
    return ['All', ...Array.from(set).sort()];
  }, [holdingItems]);

  // Filtered Holding Items
  const filteredHoldingItems = useMemo(() => {
    return holdingItems.filter(item => {
      if (holdingTab === 'warehouse') {
        if (selectedWarehouseGuy !== 'All' && item.warehouseGuy !== selectedWarehouseGuy) return false;
      } else {
        if (selectedHoldingInvoice !== 'All' && item.invoiceNo !== selectedHoldingInvoice) return false;
      }
      return true;
    });
  }, [holdingItems, holdingTab, selectedWarehouseGuy, selectedHoldingInvoice]);

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
    chart: { type: 'area', height: 300, toolbar: { show: false }, zoom: { enabled: false } },
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
    tooltip: { y: { formatter: (val: number) => `Rs. ${val.toLocaleString()}` } },
    legend: { position: 'top', horizontalAlign: 'right' }
  };

  const salesVsPurchasesSeries = [
    { name: 'Gross Sales', data: grossSalesData },
    { name: 'Procurement Purchases', data: procurementData }
  ];

  // 2. Customer Sales Volume Graph (Monthly & Daily View Switcher)
  const customerGraphCategories = chartViewTab === 'daily' ? customerSalesDaily.dates : customerSalesMonthly.months;
  const customerGraphData = chartViewTab === 'daily' ? customerSalesDaily.sales : customerSalesMonthly.sales;

  const customerSalesChartOptions: any = {
    chart: { type: 'bar', height: 300, toolbar: { show: false } },
    colors: ['#059669'],
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: chartViewTab === 'daily' ? '45%' : '35%',
        distributed: false
      }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: customerGraphCategories,
      labels: { style: { colors: '#64748B', fontSize: '10px' } }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `Rs. ${(val / 1000).toFixed(0)}k`,
        style: { colors: '#64748B', fontSize: '11px' }
      }
    },
    tooltip: {
      y: { formatter: (val: number) => `Rs. ${Number(val || 0).toLocaleString()}` }
    }
  };

  const customerSalesChartSeries = [
    { name: chartViewTab === 'daily' ? 'Daily Customer Sales' : 'Monthly Customer Sales', data: customerGraphData }
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
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-slate-800 dark:text-slate-100 text-xs pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Executive Management Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time fiscal monitoring, procurement velocity & operational intelligence</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 shadow-sm flex items-center gap-1.5">
            <MdCalendarToday className="text-emerald-600" />
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* --- TOP ACTION TILES GRID --- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-5">
        <ActionCard title="Sales" subtitle="Customer Bill" Icon={MdShoppingCart} bgGradient="bg-gradient-to-br from-emerald-600 to-teal-800" onClick={() => navigate('/sales/invoice/list')} />
        <ActionCard title="Purchases" subtitle="Buy New Product" Icon={MdLocalMall} bgGradient="bg-gradient-to-br from-amber-600 to-amber-800" onClick={() => navigate('/Purchase/Purchases/list')} />
        <ActionCard title="Products" subtitle="Items List" Icon={MdAddBox} bgGradient="bg-gradient-to-br from-teal-600 to-cyan-800" onClick={() => navigate('/Administration/Products/list')} />
        <ActionCard title="Sale Return" subtitle="Customer Return" Icon={MdCompareArrows} bgGradient="bg-gradient-to-br from-slate-700 to-slate-900" onClick={() => navigate('/sales/return')} />
        <ActionCard title="Stock Report" subtitle="Inventory Audit" Icon={MdAssessment} bgGradient="bg-gradient-to-br from-emerald-700 to-teal-900" onClick={() => navigate('/Reports/Stock-Report')} />
        <ActionCard title="Today's Sale" subtitle={`Rs. ${metrics.todaysSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} Icon={MdTrendingUp} bgGradient="bg-gradient-to-br from-teal-500 to-emerald-700" onClick={() => { }} />
        <ActionCard title="This Month Sales" subtitle={`Rs. ${metrics.thisMonthSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} Icon={MdArrowUpward} bgGradient="bg-gradient-to-br from-emerald-800 to-slate-900" onClick={() => { }} />
        <ActionCard title="This Month Purchases" subtitle={`Rs. ${metrics.thisMonthPurchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} Icon={MdArrowDownward} bgGradient="bg-gradient-to-br from-amber-700 to-stone-900" onClick={() => { }} />
      </div>

      {/* --- FINANCIAL KPI STAT CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard title="Calculated Cash Balance" value={metrics.cashBalance} Icon={MdAccountBalanceWallet} bgColor="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <StatCard title="Monthly Bank Balance" value={metrics.totalBankBalance} Icon={MdAccountBalance} bgColor="bg-gradient-to-br from-teal-600 to-cyan-700" />
        <StatCard title="Customer Receivables" value={metrics.totalReceivables} Icon={MdReceiptLong} bgColor="bg-gradient-to-br from-amber-500 to-amber-700" />
        <StatCard title="Total Assets" value={metrics.totalAssets} Icon={MdAssessment} bgColor="bg-gradient-to-br from-emerald-700 to-slate-900" />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: CUSTOMER RECEIVABLES (AGING) & TRENDING PRODUCTS               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WIDGET 1: CUSTOMER RECEIVABLES AGING LEDGER (7 COLS) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                    <MdOutlineReceipt size={16} />
                  </span>
                  Customer Receivables Aging Ledger
                </h3>
                <p className="text-[11px] text-slate-400">Last 10 outstanding sales invoices with real-time aging status</p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold font-mono">
                {receivablesList.length} Invoices Due
              </span>
            </div>

            {/* Table Container with Exactly 5 Visible Rows Height + Scrollbar */}
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/80 max-h-[295px] overflow-y-auto pr-1">
              <table className="w-full table-auto border-collapse font-sans text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-sm">
                  <tr className="text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700 text-left text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Inv No.</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Salesman</th>
                    <th className="py-2.5 px-3">Date & Aging</th>
                    <th className="py-2.5 px-3 text-right">Outstanding (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {receivablesList.length > 0 ? (
                    receivablesList.map((rec) => {
                      // Aging color scheme
                      let badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50';
                      if (rec.daysPending > 30) {
                        badgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50';
                      } else if (rec.daysPending > 7) {
                        badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50';
                      }

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 duration-150">
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {rec.invoiceNo}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100 max-w-[140px] truncate" title={rec.customerName}>
                            {rec.customerName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-[100px] truncate" title={rec.salesman}>
                            <span className="inline-flex items-center gap-1">
                              <MdPerson size={13} className="text-slate-400" />
                              {rec.salesman}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-[10px] text-slate-400">{rec.invoiceDate}</span>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight ${badgeClass}`}>
                                {rec.daysPending === 0 ? 'Today' : `${rec.daysPending} Days Old`}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                            Rs. {rec.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 italic">
                        No outstanding customer invoices found. All receivables cleared! 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pt-2 flex justify-between items-center text-[11px] text-slate-400">
            <span>Scroll table to see full last 10 entries</span>
            <button
              onClick={() => navigate('/Reports/Account-Report', { state: { activeTab: 12 } })}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              Open Receivables Ledger →
            </button>
          </div>
        </div>

        {/* WIDGET 2: TRENDING PRODUCTS LEADERBOARD (5 COLS) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="p-1 rounded-md bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
                    <MdWarning size={16} />
                  </span>
                  Low Stock Limit Alerts
                </h3>
                <p className="text-[11px] text-slate-400">Products at or below minimum threshold</p>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold font-mono ${lowStockProducts.length > 0
                ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                }`}>
                {lowStockProducts.length > 0 ? `${lowStockProducts.length} Items Critical` : 'Stock Healthy 🛡️'}
              </span>
            </div>

            {/* List with Up to 10 Low Stock Items */}
            <div className="space-y-2 max-h-[295px] overflow-y-auto pr-1">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl border border-rose-100 dark:border-rose-950/40 bg-rose-50/40 dark:bg-rose-950/20 flex justify-between items-center gap-2 hover:bg-rose-50/70 duration-150"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-white text-xs truncate" title={p.name}>
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="text-rose-600 font-bold">Avail: {p.currentStock} {p.unit}</span>
                        <span>•</span>
                        <span>Min Req: {p.minLimit} {p.unit}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[10px]">
                        -{p.deficit} {p.unit}
                      </span>
                      <button
                        onClick={() => navigate('/Purchase/Purchases/Add')}
                        className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold hover:border-emerald-500 hover:text-emerald-600 transition"
                        title="Create Purchase Order"
                      >
                        + Reorder
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-emerald-600 dark:text-emerald-400 flex flex-col items-center justify-center gap-2">
                  <MdCheckCircle size={32} />
                  <span className="font-bold text-xs">All Products are above Minimum Stock Limits</span>
                  <span className="text-[11px] text-slate-400">Inventory levels are currently optimal.</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 text-right">
            <button
              onClick={() => navigate('/Reports/Stock-Report')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline text-[11px]"
            >
              Open Inventory Audit Matrix →
            </button>
          </div>
        </div>

      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WIDGET 3: INTERACTIVE HOLDING INVENTORY (7 COLS) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 flex flex-col justify-between">
          <div>
            {/* Header with Dual Tabs and Dropdown Filters */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="p-1 rounded-md bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400">
                    <MdPauseCircleFilled size={16} />
                  </span>
                  Holding Inventory Center
                </h3>
                <p className="text-[11px] text-slate-400">Committed orders held at warehouse pending customer pickup</p>
              </div>

              {/* Mode Tabs & Selector */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    onClick={() => setHoldingTab('warehouse')}
                    className={`px-2.5 py-1 rounded-md transition ${holdingTab === 'warehouse'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500'
                      }`}
                  >
                    Warehouse In-Charge
                  </button>
                  <button
                    onClick={() => setHoldingTab('invoice')}
                    className={`px-2.5 py-1 rounded-md transition ${holdingTab === 'invoice'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500'
                      }`}
                  >
                    Invoice-Wise
                  </button>
                </div>

                {/* Dropdown Selector based on Active Tab */}
                {holdingTab === 'warehouse' ? (
                  <select
                    value={selectedWarehouseGuy}
                    onChange={(e) => setSelectedWarehouseGuy(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none max-w-[150px] truncate"
                  >
                    {warehouseGuysList.map(guy => (
                      <option key={guy} value={guy}>{guy === 'All' ? 'All Warehouse Staff' : guy}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedHoldingInvoice}
                    onChange={(e) => setSelectedHoldingInvoice(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none max-w-[150px] truncate"
                  >
                    {holdingInvoicesList.map(inv => (
                      <option key={inv} value={inv}>{inv === 'All' ? 'All Invoices' : inv}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Holding Items Table */}
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/80 max-h-[295px] overflow-y-auto pr-1">
              <table className="w-full table-auto border-collapse font-sans text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-sm">
                  <tr className="text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700 text-left text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Item / SKU</th>
                    <th className="py-2.5 px-3">{holdingTab === 'warehouse' ? 'Gatepass (DC)' : 'Invoice #'}</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-center">Held Qty</th>
                    <th className="py-2.5 px-3 text-right">Held Value (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredHoldingItems.length > 0 ? (
                    filteredHoldingItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 duration-150">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white max-w-[150px] truncate" title={item.productName}>
                          {item.productName}
                          <div className="text-[10px] text-slate-400 font-normal font-mono">
                            {holdingTab === 'warehouse' ? `Staff: ${item.warehouseGuy}` : `Salesman: ${item.salesman}`}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
                          {holdingTab === 'warehouse' ? item.gatepassNo : item.invoiceNo}
                          <div className="text-[10px] text-slate-400 font-normal">{item.date}</div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate" title={item.customerName}>
                          {item.customerName}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <QtyBadge qty={item.holdQty} />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                          Rs. {item.heldAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 italic">
                        No active holding items matching your selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center text-[11px] text-slate-400">
            <span>Showing {filteredHoldingItems.length} active committed holding items</span>
            <button
              onClick={() => navigate('/Reports/Holding-Report')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              Open Full Holding Report →
            </button>
          </div>
        </div>

        {/* WIDGET 4: LOW STOCK & MINIMUM LIMIT ALERTS (5 COLS) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                    <MdLocalFireDepartment size={16} />
                  </span>
                  Top Trending Products
                </h3>
                <p className="text-[11px] text-slate-400">Ranked by revenue velocity & order frequency</p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold">
                Top Demand 🔥
              </span>
            </div>

            {/* List with 5 visible rows + scroll */}
            <div className="space-y-2.5 max-h-[295px] overflow-y-auto pr-1">
              {trendingProducts.length > 0 ? (
                trendingProducts.map((p, idx) => (
                  <div
                    key={p.name}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 duration-150 flex items-center gap-3"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 font-black text-xs flex items-center justify-center shrink-0">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-slate-900 dark:text-white truncate text-xs" title={p.name}>
                          {p.name}
                        </span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs shrink-0 ml-2">
                          Rs. {(p.totalRevenue / 1000).toFixed(1)}k
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                        <span>{p.category}</span>
                        <span>{p.unitsSold.toLocaleString()} units sold ({p.transactionCount} bills)</span>
                      </div>
                      {/* Mini visual velocity bar */}
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full"
                          style={{ width: `${Math.max(8, p.percentageOfTotal)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 italic">
                  No sales invoice items recorded yet.
                </div>
              )}
            </div>
          </div>
          <div className="pt-2 text-right">
            <button
              onClick={() => navigate('/Reports/Sales-Report')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline text-[11px]"
            >
              View Full Product Sales Analytics →
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: CHARTS (SALES VS PURCHASES & CUSTOMER SALES WITH DAILY/MONTHLY)*/}
      {/* ========================================================================= */}

      {/* ========================================================================= */}
      {/* SECTION 3: HOLDING INVENTORY DUAL-TAB & LOW STOCK LIMIT ALERTS            */}
      {/* ========================================================================= */}

      {/* ========================================================================= */}
      {/* SECTION 4: LIQUIDITY CENTER (BANK ACCOUNTS & CASH DRAWER DUAL TABS)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bank Allocation Donut Chart (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center gap-2">
              <MdAccountBalance className="text-emerald-600" />
              Corporate Treasury Allocation
            </h3>
            <ReactApexChart options={bankDonutOptions} series={bankDonutSeries} type="donut" height={260} />
          </div>
          <div className="text-[11px] text-slate-400 text-center pt-2">
            Net Liquid Reserves: <span className="font-bold text-slate-900 dark:text-white font-mono">Rs. {(metrics.totalBankBalance + metrics.cashBalance).toLocaleString()}</span>
          </div>
        </div>

        {/* Liquid Ledgers (Bank Accounts & Cash Drawer Tabs) (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Liquidity & Cash Settlement Ledgers
                </h3>
                <p className="text-[11px] text-slate-400">Reconciled corporate bank accounts & cash drawer transactions</p>
              </div>

              {/* Dual Tab: Bank Accounts vs Cash Drawer */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl font-bold text-xs">
                <button
                  onClick={() => setLiquidityTab('bank')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${liquidityTab === 'bank'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                    }`}
                >
                  <MdAccountBalance size={14} />
                  <span>Bank Accounts ({metrics.bankAccounts?.length || 0})</span>
                </button>
                <button
                  onClick={() => setLiquidityTab('cash')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${liquidityTab === 'cash'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                    }`}
                >
                  <MdAccountBalanceWallet size={14} />
                  <span>Cash Drawer</span>
                </button>
              </div>
            </div>

            {/* TAB 1: BANK ACCOUNTS LEDGER TABLE */}
            {liquidityTab === 'bank' && (
              <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 max-h-[260px] overflow-y-auto">
                <table className="w-full table-auto border-collapse font-mono text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                    <tr className="text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 text-left text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Bank Title</th>
                      <th className="py-2.5 px-3">Account Number</th>
                      <th className="py-2.5 px-3 text-right">Debit (+In)</th>
                      <th className="py-2.5 px-3 text-right">Credit (-Out)</th>
                      <th className="py-2.5 px-3 text-right font-black">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {metrics.bankAccounts && metrics.bankAccounts.length > 0 ? (
                      metrics.bankAccounts.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 duration-150"
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                            <span className="p-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                              <MdAccountBalance size={14} />
                            </span>
                            {b.bankName} - {b.accountTitle}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{b.accountNumber || '-'}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                            {b.totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-500 font-semibold">
                            {b.totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
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
            )}

            {/* TAB 2: CASH DRAWER SETTLEMENT TABLE */}
            {liquidityTab === 'cash' && (
              <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 max-h-[260px] overflow-y-auto">
                <table className="w-full table-auto border-collapse font-mono text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                    <tr className="text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 text-left text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Source / Voucher</th>
                      <th className="py-2.5 px-3">Party / Particulars</th>
                      <th className="py-2.5 px-3 text-center">Type</th>
                      <th className="py-2.5 px-3 text-right">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {cashTransactions.length > 0 ? (
                      cashTransactions.map((c) => (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 duration-150"
                        >
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{c.date}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans">{c.source}</td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans max-w-[140px] truncate" title={c.party}>
                            {c.party}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.type === 'Inflow'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                              }`}>
                              {c.type === 'Inflow' ? '+ Received' : '- Paid'}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-black ${c.type === 'Inflow' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                            Rs. {c.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                          No recent cash drawer movements found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-3 flex justify-between items-center text-xs">
            <span className="text-[11px] text-slate-400">
              {liquidityTab === 'bank' ? 'Real-time verified bank reconciliation' : `Current Cash In Hand: Rs. ${metrics.cashBalance.toLocaleString()}`}
            </span>
            <button
              onClick={() => navigate('/Reports/Account-Report')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline text-xs flex items-center gap-1"
            >
              <span>View Full General Ledger</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: SALES VS PROCUREMENT */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Sales Volume vs Procurement
              </h3>
              <p className="text-[11px] text-slate-400">Monthly comparative velocity & margins</p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold font-mono">Live Sync</span>
          </div>
          <ReactApexChart options={salesVsPurchasesOptions} series={salesVsPurchasesSeries} type="area" height={300} />
        </div>

        {/* CHART 2: CUSTOMER SALES VOLUME GRAPH (TABS: DAILY / MONTHLY) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Customer Sales Volume Trajectory
              </h3>
              <p className="text-[11px] text-slate-400">Interactive timeframe aggregation</p>
            </div>
            {/* Tab Switcher: Daily vs Monthly */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl font-bold text-xs">
              <button
                onClick={() => setChartViewTab('daily')}
                className={`px-3 py-1 rounded-lg transition-all ${chartViewTab === 'daily'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
              >
                📅 Daily (Last 14d)
              </button>
              <button
                onClick={() => setChartViewTab('monthly')}
                className={`px-3 py-1 rounded-lg transition-all ${chartViewTab === 'monthly'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
              >
                📆 Monthly
              </button>
            </div>
          </div>
          <ReactApexChart options={customerSalesChartOptions} series={customerSalesChartSeries} type="bar" height={300} />
        </div>
      </div>
    </div >
  );
};

export default Dashboard;
