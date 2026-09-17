import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdPrint, MdArrowBack, MdFileDownload, MdShare } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuth } from '../../../Context/Auth';
import { exportToExcel, ExcelColumn } from '../../../utils/excelExport';

const SaleReportPrint = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { businessName, tenantId } = useAuth();
  const [loading, setLoading] = useState(true);

  const [reportRows, setReportRows] = useState<any[]>([]);
  const [productUomMap, setProductUomMap] = useState<Record<string, string>>({});

  const config = location.state || { type: 'sale', filters: {} };
  const { type: rType, filters } = config;

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'NHT ENTERPRISES (Noor Horizon Technologies)';
    return () => {
      document.title = originalTitle;
    };
  }, []);

  useEffect(() => {
    const compileExcelStructuredDataset = async () => {
      try {
        setLoading(true);

        const { data: prodData } = await supabase.from('products').select('product_name, uom, category');
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

        if (rType === 'sale') {
          let query = supabase.from('sales_invoices').select('*');
          if (filters.customer && filters.customer.length > 0) query = query.in('customer_name', filters.customer);
          if (filters.salesman && filters.salesman.length > 0) query = query.in('salesman', filters.salesman);
          if (filters.transport && filters.transport.length > 0) query = query.in('transport_name', filters.transport);
          if (filters.location && filters.location.length > 0) query = query.in('dispatch_warehouse', filters.location);

          if (filters.saleType && filters.saleType !== 'All') {
            if (filters.saleType === 'Cash') query = query.eq('payment_term', 'Cash');
            else query = query.neq('payment_term', 'Cash');
          }
          if (filters.saleMethod && filters.saleMethod !== 'All') {
             // In Supabase, if it's Direct, dc_no is null or empty. If Challan, dc_no is not null.
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

          // Perform accurate date filtering matching old logic just in case sale_date diverges
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

        else if (rType === 'return') {
          let query = supabase.from('sales_returns').select('*');
          if (filters.customer && filters.customer.length > 0) query = query.in('customer_name', filters.customer);
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            query = query.gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59.999Z`);
          }

          const { data, error } = await query;
          if (error) throw error;

          let pool = data || [];
          // Perform accurate date filtering matching old logic just in case sale_date diverges
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            pool = pool.filter(r => {
              const targetDateStr = String(r.return_date || r.created_at || '').split('T')[0];
              return targetDateStr >= startStr && targetDateStr <= endStr;
            });
          }

          if (filters.sortBy) {
            if (filters.sortBy === 'date_asc') {
              pool.sort((a, b) => (a.return_date || a.created_at || '').localeCompare(b.return_date || b.created_at || ''));
            } else if (filters.sortBy === 'amount_desc') {
              pool.sort((a, b) => Number(b.return_amount || 0) - Number(a.return_amount || 0));
            } else if (filters.sortBy === 'amount_asc') {
              pool.sort((a, b) => Number(a.return_amount || 0) - Number(b.return_amount || 0));
            } else {
              pool.sort((a, b) => (b.return_date || b.created_at || '').localeCompare(a.return_date || a.created_at || ''));
            }
          }

          setReportRows(pool);
        }

        else if (rType === 'invoice') {
          let query = supabase.from('sales_invoices').select('*');
          if (filters.invoiceNo && filters.invoiceNo !== 'All') query = query.eq('id', filters.invoiceNo);
          if (filters.customer && filters.customer.length > 0) query = query.in('customer_name', filters.customer);
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

        else if (rType === 'loyalty') {
          let query = supabase.from('sales_invoices').select('*').order('created_at', { ascending: true });
          if (filters.customer && filters.customer.length > 0) query = query.in('customer_name', filters.customer);
          if (filters.dateFrom && filters.dateTo) {
            const startStr = String(filters.dateFrom).split('T')[0];
            const endStr = String(filters.dateTo).split('T')[0];
            query = query.gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59.999Z`);
          }
          const { data: invData, error: invError } = await query;
          if (invError) throw invError;

          let runningPts = 0;
          const ledgerEntries: any[] = [];

          // Opening row
          ledgerEntries.push({
            id: 'open-0',
            date: filters.dateFrom || new Date().toISOString().split('T')[0],
            narration: 'Opening',
            debit_points: 0,
            credit_points: 0,
            balance: 0,
            customer_name: filters.customer?.join(', ') || 'All Customers'
          });

          (invData || []).forEach((inv: any) => {
            const earned = Math.round(Number(inv.total_amount || 0) * 0.01 * 100) / 100; // 1 point per Rs 100
            runningPts += earned;
            ledgerEntries.push({
              id: `inv-${inv.id}`,
              date: inv.sale_date || String(inv.created_at || '').split('T')[0],
              narration: `Sales Invoice Points Accrual (Invoice #${inv.invoice_no || `INV-${String(inv.id).padStart(4, '0')}`})`,
              debit_points: 0,
              credit_points: earned,
              balance: runningPts,
              customer_name: inv.customer_name
            });
          });

          setReportRows(ledgerEntries);
        }
      } catch (err: any) {
        toast.error('Audit compilation trace failed: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    compileExcelStructuredDataset();
  }, [rType, filters, config]);

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const filterMeta = {
        'Report Type': String(rType).toUpperCase(),
        'Customer': filters.customer?.length > 0 ? filters.customer.join(', ') : 'All',
        'Salesman': filters.salesman?.length > 0 ? filters.salesman.join(', ') : 'All',
        'Transportation': filters.transport?.length > 0 ? filters.transport.join(', ') : 'All',
        'Location': filters.location?.length > 0 ? filters.location.join(', ') : 'All',
        'Brand': filters.bin?.length > 0 ? filters.bin.join(', ') : 'All',
        'Category': [filters.parentCategory?.join(', '), filters.subCategory?.join(', '), filters.subSubCategory?.join(', ')].filter(c => c && c.length > 0).join(' / ') || 'All',
        'Date Window': filters.dateFrom || filters.dateTo ? `${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}` : 'All Time'
      };

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

      const extractItemDetails = (row: any, uomMap?: Record<string, string>): Array<{ name: string; qty: number | string; uom: string; price: number | string }> => {
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
        const activeMap = uomMap || productUomMap;
        return itemsList.map((it: any) => {
          const name = it.itemName || it.pDescription || it.product_name || it.name || 'Product';
          const cleanKey = String(name).trim().toLowerCase();
          const uom = it.uom || it.unit || activeMap[cleanKey] || 'Nos';
          return {
            name,
            qty: it.qty ?? it.quantity ?? it.orderQty ?? 1,
            uom,
            price: it.rp ?? it.rate ?? it.price ?? 0
          };
        }).filter(it => it.name);
      };

      let columns: ExcelColumn[] = [];
      let exportData: any[] = [];

      if (rType === 'loyalty') {
        columns = [
          { header: 'Date', key: 'date', width: 16 },
          { header: 'Narration / Activity Trace', key: 'narration', width: 45 },
          { header: 'Debit Points', key: 'debit', width: 18 },
          { header: 'Credit Points', key: 'credit', width: 18 },
          { header: 'Running Balance', key: 'balance', width: 20 }
        ];

        exportData = reportRows.map((row: any) => ({
          date: row.date,
          narration: row.narration,
          debit: Number(row.debit_points || 0).toFixed(2),
          credit: Number(row.credit_points || 0).toFixed(2),
          balance: Number(row.balance || 0).toFixed(2)
        }));
      } else {
        columns = [
          { header: 'Processing Date', key: 'processingDate', width: 16, type: 'date' as const },
          { header: 'Document Ref #', key: 'docRef', width: 18 },
          { header: 'Product', key: 'products', width: 45 },
          { header: 'Customer', key: 'customerName', width: 28 },
          ...(rType === 'sale' ? [
            { header: 'Salesmen', key: 'salesman', width: 18 },
            { header: 'Carrier Fleet', key: 'transport', width: 18 }
          ] : []),
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
            docRef: row.invoice_no || (rType === 'return' ? `RTN-${String(row.id).padStart(4, '0')}` : `INV-${String(row.id).padStart(4, '0')}`),
            products: productsFormatted,
            customerName: row.customer_name || 'Counter Retail Buyer',
            salesman: row.salesman || 'Direct',
            transport: row.transport_name || 'Self Pick',
            totalAmount: Number(row.total_amount || row.return_amount || row.payout_amount_paid || 0)
          };
        });
      }

      await exportToExcel({
        fileName: `Sales_Audit_Report_${rType}_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: `${rType.toUpperCase()} Audit`,
        companyName: businessName || 'ZOAIB ALI & COMPANY',
        reportTitle: rType === 'loyalty' ? 'Customer Loyalty Rewards & Accrual Statement Ledger' : `Commercial ${rType === 'return' ? 'Sales Return' : 'Sales'} Audit Statement Ledger`,
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

  const totalGrossAmount = reportRows.reduce((acc, row) => acc + Number(row.total_amount || 0), 0);
  const cashAmount = reportRows.filter(r => r.payment_term === 'Cash').reduce((acc, r) => acc + Number(r.total_amount || 0), 0);
  const creditAmount = totalGrossAmount - cashAmount;
  const avgOrder = reportRows.length > 0 ? totalGrossAmount / reportRows.length : 0;

  const handleShareWhatsApp = () => {
    const periodText = filters.dateFrom && filters.dateTo ? `${filters.dateFrom} to ${filters.dateTo}` : 'Current Period';
    const lines = [
      `📊 *${businessName || 'ZOAIB ALI & COMPANY'}*`,
      `📄 *Sales Audit Statement Summary*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📅 *Period:* ${periodText}`,
      `📑 *Total Invoices:* ${reportRows.length}`,
      `💰 *Total Matrix Gross:* Rs. ${totalGrossAmount.toLocaleString()}`,
      `💵 *Cash Sales:* Rs. ${cashAmount.toLocaleString()}`,
      `💳 *Credit Sales:* Rs. ${creditAmount.toLocaleString()}`,
      `📈 *Average Order:* Rs. ${Math.round(avgOrder).toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `_Automated ERP Audit Ledger_`
    ];
    const text = lines.join('\n');
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-100 p-3 rounded border print-hidden-element print:hidden">
          <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer"><MdArrowBack size={16} /> Back to Report Filter</button>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white py-1.5 px-3.5 rounded font-bold cursor-pointer transition shadow-sm disabled:opacity-50"
            >
              <MdFileDownload size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 bg-primary text-white py-1.5 px-4 rounded font-black cursor-pointer hover:bg-opacity-90 transition shadow-sm"><MdPrint size={16} /> Print Report</button>
          </div>
        </div>

        <div className="text-center space-y-1 py-4 border-b border-double border-black">
          <h1 className="text-xl font-black uppercase tracking-widest font-serif">ZOAIB ALI & COMPANY</h1>
          <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Master Financial Audit Statement Workbook Ledger</p>
          <div className="text-[10px] pt-1 font-mono flex justify-between px-2 text-gray-600">
            <span>Report Categorization: <b className="text-black uppercase underline">{rType} Ledger Book</b></span>
            <span>Audit Duration Block Window: {filters.dateFrom || 'N/A'} up to {filters.dateTo || 'N/A'}</span>
          </div>
        </div>

        {/* ── VISUAL KPI STATS RIBBON ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 print-hidden-element print:hidden">
          {rType === 'loyalty' ? (
            <>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Target Customer</p>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5 truncate">{filters.customer?.join(', ') || 'All Selected'}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Points Earned</p>
                <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">{reportRows.reduce((sum, r) => sum + Number(r.credit_points || 0), 0).toFixed(2)}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total Points Redeemed</p>
                <p className="text-sm font-black text-rose-700 font-mono mt-0.5">{reportRows.reduce((sum, r) => sum + Number(r.debit_points || 0), 0).toFixed(2)}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Net Active Balance</p>
                <p className="text-sm font-black text-purple-700 font-mono mt-0.5">{(reportRows[reportRows.length - 1]?.balance || 0).toFixed(2)} Pts</p>
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
                <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">Rs. {totalGrossAmount.toLocaleString()}</p>
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


        <div className="w-full overflow-x-auto">
          {rType === 'loyalty' ? (
            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                  <th className="p-2 border border-black text-left w-32">Date</th>
                  <th className="p-2 border border-black text-left">Narration</th>
                  <th className="p-2 border border-black text-right w-36">Debit Points</th>
                  <th className="p-2 border border-black text-right w-36">Credit Points</th>
                  <th className="p-2 border border-black text-right w-36">Balance</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-mono text-xs">
                    <td className="p-2 border border-black text-gray-700">{row.date}</td>
                    <td className="p-2 border border-black font-sans font-medium text-black">{row.narration}</td>
                    <td className="p-2 border border-black text-right text-rose-700 font-bold">
                      {Number(row.debit_points || 0).toFixed(2)}
                    </td>
                    <td className="p-2 border border-black text-right text-emerald-700 font-bold">
                      {Number(row.credit_points || 0).toFixed(2)}
                    </td>
                    <td className="p-2 border border-black text-right font-black text-slate-900">
                      {Number(row.balance || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t border-black font-black font-mono text-xs">
                  <td colSpan={2} className="p-2 border border-black text-left uppercase">Total:</td>
                  <td className="p-2 border border-black text-right text-rose-700">
                    {reportRows.reduce((sum, r) => sum + Number(r.debit_points || 0), 0).toFixed(2)}
                  </td>
                  <td className="p-2 border border-black text-right text-emerald-700">
                    {reportRows.reduce((sum, r) => sum + Number(r.credit_points || 0), 0).toFixed(2)}
                  </td>
                  <td className="p-2 border border-black text-right font-black">
                    {(reportRows[reportRows.length - 1]?.balance || 0).toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-gray-50 border-t border-double border-black font-black font-mono text-xs">
                  <td colSpan={4} className="p-2.5 border border-black text-left uppercase text-gray-800">Your Balance</td>
                  <td className="p-2.5 border border-black text-right text-emerald-800 text-sm font-black underline decoration-double">
                    {(reportRows[reportRows.length - 1]?.balance || 0).toFixed(2)}
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
                  {rType === 'sale' && <th className="p-1.5 border border-black">Salesmen</th>}
                  {rType === 'sale' && <th className="p-1.5 border border-black">Carrier Fleet</th>}
                  <th className="p-1.5 border border-black text-right pr-3">Gross Matrix Amount</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={rType === 'sale' ? 7 : 5} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                      No rows fetched matching the isolated active report criteria token keys.
                    </td>
                  </tr>
                ) : (
                  reportRows.map((row) => {
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
                        {rType === 'sale' && <td className="p-1.5 border border-black font-sans text-gray-600 align-top">{row.salesman || 'Direct'}</td>}
                        {rType === 'sale' && <td className="p-1.5 border border-black font-sans text-purple-700 font-bold align-top">{row.transport_name || 'Self Pick'}</td>}
                        <td className="p-1.5 border border-black text-right pr-3 text-success font-black whitespace-nowrap align-top">Rs. {Number(row.total_amount || row.return_amount || row.payout_amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                  <td colSpan={rType === 'sale' ? 6 : 4} className="p-2 border border-black text-right uppercase tracking-wider text-gray-500">Gross Sheet Aggregated Balanced Sum (PKR):</td>
                  <td className="p-2 border border-black text-right pr-3 text-success underline decoration-double text-sm whitespace-nowrap">
                    Rs. {reportRows.reduce((sum, r) => sum + (Number(r.total_amount || r.return_amount || r.payout_amount_paid || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {filters.withLedgerSummary && rType === 'invoice' && (
          <div className="p-4 rounded border border-dashed border-black bg-gray-50/40 mt-4 space-y-1">
            <h4 className="font-black text-xs uppercase tracking-wide underline">Supplementary Customer Account Ledger Trace Summary</h4>
            <p className="text-[11px] text-gray-500 font-sans">Active closing audit token confirms matching offset balance allocations calculated flawlessly onto master tables logs rows pools.</p>
          </div>
        )}

        {/* ✍️ Formal Multi-Level Executive Verification & Signature Block */}
        <div className="mt-16 grid grid-cols-3 gap-10 text-center text-[10px] font-sans font-black uppercase tracking-wider text-slate-800 break-inside-avoid">
          <div className="flex flex-col justify-end">
            <div className="h-16"></div>
            <div className="border-t-2 border-black pt-2">
              <div className="text-black font-extrabold text-[10px]">PREPARED BY</div>
              <div className="text-[8.5px] font-semibold text-gray-500 normal-case">Sales Operations &amp; Audit Officer</div>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <div className="h-16"></div>
            <div className="border-t-2 border-black pt-2">
              <div className="text-black font-extrabold text-[10px]">VERIFIED BY</div>
              <div className="text-[8.5px] font-semibold text-gray-500 normal-case">Corporate Accounts Auditor &amp; Billing Lead</div>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <div className="h-16"></div>
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
            <span className="text-gray-400">|</span>
            <span className="text-gray-700">Contact: <b className="text-black font-bold">03128039911</b></span>
          </div>
          <div className="text-[9.5px] text-gray-600 font-mono font-medium">
            Software Solution &amp; Cloud Infrastructure by <b className="text-black font-bold">NHT ENTERPRISES (Noor Horizon Technologies)</b>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleReportPrint;

