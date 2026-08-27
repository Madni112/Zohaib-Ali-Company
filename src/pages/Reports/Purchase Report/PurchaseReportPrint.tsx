import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdPrint, MdArrowBack, MdFileDownload } from 'react-icons/md';
import { useAuth } from '../../../Context/Auth';
import { exportToExcel, ExcelColumn } from '../../../utils/excelExport';

const PurchaseReportPrint = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { businessName, tenantId } = useAuth();
  const [loading, setLoading] = useState(true);

  const [reportRows, setReportRows] = useState<any[]>([]);

  const config = location.state || { type: 'purchase', filters: {} };
  const { type: rType, filters } = config;

  useEffect(() => {
    const compilePurchaseStructuredDataset = async () => {
      try {
        setLoading(true);

        if (rType === 'purchase') {
          let query = supabase.from('supplier_purchases').select('*');
          if (filters.vendor && filters.vendor !== 'All') query = query.eq('supplier_name', filters.vendor);
          if (filters.location && filters.location !== 'All') query = query.eq('target_warehouse', filters.location);

          const { data: purData, error: purError } = await query;
          if (purError) throw purError;

          let pool = purData || [];

          if (filters.dateFrom && filters.dateTo) {
            pool = pool.filter(p => {
              const databaseDateStr = String(p.purchase_date || p.created_at || '').split('T')[0];
              return databaseDateStr >= filters.dateFrom && databaseDateStr <= filters.dateTo;
            });
          }
          if (filters.purchaseType && filters.purchaseType !== 'All') {
            pool = pool.filter(p => filters.purchaseType === 'Cash' ? p.payment_term === 'Cash' : p.payment_term !== 'Cash');
          }
          setReportRows(pool);
        }

        else if (rType === 'return') {
          // ✅ ALIGNED TO YOUR NEW SQL SCHEMA: Queries purchase_returns matching vendor_name
          let query = supabase.from('purchase_returns').select('*');
          if (filters.vendor && filters.vendor !== 'All') query = query.eq('vendor_name', filters.vendor);
          if (filters.location && filters.location !== 'All') query = query.eq('source_warehouse', filters.location);

          const { data, error } = await query;
          if (error) throw error;

          let pool = data || [];
          if (filters.dateFrom && filters.dateTo) {
            pool = pool.filter(r => {
              const databaseDateStr = String(r.return_date || r.created_at || '').split('T')[0];
              return databaseDateStr >= filters.dateFrom && databaseDateStr <= filters.dateTo;
            });
          }
          setReportRows(pool);
        }

        else if (rType === 'invoice') {
          let query = supabase.from('supplier_purchases').select('*');
          if (filters.invoiceNo && filters.invoiceNo !== 'All') query = query.eq('id', filters.invoiceNo);
          const { data, error } = await query;
          if (error) throw error;
          setReportRows(data || []);
        }
      } catch (err: any) {
        toast.error('Procurement auditing trace failure: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    compilePurchaseStructuredDataset();
  }, [rType, filters]);

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const filterMeta = {
        'Report Type': String(rType).toUpperCase(),
        'Vendor': filters.vendor || 'All',
        'Location': filters.location || 'All',
        'Purchase Type': filters.purchaseType || 'All',
        'Date Window': filters.dateFrom || filters.dateTo ? `${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}` : 'All Time'
      };

      const columns: ExcelColumn[] = [
        { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
        { header: 'Purchase Doc Ref #', key: 'docRef', width: 20 },
        { header: 'Vendor / Supplier Account', key: 'vendorName', width: 28 },
        { header: 'Warehouse Bin', key: 'warehouse', width: 18 },
        { header: 'Processing Date', key: 'processingDate', width: 16, type: 'date' as const },
        { header: 'Settlement Status', key: 'status', width: 16, alignment: 'center' as const },
        { header: 'Gross Matrix Valuation (Rs.)', key: 'totalAmount', width: 22, type: 'currency' as const }
      ];

      const exportData = reportRows.map((row, idx) => ({
        idx: idx + 1,
        docRef: row.purchase_no || row.return_no || `PUR-${String(row.id).padStart(4, '0')}`,
        vendorName: row.supplier_name || row.vendor_name || 'Generic Wholesaler',
        warehouse: row.target_warehouse || row.source_warehouse || 'Main Warehouse',
        processingDate: row.purchase_date || row.return_date || String(row.created_at || '').split(' ')[0],
        status: row.payment_term || row.status || 'Confirmed',
        totalAmount: Number(row.total_amount || row.return_amount || 0)
      }));

      await exportToExcel({
        fileName: `Purchase_Audit_Report_${rType}_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: `${rType.toUpperCase()} Audit`,
        companyName: businessName || 'ZOHAIB ALI & COMPANY',
        reportTitle: `Corporate ${rType === 'return' ? 'Purchase Return' : 'Purchase'} Audit Statement Workbook`,
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
          <button type="button" onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Purchase-Report`)} className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer"><MdArrowBack size={16} /> Return to Auditing Center</button>
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
          <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Master Procurement Accounting Workbook Summary Statement</p>
          <div className="text-[10px] pt-1 font-mono flex justify-between px-2 text-gray-600">
            <span>Procurement Categorization: <b className="text-black uppercase underline">{rType} Ledger Book</b></span>
            <span>Audit Duration Window Block: {filters.dateFrom || 'N/A'} up to {filters.dateTo || 'N/A'}</span>
          </div>
        </div>


        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans antialiased text-left print:w-full">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                <th className="p-1.5 border border-black text-center w-12">Index</th>
                <th className="p-1.5 border border-black">Purchase Doc Ref #</th>
                <th className="p-1.5 border border-black">Associated Vendor / Supplier Account</th>
                <th className="p-1.5 border border-black text-center">Processing Date</th>
                <th className="p-1.5 border border-black text-center">Settlement Status</th>
                <th className="p-1.5 border border-black text-right pr-3">Gross Matrix Valuation</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 font-bold italic border border-black text-gray-400 bg-gray-50/50">No rows matching active report criteria.</td></tr>
              ) : (
                reportRows.map((row, idx) => {
                  const displayDocRef = row.purchase_no || row.return_no || `ID: ${row.id}`;
                  const displayAccountTitle = row.supplier_name || row.vendor_name || 'Generic Wholesaler';
                  const displayProcessingDate = row.purchase_date || row.return_date || String(row.created_at || '').split(' ')[0];

                  return (
                    <tr key={row.id} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                      <td className="p-1.5 border border-black text-center text-gray-400">{idx + 1}</td>
                      <td className="p-1.5 border border-black text-primary font-black uppercase">{displayDocRef}</td>
                      <td className="p-1.5 border border-black text-black font-sans">{displayAccountTitle}</td>
                      <td className="p-1.5 border border-black text-center text-gray-500">{displayProcessingDate}</td>
                      <td className="p-2 border border-black text-center uppercase text-[10px] font-black">{row.payment_term || 'Settled'}</td>
                      <td className="p-1.5 border border-black text-right pr-3 text-success font-black">Rs. {Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                <td colSpan={5} className="p-2 border border-black text-right uppercase tracking-wider text-gray-500">Gross Procurement Balanced Sum (PKR):</td>
                <td className="p-2 border border-black text-right pr-3 text-success underline decoration-double text-sm">
                  Rs. {reportRows.reduce((sum, r) => sum + (Number(r.total_amount || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-20 grid grid-cols-3 gap-12 text-center text-[9px] font-sans font-black uppercase tracking-widest text-gray-400">
          <div className="border-t border-black pt-2">Prepared By: Procurement Officer</div>
          <div className="border-t border-black pt-2">Verified By: Corporate Accounts Auditor</div>
          <div className="border-t border-black pt-2">Authorized Executive Director Seal</div>
        </div>

        {/* 🏢 Software & Corporate Provider Footer */}
        <div className="mt-10 pt-3 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-sans print:border-gray-400">
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

export default PurchaseReportPrint;

