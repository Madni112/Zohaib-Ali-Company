import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MdPrint, MdArrowBack, MdFileDownload } from 'react-icons/md';
import { QtyBadge } from '../../../utils/QtyBadge';
import { useAuth } from '../../../Context/Auth';
import { exportToExcel, ExcelColumn } from '../../../utils/excelExport';
import ReportPagination from '../../../components/ReportPagination';

const HoldingReportPrint: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { businessName, tenantId } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [isPrinting, setIsPrinting] = useState(false);

  const stateData = location.state || {
    perspective: 'detailed',
    filters: {},
    rows: [],
    kpis: {
      totalItems: 0,
      totalHeldQty: 0,
      totalHeldValue: 0,
      totalOrderQty: 0,
      totalOrderValue: 0,
      uniqueGatepasses: 0,
      uniqueInvoices: 0,
      uniqueCustomers: 0,
      uniqueSalesmen: 0
    }
  };

  const { perspective, filters, rows, kpis } = stateData;

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'NHT ENTERPRISES (Noor Horizon Technologies)';

    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      document.title = originalTitle;
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [perspective, JSON.stringify(filters)]);

  const paginatedRows = useMemo(() => {
    if (isPrinting || pageSize === 'all') return rows || [];
    const start = (currentPage - 1) * pageSize;
    return (rows || []).slice(start, start + pageSize);
  }, [rows, currentPage, pageSize, isPrinting]);

  const startIndex = (currentPage - 1) * (pageSize === 'all' ? 0 : (pageSize as number));

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const filterMeta = {
        'Perspective': String(perspective).toUpperCase(),
        'Salesman': filters.salesman || 'All',
        'Customer': filters.customer || 'All',
        'Gatepass': filters.gatepass || 'All',
        'Invoice': filters.invoice || 'All',
        'Date Window': filters.dateFrom || filters.dateTo ? `${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}` : 'All Time'
      };

      if (perspective === 'detailed') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Gatepass / DC #', key: 'gatepassNo', width: 16 },
          { header: 'Invoice #', key: 'invoiceNo', width: 15 },
          { header: 'Date', key: 'date', width: 14, type: 'date' },
          { header: 'Customer Name', key: 'customerName', width: 26 },
          { header: 'Salesman', key: 'salesman', width: 20 },
          { header: 'Product Description', key: 'productName', width: 32 },
          { header: 'Code', key: 'skuCode', width: 14 },
          { header: 'Warehouse', key: 'warehouse', width: 18 },
          { header: 'Order Qty', key: 'orderQty', width: 12, type: 'number' },
          { header: 'Dispatched Qty', key: 'dispatchedQty', width: 14, type: 'number' },
          { header: 'Held Qty', key: 'holdQty', width: 12, type: 'number' },
          { header: 'Unit Rate (Rs.)', key: 'rate', width: 16, type: 'currency' },
          { header: 'Held Value (Rs.)', key: 'heldAmount', width: 18, type: 'currency' }
        ];

        const exportData = (rows || []).map((r: any, i: number) => ({
          idx: i + 1,
          ...r
        }));

        await exportToExcel({
          fileName: `Holding_Items_Detailed_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Holding Items',
          companyName: businessName || 'ZOAIB ALI & COMPANY',
          reportTitle: 'Holding Items & Pending Dispatch Audit Statement',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      } else if (perspective === 'salesman') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Salesman Name', key: 'salesman', width: 28 },
          { header: 'Clients Count', key: 'custCount', width: 16, type: 'number' },
          { header: 'Invoices Count', key: 'invCount', width: 16, type: 'number' },
          { header: 'Held Items Count', key: 'itemsCount', width: 18, type: 'number' },
          { header: 'Total Held Quantity', key: 'totalHeldQty', width: 20, type: 'number' },
          { header: 'Total Holding Valuation (Rs.)', key: 'totalHeldValue', width: 26, type: 'currency' }
        ];

        const exportData = (rows || []).map((s: any, i: number) => ({
          idx: i + 1,
          salesman: s.salesman,
          custCount: s.customerCount ? (s.customerCount.size || s.customerCount) : 0,
          invCount: s.invoices ? (s.invoices.size || s.invoices) : 0,
          itemsCount: s.itemsCount,
          totalHeldQty: s.totalHeldQty,
          totalHeldValue: s.totalHeldValue
        }));

        await exportToExcel({
          fileName: `Holding_Salesman_Wise_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Salesman Holding',
          companyName: businessName || 'ZOAIB ALI & COMPANY',
          reportTitle: 'Salesman-Wise Holding Inventory Audit',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      } else if (perspective === 'customer') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Customer / Client Title', key: 'customer', width: 32 },
          { header: 'Gatepasses Involved', key: 'gpCount', width: 18, type: 'number' },
          { header: 'Invoices Count', key: 'invCount', width: 16, type: 'number' },
          { header: 'Held Items Count', key: 'itemsCount', width: 18, type: 'number' },
          { header: 'Total Held Quantity', key: 'totalHeldQty', width: 20, type: 'number' },
          { header: 'Total Holding Value (Rs.)', key: 'totalHeldValue', width: 26, type: 'currency' }
        ];

        const exportData = (rows || []).map((c: any, i: number) => ({
          idx: i + 1,
          customer: c.customer,
          gpCount: c.gatepasses ? (c.gatepasses.size || c.gatepasses) : 0,
          invCount: c.invoices ? (c.invoices.size || c.invoices) : 0,
          itemsCount: c.itemsCount,
          totalHeldQty: c.totalHeldQty,
          totalHeldValue: c.totalHeldValue
        }));

        await exportToExcel({
          fileName: `Holding_Customer_Wise_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Customer Holding',
          companyName: businessName || 'ZOAIB ALI & COMPANY',
          reportTitle: 'Customer-Wise Holding Stock Statement',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      } else if (perspective === 'gatepass') {
        const columns: ExcelColumn[] = [
          { header: 'S#', key: 'idx', width: 8, alignment: 'center' },
          { header: 'Gatepass / DC #', key: 'gatepassNo', width: 18 },
          { header: 'Date', key: 'date', width: 14, type: 'date' },
          { header: 'Customer Name', key: 'customer', width: 26 },
          { header: 'Salesman', key: 'salesman', width: 20 },
          { header: 'Total Order Qty', key: 'totalOrderQty', width: 16, type: 'number' },
          { header: 'Dispatched Qty', key: 'totalDispatchedQty', width: 16, type: 'number' },
          { header: 'Held Qty', key: 'totalHeldQty', width: 14, type: 'number' },
          { header: 'Held Value (Rs.)', key: 'totalHeldValue', width: 20, type: 'currency' }
        ];

        const exportData = (rows || []).map((g: any, i: number) => ({
          idx: i + 1,
          ...g
        }));

        await exportToExcel({
          fileName: `Holding_Gatepass_Wise_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Gatepass Holding',
          companyName: businessName || 'ZOAIB ALI & COMPANY',
          reportTitle: 'Gatepass / Delivery Challan Holding Audit',
          filterSummary: filterMeta,
          columns,
          data: exportData,
          theme: 'emerald'
        });
      } else if (perspective === 'invoice') {
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

        const exportData = (rows || []).map((inv: any, i: number) => ({
          idx: i + 1,
          ...inv
        }));

        await exportToExcel({
          fileName: `Holding_Invoice_Wise_${new Date().toISOString().split('T')[0]}.xlsx`,
          sheetName: 'Invoice Holding',
          companyName: businessName || 'ZOAIB ALI & COMPANY',
          reportTitle: 'Invoice-Wise Holding Inventory Valuation',
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
        {/* Screen Controls Header */}
        <div className="flex justify-between items-center bg-gray-100 p-3 rounded border print-hidden-element print:hidden">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer"
          >
            <MdArrowBack size={16} /> Return to Holding Audit Center
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-4 rounded font-bold cursor-pointer transition shadow-sm disabled:opacity-50"
            >
              <MdFileDownload size={16} /> {exporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-primary text-white py-1.5 px-5 rounded font-black cursor-pointer hover:bg-opacity-90 transition shadow-sm"
            >
              <MdPrint size={16} /> Print Voucher Report
            </button>
          </div>
        </div>

        {/* Printable Letterhead */}
        <div className="text-center space-y-1 py-4 border-b border-double border-black">
          <h1 className="text-xl font-black uppercase tracking-widest font-serif">
            {businessName || 'ZOAIB ALI & COMPANY'}
          </h1>
          <p className="text-[10px] font-bold tracking-wider text-gray-600 uppercase">
            COMMERCIAL HOLDING INVENTORY & PENDING DISPATCH AUDIT STATEMENT
          </p>
          <div className="text-[10px] pt-1 font-mono flex justify-between px-2 text-gray-700">
            <span>Audit Perspective: <b className="text-black uppercase underline">{perspective} Perspective</b></span>
            <span>Date Window: {filters.dateFrom || 'Start'} up to {filters.dateTo || 'Today'}</span>
          </div>
        </div>

        <ReportPagination
          totalCount={(rows || []).length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />

        {/* 1. Itemized Detailed View */}
        {perspective === 'detailed' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                  <th className="p-1.5 border border-black text-center w-10">S#</th>
                  <th className="p-1.5 border border-black">Gatepass #</th>
                  <th className="p-1.5 border border-black">Invoice #</th>
                  <th className="p-1.5 border border-black text-center">Date</th>
                  <th className="p-1.5 border border-black">Customer Title</th>
                  <th className="p-1.5 border border-black">Salesman</th>
                  <th className="p-1.5 border border-black">Product Description</th>
                  <th className="p-1.5 border border-black text-right">Order</th>
                  <th className="p-1.5 border border-black text-right">Sent</th>
                  <th className="p-1.5 border border-black text-right bg-amber-50">Held Qty</th>
                  <th className="p-1.5 border border-black text-right">Rate</th>
                  <th className="p-1.5 border border-black text-right pr-2 bg-emerald-50">Held Value</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 font-bold italic border border-black text-gray-400">
                      No holding records found matching parameters.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r: any, idx: number) => (
                    <tr key={idx} className="border-b border-black font-mono text-xs">
                      <td className="p-1 border border-black text-center text-gray-500">{startIndex + idx + 1}</td>
                      <td className="p-1 border border-black font-bold">{r.gatepassNo}</td>
                      <td className="p-1 border border-black">{r.invoiceNo}</td>
                      <td className="p-1 border border-black text-center text-gray-600 font-sans text-[10px]">{r.date}</td>
                      <td className="p-1 border border-black font-sans font-bold">{r.customerName}</td>
                      <td className="p-1 border border-black font-sans text-gray-700">{r.salesman}</td>
                      <td className="p-1 border border-black font-sans">
                        <div className="font-bold">{r.productName}</div>
                        {r.skuCode && <div className="text-[9px] text-gray-500">{r.skuCode}</div>}
                      </td>
                      <td className="p-1 border border-black text-center"><QtyBadge qty={r.orderQty} /></td>
                      <td className="p-1 border border-black text-center text-emerald-700"><QtyBadge qty={r.dispatchedQty} /></td>
                      <td className="p-1 border border-black text-center font-black bg-amber-50/50 text-amber-900"><QtyBadge qty={r.holdQty} /></td>
                      <td className="p-1 border border-black text-right">Rs. {Number(r.rate || 0).toLocaleString()}</td>
                      <td className="p-1 border border-black text-right pr-2 font-black bg-emerald-50/50 text-emerald-800">
                        Rs. {Number(r.heldAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  {/* 📄 Page Subtotal Row */}
                  {!isPrinting && pageSize !== 'all' && (
                    <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                      <td colSpan={7} className="p-2 border border-black text-right uppercase font-sans text-amber-900">
                        Page {currentPage} Subtotal ({paginatedRows.length} items):
                      </td>
                      <td className="p-2 border border-black text-center"><QtyBadge qty={paginatedRows.reduce((s: number, r: any) => s + Number(r.orderQty || 0), 0)} /></td>
                      <td className="p-2 border border-black text-center text-emerald-700"><QtyBadge qty={paginatedRows.reduce((s: number, r: any) => s + Number(r.dispatchedQty || 0), 0)} /></td>
                      <td className="p-2 border border-black text-center bg-amber-100 text-amber-900"><QtyBadge qty={paginatedRows.reduce((s: number, r: any) => s + Number(r.holdQty || 0), 0)} /></td>
                      <td className="p-2 border border-black text-right">-</td>
                      <td className="p-2 border border-black text-right pr-2 bg-emerald-50 text-emerald-900 font-bold">
                        Rs. {paginatedRows.reduce((s: number, r: any) => s + Number(r.heldAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  {/* 📊 Overall Grand Totals Row */}
                  <tr className="bg-gray-100 border-t-2 border-black font-black text-black text-xs font-mono">
                    <td colSpan={7} className="p-2 border border-black text-right uppercase font-sans">Grand Total Summary (All {rows.length} Items):</td>
                    <td className="p-2 border border-black text-center"><QtyBadge qty={kpis.totalOrderQty} /></td>
                    <td className="p-2 border border-black text-center text-emerald-700"><QtyBadge qty={kpis.totalOrderQty - kpis.totalHeldQty} /></td>
                    <td className="p-2 border border-black text-center bg-amber-100 text-amber-900"><QtyBadge qty={kpis.totalHeldQty} /></td>
                    <td className="p-2 border border-black text-right">-</td>
                    <td className="p-2 border border-black text-right pr-2 bg-emerald-100 text-emerald-900 font-bold">
                      Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 2. Salesman-Wise View */}
        {perspective === 'salesman' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                  <th className="p-2 border border-black text-center w-12">S#</th>
                  <th className="p-2 border border-black">Salesman / Officer Title</th>
                  <th className="p-2 border border-black text-center">Assigned Clients</th>
                  <th className="p-2 border border-black text-center">Invoices Count</th>
                  <th className="p-2 border border-black text-center">Held Items Lines</th>
                  <th className="p-2 border border-black text-right">Total Held Quantity</th>
                  <th className="p-2 border border-black text-right pr-3 bg-emerald-50">Total Holding Valuation</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((s: any, idx: number) => (
                  <tr key={idx} className="border-b border-black font-mono text-xs">
                    <td className="p-2 border border-black text-center text-gray-500">{startIndex + idx + 1}</td>
                    <td className="p-2 border border-black font-sans font-bold">{s.salesman}</td>
                    <td className="p-2 border border-black text-center">{s.customerCount ? (s.customerCount.size || s.customerCount) : 0} Clients</td>
                    <td className="p-2 border border-black text-center">{s.invoices ? (s.invoices.size || s.invoices) : 0} Invoices</td>
                    <td className="p-2 border border-black text-center">{s.itemsCount}</td>
                    <td className="p-2 border border-black text-right font-black">{s.totalHeldQty.toLocaleString()} Pcs</td>
                    <td className="p-2 border border-black text-right pr-3 font-black bg-emerald-50/50">
                      Rs. {Number(s.totalHeldValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* 📄 Page Subtotal Row */}
                {!isPrinting && pageSize !== 'all' && (
                  <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                    <td colSpan={5} className="p-2 border border-black text-right uppercase font-sans text-amber-900">
                      Page {currentPage} Subtotal ({paginatedRows.length} salesmen):
                    </td>
                    <td className="p-2 border border-black text-right">{paginatedRows.reduce((s: number, r: any) => s + Number(r.totalHeldQty || 0), 0).toLocaleString()} Pcs</td>
                    <td className="p-2 border border-black text-right pr-3 bg-emerald-50 text-emerald-900 font-bold">
                      Rs. {paginatedRows.reduce((s: number, r: any) => s + Number(r.totalHeldValue || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {/* 📊 Overall Grand Totals Row */}
                <tr className="bg-gray-100 border-t-2 border-black font-black text-black text-xs font-mono">
                  <td colSpan={5} className="p-2 border border-black text-right uppercase font-sans">Grand Total Summary (All {rows.length} Salesmen):</td>
                  <td className="p-2 border border-black text-right">{kpis.totalHeldQty.toLocaleString()} Pcs</td>
                  <td className="p-2 border border-black text-right pr-3 bg-emerald-100">
                    Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 3. Customer-Wise View */}
        {perspective === 'customer' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                  <th className="p-2 border border-black text-center w-12">S#</th>
                  <th className="p-2 border border-black">Customer / Account Title</th>
                  <th className="p-2 border border-black text-center">Gatepasses</th>
                  <th className="p-2 border border-black text-center">Invoices</th>
                  <th className="p-2 border border-black text-center">Held Items</th>
                  <th className="p-2 border border-black text-right">Committed Held Qty</th>
                  <th className="p-2 border border-black text-right pr-3 bg-emerald-50">Total Holding Value</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((c: any, idx: number) => (
                  <tr key={idx} className="border-b border-black font-mono text-xs">
                    <td className="p-2 border border-black text-center text-gray-500">{startIndex + idx + 1}</td>
                    <td className="p-2 border border-black font-sans font-bold">{c.customer}</td>
                    <td className="p-2 border border-black text-center">{c.gatepasses ? (c.gatepasses.size || c.gatepasses) : 0} GPs</td>
                    <td className="p-2 border border-black text-center">{c.invoices ? (c.invoices.size || c.invoices) : 0} Invs</td>
                    <td className="p-2 border border-black text-center">{c.itemsCount}</td>
                    <td className="p-2 border border-black text-right font-black">{c.totalHeldQty.toLocaleString()} Pcs</td>
                    <td className="p-2 border border-black text-right pr-3 font-black bg-emerald-50/50">
                      Rs. {Number(c.totalHeldValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* 📄 Page Subtotal Row */}
                {!isPrinting && pageSize !== 'all' && (
                  <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                    <td colSpan={5} className="p-2 border border-black text-right uppercase font-sans text-amber-900">
                      Page {currentPage} Subtotal ({paginatedRows.length} clients):
                    </td>
                    <td className="p-2 border border-black text-right">{paginatedRows.reduce((s: number, r: any) => s + Number(r.totalHeldQty || 0), 0).toLocaleString()} Pcs</td>
                    <td className="p-2 border border-black text-right pr-3 bg-emerald-50 text-emerald-900 font-bold">
                      Rs. {paginatedRows.reduce((s: number, r: any) => s + Number(r.totalHeldValue || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {/* 📊 Overall Grand Totals Row */}
                <tr className="bg-gray-100 border-t-2 border-black font-black text-black text-xs font-mono">
                  <td colSpan={5} className="p-2 border border-black text-right uppercase font-sans">Grand Total Summary (All {rows.length} Clients):</td>
                  <td className="p-2 border border-black text-right">{kpis.totalHeldQty.toLocaleString()} Pcs</td>
                  <td className="p-2 border border-black text-right pr-3 bg-emerald-100">
                    Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 4. Gatepass-Wise View */}
        {perspective === 'gatepass' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                  <th className="p-2 border border-black text-center w-12">S#</th>
                  <th className="p-2 border border-black">Gatepass / DC #</th>
                  <th className="p-2 border border-black text-center">Date</th>
                  <th className="p-2 border border-black">Customer Name</th>
                  <th className="p-2 border border-black">Salesman</th>
                  <th className="p-2 border border-black text-right">Order Qty</th>
                  <th className="p-2 border border-black text-right">Dispatched</th>
                  <th className="p-2 border border-black text-right">Held Qty</th>
                  <th className="p-2 border border-black text-right pr-3 bg-emerald-50">Held Value</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((g: any, idx: number) => (
                  <tr key={idx} className="border-b border-black font-mono text-xs">
                    <td className="p-2 border border-black text-center text-gray-500">{startIndex + idx + 1}</td>
                    <td className="p-2 border border-black font-bold">{g.gatepassNo}</td>
                    <td className="p-2 border border-black text-center font-sans text-[10px]">{g.date}</td>
                    <td className="p-2 border border-black font-sans font-bold">{g.customer}</td>
                    <td className="p-2 border border-black font-sans">{g.salesman}</td>
                    <td className="p-2 border border-black text-right">{g.totalOrderQty.toLocaleString()}</td>
                    <td className="p-2 border border-black text-right text-emerald-700">{g.totalDispatchedQty.toLocaleString()}</td>
                    <td className="p-2 border border-black text-right font-black text-amber-900">{g.totalHeldQty.toLocaleString()}</td>
                    <td className="p-2 border border-black text-right pr-3 font-black bg-emerald-50/50">
                      Rs. {Number(g.totalHeldValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* 📄 Page Subtotal Row */}
                {!isPrinting && pageSize !== 'all' && (
                  <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                    <td colSpan={5} className="p-2 border border-black text-right uppercase font-sans text-amber-900">
                      Page {currentPage} Subtotal ({paginatedRows.length} gatepasses):
                    </td>
                    <td className="p-2 border border-black text-right">{paginatedRows.reduce((s: number, r: any) => s + Number(r.totalOrderQty || 0), 0).toLocaleString()}</td>
                    <td className="p-2 border border-black text-right text-emerald-700">{paginatedRows.reduce((s: number, r: any) => s + Number(r.totalDispatchedQty || 0), 0).toLocaleString()}</td>
                    <td className="p-2 border border-black text-right">{paginatedRows.reduce((s: number, r: any) => s + Number(r.totalHeldQty || 0), 0).toLocaleString()}</td>
                    <td className="p-2 border border-black text-right pr-3 bg-emerald-50 text-emerald-900 font-bold">
                      Rs. {paginatedRows.reduce((s: number, r: any) => s + Number(r.totalHeldValue || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {/* 📊 Overall Grand Totals Row */}
                <tr className="bg-gray-100 border-t-2 border-black font-black text-black text-xs font-mono">
                  <td colSpan={5} className="p-2 border border-black text-right uppercase font-sans">Grand Total Summary (All {rows.length} Gatepasses):</td>
                  <td className="p-2 border border-black text-right">{kpis.totalOrderQty.toLocaleString()}</td>
                  <td className="p-2 border border-black text-right text-emerald-700">{(kpis.totalOrderQty - kpis.totalHeldQty).toLocaleString()}</td>
                  <td className="p-2 border border-black text-right">{kpis.totalHeldQty.toLocaleString()}</td>
                  <td className="p-2 border border-black text-right pr-3 bg-emerald-100">
                    Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 5. Invoice-Wise View */}
        {perspective === 'invoice' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                  <th className="p-2 border border-black text-center w-12">S#</th>
                  <th className="p-2 border border-black">Invoice #</th>
                  <th className="p-2 border border-black text-center">Date</th>
                  <th className="p-2 border border-black">Customer Name</th>
                  <th className="p-2 border border-black">Salesman</th>
                  <th className="p-2 border border-black text-center">Items</th>
                  <th className="p-2 border border-black text-right">Held Qty</th>
                  <th className="p-2 border border-black text-right">Order Total</th>
                  <th className="p-2 border border-black text-right pr-3 bg-emerald-50">Pending Held Value</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((inv: any, idx: number) => (
                  <tr key={idx} className="border-b border-black font-mono text-xs">
                    <td className="p-2 border border-black text-center text-gray-500">{startIndex + idx + 1}</td>
                    <td className="p-2 border border-black font-bold">{inv.invoiceNo}</td>
                    <td className="p-2 border border-black text-center font-sans text-[10px]">{inv.date}</td>
                    <td className="p-2 border border-black font-sans font-bold">{inv.customer}</td>
                    <td className="p-2 border border-black font-sans">{inv.salesman}</td>
                    <td className="p-2 border border-black text-center">{inv.itemsCount}</td>
                    <td className="p-2 border border-black text-right font-black text-amber-900">{inv.totalHeldQty.toLocaleString()}</td>
                    <td className="p-2 border border-black text-right">
                      Rs. {Number(inv.totalOrderAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-black text-right pr-3 font-black bg-emerald-50/50">
                      Rs. {Number(inv.totalHeldValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* 📄 Page Subtotal Row */}
                {!isPrinting && pageSize !== 'all' && (
                  <tr className="bg-amber-50/80 border-t border-black font-bold font-mono text-xs text-amber-950">
                    <td colSpan={6} className="p-2 border border-black text-right uppercase font-sans text-amber-900">
                      Page {currentPage} Subtotal ({paginatedRows.length} invoices):
                    </td>
                    <td className="p-2 border border-black text-right">{paginatedRows.reduce((s: number, r: any) => s + Number(r.totalHeldQty || 0), 0).toLocaleString()}</td>
                    <td className="p-2 border border-black text-right">Rs. {paginatedRows.reduce((s: number, r: any) => s + Number(r.totalOrderAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 border border-black text-right pr-3 bg-emerald-50 text-emerald-900 font-bold">
                      Rs. {paginatedRows.reduce((s: number, r: any) => s + Number(r.totalHeldValue || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {/* 📊 Overall Grand Totals Row */}
                <tr className="bg-gray-100 border-t-2 border-black font-black text-black text-xs font-mono">
                  <td colSpan={6} className="p-2 border border-black text-right uppercase font-sans">Grand Total Summary (All {rows.length} Invoices):</td>
                  <td className="p-2 border border-black text-right">{kpis.totalHeldQty.toLocaleString()}</td>
                  <td className="p-2 border border-black text-right">Rs. {kpis.totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 border border-black text-right pr-3 bg-emerald-100">
                    Rs. {kpis.totalHeldValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <ReportPagination
          totalCount={(rows || []).length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />

        {/* ✍️ Formal Multi-Level Executive Verification & Signature Block */}
        <div className="mt-16 grid grid-cols-3 gap-10 text-center text-[10px] font-sans font-black uppercase tracking-wider text-slate-800 break-inside-avoid">
          <div className="flex flex-col justify-end">
            <div className="signature-spacer h-20 min-h-[80px]" style={{ height: '80px', minHeight: '80px' }}></div>
            <div className="border-t-2 border-black pt-2">
              <div className="text-black font-extrabold text-[10px]">PREPARED BY</div>
              <div className="text-[8.5px] font-semibold text-gray-500 normal-case">Logistics &amp; Gatepass Queue Controller</div>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <div className="signature-spacer h-20 min-h-[80px]" style={{ height: '80px', minHeight: '80px' }}></div>
            <div className="border-t-2 border-black pt-2">
              <div className="text-black font-extrabold text-[10px]">VERIFIED BY</div>
              <div className="text-[8.5px] font-semibold text-gray-500 normal-case">Warehouse Operations &amp; Holding Auditor</div>
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

export default HoldingReportPrint;
