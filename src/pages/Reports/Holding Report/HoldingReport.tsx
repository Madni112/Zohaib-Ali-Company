import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { exportToExcel, ExcelColumn } from '../../../utils/excelExport';
import {
  MdPauseCircleFilled,
  MdPrint,
  MdFileDownload,
  MdTrendingUp,
  MdInventory,
  MdPeople,
  MdReceipt,
  MdLocalShipping,
  MdSearch,
  MdFilterAlt,
  MdRefresh,
  MdAttachMoney
} from 'react-icons/md';

type ViewPerspective = 'detailed' | 'salesman' | 'gatepass' | 'invoice' | 'customer';

interface HoldingItemRow {
  id: string;
  dcId: number | string;
  gatepassNo: string;
  invoiceNo: string;
  customerName: string;
  salesman: string;
  productName: string;
  skuCode: string;
  warehouse: string;
  orderQty: number;
  dispatchedQty: number;
  holdQty: number;
  rate: number;
  totalOrderAmount: number;
  heldAmount: number;
  date: string;
  status: string;
}

const HoldingReport: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId, businessName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [activePerspective, setActivePerspective] = useState<ViewPerspective>('detailed');

  // Raw fetched data
  const [holdingRows, setHoldingRows] = useState<HoldingItemRow[]>([]);
  const [salesmenList, setSalesmenList] = useState<string[]>([]);
  const [customersList, setCustomersList] = useState<string[]>([]);
  const [gatepassesList, setGatepassesList] = useState<string[]>([]);
  const [invoicesList, setInvoicesList] = useState<string[]>([]);

  // Search & Filter Criteria
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSalesman, setSelectedSalesman] = useState('All');
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [selectedGatepass, setSelectedGatepass] = useState('All');
  const [selectedInvoice, setSelectedInvoice] = useState('All');
  const [holdingStatusFilter, setHoldingStatusFilter] = useState<'holding_only' | 'all' | 'zero_holding'>('holding_only');
  const [minAmount, setMinAmount] = useState<number | string>('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'qty_desc'>('amount_desc');

  // Date Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Quick Date Preset Handler
  const setQuickDateRange = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'all_time') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const todayStr = formatDate(today);
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = formatDate(y);
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === 'this_week') {
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      setDateFrom(formatDate(startOfWeek));
      setDateTo(formatDate(today));
    } else if (preset === 'this_month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(formatDate(startOfMonth));
      setDateTo(formatDate(today));
    } else if (preset === 'last_month') {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateFrom(formatDate(startOfLastMonth));
      setDateTo(formatDate(endOfLastMonth));
    } else if (preset === 'all_time') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const loadHoldingData = async () => {
    try {
      setLoading(true);

      const [dcRes, invRes, smRes, custRes] = await Promise.all([
        supabase.from('delivery_challans').select('*').order('created_at', { ascending: false }),
        supabase.from('sales_invoices').select('*'),
        supabase.from('salesmen').select('id, name'),
        supabase.from('customers').select('id, customerName')
      ]);

      if (dcRes.error) throw dcRes.error;

      const dcs = dcRes.data || [];
      const invoices = invRes.data || [];
      const salesmen = (smRes.data || []).map((s: any) => s.name).filter(Boolean);
      const customers = (custRes.data || []).map((c: any) => c.customerName).filter(Boolean);

      // Create lookup map for invoices
      const invMap: Record<string, any> = {};
      invoices.forEach(inv => {
        const key1 = String(inv.id).trim().toLowerCase();
        const key2 = `inv-${key1}`;
        invMap[key1] = inv;
        invMap[key2] = inv;
      });

      const extractedRows: HoldingItemRow[] = [];
      const uniqueGPs = new Set<string>();
      const uniqueInvs = new Set<string>();
      const uniqueSMs = new Set<string>(salesmen);
      const uniqueCusts = new Set<string>(customers);

      dcs.forEach(dc => {
        const rawInvCode = String(dc.invoice_no || '').trim().replace(/^inv-/i, '').toLowerCase();
        const linkedInv = invMap[rawInvCode] || invMap[String(dc.invoice_no || '').trim().toLowerCase()];

        const gatepassCode = dc.challan_no || `DC-${String(dc.id).padStart(4, '0')}`;
        const invoiceCode = dc.invoice_no || (linkedInv?.id ? `INV-${String(linkedInv.id).padStart(4, '0')}` : 'Direct');
        const custName = dc.customer_name || linkedInv?.customer_name || 'Counter Buyer';
        const smName = linkedInv?.salesman || dc.salesman || 'Direct';
        const docDate = dc.challan_date || dc.dc_date || linkedInv?.sale_date || String(dc.created_at || '').split('T')[0];

        if (gatepassCode) uniqueGPs.add(gatepassCode);
        if (invoiceCode && invoiceCode !== 'Direct') uniqueInvs.add(invoiceCode);
        if (custName) uniqueCusts.add(custName);
        if (smName) uniqueSMs.add(smName);

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

        items.forEach((item, idx) => {
          const orderQty = Number(item.orderQty ?? item.qty ?? 0);
          const dispatchedQty = Number(item.dispatchedQty ?? (dc.status === 'Approved' || dc.status === 'Dispatched' ? orderQty : 0));
          const holdQty = Number(item.holdQty !== undefined ? item.holdQty : Math.max(0, orderQty - dispatchedQty));
          const rate = Number(item.rate || item.rp || 0);
          const totalOrderAmt = orderQty * rate;
          const heldAmt = holdQty * rate;

          extractedRows.push({
            id: `${dc.id}-${idx}`,
            dcId: dc.id,
            gatepassNo: gatepassCode,
            invoiceNo: invoiceCode,
            customerName: custName,
            salesman: smName,
            productName: item.pDescription || item.itemName || item.product_name || 'Item',
            skuCode: item.skuCode || item.sku || '',
            warehouse: item.location || dc.dispatch_warehouse || 'Main Warehouse',
            orderQty,
            dispatchedQty,
            holdQty,
            rate,
            totalOrderAmount: totalOrderAmt,
            heldAmount: heldAmt,
            date: docDate,
            status: dc.status || (holdQty > 0 ? 'Holding' : 'Completed')
          });
        });
      });

      setHoldingRows(extractedRows);
      setGatepassesList(Array.from(uniqueGPs).sort());
      setInvoicesList(Array.from(uniqueInvs).sort());
      setSalesmenList(Array.from(uniqueSMs).sort());
      setCustomersList(Array.from(uniqueCusts).sort());
    } catch (err: any) {
      console.error('Error fetching holding data:', err);
      toast.error('Failed to load holding items: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHoldingData();
  }, []);

  // Filtered Rows
  const filteredHoldingRows = useMemo(() => {
    return holdingRows.filter(row => {
      // 1. Holding status
      if (holdingStatusFilter === 'holding_only' && row.holdQty <= 0) return false;
      if (holdingStatusFilter === 'zero_holding' && row.holdQty > 0) return false;

      // 2. Salesman
      if (selectedSalesman !== 'All' && row.salesman.toLowerCase() !== selectedSalesman.toLowerCase()) return false;

      // 3. Customer
      if (selectedCustomer !== 'All' && row.customerName.toLowerCase() !== selectedCustomer.toLowerCase()) return false;

      // 4. Gatepass
      if (selectedGatepass !== 'All' && row.gatepassNo.toLowerCase() !== selectedGatepass.toLowerCase()) return false;

      // 5. Invoice
      if (selectedInvoice !== 'All' && row.invoiceNo.toLowerCase() !== selectedInvoice.toLowerCase()) return false;

      // 6. Date Range
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;

      // 7. Min Amount
      if (minAmount !== '' && Number(minAmount) > 0) {
        if (row.heldAmount < Number(minAmount)) return false;
      }

      // 8. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const match =
          row.productName.toLowerCase().includes(query) ||
          row.skuCode.toLowerCase().includes(query) ||
          row.customerName.toLowerCase().includes(query) ||
          row.salesman.toLowerCase().includes(query) ||
          row.gatepassNo.toLowerCase().includes(query) ||
          row.invoiceNo.toLowerCase().includes(query) ||
          row.warehouse.toLowerCase().includes(query);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'amount_desc') return b.heldAmount - a.heldAmount;
      if (sortBy === 'amount_asc') return a.heldAmount - b.heldAmount;
      if (sortBy === 'qty_desc') return b.holdQty - a.holdQty;
      if (sortBy === 'date_desc') return b.date.localeCompare(a.date);
      if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
      return 0;
    });
  }, [
    holdingRows,
    holdingStatusFilter,
    selectedSalesman,
    selectedCustomer,
    selectedGatepass,
    selectedInvoice,
    dateFrom,
    dateTo,
    minAmount,
    searchQuery,
    sortBy
  ]);

  // Aggregations for KPI Cards
  const kpis = useMemo(() => {
    let totalHeldQty = 0;
    let totalHeldValue = 0;
    let totalOrderQty = 0;
    let totalOrderValue = 0;
    const affectedGPs = new Set<string>();
    const affectedInvs = new Set<string>();
    const affectedCusts = new Set<string>();
    const affectedSMs = new Set<string>();

    filteredHoldingRows.forEach(row => {
      totalHeldQty += row.holdQty;
      totalHeldValue += row.heldAmount;
      totalOrderQty += row.orderQty;
      totalOrderValue += row.totalOrderAmount;
      if (row.gatepassNo) affectedGPs.add(row.gatepassNo);
      if (row.invoiceNo && row.invoiceNo !== 'Direct') affectedInvs.add(row.invoiceNo);
      if (row.customerName) affectedCusts.add(row.customerName);
      if (row.salesman) affectedSMs.add(row.salesman);
    });

    return {
      totalItems: filteredHoldingRows.length,
      totalHeldQty,
      totalHeldValue,
      totalOrderQty,
      totalOrderValue,
      uniqueGatepasses: affectedGPs.size,
      uniqueInvoices: affectedInvs.size,
      uniqueCustomers: affectedCusts.size,
      uniqueSalesmen: affectedSMs.size
    };
  }, [filteredHoldingRows]);

  // Grouped Summaries for alternative tabs
  const salesmanSummary = useMemo(() => {
    const map: Record<string, { salesman: string; itemsCount: number; totalHeldQty: number; totalHeldValue: number; customerCount: Set<string>; invoices: Set<string> }> = {};
    filteredHoldingRows.forEach(row => {
      if (!map[row.salesman]) {
        map[row.salesman] = {
          salesman: row.salesman,
          itemsCount: 0,
          totalHeldQty: 0,
          totalHeldValue: 0,
          customerCount: new Set(),
          invoices: new Set()
        };
      }
      map[row.salesman].itemsCount += 1;
      map[row.salesman].totalHeldQty += row.holdQty;
      map[row.salesman].totalHeldValue += row.heldAmount;
      map[row.salesman].customerCount.add(row.customerName);
      map[row.salesman].invoices.add(row.invoiceNo);
    });
    return Object.values(map).sort((a, b) => b.totalHeldValue - a.totalHeldValue);
  }, [filteredHoldingRows]);

  const customerSummary = useMemo(() => {
    const map: Record<string, { customer: string; itemsCount: number; totalHeldQty: number; totalHeldValue: number; gatepasses: Set<string>; invoices: Set<string> }> = {};
    filteredHoldingRows.forEach(row => {
      if (!map[row.customerName]) {
        map[row.customerName] = {
          customer: row.customerName,
          itemsCount: 0,
          totalHeldQty: 0,
          totalHeldValue: 0,
          gatepasses: new Set(),
          invoices: new Set()
        };
      }
      map[row.customerName].itemsCount += 1;
      map[row.customerName].totalHeldQty += row.holdQty;
      map[row.customerName].totalHeldValue += row.heldAmount;
      map[row.customerName].gatepasses.add(row.gatepassNo);
      map[row.customerName].invoices.add(row.invoiceNo);
    });
    return Object.values(map).sort((a, b) => b.totalHeldValue - a.totalHeldValue);
  }, [filteredHoldingRows]);

  const gatepassSummary = useMemo(() => {
    const map: Record<string, { gatepassNo: string; customer: string; salesman: string; date: string; itemsCount: number; totalOrderQty: number; totalDispatchedQty: number; totalHeldQty: number; totalHeldValue: number; status: string }> = {};
    filteredHoldingRows.forEach(row => {
      if (!map[row.gatepassNo]) {
        map[row.gatepassNo] = {
          gatepassNo: row.gatepassNo,
          customer: row.customerName,
          salesman: row.salesman,
          date: row.date,
          itemsCount: 0,
          totalOrderQty: 0,
          totalDispatchedQty: 0,
          totalHeldQty: 0,
          totalHeldValue: 0,
          status: row.status
        };
      }
      map[row.gatepassNo].itemsCount += 1;
      map[row.gatepassNo].totalOrderQty += row.orderQty;
      map[row.gatepassNo].totalDispatchedQty += row.dispatchedQty;
      map[row.gatepassNo].totalHeldQty += row.holdQty;
      map[row.gatepassNo].totalHeldValue += row.heldAmount;
    });
    return Object.values(map).sort((a, b) => b.totalHeldValue - a.totalHeldValue);
  }, [filteredHoldingRows]);

  const invoiceSummary = useMemo(() => {
    const map: Record<string, { invoiceNo: string; customer: string; salesman: string; date: string; itemsCount: number; totalHeldQty: number; totalHeldValue: number; totalOrderAmount: number }> = {};
    filteredHoldingRows.forEach(row => {
      if (!map[row.invoiceNo]) {
        map[row.invoiceNo] = {
          invoiceNo: row.invoiceNo,
          customer: row.customerName,
          salesman: row.salesman,
          date: row.date,
          itemsCount: 0,
          totalHeldQty: 0,
          totalHeldValue: 0,
          totalOrderAmount: 0
        };
      }
      map[row.invoiceNo].itemsCount += 1;
      map[row.invoiceNo].totalHeldQty += row.holdQty;
      map[row.invoiceNo].totalHeldValue += row.heldAmount;
      map[row.invoiceNo].totalOrderAmount += row.totalOrderAmount;
    });
    return Object.values(map).sort((a, b) => b.totalHeldValue - a.totalHeldValue);
  }, [filteredHoldingRows]);

  // Export to Excel Handler
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const filterMeta = {
        'Perspective': activePerspective.toUpperCase(),
        'Salesman': selectedSalesman,
        'Customer': selectedCustomer,
        'Gatepass': selectedGatepass,
        'Invoice': selectedInvoice,
        'Date Window': dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'End'}` : 'All Time',
        'Holding Filter': holdingStatusFilter === 'holding_only' ? 'Holding Items Only' : holdingStatusFilter === 'zero_holding' ? 'Dispatched / Zero Hold' : 'All Rows'
      };

      if (activePerspective === 'detailed') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Gatepass / DC #', key: 'gatepassNo', width: 16 },
          { header: 'Invoice #', key: 'invoiceNo', width: 15 },
          { header: 'Date', key: 'date', width: 14, type: 'date' },
          { header: 'Customer Name', key: 'customerName', width: 26 },
          { header: 'Salesman', key: 'salesman', width: 20 },
          { header: 'Product Description', key: 'productName', width: 32 },
          { header: 'SKU Code', key: 'skuCode', width: 14 },
          { header: 'Warehouse', key: 'warehouse', width: 18 },
          { header: 'Order Qty', key: 'orderQty', width: 12, type: 'number' },
          { header: 'Dispatched Qty', key: 'dispatchedQty', width: 14, type: 'number' },
          { header: 'Held Qty', key: 'holdQty', width: 12, type: 'number' },
          { header: 'Unit Rate (Rs.)', key: 'rate', width: 16, type: 'currency' },
          { header: 'Held Value (Rs.)', key: 'heldAmount', width: 18, type: 'currency' },
          { header: 'Status', key: 'status', width: 14, alignment: 'center' }
        ];

        const exportData = filteredHoldingRows.map((r, i) => ({
          idx: i + 1,
          ...r
        }));

        await exportToExcel({
          fileName: `Holding_Items_Detailed_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Holding Items Audit',
          companyName: businessName || 'ZOHAIB ALI & COMPANY',
          reportTitle: 'Holding Items & Pending Dispatch Audit Statement',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      } else if (activePerspective === 'salesman') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Salesman Name', key: 'salesman', width: 28 },
          { header: 'Clients Count', key: 'custCount', width: 16, type: 'number' },
          { header: 'Invoices Count', key: 'invCount', width: 16, type: 'number' },
          { header: 'Held Items Count', key: 'itemsCount', width: 18, type: 'number' },
          { header: 'Total Held Quantity', key: 'totalHeldQty', width: 20, type: 'number' },
          { header: 'Total Holding Valuation (Rs.)', key: 'totalHeldValue', width: 26, type: 'currency' }
        ];

        const exportData = salesmanSummary.map((s, i) => ({
          idx: i + 1,
          salesman: s.salesman,
          custCount: s.customerCount.size,
          invCount: s.invoices.size,
          itemsCount: s.itemsCount,
          totalHeldQty: s.totalHeldQty,
          totalHeldValue: s.totalHeldValue
        }));

        await exportToExcel({
          fileName: `Holding_Items_Salesman_Wise_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Salesman Holding',
          companyName: businessName || 'ZOHAIB ALI & COMPANY',
          reportTitle: 'Salesman-Wise Holding Inventory Portfolio Statement',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      } else if (activePerspective === 'customer') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Customer / Client Title', key: 'customer', width: 32 },
          { header: 'Gatepasses Involved', key: 'gpCount', width: 18, type: 'number' },
          { header: 'Invoices Count', key: 'invCount', width: 16, type: 'number' },
          { header: 'Held Items Count', key: 'itemsCount', width: 18, type: 'number' },
          { header: 'Total Held Quantity', key: 'totalHeldQty', width: 20, type: 'number' },
          { header: 'Total Holding Value (Rs.)', key: 'totalHeldValue', width: 26, type: 'currency' }
        ];

        const exportData = customerSummary.map((c, i) => ({
          idx: i + 1,
          customer: c.customer,
          gpCount: c.gatepasses.size,
          invCount: c.invoices.size,
          itemsCount: c.itemsCount,
          totalHeldQty: c.totalHeldQty,
          totalHeldValue: c.totalHeldValue
        }));

        await exportToExcel({
          fileName: `Holding_Items_Customer_Wise_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Customer Holding',
          companyName: businessName || 'ZOHAIB ALI & COMPANY',
          reportTitle: 'Customer-Wise Holding Stock Allocation Report',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      } else if (activePerspective === 'gatepass') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Gatepass / DC #', key: 'gatepassNo', width: 18 },
          { header: 'Date', key: 'date', width: 14, type: 'date' },
          { header: 'Customer Name', key: 'customer', width: 26 },
          { header: 'Salesman', key: 'salesman', width: 20 },
          { header: 'Total Order Qty', key: 'totalOrderQty', width: 16, type: 'number' },
          { header: 'Dispatched Qty', key: 'totalDispatchedQty', width: 16, type: 'number' },
          { header: 'Held Qty', key: 'totalHeldQty', width: 14, type: 'number' },
          { header: 'Held Value (Rs.)', key: 'totalHeldValue', width: 20, type: 'currency' },
          { header: 'Status', key: 'status', width: 15, alignment: 'center' }
        ];

        const exportData = gatepassSummary.map((g, i) => ({
          idx: i + 1,
          ...g
        }));

        await exportToExcel({
          fileName: `Holding_Items_Gatepass_Wise_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Gatepass Holding',
          companyName: businessName || 'ZOHAIB ALI & COMPANY',
          reportTitle: 'Gatepass / Delivery Challan Holding Stock Audit',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      } else if (activePerspective === 'invoice') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Invoice #', key: 'invoiceNo', width: 16 },
          { header: 'Date', key: 'date', width: 14, type: 'date' },
          { header: 'Customer Name', key: 'customer', width: 26 },
          { header: 'Salesman', key: 'salesman', width: 20 },
          { header: 'Held Items Count', key: 'itemsCount', width: 16, type: 'number' },
          { header: 'Total Held Qty', key: 'totalHeldQty', width: 16, type: 'number' },
          { header: 'Total Order Amount (Rs.)', key: 'totalOrderAmount', width: 22, type: 'currency' },
          { header: 'Pending Held Value (Rs.)', key: 'totalHeldValue', width: 22, type: 'currency' }
        ];

        const exportData = invoiceSummary.map((inv, i) => ({
          idx: i + 1,
          ...inv
        }));

        await exportToExcel({
          fileName: `Holding_Items_Invoice_Wise_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Invoice Holding',
          companyName: businessName || 'ZOHAIB ALI & COMPANY',
          reportTitle: 'Invoice-Wise Holding Inventory Valuation Statement',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      }

      toast.success('Excel workbook exported successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Print Handler
  const handlePrint = () => {
    navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Holding-Report/Print`, {
      state: {
        perspective: activePerspective,
        filters: {
          salesman: selectedSalesman,
          customer: selectedCustomer,
          gatepass: selectedGatepass,
          invoice: selectedInvoice,
          holdingStatus: holdingStatusFilter,
          dateFrom,
          dateTo,
          minAmount,
          sortBy
        },
        rows: activePerspective === 'detailed'
          ? filteredHoldingRows
          : activePerspective === 'salesman'
          ? salesmanSummary
          : activePerspective === 'customer'
          ? customerSummary
          : activePerspective === 'gatepass'
          ? gatepassSummary
          : invoiceSummary,
        kpis
      }
    });
  };

  // Paginated Data
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredHoldingRows.slice(startIndex, startIndex + pageSize);
  }, [filteredHoldingRows, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredHoldingRows.length / pageSize) || 1;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-bodydark text-xs antialiased font-sans relative">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2 uppercase tracking-wider">
            <MdPauseCircleFilled className="text-amber-500" size={26} />
            Holding Item & Dispatch Audit Center
          </h2>
          <p className="text-xs text-gray-400">
            Track held stock quantities, pending delivery orders, salesman allocations, and gatepass status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadHoldingData}
            title="Refresh dataset"
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 py-2 px-3.5 rounded font-bold transition shadow-sm cursor-pointer"
          >
            <MdRefresh size={16} /> Refresh
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <MdFileDownload size={18} />
            {exporting ? 'Generating Excel...' : 'Export to Excel (.xlsx)'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-primary hover:bg-opacity-90 text-white py-2 px-4 rounded font-bold transition shadow-sm cursor-pointer"
          >
            <MdPrint size={18} /> Print Voucher Report
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark flex items-center justify-between">
          <div>
            <span className="text-gray-400 font-bold block uppercase text-[10px]">Total Held Quantity</span>
            <b className="text-amber-600 dark:text-amber-400 text-xl font-black font-mono">
              {kpis.totalHeldQty.toLocaleString()} Pcs
            </b>
            <span className="text-[10px] text-gray-400 block mt-0.5">Across {kpis.totalItems} distinct items</span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded text-amber-600">
            <MdInventory size={24} />
          </div>
        </div>

        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark flex items-center justify-between">
          <div>
            <span className="text-gray-400 font-bold block uppercase text-[10px]">Financial Holding Value</span>
            <b className="text-emerald-600 dark:text-emerald-400 text-xl font-black font-mono">
              Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </b>
            <span className="text-[10px] text-gray-400 block mt-0.5">Committed inventory cost</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded text-emerald-600">
            <MdAttachMoney size={24} />
          </div>
        </div>

        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark flex items-center justify-between">
          <div>
            <span className="text-gray-400 font-bold block uppercase text-[10px]">Affected Gatepasses / Invoices</span>
            <b className="text-primary text-xl font-black font-mono">
              {kpis.uniqueGatepasses} GPs / {kpis.uniqueInvoices} Invs
            </b>
            <span className="text-[10px] text-gray-400 block mt-0.5">Pending dispatch orders</span>
          </div>
          <div className="p-3 bg-primary/10 rounded text-primary">
            <MdLocalShipping size={24} />
          </div>
        </div>

        <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark flex items-center justify-between">
          <div>
            <span className="text-gray-400 font-bold block uppercase text-[10px]">Sales Officers & Clients</span>
            <b className="text-purple-600 dark:text-purple-400 text-xl font-black font-mono">
              {kpis.uniqueSalesmen} Reps / {kpis.uniqueCustomers} Cust
            </b>
            <span className="text-[10px] text-gray-400 block mt-0.5">Assigned holding portfolios</span>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded text-purple-600">
            <MdPeople size={24} />
          </div>
        </div>
      </div>

      {/* View Perspective Selection Tabs */}
      <div className="flex flex-wrap border-b border-stroke dark:border-strokedark gap-1 bg-white dark:bg-boxdark font-black tracking-wider text-[11px] uppercase text-gray-500 rounded-t-sm p-1">
        <button
          type="button"
          onClick={() => { setActivePerspective('detailed'); setCurrentPage(1); }}
          className={`py-2.5 px-5 transition rounded-sm border-b-2 cursor-pointer ${
            activePerspective === 'detailed'
              ? 'border-primary text-primary font-black bg-primary/10 shadow-sm'
              : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'
          }`}
        >
          📋 Itemized Detailed View ({filteredHoldingRows.length})
        </button>

        <button
          type="button"
          onClick={() => { setActivePerspective('salesman'); setCurrentPage(1); }}
          className={`py-2.5 px-5 transition rounded-sm border-b-2 cursor-pointer ${
            activePerspective === 'salesman'
              ? 'border-primary text-primary font-black bg-primary/10 shadow-sm'
              : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'
          }`}
        >
          👔 Salesman-Wise Holding ({salesmanSummary.length})
        </button>

        <button
          type="button"
          onClick={() => { setActivePerspective('customer'); setCurrentPage(1); }}
          className={`py-2.5 px-5 transition rounded-sm border-b-2 cursor-pointer ${
            activePerspective === 'customer'
              ? 'border-primary text-primary font-black bg-primary/10 shadow-sm'
              : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'
          }`}
        >
          🏢 Customer-Wise Allocation ({customerSummary.length})
        </button>

        <button
          type="button"
          onClick={() => { setActivePerspective('gatepass'); setCurrentPage(1); }}
          className={`py-2.5 px-5 transition rounded-sm border-b-2 cursor-pointer ${
            activePerspective === 'gatepass'
              ? 'border-primary text-primary font-black bg-primary/10 shadow-sm'
              : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'
          }`}
        >
          🚚 Gatepass / Challan-Wise ({gatepassSummary.length})
        </button>

        <button
          type="button"
          onClick={() => { setActivePerspective('invoice'); setCurrentPage(1); }}
          className={`py-2.5 px-5 transition rounded-sm border-b-2 cursor-pointer ${
            activePerspective === 'invoice'
              ? 'border-primary text-primary font-black bg-primary/10 shadow-sm'
              : 'border-transparent text-gray-400 hover:text-black dark:hover:text-white'
          }`}
        >
          🧾 Invoice-Wise Valuation ({invoiceSummary.length})
        </button>
      </div>

      {/* Multi-Dimensional Filter Box */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-stroke dark:border-strokedark pb-3">
          <h3 className="font-bold text-sm text-black dark:text-white flex items-center gap-1.5 uppercase tracking-wider text-primary">
            <MdFilterAlt size={18} /> Multi-Dimensional Audit Filters
          </h3>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Quick Dates:</span>
            <button type="button" onClick={() => setQuickDateRange('today')} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Today</button>
            <button type="button" onClick={() => setQuickDateRange('yesterday')} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Yesterday</button>
            <button type="button" onClick={() => setQuickDateRange('this_week')} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">This Week</button>
            <button type="button" onClick={() => setQuickDateRange('this_month')} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">This Month</button>
            <button type="button" onClick={() => setQuickDateRange('last_month')} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">Last Month</button>
            <button type="button" onClick={() => setQuickDateRange('all_time')} className="py-1 px-2.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition">All Time</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Salesman Filter */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Salesman Wise:</label>
            <select
              value={selectedSalesman}
              onChange={(e) => { setSelectedSalesman(e.target.value); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            >
              <option value="All">All Salesmen ({salesmenList.length})</option>
              {salesmenList.map((s, i) => <option key={i} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Customer Wise:</label>
            <select
              value={selectedCustomer}
              onChange={(e) => { setSelectedCustomer(e.target.value); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            >
              <option value="All">All Customers ({customersList.length})</option>
              {customersList.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Gatepass Filter */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Gatepass / DC Wise:</label>
            <select
              value={selectedGatepass}
              onChange={(e) => { setSelectedGatepass(e.target.value); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            >
              <option value="All">All Gatepasses ({gatepassesList.length})</option>
              {gatepassesList.map((gp, i) => <option key={i} value={gp}>{gp}</option>)}
            </select>
          </div>

          {/* Invoice Filter */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Invoice No. Wise:</label>
            <select
              value={selectedInvoice}
              onChange={(e) => { setSelectedInvoice(e.target.value); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            >
              <option value="All">All Invoices ({invoicesList.length})</option>
              {invoicesList.map((inv, i) => <option key={i} value={inv}>{inv}</option>)}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Date From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Date To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Holding Status:</label>
            <select
              value={holdingStatusFilter}
              onChange={(e) => { setHoldingStatusFilter(e.target.value as any); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            >
              <option value="holding_only">Holding Only (Hold Qty &gt; 0)</option>
              <option value="all">All Items (Including Dispatched)</option>
              <option value="zero_holding">Fully Dispatched (0 Hold)</option>
            </select>
          </div>

          {/* Min Amount Threshold */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Min Held Amount (Rs.):</label>
            <input
              type="number"
              placeholder="e.g. 5000"
              value={minAmount}
              onChange={(e) => { setMinAmount(e.target.value); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Sort By Metric:</label>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }}
              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none"
            >
              <option value="amount_desc">Highest Holding Value (Rs.)</option>
              <option value="amount_asc">Lowest Holding Value (Rs.)</option>
              <option value="qty_desc">Highest Held Quantity</option>
              <option value="date_desc">Newest Date First</option>
              <option value="date_asc">Oldest Date First</option>
            </select>
          </div>

          {/* Keyword Search Field (spanning 3 cols) */}
          <div className="lg:col-span-3">
            <label className="block font-bold text-gray-500 mb-1 text-[11px]">Search Keywords:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type item description, SKU, customer, salesman, GP or INV code..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full border border-stroke dark:border-strokedark rounded p-2 pl-8 bg-transparent font-semibold text-xs text-black dark:text-white dark:bg-boxdark outline-none focus:border-primary"
              />
              <MdSearch className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Datatable */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-stroke dark:border-strokedark flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50/50 dark:bg-meta-4/20">
          <div className="font-bold text-xs text-gray-600 dark:text-gray-300">
            Showing <span className="text-primary font-black">
              {activePerspective === 'detailed' ? filteredHoldingRows.length :
               activePerspective === 'salesman' ? salesmanSummary.length :
               activePerspective === 'customer' ? customerSummary.length :
               activePerspective === 'gatepass' ? gatepassSummary.length :
               invoiceSummary.length}
            </span> records matching isolated criteria
          </div>

          {activePerspective === 'detailed' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold text-[11px]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-stroke dark:border-strokedark rounded px-2 py-1 bg-white dark:bg-boxdark font-bold text-xs"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
        </div>

        {/* 1. Itemized Detailed View */}
        {activePerspective === 'detailed' && (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-black uppercase text-black dark:text-white border-b border-stroke dark:border-strokedark text-[10px] tracking-wider">
                  <th className="p-3 w-12 text-center">S#</th>
                  <th className="p-3">Gatepass / DC</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3 text-center">Date</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Salesman</th>
                  <th className="p-3">Product Description</th>
                  <th className="p-3 text-center">Warehouse</th>
                  <th className="p-3 text-right">Order Qty</th>
                  <th className="p-3 text-right">Dispatched</th>
                  <th className="p-3 text-right bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">Held Qty</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right pr-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">Held Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark font-medium">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-12 text-gray-400 font-bold italic">
                      No holding records found matching your active filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-mono">
                      <td className="p-3 text-center text-gray-400 font-sans">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 font-bold text-primary">{row.gatepassNo}</td>
                      <td className="p-3 font-bold text-purple-600 dark:text-purple-400">{row.invoiceNo}</td>
                      <td className="p-3 text-center text-gray-500 text-[11px] font-sans">{row.date}</td>
                      <td className="p-3 font-sans font-bold text-black dark:text-white">{row.customerName}</td>
                      <td className="p-3 font-sans text-gray-600 dark:text-gray-300">{row.salesman}</td>
                      <td className="p-3 font-sans">
                        <div className="font-bold text-black dark:text-white">{row.productName}</div>
                        {row.skuCode && <div className="text-[10px] text-gray-400 font-mono">{row.skuCode}</div>}
                      </td>
                      <td className="p-3 text-center font-sans text-gray-500">{row.warehouse}</td>
                      <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-300">{row.orderQty.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{row.dispatchedQty.toLocaleString()}</td>
                      <td className="p-3 text-right bg-amber-50/50 dark:bg-amber-950/20 font-black text-amber-700 dark:text-amber-400">
                        {row.holdQty > 0 ? (
                          <span className="inline-flex px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                            {row.holdQty.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-gray-600">Rs. {row.rate.toLocaleString()}</td>
                      <td className="p-3 text-right pr-4 bg-emerald-50/50 dark:bg-emerald-950/20 font-black text-emerald-600">
                        Rs. {row.heldAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredHoldingRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 dark:bg-meta-4 font-black text-black dark:text-white border-t-2 border-black dark:border-white text-xs font-mono">
                    <td colSpan={8} className="p-3 text-right uppercase tracking-wider font-sans">Summary Totals:</td>
                    <td className="p-3 text-right">{kpis.totalOrderQty.toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-600">{(kpis.totalOrderQty - kpis.totalHeldQty).toLocaleString()}</td>
                    <td className="p-3 text-right text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50">
                      {kpis.totalHeldQty.toLocaleString()} Pcs
                    </td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right pr-4 text-emerald-600 font-mono text-sm bg-emerald-100 dark:bg-emerald-950/50">
                      Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 2. Salesman-Wise View */}
        {activePerspective === 'salesman' && (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-black uppercase text-black dark:text-white border-b border-stroke dark:border-strokedark text-[10px] tracking-wider">
                  <th className="p-3 w-12 text-center">S#</th>
                  <th className="p-3">Salesman / Officer Title</th>
                  <th className="p-3 text-center">Assigned Clients</th>
                  <th className="p-3 text-center">Invoices Handled</th>
                  <th className="p-3 text-center">Held Items Lines</th>
                  <th className="p-3 text-right">Total Held Quantity</th>
                  <th className="p-3 text-right pr-6 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">Total Holding Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark font-medium">
                {salesmanSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 font-bold italic">
                      No salesman holding data available.
                    </td>
                  </tr>
                ) : (
                  salesmanSummary.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-black dark:text-white font-sans">{s.salesman}</td>
                      <td className="p-3 text-center font-bold font-mono text-primary">{s.customerCount.size} Clients</td>
                      <td className="p-3 text-center font-bold font-mono text-purple-600">{s.invoices.size} Invoices</td>
                      <td className="p-3 text-center font-bold font-mono">{s.itemsCount}</td>
                      <td className="p-3 text-right font-black font-mono text-amber-600">{s.totalHeldQty.toLocaleString()} Pcs</td>
                      <td className="p-3 text-right pr-6 font-black font-mono text-emerald-600 text-sm bg-emerald-50/40 dark:bg-emerald-950/20">
                        Rs. {s.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {salesmanSummary.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 dark:bg-meta-4 font-black text-black dark:text-white border-t-2 border-black dark:border-white text-xs font-mono">
                    <td colSpan={5} className="p-3 text-right uppercase tracking-wider font-sans">Total Salesman Portfolio:</td>
                    <td className="p-3 text-right text-amber-700">{kpis.totalHeldQty.toLocaleString()} Pcs</td>
                    <td className="p-3 text-right pr-6 text-emerald-600 font-mono text-sm bg-emerald-100 dark:bg-emerald-950/50">
                      Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 3. Customer-Wise View */}
        {activePerspective === 'customer' && (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-black uppercase text-black dark:text-white border-b border-stroke dark:border-strokedark text-[10px] tracking-wider">
                  <th className="p-3 w-12 text-center">S#</th>
                  <th className="p-3">Customer / Client Account</th>
                  <th className="p-3 text-center">Gatepasses Link</th>
                  <th className="p-3 text-center">Invoices Involved</th>
                  <th className="p-3 text-center">Held Items Count</th>
                  <th className="p-3 text-right">Committed Held Qty</th>
                  <th className="p-3 text-right pr-6 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">Total Holding Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark font-medium">
                {customerSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 font-bold italic">
                      No customer holding records found.
                    </td>
                  </tr>
                ) : (
                  customerSummary.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-black dark:text-white font-sans">{c.customer}</td>
                      <td className="p-3 text-center font-bold font-mono text-primary">{c.gatepasses.size} GPs</td>
                      <td className="p-3 text-center font-bold font-mono text-purple-600">{c.invoices.size} Invs</td>
                      <td className="p-3 text-center font-bold font-mono">{c.itemsCount}</td>
                      <td className="p-3 text-right font-black font-mono text-amber-600">{c.totalHeldQty.toLocaleString()} Pcs</td>
                      <td className="p-3 text-right pr-6 font-black font-mono text-emerald-600 text-sm bg-emerald-50/40 dark:bg-emerald-950/20">
                        Rs. {c.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {customerSummary.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 dark:bg-meta-4 font-black text-black dark:text-white border-t-2 border-black dark:border-white text-xs font-mono">
                    <td colSpan={5} className="p-3 text-right uppercase tracking-wider font-sans">Total Client Commitments:</td>
                    <td className="p-3 text-right text-amber-700">{kpis.totalHeldQty.toLocaleString()} Pcs</td>
                    <td className="p-3 text-right pr-6 text-emerald-600 font-mono text-sm bg-emerald-100 dark:bg-emerald-950/50">
                      Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 4. Gatepass-Wise View */}
        {activePerspective === 'gatepass' && (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-black uppercase text-black dark:text-white border-b border-stroke dark:border-strokedark text-[10px] tracking-wider">
                  <th className="p-3 w-12 text-center">S#</th>
                  <th className="p-3">Gatepass / DC #</th>
                  <th className="p-3 text-center">Date</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Salesman</th>
                  <th className="p-3 text-right">Order Qty</th>
                  <th className="p-3 text-right">Dispatched</th>
                  <th className="p-3 text-right text-amber-700">Held Qty</th>
                  <th className="p-3 text-right pr-6 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">Pending Held Value</th>
                  <th className="p-3 text-center">Dispatch Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark font-medium">
                {gatepassSummary.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400 font-bold italic">
                      No gatepass holding records found.
                    </td>
                  </tr>
                ) : (
                  gatepassSummary.map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold font-mono text-primary">{g.gatepassNo}</td>
                      <td className="p-3 text-center text-gray-500 font-mono text-[11px]">{g.date}</td>
                      <td className="p-3 font-bold text-black dark:text-white font-sans">{g.customer}</td>
                      <td className="p-3 text-gray-600 font-sans">{g.salesman}</td>
                      <td className="p-3 text-right font-mono font-bold">{g.totalOrderQty.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{g.totalDispatchedQty.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-black text-amber-600">{g.totalHeldQty.toLocaleString()}</td>
                      <td className="p-3 text-right pr-6 font-mono font-black text-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20">
                        Rs. {g.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          g.totalHeldQty === 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {g.totalHeldQty === 0 ? 'Dispatched' : 'Holding'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {gatepassSummary.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 dark:bg-meta-4 font-black text-black dark:text-white border-t-2 border-black dark:border-white text-xs font-mono">
                    <td colSpan={5} className="p-3 text-right uppercase tracking-wider font-sans">Total Gatepass Ledger:</td>
                    <td className="p-3 text-right">{kpis.totalOrderQty.toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-600">{(kpis.totalOrderQty - kpis.totalHeldQty).toLocaleString()}</td>
                    <td className="p-3 text-right text-amber-700">{kpis.totalHeldQty.toLocaleString()}</td>
                    <td className="p-3 text-right pr-6 text-emerald-600 font-mono text-sm bg-emerald-100 dark:bg-emerald-950/50">
                      Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 5. Invoice-Wise View */}
        {activePerspective === 'invoice' && (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-meta-4 font-black uppercase text-black dark:text-white border-b border-stroke dark:border-strokedark text-[10px] tracking-wider">
                  <th className="p-3 w-12 text-center">S#</th>
                  <th className="p-3">Sales Invoice #</th>
                  <th className="p-3 text-center">Invoice Date</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Salesman</th>
                  <th className="p-3 text-center">Held Items Count</th>
                  <th className="p-3 text-right">Total Held Qty</th>
                  <th className="p-3 text-right">Total Order Value</th>
                  <th className="p-3 text-right pr-6 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">Pending Held Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark font-medium">
                {invoiceSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400 font-bold italic">
                      No invoice holding records found.
                    </td>
                  </tr>
                ) : (
                  invoiceSummary.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold font-mono text-purple-600 dark:text-purple-400">{inv.invoiceNo}</td>
                      <td className="p-3 text-center text-gray-500 font-mono text-[11px]">{inv.date}</td>
                      <td className="p-3 font-bold text-black dark:text-white font-sans">{inv.customer}</td>
                      <td className="p-3 text-gray-600 font-sans">{inv.salesman}</td>
                      <td className="p-3 text-center font-mono font-bold">{inv.itemsCount}</td>
                      <td className="p-3 text-right font-mono font-black text-amber-600">{inv.totalHeldQty.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">
                        Rs. {inv.totalOrderAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right pr-6 font-mono font-black text-emerald-600 text-sm bg-emerald-50/40 dark:bg-emerald-950/20">
                        Rs. {inv.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {invoiceSummary.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 dark:bg-meta-4 font-black text-black dark:text-white border-t-2 border-black dark:border-white text-xs font-mono">
                    <td colSpan={6} className="p-3 text-right uppercase tracking-wider font-sans">Total Invoices Valuation:</td>
                    <td className="p-3 text-right text-amber-700">{kpis.totalHeldQty.toLocaleString()} Pcs</td>
                    <td className="p-3 text-right text-gray-700">Rs. {kpis.totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right pr-6 text-emerald-600 font-mono text-sm bg-emerald-100 dark:bg-emerald-950/50">
                      Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {activePerspective === 'detailed' && filteredHoldingRows.length > pageSize && (
          <div className="p-4 border-t border-stroke dark:border-strokedark flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-xs text-gray-500 font-bold">
              Showing page <span className="text-primary">{currentPage}</span> of {totalPages} ({filteredHoldingRows.length} total rows)
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded border border-stroke dark:border-strokedark font-bold hover:bg-gray-100 dark:hover:bg-meta-4 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded font-bold transition text-xs cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-primary text-white font-black'
                        : 'border border-stroke dark:border-strokedark hover:bg-gray-100 dark:hover:bg-meta-4'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded border border-stroke dark:border-strokedark font-bold hover:bg-gray-100 dark:hover:bg-meta-4 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HoldingReport;
