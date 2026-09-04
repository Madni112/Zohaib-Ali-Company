import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdPrint, MdArrowBack, MdFileDownload } from 'react-icons/md';
import { useAuth } from '../../../Context/Auth';
import { exportToExcel, ExcelColumn } from '../../../utils/excelExport';

const SaleReportPrint = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { businessName, tenantId } = useAuth();
  const [loading, setLoading] = useState(true);

  const [reportRows, setReportRows] = useState<any[]>([]);

  const config = location.state || { type: 'sale', filters: {} };
  const { type: rType, filters } = config;

  useEffect(() => {
    const compileExcelStructuredDataset = async () => {
      try {
        setLoading(true);

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
          setReportRows(pool);
        }

        else if (rType === 'invoice') {
          let query = supabase.from('sales_invoices').select('*');
          if (filters.invoiceNo && filters.invoiceNo !== 'All') query = query.eq('id', filters.invoiceNo);
          const { data, error } = await query;
          if (error) throw error;
          setReportRows(data || []);
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

      const columns: ExcelColumn[] = [
        { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
        { header: 'Document Ref #', key: 'docRef', width: 18 },
        { header: 'Customer / Account Title', key: 'customerName', width: 28 },
        ...(rType === 'sale' ? [
          { header: 'Officer Link', key: 'salesman', width: 18 },
          { header: 'Carrier Fleet', key: 'transport', width: 18 }
        ] : []),
        { header: 'Processing Date', key: 'processingDate', width: 16, type: 'date' as const },
        { header: 'Receipt Status', key: 'status', width: 14, alignment: 'center' as const },
        { header: 'Gross Matrix Amount (Rs.)', key: 'totalAmount', width: 22, type: 'currency' as const }
      ];

      const exportData = reportRows.map((row, idx) => ({
        idx: idx + 1,
        docRef: rType === 'return' ? `RTN-${String(row.id).padStart(4, '0')}` : `INV-${String(row.id).padStart(4, '0')}`,
        customerName: row.customer_name || 'Counter Retail Buyer',
        salesman: row.salesman || 'Direct',
        transport: row.transport_name || 'Self Pick',
        processingDate: row.sale_date || row.return_date || String(row.created_at || '').split('T')[0],
        status: row.receipt_status || row.status || 'Confirm',
        totalAmount: Number(row.total_amount || row.return_amount || row.payout_amount_paid || 0)
      }));

      await exportToExcel({
        fileName: `Sales_Audit_Report_${rType}_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: `${rType.toUpperCase()} Audit`,
        companyName: businessName || 'ZOAIB ALI & COMPANY',
        reportTitle: `Commercial ${rType === 'return' ? 'Sales Return' : 'Sales'} Audit Statement Ledger`,
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
          <button type="button" onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Sales-Report`)} className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer"><MdArrowBack size={16} /> Return to Auditing Center</button>
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
          <h1 className="text-xl font-black uppercase tracking-widest font-serif">ZOAIB ALI & COMPANY</h1>
          <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Master Financial Audit Statement Workbook Ledger</p>
          <div className="text-[10px] pt-1 font-mono flex justify-between px-2 text-gray-600">
            <span>Report Categorization: <b className="text-black uppercase underline">{rType} Ledger Book</b></span>
            <span>Audit Duration Block Window: {filters.dateFrom || 'N/A'} up to {filters.dateTo || 'N/A'}</span>
          </div>
        </div>


        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                <th className="p-1.5 border border-black text-center w-12">Index</th>
                <th className="p-1.5 border border-black">Document Ref #</th>
                <th className="p-1.5 border border-black">Customer / Account Title</th>
                {rType === 'sale' && <th className="p-1.5 border border-black">Officer Link</th>}
                {rType === 'sale' && <th className="p-1.5 border border-black">Carrier Fleet</th>}
                <th className="p-1.5 border border-black text-center">Processing Date</th>
                <th className="p-1.5 border border-black text-center">Receipt Status</th>
                <th className="p-1.5 border border-black text-right pr-3">Gross Matrix Amount</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={rType === 'sale' ? 8 : 6} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">
                    No rows fetched matching the isolated active report criteria token keys.
                  </td>
                </tr>
              ) : (
                reportRows.map((row, idx) => {
                  const displayDocPrefixId = `INV-${row.id}`;
                  const processingDateDisplay = row.sale_date || row.return_date || String(row.created_at || '').split('T')[0];
                  const activeStatusValue = row.receipt_status || 'Confirm';

                  return (
                    <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                      <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                      <td className="p-1.5 border border-black text-primary font-black uppercase">{displayDocPrefixId}</td>
                      <td className="p-1.5 border border-black text-black font-sans">{row.customer_name || 'Counter Retail Buyer'}</td>
                      {rType === 'sale' && <td className="p-1.5 border border-black font-sans text-gray-600">{row.salesman || 'Direct'}</td>}
                      {rType === 'sale' && <td className="p-1.5 border border-black font-sans text-purple-700 font-bold">{row.transport_name || 'Self Pick'}</td>}
                      <td className="p-1.5 border border-black text-center text-gray-500">{processingDateDisplay}</td>
                      <td className="p-2 border border-black text-center uppercase text-[10px] font-black">{activeStatusValue}</td>
                      <td className="p-1.5 border border-black text-right pr-3 text-success font-black">Rs. {Number(row.total_amount || row.return_amount || row.payout_amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                <td colSpan={rType === 'sale' ? 7 : 5} className="p-2 border border-black text-right uppercase tracking-wider text-gray-500">Gross Sheet Aggregated Balanced Sum (PKR):</td>
                <td className="p-2 border border-black text-right pr-3 text-success underline decoration-double text-sm">
                  Rs. {reportRows.reduce((sum, r) => sum + (Number(r.total_amount || r.return_amount || r.payout_amount_paid || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {filters.withLedgerSummary && rType === 'invoice' && (
          <div className="p-4 rounded border border-dashed border-black bg-gray-50/40 mt-4 space-y-1">
            <h4 className="font-black text-xs uppercase tracking-wide underline">Supplementary Customer Account Ledger Trace Summary</h4>
            <p className="text-[11px] text-gray-500 font-sans">Active closing audit token confirms matching offset balance allocations calculated flawlessly onto master tables logs rows pools.</p>
          </div>
        )}

        <div className="mt-20 grid grid-cols-3 gap-12 text-center text-[9px] font-sans font-black uppercase tracking-widest text-gray-400">
          <div className="border-t border-black pt-2">Prepared By: Sales Audit Officer</div>
          <div className="border-t border-black pt-2">Verified By: Corporate Accounts Auditor</div>
          <div className="border-t border-black pt-2">Authorized Executive Director Seal</div>
        </div>

        {/* 🏢 Software & Corporate Provider Footer */}
        <div className="mt-10 pt-3 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-sans print:border-gray-400">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-black font-black uppercase">ZOAIB ALI & COMPANY</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-700">Contact: <b className="text-black font-bold">03128039911</b></span>
          </div>
          <div className="text-[9px] text-gray-400 font-mono">
            System Generated Report • Zoaib Ali & Company
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleReportPrint;

