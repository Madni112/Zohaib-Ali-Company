import { supabase } from '../Context/supabaseClient';

export interface BankBalanceItem {
  id: string | number;
  bankName: string;
  accountTitle: string;
  accountNumber?: string;
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
}

export interface FinancialSummary {
  cashBalance: number;
  totalBankBalance: number;
  bankAccounts: BankBalanceItem[];
  todaysSales: number;
  thisMonthSales: number;
  thisMonthPurchases: number;
  totalReceivables: number;
  totalPayables: number;
  inventoryAssetValue: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  monthlySalesTrend: { month: string; sales: number; purchases: number }[];
  cashFlowTrend: { month: string; inflow: number; outflow: number }[];
}

export const fetchFinancialMetrics = async (): Promise<FinancialSummary> => {
  try {
    // 1. Fetch data from Supabase tables with fallbacks
    const { data: salesInvoices } = await supabase.from('sales_invoices').select('*');
    const { data: supplierPurchases } = await supabase.from('supplier_purchases').select('*');
    const { data: salesReturns } = await supabase.from('sales_returns').select('*');
    const { data: salesReturnReceipts } = await supabase.from('sales_return_receipts').select('*');
    const { data: purchaseReturns } = await supabase.from('purchase_returns').select('*');
    const { data: purchaseReturnReceipts } = await supabase.from('purchase_return_receipts').select('*');
    const { data: vouchers } = await supabase.from('financial_vouchers').select('*');
    const { data: banks } = await supabase.from('banks').select('*');
    const { data: inventory } = await supabase.from('warehouse_inventory').select('*');
    const { data: products } = await supabase.from('products').select('*');
    const { data: customerReceipts } = await supabase.from('customer_recoveries').select('*');

    const invoicesList = salesInvoices || [];
    const purchasesList = supplierPurchases || [];
    const salesReturnsList = salesReturns || [];
    const salesReturnRecList = salesReturnReceipts || [];
    const purchaseReturnsList = purchaseReturns || [];
    const purchaseReturnRecList = purchaseReturnReceipts || [];
    const vouchersList = vouchers || [];
    const banksList = banks || [];
    const inventoryList = inventory || [];
    const productsList = products || [];
    const customerRecList = customerReceipts || [];

    const todayStr = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // --- 2. Calculate Today's & Monthly Net Sales & Purchases ---
    let todaysSales = 0;
    let thisMonthSales = 0;

    invoicesList.forEach((inv: any) => {
      const invAmt = Number(inv.total_amount || 0);
      const invDateStr = String(inv.created_at || inv.invoice_date || '').split('T')[0];

      if (invDateStr === todayStr) {
        todaysSales += invAmt;
      }

      if (invDateStr) {
        const d = new Date(invDateStr);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          thisMonthSales += invAmt;
        }
      }
    });

    // Deduct Sales Returns from Net Sales Metrics
    salesReturnsList.forEach((ret: any) => {
      const retAmt = Number(ret.total_amount || ret.total_net_amount || 0);
      const retDateStr = String(ret.created_at || ret.return_date || '').split('T')[0];

      if (retDateStr === todayStr) {
        todaysSales -= retAmt;
      }

      if (retDateStr) {
        const d = new Date(retDateStr);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          thisMonthSales -= retAmt;
        }
      }
    });

    todaysSales = Math.max(0, todaysSales);
    thisMonthSales = Math.max(0, thisMonthSales);

    let thisMonthPurchases = 0;
    purchasesList.forEach((pur: any) => {
      const purAmt = Number(pur.total_amount || 0);
      const purDateStr = String(pur.created_at || pur.purchase_date || '').split('T')[0];
      if (purDateStr) {
        const d = new Date(purDateStr);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          thisMonthPurchases += purAmt;
        }
      }
    });

    // Deduct Purchase Returns from Net Monthly Purchases
    purchaseReturnsList.forEach((pret: any) => {
      const pretAmt = Number(pret.total_amount || pret.total_net_amount || 0);
      const pretDateStr = String(pret.created_at || pret.return_date || '').split('T')[0];
      if (pretDateStr) {
        const d = new Date(pretDateStr);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          thisMonthPurchases -= pretAmt;
        }
      }
    });
    thisMonthPurchases = Math.max(0, thisMonthPurchases);

    // --- 3. Calculate Cash Balance (App Cash Drawer Liquidity) ---
    let cashInflow = 0;
    let cashOutflow = 0;

    // Cash Sales Invoices
    invoicesList.forEach((inv: any) => {
      const paid = Number(inv.cash_amount_paid || inv.amount_paid || 0);
      if (inv.settlement_mode === 'Cash' || inv.payment_mode === 'Cash') {
        cashInflow += paid || Number(inv.total_amount || 0);
      } else if (paid > 0) {
        cashInflow += paid;
      }
    });

    // Customer Cash Receipts / Recoveries
    customerRecList.forEach((rec: any) => {
      if (rec.deposit_mode === 'Cash' || rec.payment_mode === 'Cash' || !rec.deposit_mode) {
        cashInflow += Number(rec.net_collected_amount || rec.amount_paid || rec.amount || 0);
      }
    });

    // Financial Vouchers (Cash Receipts)
    vouchersList.forEach((v: any) => {
      const amt = Number(v.total_amount || v.amount || 0);
      const mode = String(v.mode_of_payment || v.voucher_type || '');
      const isReceipt = String(v.voucher_type || '').toLowerCase().includes('receipt');
      const isPayment = String(v.voucher_type || '').toLowerCase().includes('payment');

      if (!mode.toLowerCase().includes('bank')) {
        if (isReceipt) cashInflow += amt;
        if (isPayment) cashOutflow += amt;
      }
    });

    // Cash Purchases Outflow
    purchasesList.forEach((pur: any) => {
      const paid = Number(pur.amount_paid_now || pur.paid_amount || 0);
      if (pur.payment_mode === 'Cash' || pur.settlement_mode === 'Cash') {
        cashOutflow += paid || Number(pur.total_amount || 0);
      } else if (paid > 0 && pur.payment_mode !== 'Bank') {
        cashOutflow += paid;
      }
    });

    // Sales Return Receipts Cash Outflow
    salesReturnRecList.forEach((srec: any) => {
      if (srec.settlement_mode === 'Cash') {
        cashOutflow += Number(srec.amount_paid || 0);
      }
    });

    // Purchase Return Receipts Cash Inflow
    purchaseReturnRecList.forEach((prec: any) => {
      if (prec.settlement_mode === 'Cash') {
        cashInflow += Number(prec.amount_received || prec.amount_paid || 0);
      }
    });

    const netCashBalance = Math.max(0, cashInflow - cashOutflow);

    // --- 4. Calculate Bank Balances per Corporate Bank Ledger ---
    const bankLedgerMap: Record<string, BankBalanceItem> = {};

    banksList.forEach((b: any) => {
      const key = String(b.accountTitle || b.bankName || b.id).trim();
      bankLedgerMap[key] = {
        id: b.id,
        bankName: b.bankName || 'Bank',
        accountTitle: b.accountTitle || key,
        accountNumber: b.accountNumber || '',
        openingBalance: Number(b.openingBalance || 0),
        totalInflow: 0,
        totalOutflow: 0,
        netBalance: Number(b.openingBalance || 0)
      };
    });

    // Bank Invoices
    invoicesList.forEach((inv: any) => {
      if (inv.settlement_mode === 'Bank' && inv.selectedBankTitle) {
        const title = String(inv.selectedBankTitle).trim();
        const amt = Number(inv.cash_amount_paid || inv.total_amount || 0);
        if (!bankLedgerMap[title]) {
          bankLedgerMap[title] = { id: title, bankName: 'Bank', accountTitle: title, openingBalance: 0, totalInflow: 0, totalOutflow: 0, netBalance: 0 };
        }
        bankLedgerMap[title].totalInflow += amt;
      }
    });

    // Bank Supplier Purchases
    purchasesList.forEach((pur: any) => {
      if ((pur.payment_mode === 'Bank' || pur.settlement_mode === 'Bank') && pur.selected_bank_title) {
        const title = String(pur.selected_bank_title).trim();
        const amt = Number(pur.amount_paid_now || pur.total_amount || 0);
        if (!bankLedgerMap[title]) {
          bankLedgerMap[title] = { id: title, bankName: 'Bank', accountTitle: title, openingBalance: 0, totalInflow: 0, totalOutflow: 0, netBalance: 0 };
        }
        bankLedgerMap[title].totalOutflow += amt;
      }
    });

    // Bank Vouchers
    vouchersList.forEach((v: any) => {
      const bankTitle = String(v.bank_account || v.bank_title || '').trim();
      const amt = Number(v.total_amount || 0);
      const isReceipt = String(v.voucher_type || '').toLowerCase().includes('receipt');
      const isPayment = String(v.voucher_type || '').toLowerCase().includes('payment');

      if (bankTitle) {
        if (!bankLedgerMap[bankTitle]) {
          bankLedgerMap[bankTitle] = { id: bankTitle, bankName: 'Bank', accountTitle: bankTitle, openingBalance: 0, totalInflow: 0, totalOutflow: 0, netBalance: 0 };
        }
        if (isReceipt) bankLedgerMap[bankTitle].totalInflow += amt;
        if (isPayment) bankLedgerMap[bankTitle].totalOutflow += amt;
      }
    });

    // Bank Sales Return Receipts Outflow
    salesReturnRecList.forEach((srec: any) => {
      if (srec.settlement_mode === 'Bank' && srec.bank_account_title) {
        const title = String(srec.bank_account_title).trim();
        if (!bankLedgerMap[title]) {
          bankLedgerMap[title] = { id: title, bankName: 'Bank', accountTitle: title, openingBalance: 0, totalInflow: 0, totalOutflow: 0, netBalance: 0 };
        }
        bankLedgerMap[title].totalOutflow += Number(srec.amount_paid || 0);
      }
    });

    const bankAccountsList = Object.values(bankLedgerMap).map(b => {
      b.netBalance = b.openingBalance + b.totalInflow - b.totalOutflow;
      return b;
    });

    const totalBankBalance = bankAccountsList.reduce((acc, b) => acc + b.netBalance, 0);

    // --- 5. True Net Receivables, Payables, Inventory Asset Value ---
    let totalReceivables = 0;
    invoicesList.forEach((inv: any) => {
      const invIdStr = String(inv.id).trim().toLowerCase();
      const tot = Number(inv.total_amount || 0);
      const initialPaid = Number(inv.cash_amount_paid || inv.amount_paid || 0);

      // Sum returns for this specific invoice
      const matchedReturns = salesReturnsList.filter((r: any) => {
        const cleanRef = String(r.original_invoice_no || '').replace('INV-', '').trim().toLowerCase();
        return cleanRef === invIdStr;
      });
      const returnsSum = matchedReturns.reduce((sum: number, r: any) => sum + Number(r.total_amount || r.total_net_amount || 0), 0);

      // Sum vouchers for this specific invoice
      const matchedVouchers = vouchersList.filter((v: any) => {
        const cleanRef = String(v.original_invoice_no || '').replace('INV-', '').trim().toLowerCase();
        const isReceipt = String(v.voucher_type || '').toLowerCase().includes('receipt');
        return isReceipt && cleanRef === invIdStr;
      });
      const vouchersSum = matchedVouchers.reduce((sum: number, v: any) => sum + Number(v.total_amount || 0), 0);

      const netDue = Math.max(0, tot - initialPaid - vouchersSum - returnsSum);
      totalReceivables += netDue;
    });

    let totalPayables = 0;
    purchasesList.forEach((pur: any) => {
      const purIdStr = String(pur.id).trim().toLowerCase();
      const tot = Number(pur.total_amount || 0);
      const initialPaid = Number(pur.amount_paid_now || pur.paid_amount || 0);

      // Sum purchase returns for this specific purchase
      const matchedPReturns = purchaseReturnsList.filter((pr: any) => {
        const cleanRef = String(pr.purchase_no || pr.original_purchase_no || '').replace('PUR-', '').trim().toLowerCase();
        return cleanRef === purIdStr;
      });
      const pReturnsSum = matchedPReturns.reduce((sum: number, pr: any) => sum + Number(pr.total_amount || 0), 0);

      const netPayableDue = Math.max(0, tot - initialPaid - pReturnsSum);
      totalPayables += netPayableDue;
    });

    let inventoryAssetValue = 0;
    // Map product prices for accurate inventory valuation
    const priceMap: Record<string, number> = {};
    productsList.forEach((p: any) => {
      priceMap[p.product_name] = Number(p.retail_price || p.purchase_price || p.mrp || 0);
    });

    inventoryList.forEach((invItem: any) => {
      const qty = Number(invItem.quantity || 0);
      const unitPrice = priceMap[invItem.product_name] || Number(invItem.unit_cost || 0);
      inventoryAssetValue += (qty * unitPrice);
    });

    // --- 6. Balance Sheet Equation Totals ---
    const totalAssets = netCashBalance + totalBankBalance + totalReceivables + inventoryAssetValue;
    const totalLiabilities = totalPayables;
    const totalEquity = totalAssets - totalLiabilities;

    // --- 7. Monthly Trends (Last 6 Months) ---
    const monthsName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySalesTrendMap: Record<string, { sales: number; purchases: number }> = {};
    const cashFlowTrendMap: Record<string, { inflow: number; outflow: number }> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = `${monthsName[d.getMonth()]} ${d.getFullYear()}`;
      monthlySalesTrendMap[key] = { sales: 0, purchases: 0 };
      cashFlowTrendMap[key] = { inflow: 0, outflow: 0 };
    }

    invoicesList.forEach((inv: any) => {
      const d = new Date(inv.created_at || inv.invoice_date);
      if (!isNaN(d.getTime())) {
        const key = `${monthsName[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlySalesTrendMap[key]) {
          monthlySalesTrendMap[key].sales += Number(inv.total_amount || 0);
        }
        if (cashFlowTrendMap[key]) {
          cashFlowTrendMap[key].inflow += Number(inv.cash_amount_paid || inv.total_amount || 0);
        }
      }
    });

    // Deduct Sales Returns from Monthly Trend
    salesReturnsList.forEach((ret: any) => {
      const d = new Date(ret.created_at || ret.return_date);
      if (!isNaN(d.getTime())) {
        const key = `${monthsName[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlySalesTrendMap[key]) {
          monthlySalesTrendMap[key].sales = Math.max(0, monthlySalesTrendMap[key].sales - Number(ret.total_amount || ret.total_net_amount || 0));
        }
      }
    });

    purchasesList.forEach((pur: any) => {
      const d = new Date(pur.created_at || pur.purchase_date);
      if (!isNaN(d.getTime())) {
        const key = `${monthsName[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlySalesTrendMap[key]) {
          monthlySalesTrendMap[key].purchases += Number(pur.total_amount || 0);
        }
        if (cashFlowTrendMap[key]) {
          cashFlowTrendMap[key].outflow += Number(pur.amount_paid_now || pur.total_amount || 0);
        }
      }
    });

    // Deduct Purchase Returns from Monthly Trend
    purchaseReturnsList.forEach((pret: any) => {
      const d = new Date(pret.created_at || pret.return_date);
      if (!isNaN(d.getTime())) {
        const key = `${monthsName[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlySalesTrendMap[key]) {
          monthlySalesTrendMap[key].purchases = Math.max(0, monthlySalesTrendMap[key].purchases - Number(pret.total_amount || pret.total_net_amount || 0));
        }
      }
    });

    const monthlySalesTrend = Object.keys(monthlySalesTrendMap).map(k => ({
      month: k,
      sales: monthlySalesTrendMap[k].sales,
      purchases: monthlySalesTrendMap[k].purchases
    }));

    const cashFlowTrend = Object.keys(cashFlowTrendMap).map(k => ({
      month: k,
      inflow: cashFlowTrendMap[k].inflow,
      outflow: cashFlowTrendMap[k].outflow
    }));

    return {
      cashBalance: netCashBalance,
      totalBankBalance,
      bankAccounts: bankAccountsList,
      todaysSales,
      thisMonthSales,
      thisMonthPurchases,
      totalReceivables,
      totalPayables,
      inventoryAssetValue,
      totalAssets,
      totalLiabilities,
      totalEquity,
      monthlySalesTrend,
      cashFlowTrend
    };
  } catch (err) {
    console.error('Error calculating financial metrics:', err);
    return {
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
  }
};

/**
 * Automatically recalculates and synchronizes the receipt_status of an invoice
 * by comparing total bill amount with upfront payments, vouchers, and debit notes.
 */
export const recalculateInvoiceSettlementStatus = async (invoiceId: string | number) => {
  try {
    const rawInvId = String(invoiceId || '').replace(/\D/g, '');
    if (!rawInvId) return;

    const { data: inv } = await supabase
      .from('sales_invoices')
      .select('id, total_amount, cash_amount_paid, bank_amount')
      .eq('id', Number(rawInvId))
      .maybeSingle();

    if (!inv) return;

    // 1. Fetch all subsequent receipt vouchers for this invoice
    const { data: remVouchers } = await supabase
      .from('financial_vouchers')
      .select('total_amount')
      .or('voucher_type.eq.Cash Receipt Voucher,voucher_type.eq.Bank Receipt Voucher,voucher_type.eq.Cash & Bank Receipt Voucher')
      .or(`original_invoice_no.eq.${rawInvId},original_invoice_no.eq.INV-${rawInvId}`);

    const subsequentVoucherPaid = (remVouchers || []).reduce(
      (sum: number, v: any) => sum + (Number(v.total_amount) || 0),
      0
    );

    // 2. Fetch sales returns / debit notes against this invoice
    const { data: returns } = await supabase
      .from('sales_returns')
      .select('total_amount')
      .or(`original_invoice_no.eq.${rawInvId},original_invoice_no.eq.INV-${rawInvId}`);

    const totalReturned = (returns || []).reduce(
      (sum: number, r: any) => sum + (Number(r.total_amount) || 0),
      0
    );

    // 3. Upfront payments made at the time of sale
    const initialBankPaid = Number(inv.bank_amount || 0);
    const initialCashPaid = Number(inv.cash_amount_paid || 0);

    const totalPaidSoFar = initialCashPaid + initialBankPaid + subsequentVoucherPaid + totalReturned;
    const netTotal = Number(inv.total_amount || 0);
    const netOutstanding = netTotal - totalPaidSoFar;

    let targetStatus = 'Unpaid';
    if (netOutstanding <= 1) {
      targetStatus = 'Paid';
    } else if (totalPaidSoFar > 0) {
      targetStatus = 'Partial';
    }

    await supabase
      .from('sales_invoices')
      .update({ receipt_status: targetStatus })
      .eq('id', Number(rawInvId));

    return targetStatus;
  } catch (err) {
    console.error('Failed to recalculate invoice settlement status:', err);
  }
};

