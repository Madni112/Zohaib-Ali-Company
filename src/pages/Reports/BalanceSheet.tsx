import React, { useEffect, useState } from 'react';
import { fetchFinancialMetrics, FinancialSummary } from '../../service/financialCalculations';
import Spinner from '../../ui/Spinner';
import { MdAccountBalance, MdAccountBalanceWallet, MdMonetizationOn, MdInventory, MdTrendingUp, MdAssignmentReturn, MdPrint, MdFileDownload } from 'react-icons/md';
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
  const { businessName } = useAuth();
  const [metrics, setMetrics] = useState<FinancialSummary>(defaultMetrics);
  const [loading, setLoading] = useState(true);

  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

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
        { header: 'Account Classification Code', key: 'code', width: 22 },
        { header: 'Account Description / Group', key: 'title', width: 36 },
        { header: 'Category Type', key: 'category', width: 18 },
        { header: 'Debit Matrix (Rs.)', key: 'debit', width: 20, type: 'currency' },
        { header: 'Credit Matrix (Rs.)', key: 'credit', width: 20, type: 'currency' }
      ];

      const exportData = [
        { code: '1010', title: 'Cash Box & Liquid App Drawer', category: 'ASSET', debit: metrics.cashBalance || 0, credit: 0 },
        { code: '1020', title: 'Corporate Bank Ledger Accounts', category: 'ASSET', debit: metrics.totalBankBalance || 0, credit: 0 },
        { code: '1030', title: 'Accounts Receivable (Customers)', category: 'ASSET', debit: metrics.totalReceivables || 0, credit: 0 },
        { code: '1040', title: 'Merchandise Inventory Stock Assets', category: 'ASSET', debit: metrics.inventoryAssetValue || 0, credit: 0 },
        { code: 'TOTAL ASSETS', title: 'TOTAL COMMERCIAL ASSETS', category: 'ASSETS TOTAL', debit: metrics.totalAssets || 0, credit: 0 },
        { code: '2010', title: 'Accounts Payable (Vendors / Suppliers)', category: 'LIABILITY', debit: 0, credit: metrics.totalPayables || 0 },
        { code: 'TOTAL LIAB', title: 'TOTAL LIABILITIES', category: 'LIABILITIES TOTAL', debit: 0, credit: metrics.totalLiabilities || 0 },
        { code: '3010', title: 'Owner Equity & Retained Earnings', category: 'EQUITY', debit: 0, credit: metrics.totalEquity || 0 },
        { code: 'TOTAL LIAB+EQ', title: 'TOTAL LIABILITIES & EQUITY', category: 'BALANCE TOTAL', debit: 0, credit: (metrics.totalLiabilities || 0) + (metrics.totalEquity || 0) }
      ];

      await exportToExcel({
        fileName: `Corporate_Balance_Sheet_${asOfDate}.xlsx`,
        sheetName: 'Balance Sheet',
        companyName: businessName || 'ZOHAIB ALI & COMPANY',
        reportTitle: `Corporate Balance Sheet Statement (As of ${asOfDate})`,
        filterSummary: { 'As Of Date': asOfDate, 'Standard': 'GAAP Standard (Assets = Liabilities + Equity)' },
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

  const isBalanced = Math.abs((metrics.totalAssets || 0) - ((metrics.totalLiabilities || 0) + (metrics.totalEquity || 0))) < 1;

  if (loading && !metrics.totalAssets && !metrics.totalLiabilities) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-white text-xs print:p-0">
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

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stroke dark:border-strokedark pb-4 print-hidden-element">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
            <MdAccountBalance className="text-primary" size={24} />
            Corporate Balance Sheet & Financial Statement
          </h2>
          <p className="text-gray-400 mt-0.5">
            Automated GAAP Balance Sheet (Assets = Liabilities + Equity) calculated from app ledger transactions
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="rounded border border-stroke py-1.5 px-3 bg-white dark:bg-boxdark outline-none font-semibold text-black dark:text-white"
          />
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-4 rounded font-bold cursor-pointer transition shadow-sm disabled:opacity-50"
          >
            <MdFileDownload size={16} /> {exporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-primary text-white py-1.5 px-4 rounded font-bold hover:bg-opacity-90 transition cursor-pointer shadow-sm"
          >
            <MdPrint size={16} /> Print Statement
          </button>
        </div>
      </div>

      <div className="balance-sheet-print-container flex flex-col gap-6">
        {/* Printable Header */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-black text-black uppercase tracking-wider">ZOHAIB ALI & COMPANY</h1>
          <h2 className="text-lg font-bold text-gray-700">CORPORATE BALANCE SHEET STATEMENT</h2>
          <p className="text-xs text-gray-500 font-mono">As of {asOfDate}</p>
        </div>

        {/* Balance Verification Banner */}
        <div className="rounded-sm border border-stroke bg-white dark:bg-boxdark p-4 shadow-default flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex p-2.5 rounded-full ${isBalanced ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
              <MdAccountBalance size={24} />
            </span>
            <div>
              <h3 className="font-bold text-sm text-black dark:text-white">
                Statement Audit Status: {isBalanced ? <span className="text-success font-extrabold">BALANCED STATEMENT ✅</span> : <span className="text-danger font-extrabold">UNBALANCED STATEMENT ⚠️</span>}
              </h3>
              <p className="text-gray-400 text-xs">
                Formula: Total Assets (Rs. {Number(metrics.totalAssets || 0).toLocaleString()}) = Liabilities (Rs. {Number(metrics.totalLiabilities || 0).toLocaleString()}) + Equity (Rs. {Number(metrics.totalEquity || 0).toLocaleString()})
              </p>
            </div>
          </div>
          <div className="flex gap-4 font-mono text-xs text-right">
            <div className="bg-gray-50 dark:bg-meta-4/20 p-2 rounded">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Assets</span>
              <b className="text-success text-sm font-black">Rs. {Number(metrics.totalAssets || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
            </div>
            <div className="bg-gray-50 dark:bg-meta-4/20 p-2 rounded">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Liabilities</span>
              <b className="text-danger text-sm font-black">Rs. {Number(metrics.totalLiabilities || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
            </div>
            <div className="bg-gray-50 dark:bg-meta-4/20 p-2 rounded">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Equity</span>
              <b className="text-primary text-sm font-black">Rs. {Number(metrics.totalEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
            </div>
          </div>
        </div>

        {/* Two Column Balance Sheet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ASSETS COLUMN */}
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
            <div className="flex items-center justify-between border-b border-stroke dark:border-strokedark pb-3 mb-4">
              <h3 className="text-base font-bold text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                <MdMonetizationOn className="text-success" size={20} /> Current & Fixed Assets
              </h3>
              <span className="text-xs font-mono font-black text-success">Total: Rs. {Number(metrics.totalAssets || 0).toLocaleString()}</span>
            </div>

            <table className="w-full text-left font-mono">
              <tbody>
                {/* Cash Balance */}
                <tr className="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/10">
                  <td className="py-3 font-sans font-bold flex items-center gap-2">
                    <MdAccountBalanceWallet className="text-amber-500" size={16} />
                    Cash in Hand (App Cash Box Liquidity)
                  </td>
                  <td className="py-3 text-right font-black text-success">
                    Rs. {Number(metrics.cashBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Bank Balances Breakdown */}
                <tr className="bg-gray-50/50 dark:bg-meta-4/10 font-sans font-bold text-gray-500 text-[11px]">
                  <td colSpan={2} className="py-2 px-1 uppercase tracking-wider">Corporate Bank Account Ledgers</td>
                </tr>
                {(!metrics.bankAccounts || metrics.bankAccounts.length === 0) ? (
                  <tr className="border-b border-stroke dark:border-strokedark text-gray-400 italic">
                    <td className="py-2 pl-4">No bank ledgers logged</td>
                    <td className="py-2 text-right">Rs. 0.00</td>
                  </tr>
                ) : (
                  metrics.bankAccounts.map((b) => (
                    <tr key={b.id} className="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/10 text-xs">
                      <td className="py-2.5 pl-4 font-sans font-medium text-gray-700 dark:text-gray-300">
                        🏦 {b.bankName} - {b.accountTitle} {b.accountNumber ? `(${b.accountNumber})` : ''}
                      </td>
                      <td className="py-2.5 text-right font-bold text-primary">
                        Rs. {Number(b.netBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}

                {/* Accounts Receivable */}
                <tr className="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/10">
                  <td className="py-3 font-sans font-bold flex items-center gap-2">
                    <MdTrendingUp className="text-emerald-500" size={16} />
                    Accounts Receivable (Client Debt Outstanding)
                  </td>
                  <td className="py-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                    Rs. {Number(metrics.totalReceivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Inventory Asset Value */}
                <tr className="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/10">
                  <td className="py-3 font-sans font-bold flex items-center gap-2">
                    <MdInventory className="text-purple-500" size={16} />
                    Merchandise Inventory Asset Value
                  </td>
                  <td className="py-3 text-right font-black text-purple-600">
                    Rs. {Number(metrics.inventoryAssetValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stroke dark:border-strokedark font-black text-sm bg-success/5">
                  <td className="py-3 font-sans uppercase">TOTAL ASSETS</td>
                  <td className="py-3 text-right text-success">
                    Rs. {Number(metrics.totalAssets || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* LIABILITIES & EQUITY COLUMN */}
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-stroke dark:border-strokedark pb-3 mb-4">
                <h3 className="text-base font-bold text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <MdAssignmentReturn className="text-danger" size={20} /> Liabilities & Equity
                </h3>
                <span className="text-xs font-mono font-black text-danger">Total: Rs. {(Number(metrics.totalLiabilities || 0) + Number(metrics.totalEquity || 0)).toLocaleString()}</span>
              </div>

              <table className="w-full text-left font-mono">
                <tbody>
                  <tr className="bg-gray-50/50 dark:bg-meta-4/10 font-sans font-bold text-gray-500 text-[11px]">
                    <td colSpan={2} className="py-2 px-1 uppercase tracking-wider">Current Liabilities</td>
                  </tr>

                  {/* Accounts Payable */}
                  <tr className="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/10">
                    <td className="py-3 font-sans font-bold text-gray-700 dark:text-gray-300">
                      Accounts Payable (Supplier Credit Unpaid Bills)
                    </td>
                    <td className="py-3 text-right font-black text-danger">
                      Rs. {Number(metrics.totalPayables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="border-b-2 border-stroke dark:border-strokedark font-bold bg-danger/5">
                    <td className="py-2.5 font-sans uppercase text-xs">Total Liabilities</td>
                    <td className="py-2.5 text-right text-danger font-black">
                      Rs. {Number(metrics.totalLiabilities || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="bg-gray-50/50 dark:bg-meta-4/10 font-sans font-bold text-gray-500 text-[11px]">
                    <td colSpan={2} className="py-2 px-1 uppercase tracking-wider mt-4">Owner's Equity & Retained Earnings</td>
                  </tr>

                  {/* Retained Earnings */}
                  <tr className="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/10">
                    <td className="py-3 font-sans font-bold text-gray-700 dark:text-gray-300">
                      Net Capital / Retained Earnings Accumulated
                    </td>
                    <td className="py-3 text-right font-black text-primary">
                      Rs. {Number(metrics.totalEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stroke dark:border-strokedark font-black text-sm bg-primary/5">
                    <td className="py-3 font-sans uppercase">TOTAL LIABILITIES & EQUITY</td>
                    <td className="py-3 text-right text-primary">
                      Rs. {(Number(metrics.totalLiabilities || 0) + Number(metrics.totalEquity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Printable Signatures Strip */}
        <div className="mt-20 hidden print:grid grid-cols-3 gap-12 text-center text-[9px] font-sans font-black uppercase tracking-widest text-gray-400">
          <div className="border-t border-gray-300 pt-2">Accountant Signature</div>
          <div className="border-t border-gray-300 pt-2">Auditor Certification</div>
          <div className="border-t border-gray-300 pt-2">Authorized Seal / Director</div>
        </div>

        {/* 🏢 Software & Corporate Provider Footer */}
        <div className="mt-8 pt-3 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-sans print:border-gray-400">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-black font-black uppercase">ZOHAIB ALI & COMPANY</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-700">Contact: <b className="text-black font-bold">03128039911</b></span>
          </div>
          <div className="text-[9px] text-gray-400 font-mono">
            System Generated Statement • Zohaib Ali & Company
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceSheet;
