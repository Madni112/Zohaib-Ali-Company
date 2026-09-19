import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdPrint, MdArrowBack, MdFileDownload, MdViewList, MdTableChart } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuth } from '../../../Context/Auth';
import { exportToExcel, ExcelColumn } from '../../../utils/excelExport';
import ReportPagination from '../../../components/ReportPagination';

const SaleReportPrint = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { businessName, tenantId } = useAuth();
  const [loading, setLoading] = useState(true);

  const [reportRows, setReportRows] = useState<any[]>([]);
  const [productUomMap, setProductUomMap] = useState<Record<string, string>>({});

  const config = location.state || { type: 'sale', filters: {} };
  const { type: rType, filters = {} } = config;

  // View mode for Product Sales History ('summary' | 'detailed')
  const [activeViewMode, setActiveViewMode] = useState<'summary' | 'detailed'>(
    filters.viewMode === 'detailed' ? 'detailed' : 'summary'
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(activeViewMode === 'detailed' ? 10 : 25);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const handleBefore = () => setIsPrinting(true);
    const handleAfter = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBefore);
    window.addEventListener('afterprint', handleAfter);
    return () => {
      window.removeEventListener('beforeprint', handleBefore);
      window.removeEventListener('afterprint', handleAfter);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [rType, activeViewMode]);

  useEffect(() => {
    const originalTitle = document.title;
    if (rType === 'product-sales-history') {
      document.title = 'Product Sales History Report - ZOAIB ALI & COMPANY';
    } else if (rType === 'sales-query') {
      document.title = 'Sales Parameter Transaction Register - ZOAIB ALI & COMPANY';
    } else if (rType === 'customer-sales') {
      document.title = 'Customer Sales & Volume Analysis - ZOAIB ALI & COMPANY';
    } else if (rType === 'return') {
      document.title = 'Sales Return & Credit Ledger - ZOAIB ALI & COMPANY';
    } else if (rType === 'invoice') {
      document.title = 'Sales Invoice Detail Audit - ZOAIB ALI & COMPANY';
    } else if (rType === 'loyalty') {
      document.title = 'Customer Loyalty Rewards Ledger - ZOAIB ALI & COMPANY';
    } else {
      document.title = 'Commercial Sales Audit Statement - ZOAIB ALI & COMPANY';
    }

    return () => {
      document.title = originalTitle;
    };
  }, [rType]);

  useEffect(() => {
    const compileExcelStructuredDataset = async () => {
      try {
        setLoading(true);

        // Fetch products lookup for UOM, categories & brands
        const { data: prodData } = await supabase.from('products').select('*');
        const uomMapObj: Record<string, string> = {};
        if (prodData) {
          prodData.forEach((p: any) => {
            if (p.product_name) {
              const isTile = Boolean(String(p.category || '').toLowerCase().includes('tile'));
              uomMapObj[p.product_name.trim().toLowerCase()] = p.uom || (isTile ? 'BOX' : 'Nos');
            }
          });
          setProductUomMap(uomMapObj);
        }

        // ── 📦 REPORT TYPE: PRODUCT SALES HISTORY REPORT ──
        if (rType === 'product-sales-history') {
          const [invRes, retRes] = await Promise.all([
            supabase.from('sales_invoices').select('*').order('id', { ascending: true }),
            supabase.from('sales_returns').select('*').order('id', { ascending: true })
          ]);

          if (invRes.error) throw invRes.error;
          if (retRes.error) throw retRes.error;

          const allInvoices = invRes.data || [];
          const allReturns = retRes.data || [];
          const allProducts = prodData || [];

          const startTimestamp = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00').getTime() : 0;
          const endTimestamp = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59.999').getTime() : Infinity;

          // Helper to extract items safely
          const parseItems = (raw: any): any[] => {
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string') {
              try { return JSON.parse(raw); } catch { return []; }
            }
            return [];
          };

          // Filter invoices by criteria
          let filteredInvoices = allInvoices.filter((inv: any) => {
            const d = inv.sale_date || inv.created_at;
            const t = d ? new Date(String(d).includes('T') ? String(d) : String(d) + 'T12:00:00').getTime() : 0;
            if (t < startTimestamp || t > endTimestamp) return false;

            if (filters.customer && filters.customer.length > 0 && !filters.customer.includes('All')) {
              if (!filters.customer.includes(inv.customer_name)) return false;
            }
            if (filters.salesman && filters.salesman.length > 0 && !filters.salesman.includes('All')) {
              if (!filters.salesman.includes(inv.salesman)) return false;
            }
            if (filters.location && filters.location.length > 0 && !filters.location.includes('All')) {
              if (!filters.location.includes(inv.dispatch_warehouse)) return false;
            }
            return true;
          });

          // Filter returns by criteria
          let filteredReturns = allReturns.filter((ret: any) => {
            const d = ret.return_date || ret.created_at;
            const t = d ? new Date(String(d).includes('T') ? String(d) : String(d) + 'T12:00:00').getTime() : 0;
            if (t < startTimestamp || t > endTimestamp) return false;

            if (filters.customer && filters.customer.length > 0 && !filters.customer.includes('All')) {
              if (!filters.customer.includes(ret.customer_name)) return false;
            }
            return true;
          });

          // Map returns by product
          const productReturnsMap: Record<string, { returnedQty: number; returnedAmount: number }> = {};
          filteredReturns.forEach((ret: any) => {
            const items = parseItems(ret.items || ret.returned_items);
            items.forEach((it: any) => {
              const pName = (it.itemName || it.product_name || '').trim();
              if (!pName) return;
              const key = pName.toLowerCase();
              if (!productReturnsMap[key]) {
                productReturnsMap[key] = { returnedQty: 0, returnedAmount: 0 };
              }
              const q = Number(it.qty || it.quantity || 1);
              const r = Number(it.rate ?? it.price ?? 0);
              productReturnsMap[key].returnedQty += q;
              productReturnsMap[key].returnedAmount += (q * r);
            });
          });

          // Aggregate sales transactions per product (pre-populate with catalog products if showZeroSales is enabled/default)
          const productSummaryMap: Record<string, any> = {};

          if (filters.showZeroSales !== false) {
            allProducts.forEach((p: any) => {
              const pName = (p.product_name || '').trim();
              if (!pName) return;
              const key = pName.toLowerCase();

              if (filters.product && filters.product.length > 0 && !filters.product.includes('All')) {
                if (!filters.product.includes(pName)) return;
              }
              if (filters.parentCategory && filters.parentCategory.length > 0 && !filters.parentCategory.includes('All')) {
                const prodCat = p.category || p.parent_category || '';
                if (!filters.parentCategory.includes(prodCat)) return;
              }
              if (filters.bin && filters.bin.length > 0 && !filters.bin.includes('All')) {
                const prodBrand = p.brand || '';
                if (!filters.bin.includes(prodBrand)) return;
              }

              productSummaryMap[key] = {
                product_name: pName,
                sku: p.item_sr_no || p.sku || '-',
                category: p.category || 'General',
                brand: p.brand || '-',
                uom: p.uom || productUomMap[key] || 'Nos',
                sold_qty: 0,
                gross_sales: 0,
                total_discounts: 0,
                net_sales: 0,
                tx_count: 0,
                last_sale_date: '-',
                transactions: []
              };
            });
          }

          filteredInvoices.forEach((inv: any) => {
            const items = parseItems(inv.items);
            const invDate = inv.sale_date || String(inv.created_at || '').split('T')[0];
            const invNo = inv.invoice_no || `INV-${String(inv.id).padStart(4, '0')}`;
            const custName = inv.customer_name || 'Counter Retail Buyer';
            const salesman = inv.salesman || 'Direct';
            const warehouse = inv.dispatch_warehouse || 'Main Warehouse';

            items.forEach((it: any) => {
              const pName = (it.itemName || it.product_name || '').trim();
              if (!pName) return;
              const key = pName.toLowerCase();

              // Product criteria filters
              if (filters.product && filters.product.length > 0 && !filters.product.includes('All')) {
                if (!filters.product.includes(pName)) return;
              }

              const matchingProd = allProducts.find(
                (p: any) => (p.product_name || '').trim().toLowerCase() === key ||
                            (it.sku && (p.item_sr_no || '').toLowerCase() === String(it.sku).toLowerCase())
              );

              // Category / Brand filters
              if (filters.parentCategory && filters.parentCategory.length > 0 && !filters.parentCategory.includes('All')) {
                const prodCat = matchingProd?.category || matchingProd?.parent_category || '';
                if (!filters.parentCategory.includes(prodCat)) return;
              }
              if (filters.bin && filters.bin.length > 0 && !filters.bin.includes('All')) {
                const prodBrand = matchingProd?.brand || '';
                if (!filters.bin.includes(prodBrand)) return;
              }

              const qty = Number(it.qty || it.quantity || 1);
              const rate = Number(it.rp ?? it.rate ?? it.sale_price ?? it.price ?? matchingProd?.retail_price ?? 0);
              const discount = Number(it.discount || it.disc || 0);
              const lineTotal = Number(it.total || it.amount || (qty * rate) - discount);
              const uom = it.uom || matchingProd?.uom || productUomMap[key] || 'Nos';
              const sku = it.sku || matchingProd?.item_sr_no || matchingProd?.sku || '-';
              const category = matchingProd?.category || it.category || 'General';
              const brand = matchingProd?.brand || it.brand || '-';

              if (!productSummaryMap[key]) {
                productSummaryMap[key] = {
                  product_name: pName,
                  sku,
                  category,
                  brand,
                  uom,
                  sold_qty: 0,
                  gross_sales: 0,
                  total_discounts: 0,
                  net_sales: 0,
                  tx_count: 0,
                  last_sale_date: invDate,
                  transactions: []
                };
              }

              productSummaryMap[key].sold_qty += qty;
              productSummaryMap[key].gross_sales += (qty * rate);
              productSummaryMap[key].total_discounts += discount;
              productSummaryMap[key].net_sales += lineTotal;
              productSummaryMap[key].tx_count += 1;
              if (productSummaryMap[key].last_sale_date === '-' || invDate > productSummaryMap[key].last_sale_date) {
                productSummaryMap[key].last_sale_date = invDate;
              }

              productSummaryMap[key].transactions.push({
                date: invDate,
                invoice_no: invNo,
                customer_name: custName,
                salesman,
                warehouse,
                qty,
                uom,
                rate,
                discount,
                total: lineTotal
              });
            });
          });

          // Compile final rows with return deductions and averages
          const compiledRows: any[] = Object.values(productSummaryMap).map((prod: any) => {
            const key = prod.product_name.toLowerCase();
            const returnsInfo = productReturnsMap[key] || { returnedQty: 0, returnedAmount: 0 };
            const netQty = prod.sold_qty - returnsInfo.returnedQty;
            const avgRate = prod.sold_qty > 0 ? (prod.gross_sales / prod.sold_qty) : 0;
            const finalNetSales = Math.max(0, prod.net_sales - returnsInfo.returnedAmount);

            return {
              ...prod,
              returned_qty: returnsInfo.returnedQty,
              returned_amount: returnsInfo.returnedAmount,
              net_qty: netQty,
              avg_rate: avgRate,
              final_net_sales: finalNetSales
            };
          });

          let finalRows = compiledRows;
          if (filters.showZeroSales === false) {
            finalRows = finalRows.filter(r => r.sold_qty > 0 || r.returned_qty > 0);
          }

          finalRows.sort((a, b) => {
            if (b.final_net_sales !== a.final_net_sales) {
              return b.final_net_sales - a.final_net_sales;
            }
            return a.product_name.localeCompare(b.product_name);
          });

          setReportRows(finalRows);
        }

        // ── 📊 REPORT TYPE: COMMERCIAL SALES AUDIT LEDGER (SALESMAN-WISE) ──
        else if (rType === 'sale') {
          let query = supabase.from('sales_invoices').select('*');
          if (filters.customer && filters.customer.length > 0 && !filters.customer.includes('All')) query = query.in('customer_name', filters.customer);
          if (filters.salesman && filters.salesman.length > 0 && !filters.salesman.includes('All')) query = query.in('salesman', filters.salesman);
          if (filters.transport && filters.transport.length > 0 && !filters.transport.includes('All')) query = query.in('transport_name', filters.transport);
          if (filters.location && filters.location.length > 0 && !filters.location.includes('All')) query = query.in('dispatch_warehouse', filters.location);

          if (filters.saleType && filters.saleType !== 'All') {
            if (filters.saleType === 'Cash') query = query.eq('payment_term', 'Cash');
            else query = query.neq('payment_term', 'Cash');
          }
          if (filters.saleMethod && filters.saleMethod !== 'All') {
             if (filters.saleMethod === 'Direct') query = query.or('dc_no.is.null,dc_no.eq.""');
             else query = query.neq('dc_no', '');
          }
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            query = query.gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59.999Z`);
          }

          const { data: invData, error: invError } = await query;
          if (invError) throw invError;

          const { data: returnsData, error: retError } = await supabase
            .from('sales_returns')
            .select('original_invoice_no');
          if (retError) throw retError;

          const returnedNosList = (returnsData || []).map(r =>
            String(r.original_invoice_no || '').trim().toLowerCase()
          );

          let pool = invData || [];

          pool = pool.filter(i => {
            const rawId = String(i.id).trim().toLowerCase();
            const isReturnedItem = returnedNosList.some(retRef =>
              retRef === rawId ||
              retRef === `inv-${rawId}` ||
              retRef === `inv-${rawId.padStart(4, '0')}` ||
              retRef.includes(rawId)
            );
            return !isReturnedItem;
          });

          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            pool = pool.filter(i => {
              const targetDateStr = String(i.sale_date || i.created_at || '').split('T')[0];
              return targetDateStr >= startStr && targetDateStr <= endStr;
            });
          }

          // Sort individual invoices
          if (filters.sortBy) {
            if (filters.sortBy === 'date_asc') {
              pool.sort((a, b) => (a.sale_date || a.created_at || '').localeCompare(b.sale_date || b.created_at || ''));
            } else if (filters.sortBy === 'amount_desc') {
              pool.sort((a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0));
            } else if (filters.sortBy === 'amount_asc') {
              pool.sort((a, b) => Number(a.total_amount || 0) - Number(b.total_amount || 0));
            } else if (filters.sortBy === 'invoice_asc') {
              pool.sort((a, b) => String(a.invoice_no || a.id).localeCompare(String(b.invoice_no || b.id)));
            } else {
              pool.sort((a, b) => (b.sale_date || b.created_at || '').localeCompare(a.sale_date || a.created_at || ''));
            }
          }

          // Group invoices by Salesman / Sales Officer
          const totalAllPoolSales = pool.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
          const salesmanMap: Record<string, any> = {};

          pool.forEach((inv: any) => {
            const smName = (inv.salesman && String(inv.salesman).trim()) ? String(inv.salesman).trim() : 'Direct / Counter';
            if (!salesmanMap[smName]) {
              salesmanMap[smName] = {
                salesman: smName,
                invoices_count: 0,
                customers_set: new Set<string>(),
                unique_customers_count: 0,
                cash_sales: 0,
                credit_sales: 0,
                total_sales: 0,
                contribution_pct: 0,
                transactions: []
              };
            }

            const invTotal = Number(inv.total_amount || 0);
            const isCash = String(inv.payment_term || '').toLowerCase() === 'cash';

            salesmanMap[smName].invoices_count += 1;
            if (inv.customer_name) {
              salesmanMap[smName].customers_set.add(String(inv.customer_name).trim());
            }
            if (isCash) {
              salesmanMap[smName].cash_sales += invTotal;
            } else {
              salesmanMap[smName].credit_sales += invTotal;
            }
            salesmanMap[smName].total_sales += invTotal;
            salesmanMap[smName].transactions.push(inv);
          });

          const salesmanGroups = Object.values(salesmanMap).map((sm: any) => {
            return {
              ...sm,
              unique_customers_count: sm.customers_set.size || (sm.invoices_count > 0 ? 1 : 0),
              contribution_pct: totalAllPoolSales > 0 ? (sm.total_sales / totalAllPoolSales) * 100 : 0
            };
          });

          // Sort salesmen groups by total_sales descending (leaderboard)
          salesmanGroups.sort((a, b) => b.total_sales - a.total_sales);

          setReportRows(salesmanGroups);
        }

        // ── 📊 REPORT TYPE: SALES FILTER & PARAMETER REGISTER (FLAT CHRONOLOGICAL) ──
        else if (rType === 'sales-query') {
          let query = supabase.from('sales_invoices').select('*');
          if (filters.customer && filters.customer.length > 0 && !filters.customer.includes('All')) query = query.in('customer_name', filters.customer);
          if (filters.salesman && filters.salesman.length > 0 && !filters.salesman.includes('All')) query = query.in('salesman', filters.salesman);
          if (filters.transport && filters.transport.length > 0 && !filters.transport.includes('All')) query = query.in('transport_name', filters.transport);
          if (filters.location && filters.location.length > 0 && !filters.location.includes('All')) query = query.in('dispatch_warehouse', filters.location);

          if (filters.saleType && filters.saleType !== 'All') {
            if (filters.saleType === 'Cash') query = query.eq('payment_term', 'Cash');
            else query = query.neq('payment_term', 'Cash');
          }
          if (filters.saleMethod && filters.saleMethod !== 'All') {
             if (filters.saleMethod === 'Direct') query = query.or('dc_no.is.null,dc_no.eq.""');
             else query = query.neq('dc_no', '');
          }
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            query = query.gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59.999Z`);
          }

          const { data: invData, error: invError } = await query;
          if (invError) throw invError;

          const { data: returnsData, error: retError } = await supabase
            .from('sales_returns')
            .select('original_invoice_no');
          if (retError) throw retError;

          const returnedNosList = (returnsData || []).map(r =>
            String(r.original_invoice_no || '').trim().toLowerCase()
          );

          let pool = invData || [];

          pool = pool.filter(i => {
            const rawId = String(i.id).trim().toLowerCase();
            const isReturnedItem = returnedNosList.some(retRef =>
              retRef === rawId ||
              retRef === `inv-${rawId}` ||
              retRef === `inv-${rawId.padStart(4, '0')}` ||
              retRef.includes(rawId)
            );
            return !isReturnedItem;
          });

          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            pool = pool.filter(i => {
              const targetDateStr = String(i.sale_date || i.created_at || '').split('T')[0];
              return targetDateStr >= startStr && targetDateStr <= endStr;
            });
          }

          // Filter by product / brand / category if specified in filters
          if ((filters.product && filters.product.length > 0 && !filters.product.includes('All')) ||
              (filters.parentCategory && filters.parentCategory.length > 0 && !filters.parentCategory.includes('All')) ||
              (filters.bin && filters.bin.length > 0 && !filters.bin.includes('All'))) {
            pool = pool.filter((inv: any) => {
              const items = extractItemDetails(inv);
              return items.some(it => {
                const pName = it.name;
                const matchingProd = (prodData || []).find((p: any) => (p.product_name || '').trim().toLowerCase() === pName.trim().toLowerCase());
                if (filters.product && filters.product.length > 0 && !filters.product.includes('All')) {
                  if (!filters.product.includes(pName)) return false;
                }
                if (filters.parentCategory && filters.parentCategory.length > 0 && !filters.parentCategory.includes('All')) {
                  const prodCat = matchingProd?.category || matchingProd?.parent_category || '';
                  if (!filters.parentCategory.includes(prodCat)) return false;
                }
                if (filters.bin && filters.bin.length > 0 && !filters.bin.includes('All')) {
                  const prodBrand = matchingProd?.brand || '';
                  if (!filters.bin.includes(prodBrand)) return false;
                }
                return true;
              });
            });
          }

          // Sort flat invoices
          if (filters.sortBy) {
            if (filters.sortBy === 'date_asc') {
              pool.sort((a, b) => (a.sale_date || a.created_at || '').localeCompare(b.sale_date || b.created_at || ''));
            } else if (filters.sortBy === 'amount_desc') {
              pool.sort((a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0));
            } else if (filters.sortBy === 'amount_asc') {
              pool.sort((a, b) => Number(a.total_amount || 0) - Number(b.total_amount || 0));
            } else if (filters.sortBy === 'invoice_asc') {
              pool.sort((a, b) => String(a.invoice_no || a.id).localeCompare(String(b.invoice_no || b.id)));
            } else {
              pool.sort((a, b) => (b.sale_date || b.created_at || '').localeCompare(a.sale_date || a.created_at || ''));
            }
          }

          setReportRows(pool);
        }

        // ── 📊 REPORT TYPE: CUSTOMER SALES & VOLUME ANALYSIS ──
        else if (rType === 'customer-sales') {
          let query = supabase.from('sales_invoices').select('*');
          if (filters.customer && filters.customer.length > 0 && !filters.customer.includes('All')) query = query.in('customer_name', filters.customer);
          if (filters.salesman && filters.salesman.length > 0 && !filters.salesman.includes('All')) query = query.in('salesman', filters.salesman);
          if (filters.transport && filters.transport.length > 0 && !filters.transport.includes('All')) query = query.in('transport_name', filters.transport);
          if (filters.location && filters.location.length > 0 && !filters.location.includes('All')) query = query.in('dispatch_warehouse', filters.location);

          if (filters.saleType && filters.saleType !== 'All') {
            if (filters.saleType === 'Cash') query = query.eq('payment_term', 'Cash');
            else query = query.neq('payment_term', 'Cash');
          }
          if (filters.saleMethod && filters.saleMethod !== 'All') {
            if (filters.saleMethod === 'Direct') query = query.or('dc_no.is.null,dc_no.eq.""');
            else query = query.neq('dc_no', '');
          }
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            query = query.gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59.999Z`);
          }

          const { data: invData, error: invError } = await query;
          if (invError) throw invError;

          const { data: returnsData, error: retError } = await supabase
            .from('sales_returns')
            .select('original_invoice_no');
          if (retError) throw retError;

          const returnedNosList = (returnsData || []).map(r =>
            String(r.original_invoice_no || '').trim().toLowerCase()
          );

          let pool = invData || [];

          pool = pool.filter(i => {
            const rawId = String(i.id).trim().toLowerCase();
            const isReturnedItem = returnedNosList.some(retRef =>
              retRef === rawId ||
              retRef === `inv-${rawId}` ||
              retRef === `inv-${rawId.padStart(4, '0')}` ||
              retRef.includes(rawId)
            );
            return !isReturnedItem;
          });

          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            pool = pool.filter(i => {
              const targetDateStr = String(i.sale_date || i.created_at || '').split('T')[0];
              return targetDateStr >= startStr && targetDateStr <= endStr;
            });
          }

          // Filter by product / brand / category if specified in filters
          if ((filters.product && filters.product.length > 0 && !filters.product.includes('All')) ||
              (filters.parentCategory && filters.parentCategory.length > 0 && !filters.parentCategory.includes('All')) ||
              (filters.bin && filters.bin.length > 0 && !filters.bin.includes('All'))) {
            pool = pool.filter((inv: any) => {
              const items = extractItemDetails(inv);
              return items.some(it => {
                const pName = it.name;
                const matchingProd = (prodData || []).find((p: any) => (p.product_name || '').trim().toLowerCase() === pName.trim().toLowerCase());
                if (filters.product && filters.product.length > 0 && !filters.product.includes('All')) {
                  if (!filters.product.includes(pName)) return false;
                }
                if (filters.parentCategory && filters.parentCategory.length > 0 && !filters.parentCategory.includes('All')) {
                  const prodCat = matchingProd?.category || matchingProd?.parent_category || '';
                  if (!filters.parentCategory.includes(prodCat)) return false;
                }
                if (filters.bin && filters.bin.length > 0 && !filters.bin.includes('All')) {
                  const prodBrand = matchingProd?.brand || '';
                  if (!filters.bin.includes(prodBrand)) return false;
                }
                return true;
              });
            });
          }

          const totalAllPoolSales = pool.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
          const customerMap: Record<string, any> = {};

          pool.forEach((inv: any) => {
            const cName = (inv.customer_name && String(inv.customer_name).trim()) ? String(inv.customer_name).trim() : 'Counter Retail Buyer';
            if (!customerMap[cName]) {
              customerMap[cName] = {
                customer_name: cName,
                invoices_count: 0,
                total_units: 0,
                cash_sales: 0,
                credit_sales: 0,
                total_sales: 0,
                contribution_pct: 0,
                transactions: []
              };
            }

            const invTotal = Number(inv.total_amount || 0);
            const isCash = String(inv.payment_term || '').toLowerCase() === 'cash';
            const invItems = extractItemDetails(inv);
            const invUnits = invItems.reduce((sum, it) => sum + Number(it.qty || 0), 0);

            customerMap[cName].invoices_count += 1;
            customerMap[cName].total_units += invUnits;
            if (isCash) {
              customerMap[cName].cash_sales += invTotal;
            } else {
              customerMap[cName].credit_sales += invTotal;
            }
            customerMap[cName].total_sales += invTotal;
            customerMap[cName].transactions.push({
              ...inv,
              calculated_units: invUnits,
              items_details: invItems
            });
          });

          const customerGroups = Object.values(customerMap).map((cust: any) => {
            return {
              ...cust,
              contribution_pct: totalAllPoolSales > 0 ? (cust.total_sales / totalAllPoolSales) * 100 : 0
            };
          });

          // Sort customer groups by total_sales descending (leaderboard)
          customerGroups.sort((a, b) => b.total_sales - a.total_sales);

          setReportRows(customerGroups);
        }

        // ── 📊 REPORT TYPE: SALES RETURN & CREDIT LEDGER (CUSTOMER-WISE) ──
        else if (rType === 'return') {
          let query = supabase.from('sales_returns').select('*');
          if (filters.customer && filters.customer.length > 0 && !filters.customer.includes('All')) query = query.in('customer_name', filters.customer);
          if (filters.salesman && filters.salesman.length > 0 && !filters.salesman.includes('All')) query = query.in('salesman', filters.salesman);
          if (filters.transport && filters.transport.length > 0 && !filters.transport.includes('All')) query = query.in('transport_name', filters.transport);
          if (filters.location && filters.location.length > 0 && !filters.location.includes('All')) query = query.in('dispatch_warehouse', filters.location);
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            query = query.gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59.999Z`);
          }

          const { data, error } = await query;
          if (error) throw error;

          let pool = data || [];
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            pool = pool.filter(r => {
              const targetDateStr = String(r.return_date || r.created_at || '').split('T')[0];
              return targetDateStr >= startStr && targetDateStr <= endStr;
            });
          }

          // Filter by product / brand / category if specified in filters
          if ((filters.product && filters.product.length > 0 && !filters.product.includes('All')) ||
              (filters.parentCategory && filters.parentCategory.length > 0 && !filters.parentCategory.includes('All')) ||
              (filters.bin && filters.bin.length > 0 && !filters.bin.includes('All'))) {
            pool = pool.filter((ret: any) => {
              const items = extractItemDetails(ret);
              return items.some(it => {
                const pName = it.name;
                const matchingProd = (prodData || []).find((p: any) => (p.product_name || '').trim().toLowerCase() === pName.trim().toLowerCase());
                if (filters.product && filters.product.length > 0 && !filters.product.includes('All')) {
                  if (!filters.product.includes(pName)) return false;
                }
                if (filters.parentCategory && filters.parentCategory.length > 0 && !filters.parentCategory.includes('All')) {
                  const prodCat = matchingProd?.category || matchingProd?.parent_category || '';
                  if (!filters.parentCategory.includes(prodCat)) return false;
                }
                if (filters.bin && filters.bin.length > 0 && !filters.bin.includes('All')) {
                  const prodBrand = matchingProd?.brand || '';
                  if (!filters.bin.includes(prodBrand)) return false;
                }
                return true;
              });
            });
          }

          // Sort individual return records
          if (filters.sortBy) {
            if (filters.sortBy === 'date_asc') {
              pool.sort((a, b) => (a.return_date || a.created_at || '').localeCompare(b.return_date || b.created_at || ''));
            } else if (filters.sortBy === 'amount_desc') {
              pool.sort((a, b) => Number(b.return_amount || b.total_amount || 0) - Number(a.return_amount || a.total_amount || 0));
            } else if (filters.sortBy === 'amount_asc') {
              pool.sort((a, b) => Number(a.return_amount || a.total_amount || 0) - Number(b.return_amount || b.total_amount || 0));
            } else if (filters.sortBy === 'invoice_asc') {
              pool.sort((a, b) => String(a.return_no || a.id).localeCompare(String(b.return_no || b.id)));
            } else {
              pool.sort((a, b) => (b.return_date || b.created_at || '').localeCompare(a.return_date || a.created_at || ''));
            }
          }

          const totalAllReturnAmount = pool.reduce((acc, r) => acc + Number(r.return_amount || r.total_amount || 0), 0);
          const customerMap: Record<string, any> = {};

          pool.forEach((ret: any) => {
            const cName = (ret.customer_name && String(ret.customer_name).trim()) ? String(ret.customer_name).trim() : 'Counter Retail Buyer';
            if (!customerMap[cName]) {
              customerMap[cName] = {
                customer_name: cName,
                returns_count: 0,
                total_returned_qty: 0,
                total_return_amount: 0,
                contribution_pct: 0,
                transactions: []
              };
            }

            const retItems = extractItemDetails(ret);
            const retQty = retItems.reduce((sum, it) => sum + Number(it.qty || 0), 0);
            const retAmount = Number(ret.return_amount || ret.total_amount || 0);

            customerMap[cName].returns_count += 1;
            customerMap[cName].total_returned_qty += retQty;
            customerMap[cName].total_return_amount += retAmount;
            customerMap[cName].transactions.push({
              ...ret,
              calculated_qty: retQty,
              calculated_amount: retAmount
            });
          });

          const customerGroups = Object.values(customerMap).map((cust: any) => ({
            ...cust,
            contribution_pct: totalAllReturnAmount > 0 ? (cust.total_return_amount / totalAllReturnAmount) * 100 : 0
          }));

          // Sort customer groups by total_return_amount descending (leaderboard)
          customerGroups.sort((a, b) => b.total_return_amount - a.total_return_amount);

          setReportRows(customerGroups);
        }

        // ── 📊 REPORT TYPE: SALES INVOICE DETAIL REPORT ──
        else if (rType === 'invoice') {
          let query = supabase.from('sales_invoices').select('*');
          if (filters.invoiceNo && filters.invoiceNo !== 'All') query = query.eq('id', filters.invoiceNo);
          if (filters.customer && filters.customer.length > 0 && !filters.customer.includes('All')) query = query.in('customer_name', filters.customer);
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            query = query.gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59.999Z`);
          }
          const { data, error } = await query;
          if (error) throw error;

          let pool = data || [];
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            pool = pool.filter(i => {
              const targetDateStr = String(i.sale_date || i.created_at || '').split('T')[0];
              return targetDateStr >= startStr && targetDateStr <= endStr;
            });
          }

          if (filters.sortBy) {
            if (filters.sortBy === 'date_asc') {
              pool.sort((a, b) => (a.sale_date || a.created_at || '').localeCompare(b.sale_date || b.created_at || ''));
            } else if (filters.sortBy === 'amount_desc') {
              pool.sort((a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0));
            } else if (filters.sortBy === 'amount_asc') {
              pool.sort((a, b) => Number(a.total_amount || 0) - Number(b.total_amount || 0));
            } else if (filters.sortBy === 'invoice_asc') {
              pool.sort((a, b) => String(a.invoice_no || a.id).localeCompare(String(b.invoice_no || b.id)));
            } else {
              pool.sort((a, b) => (b.sale_date || b.created_at || '').localeCompare(a.sale_date || a.created_at || ''));
            }
          }

          setReportRows(pool);
        }

        // ── 📊 REPORT TYPE: CUSTOMER LOYALTY REWARDS ──
        else if (rType === 'loyalty') {
          let query = supabase.from('sales_invoices').select('*').order('created_at', { ascending: true });
          if (filters.customer && filters.customer.length > 0 && !filters.customer.includes('All')) query = query.in('customer_name', filters.customer);
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            query = query.gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59.999Z`);
          }
          const { data: invData, error: invError } = await query;
          if (invError) throw invError;

          // Group by customer_name
          const customerMap: Record<string, any> = {};

          (invData || []).forEach((inv: any) => {
            const cName = inv.customer_name || 'Walking Customer';
            if (!customerMap[cName]) {
              customerMap[cName] = {
                customer_name: cName,
                transactions: [],
                total_earned: 0,
                total_redeemed: 0,
                net_balance: 0,
                total_sales_amount: 0,
                invoices_count: 0
              };
            }

            const earned = Math.round(Number(inv.total_amount || 0) * 0.01 * 100) / 100;
            const redeemed = 0;
            const currentRunning = customerMap[cName].net_balance + (earned - redeemed);

            customerMap[cName].total_earned += earned;
            customerMap[cName].total_redeemed += redeemed;
            customerMap[cName].net_balance = currentRunning;
            customerMap[cName].total_sales_amount += Number(inv.total_amount || 0);
            customerMap[cName].invoices_count += 1;

            customerMap[cName].transactions.push({
              id: `inv-${inv.id}`,
              date: inv.sale_date || String(inv.created_at || '').split('T')[0],
              invoice_no: inv.invoice_no || `INV-${String(inv.id).padStart(4, '0')}`,
              salesman: inv.salesman || 'Direct',
              narration: `Sales Invoice Points Accrual (Invoice #${inv.invoice_no || `INV-${String(inv.id).padStart(4, '0')}`})`,
              total_amount: Number(inv.total_amount || 0),
              debit_points: redeemed,
              credit_points: earned,
              balance: currentRunning
            });
          });

          const customerGroups = Object.values(customerMap).sort((a, b) => a.customer_name.localeCompare(b.customer_name));

          setReportRows(customerGroups);
        }
      } catch (err: any) {
        toast.error('Audit compilation trace failed: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    compileExcelStructuredDataset();
  }, [rType, JSON.stringify(filters)]);

  const [exporting, setExporting] = useState(false);

  // Helper function to extract line item names
  const extractItemNames = (row: any): string[] => {
    let itemsList: any[] = [];
    if (Array.isArray(row.items)) {
      itemsList = row.items;
    } else if (typeof row.items === 'string') {
      try {
        itemsList = JSON.parse(row.items);
      } catch {
        itemsList = [];
      }
    }
    return itemsList
      .map((it: any) => it.itemName || it.pDescription || it.product_name || it.name || '')
      .filter(Boolean);
  };

  // Helper function to extract line item details
  const extractItemDetails = (row: any): Array<{ name: string; qty: number | string; uom: string; price: number | string }> => {
    let itemsList: any[] = [];
    if (Array.isArray(row.items)) {
      itemsList = row.items;
    } else if (typeof row.items === 'string') {
      try {
        itemsList = JSON.parse(row.items);
      } catch {
        itemsList = [];
      }
    }
    return itemsList.map((it: any) => {
      const name = it.itemName || it.pDescription || it.product_name || it.name || 'Product';
      const cleanKey = String(name).trim().toLowerCase();
      const uom = it.uom || it.unit || productUomMap[cleanKey] || 'Nos';
      return {
        name,
        qty: it.qty ?? it.quantity ?? it.orderQty ?? 1,
        uom,
        price: it.rp ?? it.rate ?? it.price ?? 0
      };
    }).filter(it => it.name);
  };

  // ── 📥 EXCEL WORKBOOK EXPORT ──
  const handleExportExcel = async () => {
    try {
      if (!reportRows || reportRows.length === 0) {
        toast.error('No report data available to export');
        return;
      }
      setExporting(true);

      const filterMeta = {
        'Report Type': rType === 'product-sales-history' ? 'Product Sales History Report' : rType === 'sales-query' ? 'Sales Parameter Transaction Register' : rType === 'customer-sales' ? 'Customer Sales & Volume Analysis' : rType === 'return' ? 'Sales Return & Credit Ledger' : String(rType).toUpperCase(),
        'Presentation Mode': (rType === 'product-sales-history' || rType === 'sale' || rType === 'customer-sales' || rType === 'return') ? (activeViewMode === 'summary' ? 'Summary View' : 'Detailed View') : 'Standard',
        'Customer': filters.customer?.length > 0 ? filters.customer.join(', ') : 'All',
        'Salesman': filters.salesman?.length > 0 ? filters.salesman.join(', ') : 'All',
        'Warehouse': filters.location?.length > 0 ? filters.location.join(', ') : 'All',
        'Date Window': filters.dateFrom || filters.dateTo ? `${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}` : 'All Time'
      };

      let columns: ExcelColumn[] = [];
      let exportData: any[] = [];

      if (rType === 'product-sales-history') {
        if (activeViewMode === 'summary') {
          columns = [
            { header: 'S#', key: 'sno', width: 8, alignment: { horizontal: 'center' } },
            { header: 'Product / Item Name', key: 'product_name', width: 32 },
            { header: 'SKU / Code', key: 'sku', width: 16 },
            { header: 'Category', key: 'category', width: 18 },
            { header: 'Brand', key: 'brand', width: 16 },
            { header: 'UOM', key: 'uom', width: 10, alignment: { horizontal: 'center' } },
            { header: 'Sold Qty', key: 'sold_qty', width: 14, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Returned Qty', key: 'returned_qty', width: 14, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Net Sold Qty', key: 'net_qty', width: 14, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Avg. Rate (PKR)', key: 'avg_rate', width: 18, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Net Sales Revenue (PKR)', key: 'final_net_sales', width: 24, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Last Sale Date', key: 'last_sale_date', width: 16, alignment: { horizontal: 'center' } }
          ];

          exportData = reportRows.map((r, i) => ({
            sno: i + 1,
            product_name: r.product_name,
            sku: r.sku || '-',
            category: r.category || 'General',
            brand: r.brand || '-',
            uom: r.uom,
            sold_qty: r.sold_qty,
            returned_qty: r.returned_qty,
            net_qty: r.net_qty,
            avg_rate: r.avg_rate,
            final_net_sales: r.final_net_sales,
            last_sale_date: r.last_sale_date
          }));
        } else {
          columns = [
            { header: 'Product Name', key: 'product_name', width: 28 },
            { header: 'Processing Date', key: 'date', width: 14, alignment: { horizontal: 'center' } },
            { header: 'Invoice #', key: 'invoice_no', width: 16 },
            { header: 'Customer Name', key: 'customer_name', width: 26 },
            { header: 'Salesman', key: 'salesman', width: 18 },
            { header: 'Warehouse', key: 'warehouse', width: 18 },
            { header: 'Qty Sold', key: 'qty', width: 12, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'UOM', key: 'uom', width: 8, alignment: { horizontal: 'center' } },
            { header: 'Unit Rate (PKR)', key: 'rate', width: 16, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Discount (PKR)', key: 'discount', width: 16, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Net Amount (PKR)', key: 'total', width: 20, numFmt: '#,##0.00', alignment: { horizontal: 'right' } }
          ];

          exportData = [];
          reportRows.forEach((prod: any) => {
            (prod.transactions || []).forEach((tx: any) => {
              exportData.push({
                product_name: prod.product_name,
                date: tx.date,
                invoice_no: tx.invoice_no,
                customer_name: tx.customer_name,
                salesman: tx.salesman,
                warehouse: tx.warehouse,
                qty: tx.qty,
                uom: tx.uom,
                rate: tx.rate,
                discount: tx.discount,
                total: tx.total
              });
            });
          });
        }
      } else if (rType === 'sales-query') {
        columns = [
          { header: 'S#', key: 'sno', width: 8, alignment: { horizontal: 'center' } },
          { header: 'Processing Date', key: 'processingDate', width: 16, alignment: { horizontal: 'center' } },
          { header: 'Invoice #', key: 'docRef', width: 18 },
          { header: 'Customer Name', key: 'customerName', width: 28 },
          { header: 'Sales Officer', key: 'salesman', width: 20 },
          { header: 'Carrier Fleet', key: 'transport', width: 18 },
          { header: 'Product Line Items', key: 'products', width: 45 },
          { header: 'Warehouse', key: 'warehouse', width: 18 },
          { header: 'Payment Term', key: 'paymentTerm', width: 16, alignment: { horizontal: 'center' } },
          { header: 'Gross Matrix Amount (PKR)', key: 'totalAmount', width: 24, numFmt: '#,##0.00', alignment: { horizontal: 'right' } }
        ];

        exportData = reportRows.map((row, i) => {
          const itemDetails = extractItemDetails(row);
          const productsFormatted = itemDetails.length > 0
            ? itemDetails.map(it => `${it.name} (${it.qty} ${it.uom} @ Rs. ${Number(it.price).toLocaleString()})`).join(' | ')
            : extractItemNames(row).join(' | ');
          return {
            sno: i + 1,
            processingDate: row.sale_date || String(row.created_at || '').split('T')[0],
            docRef: row.invoice_no || `INV-${String(row.id).padStart(4, '0')}`,
            customerName: row.customer_name || 'Counter Retail Buyer',
            salesman: row.salesman || 'Direct',
            transport: row.transport_name || 'Self Pick',
            products: productsFormatted,
            warehouse: row.dispatch_warehouse || 'Main Warehouse',
            paymentTerm: row.payment_term || 'Credit',
            totalAmount: Number(row.total_amount || 0)
          };
        });
      } else if (rType === 'customer-sales') {
        if (activeViewMode === 'summary') {
          columns = [
            { header: 'S#', key: 'sno', width: 8, alignment: { horizontal: 'center' } },
            { header: 'Customer / Client Name', key: 'customer_name', width: 28 },
            { header: 'Invoices Booked', key: 'invoices_count', width: 16, numFmt: '#,##0', alignment: { horizontal: 'right' } },
            { header: 'Total Units Sold', key: 'total_units', width: 18, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Cash Sales (PKR)', key: 'cash_sales', width: 20, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Credit Sales (PKR)', key: 'credit_sales', width: 20, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Total Revenue (PKR)', key: 'total_sales', width: 24, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Contribution (%)', key: 'contribution_pct', width: 16, numFmt: '0.00"%"', alignment: { horizontal: 'right' } }
          ];

          exportData = reportRows.map((cust, i) => ({
            sno: i + 1,
            customer_name: cust.customer_name,
            invoices_count: cust.invoices_count,
            total_units: cust.total_units,
            cash_sales: cust.cash_sales,
            credit_sales: cust.credit_sales,
            total_sales: cust.total_sales,
            contribution_pct: cust.contribution_pct
          }));
        } else {
          columns = [
            { header: 'Customer Name', key: 'customer_name', width: 24 },
            { header: 'Processing Date', key: 'processingDate', width: 16, alignment: { horizontal: 'center' } },
            { header: 'Invoice #', key: 'docRef', width: 18 },
            { header: 'Sales Officer', key: 'salesman', width: 20 },
            { header: 'Product Line Items', key: 'products', width: 45 },
            { header: 'Payment Term', key: 'paymentTerm', width: 16, alignment: { horizontal: 'center' } },
            { header: 'Carrier Fleet', key: 'transport', width: 18 },
            { header: 'Net Amount (PKR)', key: 'totalAmount', width: 22, numFmt: '#,##0.00', alignment: { horizontal: 'right' } }
          ];

          exportData = [];
          reportRows.forEach((cust: any) => {
            (cust.transactions || []).forEach((row: any) => {
              const itemDetails = extractItemDetails(row);
              const productsFormatted = itemDetails.length > 0
                ? itemDetails.map(it => `${it.name} (${it.qty} ${it.uom} @ Rs. ${Number(it.price).toLocaleString()})`).join(' | ')
                : extractItemNames(row).join(' | ');

              exportData.push({
                customer_name: cust.customer_name,
                processingDate: row.sale_date || String(row.created_at || '').split('T')[0],
                docRef: row.invoice_no || `INV-${String(row.id).padStart(4, '0')}`,
                salesman: row.salesman || 'Direct',
                products: productsFormatted,
                paymentTerm: row.payment_term || 'Credit',
                transport: row.transport_name || 'Self Pick',
                totalAmount: Number(row.total_amount || 0)
              });
            });
          });
        }
      } else if (rType === 'loyalty') {
        columns = [
          { header: 'Customer Name', key: 'customer_name', width: 28 },
          { header: 'Date', key: 'date', width: 14, alignment: { horizontal: 'center' } },
          { header: 'Invoice Ref #', key: 'invoice_no', width: 18 },
          { header: 'Salesman', key: 'salesman', width: 18 },
          { header: 'Narration / Activity Details', key: 'narration', width: 35 },
          { header: 'Invoice Amount (PKR)', key: 'total_amount', width: 20, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
          { header: 'Points Redeemed (-)', key: 'debit', width: 18, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
          { header: 'Points Earned (+)', key: 'credit', width: 18, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
          { header: 'Customer Balance (Pts)', key: 'balance', width: 20, numFmt: '#,##0.00', alignment: { horizontal: 'right' } }
        ];

        exportData = [];
        reportRows.forEach((cust: any) => {
          (cust.transactions || []).forEach((tx: any) => {
            exportData.push({
              customer_name: cust.customer_name,
              date: tx.date,
              invoice_no: tx.invoice_no,
              salesman: tx.salesman,
              narration: tx.narration,
              total_amount: tx.total_amount,
              debit: Number(tx.debit_points || 0),
              credit: Number(tx.credit_points || 0),
              balance: Number(tx.balance || 0)
            });
          });
        });
      } else if (rType === 'sale') {
        if (activeViewMode === 'summary') {
          columns = [
            { header: 'S#', key: 'sno', width: 8, alignment: { horizontal: 'center' } },
            { header: 'Sales Officer / Salesman Name', key: 'salesman', width: 28 },
            { header: 'Invoices Booked', key: 'invoices_count', width: 16, numFmt: '#,##0', alignment: { horizontal: 'right' } },
            { header: 'Unique Clients', key: 'unique_customers_count', width: 16, numFmt: '#,##0', alignment: { horizontal: 'right' } },
            { header: 'Cash Sales (PKR)', key: 'cash_sales', width: 20, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Credit Sales (PKR)', key: 'credit_sales', width: 20, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Total Revenue (PKR)', key: 'total_sales', width: 24, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Contribution (%)', key: 'contribution_pct', width: 16, numFmt: '0.00"%"', alignment: { horizontal: 'right' } }
          ];

          exportData = reportRows.map((sm, i) => ({
            sno: i + 1,
            salesman: sm.salesman,
            invoices_count: sm.invoices_count,
            unique_customers_count: sm.unique_customers_count,
            cash_sales: sm.cash_sales,
            credit_sales: sm.credit_sales,
            total_sales: sm.total_sales,
            contribution_pct: sm.contribution_pct
          }));
        } else {
          columns = [
            { header: 'Salesman', key: 'salesman', width: 22 },
            { header: 'Processing Date', key: 'processingDate', width: 16, alignment: { horizontal: 'center' } },
            { header: 'Invoice #', key: 'docRef', width: 18 },
            { header: 'Customer Name', key: 'customerName', width: 28 },
            { header: 'Products / Items', key: 'products', width: 42 },
            { header: 'Payment Term', key: 'paymentTerm', width: 16, alignment: { horizontal: 'center' } },
            { header: 'Carrier Fleet', key: 'transport', width: 18 },
            { header: 'Net Amount (PKR)', key: 'totalAmount', width: 22, numFmt: '#,##0.00', alignment: { horizontal: 'right' } }
          ];

          exportData = [];
          reportRows.forEach((sm: any) => {
            (sm.transactions || []).forEach((row: any) => {
              const itemNames = extractItemNames(row);
              exportData.push({
                salesman: sm.salesman,
                processingDate: row.sale_date || String(row.created_at || '').split('T')[0],
                docRef: row.invoice_no || `INV-${String(row.id).padStart(4, '0')}`,
                customerName: row.customer_name || 'Counter Retail Buyer',
                products: itemNames.join(' | '),
                paymentTerm: row.payment_term || 'Credit',
                transport: row.transport_name || 'Self Pick',
                totalAmount: Number(row.total_amount || 0)
              });
            });
          });
        }
      } else if (rType === 'return') {
        if (activeViewMode === 'summary') {
          columns = [
            { header: 'S#', key: 'sno', width: 8, alignment: { horizontal: 'center' } },
            { header: 'Customer / Client Name', key: 'customer_name', width: 30 },
            { header: 'Return Notes Booked', key: 'returns_count', width: 18, numFmt: '#,##0', alignment: { horizontal: 'right' } },
            { header: 'Total Returned Units', key: 'total_returned_qty', width: 18, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: 'Total Credit Adjusted (PKR)', key: 'total_return_amount', width: 24, numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
            { header: '% Share of Returns', key: 'contribution_pct', width: 18, numFmt: '0.00"%"', alignment: { horizontal: 'right' } }
          ];

          exportData = reportRows.map((cust, i) => ({
            sno: i + 1,
            customer_name: cust.customer_name,
            returns_count: cust.returns_count,
            total_returned_qty: cust.total_returned_qty,
            total_return_amount: cust.total_return_amount,
            contribution_pct: cust.contribution_pct
          }));
        } else {
          columns = [
            { header: 'Customer Name', key: 'customer_name', width: 26 },
            { header: 'Return Date', key: 'return_date', width: 14, alignment: { horizontal: 'center' } },
            { header: 'Return Ref #', key: 'return_no', width: 18 },
            { header: 'Original Inv Ref #', key: 'original_invoice_no', width: 18 },
            { header: 'Sales Officer', key: 'salesman', width: 20 },
            { header: 'Returned Line Items', key: 'items', width: 45 },
            { header: 'Restocked Warehouse', key: 'warehouse', width: 20 },
            { header: 'Reason / Remarks', key: 'reason', width: 25 },
            { header: 'Credit Amount (PKR)', key: 'return_amount', width: 22, numFmt: '#,##0.00', alignment: { horizontal: 'right' } }
          ];

          exportData = [];
          reportRows.forEach((cust: any) => {
            (cust.transactions || []).forEach((row: any) => {
              const itemDetails = extractItemDetails(row);
              const itemsFormatted = itemDetails.length > 0
                ? itemDetails.map(it => `${it.name} (${it.qty} ${it.uom} @ Rs. ${Number(it.price).toLocaleString()})`).join(' | ')
                : extractItemNames(row).join(' | ');

              exportData.push({
                customer_name: cust.customer_name,
                return_date: row.return_date || String(row.created_at || '').split('T')[0],
                return_no: row.return_no || `RTN-${String(row.id).padStart(4, '0')}`,
                original_invoice_no: row.original_invoice_no || '-',
                salesman: row.salesman || 'Direct',
                items: itemsFormatted,
                warehouse: row.dispatch_warehouse || row.location || 'Main Warehouse',
                reason: row.reason || row.remarks || 'Stock Return',
                return_amount: Number(row.return_amount || row.total_amount || 0)
              });
            });
          });
        }
      } else {
        columns = [
          { header: 'Processing Date', key: 'processingDate', width: 16, type: 'date' as const },
          { header: 'Document Ref #', key: 'docRef', width: 18 },
          { header: 'Product', key: 'products', width: 45 },
          { header: 'Customer', key: 'customerName', width: 28 },
          { header: 'Gross Matrix Amount (Rs.)', key: 'totalAmount', width: 22, type: 'currency' as const }
        ];

        exportData = reportRows.map((row) => {
          const itemDetails = extractItemDetails(row);
          const itemNames = extractItemNames(row);
          const productsFormatted = rType === 'invoice'
            ? itemDetails.map(it => `${it.name} | ${it.qty} ${it.uom} | Rs. ${Number(it.price).toLocaleString()}`).join('\r\n')
            : itemNames.join(' | ');

          return {
            processingDate: row.sale_date || row.return_date || String(row.created_at || '').split('T')[0],
            docRef: row.invoice_no || `INV-${String(row.id).padStart(4, '0')}`,
            products: productsFormatted,
            customerName: row.customer_name || 'Counter Retail Buyer',
            totalAmount: Number(row.total_amount || row.return_amount || row.payout_amount_paid || 0)
          };
        });
      }

      const reportTitle = rType === 'product-sales-history'
        ? `Product Sales History & Market Trends Audit Report (${activeViewMode.toUpperCase()} VIEW)`
        : rType === 'sales-query'
        ? 'Sales Parameter Multi-Criteria Transaction Register'
        : rType === 'customer-sales'
        ? `Customer Sales & Volume Analysis Statement (${activeViewMode.toUpperCase()} VIEW)`
        : rType === 'sale'
        ? `Commercial Sales Audit Ledger Statement (${activeViewMode.toUpperCase()} VIEW)`
        : rType === 'return'
        ? `Sales Return & Credit Adjustment Ledger Statement (${activeViewMode.toUpperCase()} VIEW)`
        : rType === 'loyalty'
        ? 'Customer Loyalty Rewards & Accrual Statement'
        : 'Sales Invoice Detail Audit Report';

      await exportToExcel({
        fileName: `${rType === 'sale' ? 'Commercial_Sales_Ledger' : rType === 'product-sales-history' ? 'Product_Sales_History' : rType === 'customer-sales' ? 'Customer_Sales_Analysis' : rType === 'return' ? 'Sales_Return_Credit_Ledger' : rType === 'sales-query' ? 'Sales_Parameter_Register' : rType}_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: rType === 'sale' ? 'Sales Ledger' : rType === 'customer-sales' ? 'Customer Breakdown' : rType === 'return' ? 'Return Ledger' : 'Sales Report',
        companyName: businessName || 'ZOAIB ALI & COMPANY',
        reportTitle,
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

  // Summary Metrics calculations
  const totalGrossAmount = useMemo(() => {
    if (rType === 'product-sales-history') {
      return reportRows.reduce((acc, r) => acc + Number(r.final_net_sales || 0), 0);
    }
    if (rType === 'loyalty') {
      return reportRows.reduce((acc, r) => acc + Number(r.total_sales_amount || 0), 0);
    }
    if (rType === 'sale' || rType === 'customer-sales') {
      return reportRows.reduce((acc, s) => acc + Number(s.total_sales || 0), 0);
    }
    if (rType === 'return') {
      return reportRows.reduce((acc, r) => acc + Number(r.total_return_amount || 0), 0);
    }
    return reportRows.reduce((acc, row) => acc + Number(row.total_amount || 0), 0);
  }, [reportRows, rType]);

  const totalSoldUnits = useMemo(() => {
    if (rType === 'product-sales-history') {
      return reportRows.reduce((acc, r) => acc + Number(r.sold_qty || 0), 0);
    }
    if (rType === 'customer-sales') {
      return reportRows.reduce((acc, c) => acc + Number(c.total_units || 0), 0);
    }
    return 0;
  }, [reportRows, rType]);

  const totalReturnedUnits = useMemo(() => {
    if (rType === 'product-sales-history') {
      return reportRows.reduce((acc, r) => acc + Number(r.returned_qty || 0), 0);
    }
    if (rType === 'return') {
      return reportRows.reduce((acc, r) => acc + Number(r.total_returned_qty || 0), 0);
    }
    return 0;
  }, [reportRows, rType]);

  const totalNetUnits = useMemo(() => {
    if (rType === 'product-sales-history') {
      return reportRows.reduce((acc, r) => acc + Number(r.net_qty || 0), 0);
    }
    return 0;
  }, [reportRows, rType]);

  const cashAmount = useMemo(() => {
    if (rType === 'sale' || rType === 'customer-sales') {
      return reportRows.reduce((acc, s) => acc + Number(s.cash_sales || 0), 0);
    }
    return reportRows.filter(r => String(r.payment_term || '').toLowerCase() === 'cash').reduce((acc, r) => acc + Number(r.total_amount || 0), 0);
  }, [reportRows, rType]);

  const creditAmount = useMemo(() => {
    if (rType === 'sale' || rType === 'customer-sales') {
      return reportRows.reduce((acc, s) => acc + Number(s.credit_sales || 0), 0);
    }
    return totalGrossAmount - cashAmount;
  }, [reportRows, rType, totalGrossAmount, cashAmount]);

  const totalInvoicesCount = useMemo(() => {
    if (rType === 'sale' || rType === 'customer-sales') {
      return reportRows.reduce((acc, s) => acc + Number(s.invoices_count || 0), 0);
    }
    if (rType === 'return') {
      return reportRows.reduce((acc, r) => acc + Number(r.returns_count || 0), 0);
    }
    if (rType === 'loyalty') {
      return reportRows.reduce((acc, c) => acc + Number(c.invoices_count || 0), 0);
    }
    return reportRows.length;
  }, [reportRows, rType]);

  const avgOrder = totalInvoicesCount > 0 ? totalGrossAmount / totalInvoicesCount : 0;

  const paginatedRows = useMemo(() => {
    if (isPrinting || pageSize >= 10000) return reportRows;
    const start = (currentPage - 1) * pageSize;
    return reportRows.slice(start, start + pageSize);
  }, [reportRows, currentPage, pageSize, isPrinting]);

  const displayedRows = isPrinting ? reportRows : paginatedRows;

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;

  return (
    <div className="w-full bg-white text-black p-6 space-y-6 text-xs min-h-screen print:p-0 print:m-0 print:bg-white print:text-black print:min-h-0 print:h-auto">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page { size: auto; margin: 12mm 10mm 12mm 10mm; }
          body, html { height: auto !important; min-height: 0 !important; overflow: visible !important; background: white !important; }
          body * { visibility: hidden !important; }
          .print-root-container, .print-root-container * { visibility: visible !important; }
          .print-root-container { position: static !important; width: 100% !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: white !important; padding: 0 !important; margin: 0 !important; }
          aside, header, nav, footer, .print-hidden-element, button { display: none !important; visibility: hidden !important; }
          table { page-break-inside: auto !important; }
          tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}} />

      <div className="print-root-container w-full bg-white p-4 space-y-6 print:p-0 print:space-y-4">
        {/* ── TOP ACTION BUTTON BAR ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-100 p-3 rounded border print-hidden-element print:hidden">
          <button 
            type="button" 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer"
          >
            <MdArrowBack size={16} /> Back to Report Filter
          </button>
          
          <div className="flex items-center gap-2 flex-wrap">
            {(rType === 'product-sales-history' || rType === 'sale' || rType === 'customer-sales' || rType === 'return') && (
              <div className="flex items-center bg-white p-0.5 rounded border border-gray-300 shadow-2xs mr-2">
                <button
                  type="button"
                  onClick={() => setActiveViewMode('summary')}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                    activeViewMode === 'summary' ? 'bg-primary text-white' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  <MdTableChart size={14} /> Summary View
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewMode('detailed')}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                    activeViewMode === 'detailed' ? 'bg-primary text-white' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  <MdViewList size={14} /> Detailed View
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={exporting}
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white py-1.5 px-3.5 rounded font-bold cursor-pointer transition shadow-sm disabled:opacity-50"
            >
              <MdFileDownload size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <button 
              type="button" 
              onClick={() => window.print()} 
              className="flex items-center gap-1.5 bg-primary text-white py-1.5 px-4 rounded font-black cursor-pointer hover:bg-opacity-90 transition shadow-sm"
            >
              <MdPrint size={16} /> Print Report
            </button>
          </div>
        </div>

        {/* ── OFFICIAL CORPORATE REPORT HEADER ── */}
        <div className="text-center space-y-1 py-4 border-b border-double border-black">
          <h1 className="text-xl font-black uppercase tracking-widest font-serif">ZOAIB ALI & COMPANY</h1>
          <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
            {rType === 'product-sales-history' 
              ? 'Product Sales History, Velocity Trends & Realized Revenue Statement'
              : rType === 'sales-query'
              ? 'Sales Filter, Multi-Criteria Parameters & Chronological Audit Register'
              : rType === 'customer-sales'
              ? 'Customer Sales Volume, Purchasing Cycle & Revenue Contribution Statement'
              : rType === 'sale'
              ? 'Commercial Sales Audit Statement & Sales Executive Ledger'
              : rType === 'loyalty'
              ? 'Customer Loyalty Rewards & Accrual Ledger Statement'
              : rType === 'return'
              ? 'Sales Return, Defect Restock & Credit Ledger Statement'
              : 'Sales Invoice Detail Audit Report'}
          </p>
          <div className="text-[10px] pt-1 font-mono flex flex-wrap justify-between px-2 text-gray-600">
            <span>
              Report Categorization: <b className="text-black uppercase underline">
                {rType === 'product-sales-history' 
                  ? `Product Sales History (${activeViewMode.toUpperCase()} VIEW)` 
                  : rType === 'sales-query'
                  ? 'Sales Parameter Transaction Register (CHRONOLOGICAL AUDIT)'
                  : rType === 'customer-sales'
                  ? `Customer Sales & Volume Analysis (${activeViewMode.toUpperCase()} VIEW)`
                  : rType === 'sale'
                  ? `Commercial Sales Audit Ledger (${activeViewMode.toUpperCase()} VIEW)`
                  : rType === 'return'
                  ? `Sales Return & Credit Ledger (${activeViewMode.toUpperCase()} VIEW)`
                  : `${rType} Ledger Book`}
              </b>
            </span>
            <span>Duration Window Block: {filters.dateFrom || 'All Time'} up to {filters.dateTo || 'All Time'}</span>
          </div>
        </div>

        {/* ── VISUAL KPI STATS RIBBON ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 print-hidden-element print:hidden">
          {rType === 'product-sales-history' ? (
            <>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Product SKUs</p>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{reportRows.length} Items</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Units Sold (Gross)</p>
                <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">{totalSoldUnits.toLocaleString()}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Customer Returns Qty</p>
                <p className="text-sm font-black text-rose-700 font-mono mt-0.5">{totalReturnedUnits.toLocaleString()}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Net Realized Revenue</p>
                <p className="text-sm font-black text-purple-700 font-mono mt-0.5">Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </>
          ) : rType === 'customer-sales' ? (
            <>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Target Customers</p>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{reportRows.length} Clients</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Invoices Booked</p>
                <p className="text-sm font-black text-indigo-700 font-mono mt-0.5">{totalInvoicesCount} Invoices</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Volume Sold</p>
                <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">{totalSoldUnits.toLocaleString()} Units</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Realized Revenue</p>
                <p className="text-sm font-black text-purple-700 font-mono mt-0.5">Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </>
          ) : rType === 'loyalty' ? (
            <>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Target Customer(s)</p>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5 truncate">
                  {filters.customer?.length > 0 && !filters.customer.includes('All') ? filters.customer.join(', ') : `${reportRows.length} Customers`}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Points Earned</p>
                <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">
                  {reportRows.reduce((sum: number, c: any) => sum + Number(c.total_earned || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Points Redeemed</p>
                <p className="text-sm font-black text-rose-700 font-mono mt-0.5">
                  {reportRows.reduce((sum: number, c: any) => sum + Number(c.total_redeemed || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Net Active Balance</p>
                <p className="text-sm font-black text-purple-700 font-mono mt-0.5">
                  {reportRows.reduce((sum: number, c: any) => sum + Number(c.net_balance || 0), 0).toFixed(2)} Pts
                </p>
              </div>
            </>
          ) : rType === 'return' ? (
            <>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Affected Customers</p>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{reportRows.length} Clients</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Return Debit Notes</p>
                <p className="text-sm font-black text-indigo-700 font-mono mt-0.5">{totalInvoicesCount} Notes</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Returned Units</p>
                <p className="text-sm font-black text-rose-700 font-mono mt-0.5">{totalReturnedUnits.toLocaleString()} Units</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Credit Adjusted</p>
                <p className="text-sm font-black text-purple-700 font-mono mt-0.5">Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </>
          ) : rType === 'sale' ? (
            <>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Sales Officers</p>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{reportRows.length} Officers</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Invoices Booked</p>
                <p className="text-sm font-black text-indigo-700 font-mono mt-0.5">{totalInvoicesCount} Invoices</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Cash vs Credit Split</p>
                <p className="text-[11px] font-black font-mono mt-0.5">
                  <span className="text-emerald-600">Rs. {cashAmount.toLocaleString()}</span> / <span className="text-blue-600">Rs. {creditAmount.toLocaleString()}</span>
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Commercial Gross</p>
                <p className="text-sm font-black text-purple-700 font-mono mt-0.5">Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Invoices / Records</p>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">{reportRows.length}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Matrix Gross</p>
                <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Cash vs Credit Split</p>
                <p className="text-[11px] font-black font-mono mt-0.5">
                  <span className="text-emerald-600">Rs. {cashAmount.toLocaleString()}</span> / <span className="text-blue-600">Rs. {creditAmount.toLocaleString()}</span>
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Average Ticket Value</p>
                <p className="text-sm font-black text-purple-700 font-mono mt-0.5">Rs. {Math.round(avgOrder).toLocaleString()}</p>
              </div>
            </>
          )}
        </div>

        {/* ── TOP PAGINATION CONTROL ── */}
        <ReportPagination
          currentPage={currentPage}
          totalItems={reportRows.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel={rType === 'product-sales-history' ? 'products' : (rType === 'loyalty' || rType === 'customer-sales' || rType === 'return') ? 'customers' : rType === 'sale' ? 'salesmen' : 'records'}
        />

        {/* ── MAIN AUDIT TABLE SECTION ── */}
        <div className="w-full overflow-x-auto">
          {rType === 'product-sales-history' ? (
            activeViewMode === 'summary' ? (
              // ── 📊 SUMMARY VIEW TABLE (1 ROW / PRODUCT) ──
              <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                    <th className="p-1.5 border border-black text-center w-10">S#</th>
                    <th className="p-1.5 border border-black">Product / Item Name</th>
                    <th className="p-1.5 border border-black">SKU / Code</th>
                    <th className="p-1.5 border border-black">Category</th>
                    <th className="p-1.5 border border-black text-center">UOM</th>
                    <th className="p-1.5 border border-black text-right">Sold Qty</th>
                    <th className="p-1.5 border border-black text-right">Return Qty</th>
                    <th className="p-1.5 border border-black text-right">Net Qty</th>
                    <th className="p-1.5 border border-black text-right">Avg. Rate (PKR)</th>
                    <th className="p-1.5 border border-black text-right">Net Sales Revenue (PKR)</th>
                    <th className="p-1.5 border border-black text-center">Last Sold Date</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                        No product sales history records discovered matching chosen selection criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row, idx) => {
                      const realIndex = isPrinting ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                      return (
                        <tr key={idx} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                          <td className="p-1.5 border border-black text-center text-gray-600">{realIndex}</td>
                          <td className="p-1.5 border border-black font-sans font-bold text-black">{row.product_name}</td>
                          <td className="p-1.5 border border-black text-gray-700 text-[10px]">{row.sku || '-'}</td>
                          <td className="p-1.5 border border-black font-sans text-gray-600 text-[10px]">{row.category}</td>
                          <td className="p-1.5 border border-black text-center text-gray-700 font-bold">{row.uom}</td>
                          <td className="p-1.5 border border-black text-right text-black font-bold">
                            {Number(row.sold_qty || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-right text-rose-700 font-bold">
                            {Number(row.returned_qty || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-right text-primary font-black">
                            {Number(row.net_qty || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-right text-gray-800">
                            Rs. {Number(row.avg_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-right text-emerald-700 font-black">
                            Rs. {Number(row.final_net_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-center text-gray-600 text-[10px]">
                            {row.last_sale_date || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  {/* 📄 Page Subtotal Row */}
                  {!isPrinting && pageSize !== 'all' && (
                    <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                      <td colSpan={5} className="p-2 border border-black text-right uppercase tracking-wider text-amber-900">
                        Page {currentPage} Subtotal ({displayedRows.length} products):
                      </td>
                      <td className="p-2 border border-black text-right text-black font-bold">
                        {displayedRows.reduce((sum, r) => sum + Number(r.sold_qty || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-right text-rose-700 font-bold">
                        {displayedRows.reduce((sum, r) => sum + Number(r.returned_qty || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-right text-primary font-bold">
                        {displayedRows.reduce((sum, r) => sum + Number(r.net_qty || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-right text-gray-400">-</td>
                      <td className="p-2 border border-black text-right text-emerald-800 font-bold whitespace-nowrap">
                        Rs. {displayedRows.reduce((sum, r) => sum + Number(r.final_net_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-center text-[10px] font-bold text-amber-800">Page {currentPage} of {Math.ceil(reportRows.length / (typeof pageSize === 'number' ? pageSize : 1))}</td>
                    </tr>
                  )}
                  {/* 📊 Overall Grand Totals Row */}
                  <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                    <td colSpan={5} className="p-2 border border-black text-right uppercase tracking-wider text-gray-900">
                      Grand Total Summary (All {reportRows.length} Products):
                    </td>
                    <td className="p-2 border border-black text-right text-black">
                      {totalSoldUnits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-right text-rose-700">
                      {totalReturnedUnits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-right text-primary">
                      {totalNetUnits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-right text-gray-400">-</td>
                    <td className="p-2 border border-black text-right text-emerald-800 text-sm font-black underline decoration-double whitespace-nowrap">
                      Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-center text-[10px] text-gray-500">{reportRows.length} SKUs</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              // ── 📑 DETAILED VIEW TABLE (GROUPED INVOICE BREAKDOWN) ──
              <div className="space-y-6">
                {displayedRows.length === 0 ? (
                  <div className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                    No product sales history records discovered matching chosen selection criteria.
                  </div>
                ) : (
                  displayedRows.map((prod, pIdx) => {
                    const realProdNum = isPrinting ? pIdx + 1 : (currentPage - 1) * pageSize + pIdx + 1;
                    const prodSubtotal = (prod.transactions || []).reduce((acc: number, t: any) => acc + Number(t.total || 0), 0);
                    const prodTotalQty = (prod.transactions || []).reduce((acc: number, t: any) => acc + Number(t.qty || 0), 0);

                    return (
                      <div key={pIdx} className="border border-black rounded-xs overflow-hidden break-inside-avoid">
                        {/* Product Banner */}
                        <div className="bg-slate-800 text-white p-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-emerald-500 text-black px-2 py-0.5 rounded font-black text-[10px]">#{realProdNum}</span>
                            <span className="font-bold font-sans text-sm">{prod.product_name}</span>
                            <span className="text-slate-400 text-[10px]">SKU: {prod.sku || 'N/A'}</span>
                            <span className="text-slate-400 text-[10px]">Category: {prod.category}</span>
                            <span className="text-slate-400 text-[10px]">UOM: {prod.uom}</span>
                          </div>
                          <div className="text-right text-[11px] font-black font-mono">
                            <span className="text-emerald-400">Total Sold: {prodTotalQty} {prod.uom}</span>
                            <span className="text-slate-500 mx-1.5">|</span>
                            <span className="text-emerald-300">Revenue: Rs. {prodSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Transactions Sub-table */}
                        <table className="w-full table-auto border-collapse text-[11px] font-sans text-left">
                          <thead>
                            <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[9.5px]">
                              <th className="p-1.5 border border-black text-center w-24">Date</th>
                              <th className="p-1.5 border border-black w-28">Invoice #</th>
                              <th className="p-1.5 border border-black">Customer Name</th>
                              <th className="p-1.5 border border-black">Salesman</th>
                              <th className="p-1.5 border border-black">Warehouse</th>
                              <th className="p-1.5 border border-black text-right w-20">Qty</th>
                              <th className="p-1.5 border border-black text-right w-24">Unit Rate</th>
                              <th className="p-1.5 border border-black text-right w-20">Discount</th>
                              <th className="p-1.5 border border-black text-right w-28">Net Amount (PKR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(prod.transactions || []).map((tx: any, tIdx: number) => (
                              <tr key={tIdx} className="border-b border-gray-300 hover:bg-gray-50 font-mono text-xs">
                                <td className="p-1.5 border border-black text-center text-gray-700">{tx.date}</td>
                                <td className="p-1.5 border border-black font-black text-primary uppercase">{tx.invoice_no}</td>
                                <td className="p-1.5 border border-black font-sans font-medium text-black">{tx.customer_name}</td>
                                <td className="p-1.5 border border-black font-sans text-gray-600">{tx.salesman}</td>
                                <td className="p-1.5 border border-black font-sans text-gray-600">{tx.warehouse}</td>
                                <td className="p-1.5 border border-black text-right font-bold text-black">{tx.qty} {tx.uom}</td>
                                <td className="p-1.5 border border-black text-right text-gray-800">Rs. {Number(tx.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="p-1.5 border border-black text-right text-rose-600 font-semibold">{tx.discount > 0 ? `Rs. ${Number(tx.discount).toLocaleString()}` : '-'}</td>
                                <td className="p-1.5 border border-black text-right text-emerald-700 font-bold">Rs. {Number(tx.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                              <td colSpan={5} className="p-1.5 border border-black text-right uppercase tracking-wider text-gray-600">
                                Subtotal ({prod.product_name}):
                              </td>
                              <td className="p-1.5 border border-black text-right text-primary font-black">
                                {prodTotalQty} {prod.uom}
                              </td>
                              <td colSpan={2} className="p-1.5 border border-black text-right text-gray-400">-</td>
                              <td className="p-1.5 border border-black text-right text-emerald-800 font-black">
                                Rs. {prodSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })
                )}

                {/* Grand Summary Across All Products */}
                {reportRows.length > 0 && (
                  <div className="bg-gray-100 p-3 rounded border-2 border-black flex justify-between items-center font-mono font-black text-xs">
                    <span className="uppercase text-gray-800">Grand Total Net Sales Velocity Across All {reportRows.length} Products:</span>
                    <span className="text-emerald-800 text-sm underline decoration-double">
                      Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )
          ) : rType === 'loyalty' ? (
            <div className="space-y-6">
              {displayedRows.length === 0 ? (
                <div className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                  No customer loyalty records discovered matching chosen selection criteria.
                </div>
              ) : (
                displayedRows.map((cust: any, cIdx: number) => {
                  const realCustNum = isPrinting || pageSize === 'all' ? cIdx + 1 : (currentPage - 1) * (pageSize as number) + cIdx + 1;
                  const custTotalSales = Number(cust.total_sales_amount || 0);
                  const custTotalEarned = Number(cust.total_earned || 0);
                  const custTotalRedeemed = Number(cust.total_redeemed || 0);
                  const custNetBalance = Number(cust.net_balance || 0);

                  return (
                    <div key={cIdx} className="border border-black rounded-xs overflow-hidden break-inside-avoid shadow-xs">
                      {/* 👤 Customer Header Banner */}
                      <div className="bg-slate-800 text-white p-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-emerald-500 text-black px-2 py-0.5 rounded font-black text-[10px]">#{realCustNum}</span>
                          <span className="font-bold font-sans text-sm tracking-wide uppercase text-white">{cust.customer_name}</span>
                          <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px]">Invoices: {cust.invoices_count}</span>
                          <span className="text-slate-400 text-[10px]">Total Sales: Rs. {custTotalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-right text-[11px] font-black font-mono flex items-center gap-3">
                          <span className="text-emerald-400">Earned: +{custTotalEarned.toFixed(2)} Pts</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-rose-400">Redeemed: -{custTotalRedeemed.toFixed(2)} Pts</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-amber-300 font-extrabold underline decoration-double">Balance: {custNetBalance.toFixed(2)} Pts</span>
                        </div>
                      </div>

                      {/* Customer Transactions Sub-table */}
                      <table className="w-full table-auto border-collapse text-[11px] font-sans text-left">
                        <thead>
                          <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[9.5px]">
                            <th className="p-1.5 border border-black text-center w-10">S#</th>
                            <th className="p-1.5 border border-black text-center w-24">Date</th>
                            <th className="p-1.5 border border-black w-32">Invoice Ref #</th>
                            <th className="p-1.5 border border-black">Sales Officer</th>
                            <th className="p-1.5 border border-black">Narration / Event Details</th>
                            <th className="p-1.5 border border-black text-right w-28">Invoice Amount (PKR)</th>
                            <th className="p-1.5 border border-black text-right w-24 text-rose-700">Redeemed (-)</th>
                            <th className="p-1.5 border border-black text-right w-24 text-emerald-700">Earned (+)</th>
                            <th className="p-1.5 border border-black text-right w-28 pr-3">Balance (Pts)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cust.transactions || []).map((tx: any, tIdx: number) => (
                            <tr key={tIdx} className="border-b border-gray-300 hover:bg-gray-50 font-mono text-xs">
                              <td className="p-1.5 border border-black text-center text-gray-500">{tIdx + 1}</td>
                              <td className="p-1.5 border border-black text-center text-gray-700">{tx.date}</td>
                              <td className="p-1.5 border border-black font-black text-primary uppercase">{tx.invoice_no}</td>
                              <td className="p-1.5 border border-black font-sans text-gray-600">{tx.salesman}</td>
                              <td className="p-1.5 border border-black font-sans text-gray-700">{tx.narration}</td>
                              <td className="p-1.5 border border-black text-right font-bold text-gray-900">
                                Rs. {Number(tx.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-1.5 border border-black text-right text-rose-700 font-bold">
                                {Number(tx.debit_points || 0) > 0 ? `-${Number(tx.debit_points).toFixed(2)}` : '0.00'}
                              </td>
                              <td className="p-1.5 border border-black text-right text-emerald-700 font-bold">
                                +{Number(tx.credit_points || 0).toFixed(2)}
                              </td>
                              <td className="p-1.5 border border-black text-right pr-3 font-black text-slate-900">
                                {Number(tx.balance || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                            <td colSpan={5} className="p-1.5 border border-black text-right uppercase tracking-wider text-gray-600">
                              Subtotal ({cust.customer_name}):
                            </td>
                            <td className="p-1.5 border border-black text-right text-black font-black">
                              Rs. {custTotalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-1.5 border border-black text-right text-rose-700 font-black">
                              {custTotalRedeemed > 0 ? `-${custTotalRedeemed.toFixed(2)}` : '0.00'}
                            </td>
                            <td className="p-1.5 border border-black text-right text-emerald-700 font-black">
                              +{custTotalEarned.toFixed(2)}
                            </td>
                            <td className="p-1.5 border border-black text-right pr-3 text-purple-900 font-black">
                              {custNetBalance.toFixed(2)} Pts
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })
              )}

              {/* Grand Summary Across All Loyalty Customers */}
              {reportRows.length > 0 && (
                <div className="space-y-2">
                  {!isPrinting && pageSize !== 'all' && (
                    <div className="bg-amber-50/80 p-3 rounded border border-amber-300 flex justify-between items-center font-mono font-bold text-xs text-amber-950">
                      <span className="uppercase text-amber-900">
                        Page {currentPage} Subtotal ({displayedRows.length} Customers On This Page):
                      </span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-800">Sales: Rs. {displayedRows.reduce((s: number, c: any) => s + Number(c.total_sales_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-emerald-800">Earned: +{displayedRows.reduce((s: number, c: any) => s + Number(c.total_earned || 0), 0).toFixed(2)}</span>
                        <span className="text-rose-800">Redeemed: -{displayedRows.reduce((s: number, c: any) => s + Number(c.total_redeemed || 0), 0).toFixed(2)}</span>
                        <span className="text-purple-900 font-black">Page Balance: {displayedRows.reduce((s: number, c: any) => s + Number(c.net_balance || 0), 0).toFixed(2)} Pts</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-100 p-3.5 rounded border-2 border-black flex justify-between items-center font-mono font-black text-xs">
                    <span className="uppercase text-gray-900">
                      Grand Total Loyalty Accrual Summary (All {reportRows.length} Customers):
                    </span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-black">Sales: Rs. {reportRows.reduce((s: number, c: any) => s + Number(c.total_sales_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className="text-emerald-700">Earned: +{reportRows.reduce((s: number, c: any) => s + Number(c.total_earned || 0), 0).toFixed(2)}</span>
                      <span className="text-rose-700">Redeemed: -{reportRows.reduce((s: number, c: any) => s + Number(c.total_redeemed || 0), 0).toFixed(2)}</span>
                      <span className="text-purple-800 text-sm underline decoration-double">
                        Grand Balance: {reportRows.reduce((s: number, c: any) => s + Number(c.net_balance || 0), 0).toFixed(2)} Pts
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : rType === 'customer-sales' ? (
            activeViewMode === 'summary' ? (
              // ── 📊 SUMMARY VIEW TABLE (1 ROW / CUSTOMER) ──
              <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                    <th className="p-1.5 border border-black text-center w-10">S#</th>
                    <th className="p-1.5 border border-black">Customer / Purchasing Account</th>
                    <th className="p-1.5 border border-black text-center w-28">Invoices Booked</th>
                    <th className="p-1.5 border border-black text-right w-32">Total Units Sold</th>
                    <th className="p-1.5 border border-black text-right w-36">Cash Sales (PKR)</th>
                    <th className="p-1.5 border border-black text-right w-36">Credit Sales (PKR)</th>
                    <th className="p-1.5 border border-black text-right w-40">Total Revenue (PKR)</th>
                    <th className="p-1.5 border border-black text-center w-24">% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                        No customer sales breakdown records discovered matching chosen selection criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((cust, idx) => {
                      const realIndex = isPrinting || pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
                      return (
                        <tr key={idx} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                          <td className="p-1.5 border border-black text-center text-gray-600">{realIndex}</td>
                          <td className="p-1.5 border border-black font-sans font-bold text-black">{cust.customer_name}</td>
                          <td className="p-1.5 border border-black text-center font-bold text-indigo-700">{cust.invoices_count}</td>
                          <td className="p-1.5 border border-black text-right font-bold text-emerald-700">
                            {Number(cust.total_units || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 border border-black text-right text-emerald-700 font-bold">
                            Rs. {Number(cust.cash_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-right text-blue-700 font-bold">
                            Rs. {Number(cust.credit_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-right text-purple-800 font-black">
                            Rs. {Number(cust.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-center text-slate-800 font-bold">
                            {Number(cust.contribution_pct || 0).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  {/* 📄 Page Subtotal Row */}
                  {!isPrinting && pageSize !== 'all' && (
                    <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                      <td colSpan={2} className="p-2 border border-black text-right uppercase tracking-wider text-amber-900">
                        Page {currentPage} Subtotal ({displayedRows.length} Customers):
                      </td>
                      <td className="p-2 border border-black text-center text-indigo-900 font-bold">
                        {displayedRows.reduce((sum, r) => sum + Number(r.invoices_count || 0), 0)}
                      </td>
                      <td className="p-2 border border-black text-right text-emerald-800 font-bold whitespace-nowrap">
                        {displayedRows.reduce((sum, r) => sum + Number(r.total_units || 0), 0).toLocaleString()}
                      </td>
                      <td className="p-2 border border-black text-right text-emerald-800 font-bold whitespace-nowrap">
                        Rs. {displayedRows.reduce((sum, r) => sum + Number(r.cash_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-right text-blue-800 font-bold whitespace-nowrap">
                        Rs. {displayedRows.reduce((sum, r) => sum + Number(r.credit_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-right text-purple-900 font-black whitespace-nowrap">
                        Rs. {displayedRows.reduce((sum, r) => sum + Number(r.total_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-center text-[10px] font-bold text-amber-800">
                        {displayedRows.reduce((sum, r) => sum + Number(r.contribution_pct || 0), 0).toFixed(1)}%
                      </td>
                    </tr>
                  )}
                  {/* 📊 Overall Grand Totals Row */}
                  <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                    <td colSpan={2} className="p-2 border border-black text-right uppercase tracking-wider text-gray-900">
                      Grand Total Summary (All {reportRows.length} Customers):
                    </td>
                    <td className="p-2 border border-black text-center text-indigo-900">
                      {totalInvoicesCount}
                    </td>
                    <td className="p-2 border border-black text-right text-emerald-800 font-bold whitespace-nowrap">
                      {totalSoldUnits.toLocaleString()}
                    </td>
                    <td className="p-2 border border-black text-right text-emerald-800 whitespace-nowrap">
                      Rs. {cashAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-right text-blue-800 whitespace-nowrap">
                      Rs. {creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-right text-purple-900 text-sm font-black underline decoration-double whitespace-nowrap">
                      Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-center text-[10px] text-gray-600">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              // ── 📑 DETAILED VIEW TABLE (GROUPED CUSTOMER INVOICE BREAKDOWN) ──
              <div className="space-y-6">
                {displayedRows.length === 0 ? (
                  <div className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                    No customer sales breakdown records discovered matching chosen selection criteria.
                  </div>
                ) : (
                  displayedRows.map((cust: any, cIdx: number) => {
                    const realCustomerNum = isPrinting || pageSize === 'all' ? cIdx + 1 : (currentPage - 1) * (pageSize as number) + cIdx + 1;
                    const custTotalAmount = Number(cust.total_sales || 0);
                    const custCashAmount = Number(cust.cash_sales || 0);
                    const custCreditAmount = Number(cust.credit_sales || 0);
                    const custTotalUnits = Number(cust.total_units || 0);

                    return (
                      <div key={cIdx} className="border border-black rounded-xs overflow-hidden break-inside-avoid shadow-xs">
                        {/* 👤 Customer Header Banner */}
                        <div className="bg-slate-800 text-white p-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-emerald-500 text-black px-2 py-0.5 rounded font-black text-[10px]">#{realCustomerNum}</span>
                            <span className="font-bold font-sans text-sm tracking-wide uppercase text-white">{cust.customer_name}</span>
                            <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px]">Invoices: {cust.invoices_count}</span>
                            <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px]">Volume: {custTotalUnits.toLocaleString()} Units</span>
                            <span className="text-slate-400 text-[10px]">Share: {Number(cust.contribution_pct || 0).toFixed(1)}%</span>
                          </div>
                          <div className="text-right text-[11px] font-black font-mono flex items-center gap-3">
                            <span className="text-emerald-400">Cash: Rs. {custCashAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-slate-500">|</span>
                            <span className="text-blue-400">Credit: Rs. {custCreditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-slate-500">|</span>
                            <span className="text-purple-300 font-extrabold underline decoration-double">Total: Rs. {custTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Customer Transactions Sub-table */}
                        <table className="w-full table-auto border-collapse text-[11px] font-sans text-left">
                          <thead>
                            <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[9.5px]">
                              <th className="p-1.5 border border-black text-center w-10">S#</th>
                              <th className="p-1.5 border border-black text-center w-24">Date</th>
                              <th className="p-1.5 border border-black w-28">Invoice #</th>
                              <th className="p-1.5 border border-black">Sales Officer</th>
                              <th className="p-1.5 border border-black">Product Line Items</th>
                              <th className="p-1.5 border border-black text-center w-20">Term</th>
                              <th className="p-1.5 border border-black w-28">Carrier Fleet</th>
                              <th className="p-1.5 border border-black text-right w-28 pr-3">Net Amount (PKR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(cust.transactions || []).map((row: any, tIdx: number) => {
                              const displayDocPrefixId = row.invoice_no || `INV-${String(row.id).padStart(4, '0')}`;
                              const processingDateDisplay = row.sale_date || String(row.created_at || '').split('T')[0];
                              const itemDetails = extractItemDetails(row);
                              const itemNames = extractItemNames(row);
                              const isCash = String(row.payment_term || '').toLowerCase() === 'cash';

                              return (
                                <tr key={tIdx} className="border-b border-gray-300 hover:bg-gray-50 font-mono text-xs">
                                  <td className="p-1.5 border border-black text-center text-gray-500 align-top">{tIdx + 1}</td>
                                  <td className="p-1.5 border border-black text-center text-gray-700 align-top">{processingDateDisplay}</td>
                                  <td className="p-1.5 border border-black font-black text-primary uppercase align-top">{displayDocPrefixId}</td>
                                  <td className="p-1.5 border border-black font-sans font-medium text-black align-top">{row.salesman || 'Direct'}</td>
                                  <td className="p-1.5 border border-black font-sans text-gray-800 text-[11px] align-top">
                                    {itemDetails.length > 0 ? (
                                      <div className="flex flex-col gap-1 py-0.5">
                                        {itemDetails.map((item, idx) => (
                                          <div key={idx} className="flex items-center text-[11px] whitespace-nowrap">
                                            <span className="font-semibold text-black">{item.name}</span>
                                            <span className="text-emerald-700 font-black text-sm px-1.5 font-mono">|</span>
                                            <span className="text-emerald-900 font-mono font-bold">{item.qty} {item.uom}</span>
                                            <span className="text-emerald-700 font-black text-sm px-1.5 font-mono">|</span>
                                            <span className="text-gray-900 font-mono font-bold">@ Rs. {Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : itemNames.length > 0 ? (
                                      itemNames.map((name: string, i: number) => (
                                        <React.Fragment key={i}>
                                          {i > 0 && <span className="text-emerald-700 font-black text-sm px-1.5 font-mono">|</span>}
                                          <span>{name}</span>
                                        </React.Fragment>
                                      ))
                                    ) : (
                                      <span className="text-gray-400 italic">No Items</span>
                                    )}
                                  </td>
                                  <td className="p-1.5 border border-black text-center align-top">
                                    <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                                      isCash ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                                    }`}>
                                      {row.payment_term || 'Credit'}
                                    </span>
                                  </td>
                                  <td className="p-1.5 border border-black font-sans text-purple-700 font-bold align-top">{row.transport_name || 'Self Pick'}</td>
                                  <td className="p-1.5 border border-black text-right pr-3 font-black text-emerald-700 align-top">
                                    Rs. {Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                              <td colSpan={4} className="p-1.5 border border-black text-right uppercase tracking-wider text-gray-600">
                                Subtotal ({cust.customer_name} - {cust.invoices_count} Invoices):
                              </td>
                              <td className="p-1.5 border border-black text-center font-bold text-emerald-800">
                                Total Units: {custTotalUnits.toLocaleString()}
                              </td>
                              <td colSpan={2} className="p-1.5 border border-black text-right text-[10px] font-bold text-gray-700">
                                Cash: Rs. {custCashAmount.toLocaleString()} | Credit: Rs. {custCreditAmount.toLocaleString()}
                              </td>
                              <td className="p-1.5 border border-black text-right pr-3 text-purple-900 font-black">
                                Rs. {custTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })
                )}

                {/* Grand Summary Across All Customers */}
                {reportRows.length > 0 && (
                  <div className="space-y-2">
                    {!isPrinting && pageSize !== 'all' && (
                      <div className="bg-amber-50/80 p-3 rounded border border-amber-300 flex justify-between items-center font-mono font-bold text-xs text-amber-950">
                        <span className="uppercase text-amber-900">
                          Page {currentPage} Subtotal ({displayedRows.length} Customers On This Page):
                        </span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-indigo-900">Invoices: {displayedRows.reduce((s: number, r: any) => s + Number(r.invoices_count || 0), 0)}</span>
                          <span className="text-emerald-800 font-bold">Units: {displayedRows.reduce((s: number, r: any) => s + Number(r.total_units || 0), 0).toLocaleString()}</span>
                          <span className="text-emerald-800">Cash: Rs. {displayedRows.reduce((s: number, r: any) => s + Number(r.cash_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className="text-blue-800">Credit: Rs. {displayedRows.reduce((s: number, r: any) => s + Number(r.credit_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className="text-purple-900 font-black">Page Total: Rs. {displayedRows.reduce((s: number, r: any) => s + Number(r.total_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-100 p-3.5 rounded border-2 border-black flex justify-between items-center font-mono font-black text-xs">
                      <span className="uppercase text-gray-900">
                        Grand Total Customer Breakdown Summary (All {reportRows.length} Customers):
                      </span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-indigo-900">Total Invoices: {totalInvoicesCount}</span>
                        <span className="text-emerald-800 font-bold">Total Volume: {totalSoldUnits.toLocaleString()} Units</span>
                        <span className="text-emerald-700">Cash: Rs. {cashAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-blue-700">Credit: Rs. {creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-purple-800 text-sm underline decoration-double">
                          Grand Revenue: Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : rType === 'sale' ? (
            activeViewMode === 'summary' ? (
              // ── 📊 SUMMARY VIEW TABLE (1 ROW / SALESMAN) ──
              <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                    <th className="p-1.5 border border-black text-center w-10">S#</th>
                    <th className="p-1.5 border border-black">Sales Officer / Salesman Name</th>
                    <th className="p-1.5 border border-black text-center">Invoices Booked</th>
                    <th className="p-1.5 border border-black text-center">Unique Clients</th>
                    <th className="p-1.5 border border-black text-right">Cash Sales (PKR)</th>
                    <th className="p-1.5 border border-black text-right">Credit Sales (PKR)</th>
                    <th className="p-1.5 border border-black text-right">Total Revenue (PKR)</th>
                    <th className="p-1.5 border border-black text-center w-24">% Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                        No commercial sales records discovered matching chosen selection criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((sm, idx) => {
                      const realIndex = isPrinting || pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
                      return (
                        <tr key={idx} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                          <td className="p-1.5 border border-black text-center text-gray-600">{realIndex}</td>
                          <td className="p-1.5 border border-black font-sans font-bold text-black">{sm.salesman}</td>
                          <td className="p-1.5 border border-black text-center font-bold text-indigo-700">{sm.invoices_count}</td>
                          <td className="p-1.5 border border-black text-center text-gray-700 font-bold">{sm.unique_customers_count}</td>
                          <td className="p-1.5 border border-black text-right text-emerald-700 font-bold">
                            Rs. {Number(sm.cash_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-right text-blue-700 font-bold">
                            Rs. {Number(sm.credit_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-right text-purple-800 font-black">
                            Rs. {Number(sm.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-center text-slate-800 font-bold">
                            {Number(sm.contribution_pct || 0).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  {/* 📄 Page Subtotal Row */}
                  {!isPrinting && pageSize !== 'all' && (
                    <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                      <td colSpan={2} className="p-2 border border-black text-right uppercase tracking-wider text-amber-900">
                        Page {currentPage} Subtotal ({displayedRows.length} Sales Officers):
                      </td>
                      <td className="p-2 border border-black text-center text-indigo-900 font-bold">
                        {displayedRows.reduce((sum, r) => sum + Number(r.invoices_count || 0), 0)}
                      </td>
                      <td className="p-2 border border-black text-center text-gray-700 font-bold">
                        {displayedRows.reduce((sum, r) => sum + Number(r.unique_customers_count || 0), 0)}
                      </td>
                      <td className="p-2 border border-black text-right text-emerald-800 font-bold whitespace-nowrap">
                        Rs. {displayedRows.reduce((sum, r) => sum + Number(r.cash_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-right text-blue-800 font-bold whitespace-nowrap">
                        Rs. {displayedRows.reduce((sum, r) => sum + Number(r.credit_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-right text-purple-900 font-black whitespace-nowrap">
                        Rs. {displayedRows.reduce((sum, r) => sum + Number(r.total_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-center text-[10px] font-bold text-amber-800">
                        {displayedRows.reduce((sum, r) => sum + Number(r.contribution_pct || 0), 0).toFixed(1)}%
                      </td>
                    </tr>
                  )}
                  {/* 📊 Overall Grand Totals Row */}
                  <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                    <td colSpan={2} className="p-2 border border-black text-right uppercase tracking-wider text-gray-900">
                      Grand Total Summary (All {reportRows.length} Sales Officers):
                    </td>
                    <td className="p-2 border border-black text-center text-indigo-900">
                      {totalInvoicesCount}
                    </td>
                    <td className="p-2 border border-black text-center text-gray-800">
                      {reportRows.reduce((sum, r) => sum + Number(r.unique_customers_count || 0), 0)}
                    </td>
                    <td className="p-2 border border-black text-right text-emerald-800 whitespace-nowrap">
                      Rs. {cashAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-right text-blue-800 whitespace-nowrap">
                      Rs. {creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-right text-purple-900 text-sm font-black underline decoration-double whitespace-nowrap">
                      Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-center text-[10px] text-gray-600">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              // ── 📑 DETAILED VIEW TABLE (GROUPED SALESMAN INVOICE BREAKDOWN) ──
              <div className="space-y-6">
                {displayedRows.length === 0 ? (
                  <div className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                    No commercial sales records discovered matching chosen selection criteria.
                  </div>
                ) : (
                  displayedRows.map((sm: any, sIdx: number) => {
                    const realSalesmanNum = isPrinting || pageSize === 'all' ? sIdx + 1 : (currentPage - 1) * (pageSize as number) + sIdx + 1;
                    const smTotalAmount = Number(sm.total_sales || 0);
                    const smCashAmount = Number(sm.cash_sales || 0);
                    const smCreditAmount = Number(sm.credit_sales || 0);

                    return (
                      <div key={sIdx} className="border border-black rounded-xs overflow-hidden break-inside-avoid shadow-xs">
                        {/* 👔 Salesman Header Banner */}
                        <div className="bg-slate-800 text-white p-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-emerald-500 text-black px-2 py-0.5 rounded font-black text-[10px]">#{realSalesmanNum}</span>
                            <span className="font-bold font-sans text-sm tracking-wide uppercase text-white">{sm.salesman}</span>
                            <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px]">Invoices: {sm.invoices_count}</span>
                            <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px]">Unique Clients: {sm.unique_customers_count}</span>
                            <span className="text-slate-400 text-[10px]">Share: {Number(sm.contribution_pct || 0).toFixed(1)}%</span>
                          </div>
                          <div className="text-right text-[11px] font-black font-mono flex items-center gap-3">
                            <span className="text-emerald-400">Cash: Rs. {smCashAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-slate-500">|</span>
                            <span className="text-blue-400">Credit: Rs. {smCreditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-slate-500">|</span>
                            <span className="text-purple-300 font-extrabold underline decoration-double">Total: Rs. {smTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Salesman Transactions Sub-table */}
                        <table className="w-full table-auto border-collapse text-[11px] font-sans text-left">
                          <thead>
                            <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[9.5px]">
                              <th className="p-1.5 border border-black text-center w-10">S#</th>
                              <th className="p-1.5 border border-black text-center w-24">Date</th>
                              <th className="p-1.5 border border-black w-28">Invoice #</th>
                              <th className="p-1.5 border border-black">Customer Name</th>
                              <th className="p-1.5 border border-black">Products</th>
                              <th className="p-1.5 border border-black text-center w-20">Term</th>
                              <th className="p-1.5 border border-black w-28">Carrier Fleet</th>
                              <th className="p-1.5 border border-black text-right w-28 pr-3">Net Amount (PKR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(sm.transactions || []).map((row: any, tIdx: number) => {
                              const displayDocPrefixId = row.invoice_no || `INV-${String(row.id).padStart(4, '0')}`;
                              const processingDateDisplay = row.sale_date || String(row.created_at || '').split('T')[0];
                              const itemNames = extractItemNames(row);
                              const isCash = String(row.payment_term || '').toLowerCase() === 'cash';

                              return (
                                <tr key={tIdx} className="border-b border-gray-300 hover:bg-gray-50 font-mono text-xs">
                                  <td className="p-1.5 border border-black text-center text-gray-500">{tIdx + 1}</td>
                                  <td className="p-1.5 border border-black text-center text-gray-700">{processingDateDisplay}</td>
                                  <td className="p-1.5 border border-black font-black text-primary uppercase">{displayDocPrefixId}</td>
                                  <td className="p-1.5 border border-black font-sans font-medium text-black">{row.customer_name || 'Counter Retail Buyer'}</td>
                                  <td className="p-1.5 border border-black font-sans text-gray-800 text-[11px]">
                                    {itemNames.length > 0 ? (
                                      itemNames.map((name: string, i: number) => (
                                        <React.Fragment key={i}>
                                          {i > 0 && <span className="text-emerald-700 font-black text-sm px-1.5 font-mono">|</span>}
                                          <span>{name}</span>
                                        </React.Fragment>
                                      ))
                                    ) : (
                                      <span className="text-gray-400 italic">No Items</span>
                                    )}
                                  </td>
                                  <td className="p-1.5 border border-black text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                                      isCash ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                                    }`}>
                                      {row.payment_term || 'Credit'}
                                    </span>
                                  </td>
                                  <td className="p-1.5 border border-black font-sans text-purple-700 font-bold">{row.transport_name || 'Self Pick'}</td>
                                  <td className="p-1.5 border border-black text-right pr-3 font-black text-emerald-700">
                                    Rs. {Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                              <td colSpan={5} className="p-1.5 border border-black text-right uppercase tracking-wider text-gray-600">
                                Subtotal ({sm.salesman} - {sm.invoices_count} Invoices):
                              </td>
                              <td colSpan={2} className="p-1.5 border border-black text-right text-[10px] font-bold text-gray-700">
                                Cash: Rs. {smCashAmount.toLocaleString()} | Credit: Rs. {smCreditAmount.toLocaleString()}
                              </td>
                              <td className="p-1.5 border border-black text-right pr-3 text-purple-900 font-black">
                                Rs. {smTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })
                )}

                {/* Grand Summary Across All Salesmen */}
                {reportRows.length > 0 && (
                  <div className="space-y-2">
                    {!isPrinting && pageSize !== 'all' && (
                      <div className="bg-amber-50/80 p-3 rounded border border-amber-300 flex justify-between items-center font-mono font-bold text-xs text-amber-950">
                        <span className="uppercase text-amber-900">
                          Page {currentPage} Subtotal ({displayedRows.length} Sales Officers On This Page):
                        </span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-indigo-900">Invoices: {displayedRows.reduce((s: number, r: any) => s + Number(r.invoices_count || 0), 0)}</span>
                          <span className="text-emerald-800">Cash: Rs. {displayedRows.reduce((s: number, r: any) => s + Number(r.cash_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className="text-blue-800">Credit: Rs. {displayedRows.reduce((s: number, r: any) => s + Number(r.credit_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className="text-purple-900 font-black">Page Total: Rs. {displayedRows.reduce((s: number, r: any) => s + Number(r.total_sales || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-100 p-3.5 rounded border-2 border-black flex justify-between items-center font-mono font-black text-xs">
                      <span className="uppercase text-gray-900">
                        Grand Total Commercial Sales Summary (All {reportRows.length} Sales Officers):
                      </span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-indigo-900">Total Invoices: {totalInvoicesCount}</span>
                        <span className="text-emerald-700">Cash: Rs. {cashAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-blue-700">Credit: Rs. {creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-purple-800 text-sm underline decoration-double">
                          Grand Revenue: Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : rType === 'return' ? (
            activeViewMode === 'summary' ? (
              // ── 📊 SUMMARY VIEW TABLE (1 ROW / CUSTOMER) ──
              <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                    <th className="p-1.5 border border-black text-center w-10">S#</th>
                    <th className="p-1.5 border border-black">Customer / Client Name</th>
                    <th className="p-1.5 border border-black text-center w-36">Return Notes Booked</th>
                    <th className="p-1.5 border border-black text-right w-36">Total Returned Units</th>
                    <th className="p-1.5 border border-black text-right w-44">Total Credit Adjusted (PKR)</th>
                    <th className="p-1.5 border border-black text-center w-28">% Share of Returns</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                        No sales return records discovered matching chosen selection criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((cust, idx) => {
                      const realIndex = isPrinting || pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
                      return (
                        <tr key={idx} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                          <td className="p-1.5 border border-black text-center text-gray-600">{realIndex}</td>
                          <td className="p-1.5 border border-black font-sans font-bold text-black">{cust.customer_name}</td>
                          <td className="p-1.5 border border-black text-center font-bold text-indigo-700">{cust.returns_count}</td>
                          <td className="p-1.5 border border-black text-right font-bold text-rose-700">
                            {Number(cust.total_returned_qty || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 border border-black text-right text-purple-800 font-black">
                            Rs. {Number(cust.total_return_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 border border-black text-center text-slate-800 font-bold">
                            {Number(cust.contribution_pct || 0).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  {/* 📄 Page Subtotal Row */}
                  {!isPrinting && pageSize !== 'all' && (
                    <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                      <td colSpan={2} className="p-2 border border-black text-right uppercase tracking-wider text-amber-900">
                        Page {currentPage} Subtotal ({displayedRows.length} Customers):
                      </td>
                      <td className="p-2 border border-black text-center text-indigo-900 font-bold">
                        {displayedRows.reduce((sum, r) => sum + Number(r.returns_count || 0), 0)}
                      </td>
                      <td className="p-2 border border-black text-right text-rose-800 font-bold whitespace-nowrap">
                        {displayedRows.reduce((sum, r) => sum + Number(r.total_returned_qty || 0), 0).toLocaleString()}
                      </td>
                      <td className="p-2 border border-black text-right text-purple-900 font-black whitespace-nowrap">
                        Rs. {displayedRows.reduce((sum, r) => sum + Number(r.total_return_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 border border-black text-center text-[10px] font-bold text-amber-800">
                        {displayedRows.reduce((sum, r) => sum + Number(r.contribution_pct || 0), 0).toFixed(1)}%
                      </td>
                    </tr>
                  )}
                  {/* 📊 Overall Grand Totals Row */}
                  <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                    <td colSpan={2} className="p-2 border border-black text-right uppercase tracking-wider text-gray-900">
                      Grand Total Summary (All {reportRows.length} Customers):
                    </td>
                    <td className="p-2 border border-black text-center text-indigo-900">
                      {totalInvoicesCount}
                    </td>
                    <td className="p-2 border border-black text-right text-rose-800 font-bold whitespace-nowrap">
                      {totalReturnedUnits.toLocaleString()}
                    </td>
                    <td className="p-2 border border-black text-right text-purple-900 text-sm font-black underline decoration-double whitespace-nowrap">
                      Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-center text-[10px] text-gray-600">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              // ── 📑 DETAILED VIEW TABLE (GROUPED CUSTOMER RETURN BREAKDOWN) ──
              <div className="space-y-6">
                {displayedRows.length === 0 ? (
                  <div className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                    No sales return records discovered matching chosen selection criteria.
                  </div>
                ) : (
                  displayedRows.map((cust: any, cIdx: number) => {
                    const realCustomerNum = isPrinting || pageSize === 'all' ? cIdx + 1 : (currentPage - 1) * (pageSize as number) + cIdx + 1;
                    const custTotalAmount = Number(cust.total_return_amount || 0);
                    const custTotalUnits = Number(cust.total_returned_qty || 0);

                    return (
                      <div key={cIdx} className="border border-black rounded-xs overflow-hidden break-inside-avoid shadow-xs">
                        {/* 👤 Customer Header Banner */}
                        <div className="bg-slate-800 text-white p-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-rose-500 text-white px-2 py-0.5 rounded font-black text-[10px]">#{realCustomerNum}</span>
                            <span className="font-bold font-sans text-sm tracking-wide uppercase text-white">{cust.customer_name}</span>
                            <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px]">Return Notes: {cust.returns_count}</span>
                            <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px]">Units Returned: {custTotalUnits.toLocaleString()}</span>
                            <span className="text-slate-400 text-[10px]">Share: {Number(cust.contribution_pct || 0).toFixed(1)}%</span>
                          </div>
                          <div className="text-right text-[11px] font-black font-mono flex items-center gap-3">
                            <span className="text-purple-300 font-extrabold underline decoration-double">
                              Total Credit Adjusted: Rs. {custTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Customer Return Transactions Sub-table */}
                        <table className="w-full table-auto border-collapse text-[11px] font-sans text-left">
                          <thead>
                            <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[9.5px]">
                              <th className="p-1.5 border border-black text-center w-10">S#</th>
                              <th className="p-1.5 border border-black text-center w-24">Date</th>
                              <th className="p-1.5 border border-black w-28">Return Ref #</th>
                              <th className="p-1.5 border border-black w-28">Original Inv #</th>
                              <th className="p-1.5 border border-black">Sales Officer</th>
                              <th className="p-1.5 border border-black">Returned Line Items</th>
                              <th className="p-1.5 border border-black w-28">Restocked Warehouse</th>
                              <th className="p-1.5 border border-black w-28">Reason / Remarks</th>
                              <th className="p-1.5 border border-black text-right w-28 pr-3">Credit Amount (PKR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(cust.transactions || []).map((row: any, tIdx: number) => {
                              const displayDocPrefixId = row.return_no || `RTN-${String(row.id).padStart(4, '0')}`;
                              const processingDateDisplay = row.return_date || String(row.created_at || '').split('T')[0];
                              const originalInvDisplay = row.original_invoice_no || '-';
                              const itemDetails = extractItemDetails(row);
                              const itemNames = extractItemNames(row);

                              return (
                                <tr key={tIdx} className="border-b border-gray-300 hover:bg-gray-50 font-mono text-xs">
                                  <td className="p-1.5 border border-black text-center text-gray-500 align-top">{tIdx + 1}</td>
                                  <td className="p-1.5 border border-black text-center text-gray-700 align-top">{processingDateDisplay}</td>
                                  <td className="p-1.5 border border-black font-black text-rose-700 uppercase align-top">{displayDocPrefixId}</td>
                                  <td className="p-1.5 border border-black font-bold text-primary uppercase align-top">{originalInvDisplay}</td>
                                  <td className="p-1.5 border border-black font-sans font-medium text-black align-top">{row.salesman || 'Direct'}</td>
                                  <td className="p-1.5 border border-black font-sans text-gray-800 text-[11px] align-top">
                                    {itemDetails.length > 0 ? (
                                      <div className="flex flex-col gap-1 py-0.5">
                                        {itemDetails.map((item, idx) => (
                                          <div key={idx} className="flex items-center text-[11px] whitespace-nowrap">
                                            <span className="font-semibold text-black">{item.name}</span>
                                            <span className="text-rose-700 font-black text-sm px-1.5 font-mono">|</span>
                                            <span className="text-rose-900 font-mono font-bold">{item.qty} {item.uom}</span>
                                            <span className="text-rose-700 font-black text-sm px-1.5 font-mono">|</span>
                                            <span className="text-gray-900 font-mono font-bold">@ Rs. {Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : itemNames.length > 0 ? (
                                      itemNames.map((name: string, i: number) => (
                                        <React.Fragment key={i}>
                                          {i > 0 && <span className="text-rose-700 font-black text-sm px-1.5 font-mono">|</span>}
                                          <span>{name}</span>
                                        </React.Fragment>
                                      ))
                                    ) : (
                                      <span className="text-gray-400 italic">No Items Listed</span>
                                    )}
                                  </td>
                                  <td className="p-1.5 border border-black font-sans text-gray-700 align-top">{row.dispatch_warehouse || row.location || 'Main Warehouse'}</td>
                                  <td className="p-1.5 border border-black font-sans text-gray-600 text-[10px] align-top">{row.reason || row.remarks || 'Standard Return'}</td>
                                  <td className="p-1.5 border border-black text-right pr-3 font-black text-purple-900 align-top">
                                    Rs. {Number(row.return_amount || row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                              <td colSpan={5} className="p-1.5 border border-black text-right uppercase tracking-wider text-gray-600">
                                Subtotal ({cust.customer_name} - {cust.returns_count} Return Notes):
                              </td>
                              <td colSpan={3} className="p-1.5 border border-black text-right text-[10px] font-bold text-rose-800">
                                Units Returned: {custTotalUnits.toLocaleString()}
                              </td>
                              <td className="p-1.5 border border-black text-right pr-3 text-purple-900 font-black">
                                Rs. {custTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })
                )}

                {/* Grand Summary Across All Customers */}
                {reportRows.length > 0 && (
                  <div className="space-y-2">
                    {!isPrinting && pageSize !== 'all' && (
                      <div className="bg-amber-50/80 p-3 rounded border border-amber-300 flex justify-between items-center font-mono font-bold text-xs text-amber-950">
                        <span className="uppercase text-amber-900">
                          Page {currentPage} Subtotal ({displayedRows.length} Customers On This Page):
                        </span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-indigo-900">Return Notes: {displayedRows.reduce((s: number, r: any) => s + Number(r.returns_count || 0), 0)}</span>
                          <span className="text-rose-800 font-bold">Units Returned: {displayedRows.reduce((s: number, r: any) => s + Number(r.total_returned_qty || 0), 0).toLocaleString()}</span>
                          <span className="text-purple-900 font-black">Page Credit Total: Rs. {displayedRows.reduce((s: number, r: any) => s + Number(r.total_return_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-100 p-3.5 rounded border-2 border-black flex justify-between items-center font-mono font-black text-xs">
                      <span className="uppercase text-gray-900">
                        Grand Total Customer Return Breakdown Summary (All {reportRows.length} Customers):
                      </span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-indigo-900">Total Return Notes: {totalInvoicesCount}</span>
                        <span className="text-rose-800 font-bold">Total Units Returned: {totalReturnedUnits.toLocaleString()}</span>
                        <span className="text-purple-800 text-sm underline decoration-double">
                          Grand Credit Adjusted: Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : rType === 'sales-query' ? (
            // ── 📊 SALES PARAMETER MULTI-CRITERIA REGISTER (10-COLUMN FLAT AUDIT) ──
            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[9.5px]">
                  <th className="p-1.5 border border-black text-center w-10">S#</th>
                  <th className="p-1.5 border border-black text-center w-24">Date</th>
                  <th className="p-1.5 border border-black w-28">Invoice #</th>
                  <th className="p-1.5 border border-black">Customer Name</th>
                  <th className="p-1.5 border border-black">Sales Officer</th>
                  <th className="p-1.5 border border-black w-24">Carrier</th>
                  <th className="p-1.5 border border-black">Product Items</th>
                  <th className="p-1.5 border border-black w-24">Warehouse</th>
                  <th className="p-1.5 border border-black text-center w-16">Term</th>
                  <th className="p-1.5 border border-black text-right pr-3 w-28">Matrix Gross</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                      No sales parameter records discovered matching chosen multi-criteria query parameters.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row, idx) => {
                    const realIndex = isPrinting || pageSize === 'all' ? idx + 1 : (currentPage - 1) * (pageSize as number) + idx + 1;
                    const displayDocPrefixId = row.invoice_no || `INV-${String(row.id).padStart(4, '0')}`;
                    const processingDateDisplay = row.sale_date || String(row.created_at || '').split('T')[0];
                    const itemNames = extractItemNames(row);
                    const isCash = String(row.payment_term || '').toLowerCase() === 'cash';

                    return (
                      <tr key={row.id || idx} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                        <td className="p-1.5 border border-black text-center text-gray-600 align-top">{realIndex}</td>
                        <td className="p-1.5 border border-black text-center text-gray-700 align-top">{processingDateDisplay}</td>
                        <td className="p-1.5 border border-black font-black text-primary uppercase whitespace-nowrap align-top">{displayDocPrefixId}</td>
                        <td className="p-1.5 border border-black font-sans font-medium text-black align-top">{row.customer_name || 'Counter Retail Buyer'}</td>
                        <td className="p-1.5 border border-black font-sans text-gray-700 align-top">{row.salesman || 'Direct'}</td>
                        <td className="p-1.5 border border-black font-sans text-purple-700 font-bold align-top">{row.transport_name || 'Self Pick'}</td>
                        <td className="p-1.5 border border-black font-sans text-gray-800 text-[11px] align-top">
                          {itemNames.length > 0 ? (
                            itemNames.map((name: string, i: number) => (
                              <React.Fragment key={i}>
                                {i > 0 && <span className="text-emerald-700 font-black text-sm px-1.5 font-mono">|</span>}
                                <span>{name}</span>
                              </React.Fragment>
                            ))
                          ) : (
                            <span className="text-gray-400 italic">No Items</span>
                          )}
                        </td>
                        <td className="p-1.5 border border-black font-sans text-gray-600 align-top">{row.dispatch_warehouse || 'Main Warehouse'}</td>
                        <td className="p-1.5 border border-black text-center align-top">
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                            isCash ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}>
                            {row.payment_term || 'Credit'}
                          </span>
                        </td>
                        <td className="p-1.5 border border-black text-right pr-3 font-black text-emerald-700 whitespace-nowrap align-top">
                          Rs. {Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                {/* 📄 Page Subtotal Row */}
                {!isPrinting && pageSize !== 'all' && (
                  <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                    <td colSpan={9} className="p-2 border border-black text-right uppercase tracking-wider text-amber-900">
                      Page {currentPage} Subtotal ({displayedRows.length} transactions):
                    </td>
                    <td className="p-2 border border-black text-right pr-3 text-emerald-800 font-bold whitespace-nowrap">
                      Rs. {displayedRows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {/* 📊 Overall Grand Totals Row */}
                <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                  <td colSpan={9} className="p-2 border border-black text-right uppercase tracking-wider text-gray-900">
                    Grand Total Summary (All {reportRows.length} Parameter Records):
                  </td>
                  <td className="p-2 border border-black text-right pr-3 text-success underline decoration-double text-sm whitespace-nowrap font-black">
                    Rs. {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                  <th className="p-1.5 border border-black text-center">Processing Date</th>
                  <th className="p-1.5 border border-black">Document Ref #</th>
                  <th className="p-1.5 border border-black">Product</th>
                  <th className="p-1.5 border border-black">Customer</th>
                  <th className="p-1.5 border border-black text-right pr-3">Gross Matrix Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                      No rows fetched matching the isolated active report criteria token keys.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row) => {
                    const displayDocPrefixId = row.invoice_no || (rType === 'return' ? `RTN-${String(row.id).padStart(4, '0')}` : `INV-${String(row.id).padStart(4, '0')}`);
                    const processingDateDisplay = row.sale_date || row.return_date || String(row.created_at || '').split('T')[0];
                    const itemNames = extractItemNames(row);
                    const itemDetails = extractItemDetails(row);

                    return (
                      <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                        <td className="p-1.5 border border-black text-center text-gray-600 align-top">{processingDateDisplay}</td>
                        <td className="p-1.5 border border-black text-primary font-black uppercase whitespace-nowrap align-top">{displayDocPrefixId}</td>
                        <td className="p-1.5 border border-black font-sans text-black text-[11px] align-top">
                          {rType === 'invoice' ? (
                            itemDetails.length > 0 ? (
                              <div className="flex flex-col gap-1 py-0.5">
                                {itemDetails.map((item, idx) => (
                                  <div key={idx} className="flex items-center text-[11px] whitespace-nowrap">
                                    <span className="font-semibold text-black">{item.name}</span>
                                    <span className="text-emerald-700 font-black text-sm px-1.5 font-mono">|</span>
                                    <span className="text-gray-700 font-mono font-bold">{item.qty} {item.uom}</span>
                                    <span className="text-emerald-700 font-black text-sm px-1.5 font-mono">|</span>
                                    <span className="text-gray-900 font-mono font-bold">Rs. {Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No Items</span>
                            )
                          ) : (
                            itemNames.length > 0 ? (
                              itemNames.map((name: string, i: number) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <span className="text-emerald-700 font-black text-sm px-1.5 font-mono">|</span>}
                                  <span className="font-medium">{name}</span>
                                </React.Fragment>
                              ))
                            ) : (
                              <span className="text-gray-400 italic">No Items</span>
                            )
                          )}
                        </td>
                        <td className="p-1.5 border border-black text-black font-sans align-top">{row.customer_name || 'Counter Retail Buyer'}</td>
                        <td className="p-1.5 border border-black text-right pr-3 text-success font-black whitespace-nowrap align-top">Rs. {Number(row.total_amount || row.return_amount || row.payout_amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                {/* 📄 Page Subtotal Row */}
                {!isPrinting && pageSize !== 'all' && (
                  <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                    <td colSpan={4} className="p-2 border border-black text-right uppercase tracking-wider text-amber-900">
                      Page {currentPage} Subtotal ({displayedRows.length} records):
                    </td>
                    <td className="p-2 border border-black text-right pr-3 text-emerald-800 font-bold whitespace-nowrap">
                      Rs. {displayedRows.reduce((sum, r) => sum + (Number(r.total_amount || r.return_amount || r.payout_amount_paid || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {/* 📊 Overall Grand Totals Row */}
                <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                  <td colSpan={4} className="p-2 border border-black text-right uppercase tracking-wider text-gray-900">
                    Grand Total Summary (All {reportRows.length} Records):
                  </td>
                  <td className="p-2 border border-black text-right pr-3 text-success underline decoration-double text-sm whitespace-nowrap">
                    Rs. {reportRows.reduce((sum, r) => sum + (Number(r.total_amount || r.return_amount || r.payout_amount_paid || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── BOTTOM PAGINATION CONTROL ── */}
        <ReportPagination
          currentPage={currentPage}
          totalItems={reportRows.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel={rType === 'product-sales-history' ? 'products' : (rType === 'loyalty' || rType === 'customer-sales' || rType === 'return') ? 'customers' : rType === 'sale' ? 'salesmen' : 'records'}
        />

        {/* ✍️ Formal Multi-Level Executive Verification & Signature Block */}
        <div className="mt-16 grid grid-cols-3 gap-10 text-center text-[10px] font-sans font-black uppercase tracking-wider text-slate-800 break-inside-avoid">
          <div className="flex flex-col justify-end">
            <div className="signature-spacer h-20 min-h-[80px]" style={{ height: '80px', minHeight: '80px' }}></div>
            <div className="border-t-2 border-black pt-2">
              <div className="text-black font-extrabold text-[10px]">PREPARED BY</div>
              <div className="text-[8.5px] font-semibold text-gray-500 normal-case">Sales Operations &amp; Audit Officer</div>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <div className="signature-spacer h-20 min-h-[80px]" style={{ height: '80px', minHeight: '80px' }}></div>
            <div className="border-t-2 border-black pt-2">
              <div className="text-black font-extrabold text-[10px]">VERIFIED BY</div>
              <div className="text-[8.5px] font-semibold text-gray-500 normal-case">Corporate Accounts Auditor &amp; Billing Lead</div>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <div className="signature-spacer h-20 min-h-[80px]" style={{ height: '80px', minHeight: '80px' }}></div>
            <div className="border-t-2 border-black pt-2">
              <div className="text-black font-extrabold text-[10px]">AUTHORIZED BY</div>
              <div className="text-[8.5px] font-semibold text-gray-500 normal-case">Managing Executive Director &amp; Official Seal</div>
            </div>
          </div>
        </div>

        {/* 🏢 Software & Corporate Provider Footer */}
        <div className="mt-8 pt-3 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-sans print:border-gray-400 break-inside-avoid">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-black font-black uppercase">ZOAIB ALI &amp; COMPANY</span>
          </div>
          <div className="text-[9.5px] text-gray-600 font-mono font-medium text-right">
            Software Solution &amp; Cloud Infrastructure by <b className="text-black font-bold">NHT ENTERPRISES (Noor Horizon Technologies)</b>
            <span className="text-gray-400 mx-1.5">•</span>
            <span>Contact: <b className="text-black font-bold">03128039911</b></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleReportPrint;
