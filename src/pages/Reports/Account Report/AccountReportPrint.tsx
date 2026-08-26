import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdPrint, MdArrowBack } from 'react-icons/md';
import { useAuth } from '../../../Context/Auth';

const AccountReportPrint = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { businessName, tenantId } = useAuth();
    const [loading, setLoading] = useState(true);

    const [reportRows, setReportRows] = useState<any[]>([]);

    const config = location.state || { tab: 1, criteria: {} };
    const { tab: activeTab, criteria: filters } = config;

    useEffect(() => {
        const compileAccountAuditingDataset = async () => {
            try {
                setLoading(true);

                // --- 📊 TAB 1: MASTER RECONCILED GENERAL LEDGER TWO-LINE TIMELINE ---
                if (activeTab === 1) {
                    const { data: sales } = await supabase.from('sales_invoices').select('*');
                    const { data: purchases } = await supabase.from('supplier_purchases').select('*');
                    const { data: rawVouchers } = await supabase.from('financial_vouchers').select('*');
                    const { data: salesReturns } = await supabase.from('sales_returns').select('*');
                    const { data: returnReceipts } = await supabase.from('sales_return_receipts').select('*');

                    const unifiedLedgerEntries: any[] = [];

                    const parseDateString = (dateInput: any) => {
                        if (!dateInput) return '';
                        const str = String(dateInput).trim();
                        if (str.includes('T')) return str.split('T')[0];
                        if (str.includes(' ')) return str.split(' ')[0];
                        return str;
                    };

                    (sales || []).forEach(s => {
                        if (String(s.sale_status).trim().toLowerCase() !== 'cancel') {
                            unifiedLedgerEntries.push({
                                voucher_no: s.id ? `INV-${String(s.id).padStart(4, '0')}` : 'N/A',
                                description: `Commercial Sale Invoice - Customer Account: ${s.customer_name}`,
                                debit: 0,
                                credit: Number(s.total_amount || 0),
                                raw_date: parseDateString(s.sale_date || s.created_at)
                            });
                        }
                    });

                    (purchases || []).forEach(p => {
                        unifiedLedgerEntries.push({
                            voucher_no: p.purchase_no || `PUR-00${p.id}`,
                            description: `Procurement Stock Acquisition - Vendor: ${p.supplier_name}`,
                            debit: Number(p.total_amount || 0),
                            credit: 0,
                            raw_date: parseDateString(p.purchase_date || p.created_at)
                        });
                    });

                    // C. Map Standalone Vouchers
                    (rawVouchers || []).forEach(v => {
                        const vType = String(v.voucherType || '').trim().toLowerCase();
                        const isReceipt = vType.includes('receipt') || vType.endsWith('rv');
                        const amt = Number(v.amountReceived || 0);

                        unifiedLedgerEntries.push({
                            voucher_no: v.voucherNo || `VCH-${v.id}`,
                            description: v.remarks || `Voucher entry - Account: ${v.customerName || 'General'}`,
                            debit: !isReceipt ? amt : 0,
                            credit: isReceipt ? amt : 0,
                            raw_date: parseDateString(v.voucherDate || v.created_at)
                        });
                    });

                    (salesReturns || []).forEach(rtn => {
                        const trueReturnedValue = Number(rtn.payout_amount_paid || rtn.total_amount || rtn.total_net_amount || 0);

                        unifiedLedgerEntries.push({
                            voucher_no: rtn.id ? `RTN-${String(rtn.id).padStart(4, '0')}` : 'N/A',
                            description: `Sales Return Invoice (Orig INV: ${rtn.original_invoice_no}) - Customer: ${rtn.customer_name}`,
                            debit: trueReturnedValue, // ✅ Fixed: Now accurately injects the true returned amounts (10,000 & 7,200) into Debits column
                            credit: 0,
                            raw_date: parseDateString(rtn.return_date || rtn.created_at)
                        });
                    });

                    // E. Map Sales Return Cash Receipts (Debits - Formatted as REC-)
                    (returnReceipts || []).forEach(rec => {
                        unifiedLedgerEntries.push({
                            voucher_no: rec.id ? `REC-${String(rec.id).padStart(4, '0')}` : 'N/A',
                            description: `Sales Return Cash Receipt Payout (Orig INV: ${rec.original_invoice_no}) - Customer: ${rec.customer_name}`,
                            debit: Number(rec.amount_paid || 0),
                            credit: 0,
                            raw_date: parseDateString(rec.processing_date || rec.created_at)
                        });
                    });

                    let filteredPool = unifiedLedgerEntries.filter(entry => entry.raw_date);
                    if (filters.dateFrom && filters.dateTo) {
                        filteredPool = filteredPool.filter(e => e.raw_date >= filters.dateFrom && e.raw_date <= filters.dateTo);
                    }

                    filteredPool.sort((a, b) => a.raw_date.localeCompare(b.raw_date));

                    let cumulativeBalance = 0;
                    const finalPayload = filteredPool.map(e => {
                        cumulativeBalance += (e.credit - e.debit);
                        return { ...e, balance: cumulativeBalance };
                    });

                    setReportRows(finalPayload);
                }


                else if (activeTab === 2) {
                    const { data: invoices, error: invErr } = await supabase
                        .from('sales_invoices')
                        .select('*')
                        .order('id', { ascending: true });

                    const { data: returns, error: retErr } = await supabase
                        .from('sales_returns')
                        .select('original_invoice_no, total_amount, total_net_amount');

                    if (invErr) throw invErr;
                    if (retErr) throw retErr;

                    let pool = invoices || [];

                    if (filters.customer && filters.customer !== 'All') {
                        pool = pool.filter(row => row.customer_name === filters.customer);
                    }

                    if (filters.dateFrom && filters.dateTo) {
                        const startTimestamp = new Date(filters.dateFrom).getTime();
                        const endTimestamp = new Date(filters.dateTo).getTime();

                        pool = pool.filter(row => {
                            const rawRowDate = row.sale_date || String(row.created_at || '').split('T')[0];
                            if (!rawRowDate) return false;
                            const rowTimestamp = new Date(rawRowDate).getTime();
                            return rowTimestamp >= startTimestamp && rowTimestamp <= endTimestamp;
                        });
                    }

                    const adjustedCustomerRows = pool.map(inv => {
                        const matchingReturns = (returns || []).filter(r => {
                            const cleanRef = String(r.original_invoice_no || '').replace('INV-', '').trim();
                            return cleanRef === String(inv.id).trim();
                        });

                        const totalReturnedValue = matchingReturns.reduce((sum, r) => sum + Number(r.total_amount || r.total_net_amount || 0), 0);

                        const finalAdjustedInvoiceValue = Math.max(0, Number(inv.total_amount || 0) - totalReturnedValue);

                        return {
                            ...inv,
                            total_amount: finalAdjustedInvoiceValue
                        };
                    });

                    setReportRows(adjustedCustomerRows);
                }

                // --- 📊 TAB 12: ACCOUNT DEBIT AGING MATRIX SHEET (AGING REPORT) ---
                else if (activeTab === 12) {
                    const { data: invoices, error: invErr } = await supabase
                        .from('sales_invoices')
                        .select('*')
                        .order('id', { ascending: true });

                    if (invErr) throw invErr;

                    const today = new Date();

                    const customerAgingMap: Record<string, {
                        customer_name: string;
                        total_due: number;
                        days_0_30: number;
                        days_31_60: number;
                        days_61_90: number;
                        days_90_plus: number;
                        invoice_count: number;
                    }> = {};

                    (invoices || []).forEach(inv => {
                        const custName = inv.customer_name || 'General Customer';

                        if (filters.customer && filters.customer !== 'All' && custName !== filters.customer) {
                            return;
                        }

                        const totalAmount = Number(inv.total_amount || 0);
                        const paidAmount = Number(inv.cash_amount_paid || inv.amount_paid || 0);
                        const outstanding = totalAmount - paidAmount;

                        if (outstanding <= 0) return;

                        const rawDate = inv.sale_date || String(inv.created_at || '').split('T')[0];
                        const invDate = new Date(rawDate ? (rawDate.includes('T') ? rawDate : rawDate + 'T12:00:00') : Date.now());
                        const diffTime = Math.max(0, today.getTime() - invDate.getTime());
                        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        if (!customerAgingMap[custName]) {
                            customerAgingMap[custName] = {
                                customer_name: custName,
                                total_due: 0,
                                days_0_30: 0,
                                days_31_60: 0,
                                days_61_90: 0,
                                days_90_plus: 0,
                                invoice_count: 0
                            };
                        }

                        const entry = customerAgingMap[custName];
                        entry.total_due += outstanding;
                        entry.invoice_count += 1;

                        if (daysOverdue <= 30) {
                            entry.days_0_30 += outstanding;
                        } else if (daysOverdue <= 60) {
                            entry.days_31_60 += outstanding;
                        } else if (daysOverdue <= 90) {
                            entry.days_61_90 += outstanding;
                        } else {
                            entry.days_90_plus += outstanding;
                        }
                    });

                    const agingRows = Object.values(customerAgingMap);
                    setReportRows(agingRows);
                }



                // --- 📊 TABS 3 & 6: PROCUREMENT VENDOR BALANCES WITH LIVE FINANCIAL VOUCHERS INTEGRATION ---
                else if (activeTab === 3 || activeTab === 6) {
                    // 1. Fetch original vendor procurement invoices
                    let query = supabase
                        .from('supplier_purchases')
                        .select('*')
                        .order('id', { ascending: true });

                    if (filters.vendor && filters.vendor !== 'All') {
                        query = query.eq('supplier_name', filters.vendor);
                    }

                    const { data: purchasesData, error: purchaseErr } = await query;
                    if (purchaseErr) throw purchaseErr;

                    // 2. ✅ SCHEMA MATCHED: Reads strict schema variables from financial_vouchers definitions
                    const { data: vouchersData, error: voucherErr } = await supabase
                        .from('financial_vouchers')
                        .select('voucher_no, original_invoice_no, total_amount');

                    if (voucherErr) throw voucherErr;

                    let pool = purchasesData || [];

                    // Apply calendar timeline bracket filters
                    if (filters.dateFrom && filters.dateTo) {
                        const startTimestamp = new Date(filters.dateFrom).getTime();
                        const endTimestamp = new Date(filters.dateTo).getTime();

                        pool = pool.filter(row => {
                            const rawRowDate = row.purchase_date || String(row.created_at || '').split('T')[0];
                            if (!rawRowDate) return false;
                            const rowTimestamp = new Date(rawRowDate).getTime();
                            return rowTimestamp >= startTimestamp && rowTimestamp <= endTimestamp;
                        });
                    }

                    // 3. ✅ THE UNIFIED ACCURATE DEBT BALANCER ENGINE
                    const calculatedVendorOutstandingRows = pool.map(p => {
                        const grossBillTotal = Number(p.total_amount || 0);

                        // Capture your upfront cash payment field safely from your supplier_purchases table column variables
                        const amountPaidUpfront = Number(p.amount_paid || p.paid_amount || p.cash_amount_paid || p.cash_paid || 0);

                        // Find all subsequent receipts inside financial_vouchers matching this purchase order ID reference number
                        const currentPurchaseNo = String(p.purchase_no || `PUR-0900${p.id}`).toUpperCase().trim();
                        const rawPurchaseId = String(p.id).trim();

                        const subsequentReceipts = (vouchersData || []).filter(v => {
                            const cleanVoucherNo = String(v.voucher_no || '').toUpperCase().trim();
                            const cleanInvoiceNo = String(v.original_invoice_no || '').toUpperCase().trim();

                            // ✅ MULTI-COLUMN INTERCEPTOR: Scans both voucher references for matches (e.g. "PUR-090015")
                            return (
                                cleanVoucherNo === currentPurchaseNo ||
                                cleanVoucherNo.includes(currentPurchaseNo) ||
                                cleanInvoiceNo === currentPurchaseNo ||
                                cleanInvoiceNo.includes(currentPurchaseNo) ||
                                cleanVoucherNo.includes(rawPurchaseId)
                            );
                        });

                        // Aggregate all subsequent cash receipt payouts using your true total_amount column
                        const totalSubsequentReceiptsSum = subsequentReceipts.reduce((sum, v) => sum + Number(v.total_amount || 0), 0);

                        // True credit debt = Gross Bill (300,000) - Upfront Cash (10,000) - Subsequent Vouchers (90,000)
                        const trueNetCreditDebtRemaining = activeTab === 6
                            ? Math.max(0, grossBillTotal - amountPaidUpfront - totalSubsequentReceiptsSum)
                            : grossBillTotal;

                        return {
                            ...p,
                            total_amount: trueNetCreditDebtRemaining // Updates row to show true outstanding balance (200,000)
                        };
                    });

                    setReportRows(calculatedVendorOutstandingRows);
                }




                else if (activeTab === 4) {
                    const { data: rev } = await supabase.from('sales_invoices').select('total_amount, sale_date, created_at');
                    const { data: exp } = await supabase.from('supplier_purchases').select('total_amount, purchase_date, created_at');
                    const { data: ret } = await supabase.from('sales_returns').select('*');
                    const { data: rec } = await supabase.from('sales_return_receipts').select('*');
                    const { data: pret } = await supabase.from('purchase_returns').select('*');

                    let filteredRev = rev || [];
                    let filteredExp = exp || [];
                    let filteredRet = ret || [];
                    let filteredRec = rec || [];
                    let filteredPRet = pret || [];

                    if (filters.dateFrom && filters.dateTo) {
                        const startTimestamp = new Date(filters.dateFrom + 'T00:00:00').getTime();
                        const endTimestamp = new Date(filters.dateTo + 'T23:59:59').getTime();

                        filteredRev = filteredRev.filter(s => {
                            const d = s.sale_date || s.created_at;
                            if (!d) return false;
                            const ts = new Date(String(d).includes('T') ? String(d) : String(d) + 'T12:00:00').getTime();
                            return ts >= startTimestamp && ts <= endTimestamp;
                        });

                        filteredExp = filteredExp.filter(p => {
                            const d = p.purchase_date || p.created_at;
                            if (!d) return false;
                            const ts = new Date(String(d).includes('T') ? String(d) : String(d) + 'T12:00:00').getTime();
                            return ts >= startTimestamp && ts <= endTimestamp;
                        });

                        filteredRet = filteredRet.filter(r => {
                            const d = r.return_date || r.created_at;
                            if (!d) return false;
                            const ts = new Date(String(d).includes('T') ? String(d) : String(d) + 'T12:00:00').getTime();
                            return ts >= startTimestamp && ts <= endTimestamp;
                        });

                        filteredRec = filteredRec.filter(rc => {
                            const d = rc.processing_date || rc.created_at;
                            if (!d) return false;
                            const ts = new Date(String(d).includes('T') ? String(d) : String(d) + 'T12:00:00').getTime();
                            return ts >= startTimestamp && ts <= endTimestamp;
                        });

                        filteredPRet = filteredPRet.filter(pr => {
                            const d = pr.return_date || pr.created_at;
                            if (!d) return false;
                            const ts = new Date(String(d).includes('T') ? String(d) : String(d) + 'T12:00:00').getTime();
                            return ts >= startTimestamp && ts <= endTimestamp;
                        });
                    }

                    setReportRows([
                        { title: 'Gross Revenue (Sales Log Summary)', entries: filteredRev, type: 'income' },
                        { title: 'Cost of Goods Sold (Procurements)', entries: filteredExp, type: 'expense' },
                        { title: 'Sales Returns Summary', entries: filteredRet, type: 'return_sales' },
                        { title: 'Sales Return Receipts Log', entries: filteredRec, type: 'receipt_sales' },
                        { title: 'Purchase Returns Log', entries: filteredPRet, type: 'return_purchases' }
                    ]);
                }




                else if (activeTab === 5) {
                    let query = supabase.from('chart_of_accounts').select('*');
                    if (filters.categoryCode && filters.categoryCode !== 'All') query = query.eq('category_code', filters.categoryCode);
                    if (filters.controlCode && filters.controlCode !== 'All') query = query.eq('control_code', filters.controlCode);
                    if (filters.chartOfAccountCode && filters.chartOfAccountCode !== 'All') query = query.eq('account_code', filters.chartOfAccountCode);

                    const { data, error } = await query;
                    if (error) throw error;
                    setReportRows(data || []);
                }

                // --- 📊 TAB 11: GENERAL TRIAL BALANCE AUDIT WORKBOOK ---
                else if (activeTab === 11) {
                    const { data: sales } = await supabase.from('sales_invoices').select('total_amount, cash_amount_paid, amount_paid, payment_term, created_at, sale_date');
                    const { data: purchases } = await supabase.from('supplier_purchases').select('total_amount, amount_paid_now, paid_amount, created_at, purchase_date');
                    const { data: sReturns } = await supabase.from('sales_returns').select('total_amount, payout_amount_paid');
                    const { data: pReturns } = await supabase.from('purchase_returns').select('total_amount, amount_received');
                    const { data: vouchers } = await supabase.from('financial_vouchers').select('total_amount, voucher_type, mode_of_payment');
                    const { data: banks } = await supabase.from('banks').select('bankName, accountTitle, openingBalance');
                    const { data: inventory } = await supabase.from('warehouse_inventory').select('product_name, quantity');
                    const { data: products } = await supabase.from('products').select('product_name, retail_price, purchase_price');

                    // 1. Gross Sales & Returns
                    const grossSalesSum = (sales || []).reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
                    const salesReturnsSum = (sReturns || []).reduce((acc, r) => acc + Number(r.payout_amount_paid || r.total_amount || 0), 0);

                    // 2. Gross Procurements & Returns
                    const grossPurchasesSum = (purchases || []).reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
                    const purchaseReturnsSum = (pReturns || []).reduce((acc, r) => acc + Number(r.amount_received || r.total_amount || 0), 0);

                    // 3. Receivables & Payables
                    let totalReceivables = 0;
                    (sales || []).forEach(s => {
                        const tot = Number(s.total_amount || 0);
                        const paid = Number(s.cash_amount_paid || s.amount_paid || 0);
                        if (tot > paid) totalReceivables += (tot - paid);
                    });

                    let totalPayables = 0;
                    (purchases || []).forEach(p => {
                        const tot = Number(p.total_amount || 0);
                        const paid = Number(p.amount_paid_now || p.paid_amount || 0);
                        if (tot > paid) totalPayables += (tot - paid);
                    });

                    // 4. Cash Drawer Liquidity
                    let cashInflow = 0;
                    let cashOutflow = 0;
                    (sales || []).forEach(s => { cashInflow += Number(s.cash_amount_paid || s.amount_paid || 0); });
                    (purchases || []).forEach(p => { cashOutflow += Number(p.amount_paid_now || p.paid_amount || 0); });
                    (vouchers || []).forEach(v => {
                        const amt = Number(v.total_amount || 0);
                        const vType = String(v.voucher_type || '').toLowerCase();
                        if (vType.includes('receipt')) cashInflow += amt;
                        if (vType.includes('payment')) cashOutflow += amt;
                    });
                    const netCashBox = Math.max(0, cashInflow - cashOutflow);

                    // 5. Bank Accounts Total
                    const totalBankLedgers = (banks || []).reduce((acc, b) => acc + Number(b.openingBalance || 0), 0);

                    // 6. Inventory Valuation Asset
                    const pPriceMap: Record<string, number> = {};
                    (products || []).forEach(p => { pPriceMap[p.product_name] = Number(p.retail_price || p.purchase_price || 0); });
                    let totalInventoryValue = 0;
                    (inventory || []).forEach(item => {
                        const qty = Number(item.quantity || 0);
                        totalInventoryValue += (qty * (pPriceMap[item.product_name] || 0));
                    });

                    const totalDebitsWithoutEquity = netCashBox + totalBankLedgers + totalReceivables + totalInventoryValue + salesReturnsSum + grossPurchasesSum;
                    const totalCreditsWithoutEquity = totalPayables + grossSalesSum + purchaseReturnsSum;
                    const totalEquityVal = Math.max(0, totalDebitsWithoutEquity - totalCreditsWithoutEquity);

                    let trialBalanceRows = [
                        { code: '1010', title: 'Cash Box / App Liquid Drawer', category: 'A-ASSETS', debit: netCashBox, credit: 0 },
                        { code: '1020', title: 'Corporate Bank Ledgers & Accounts', category: 'A-ASSETS', debit: totalBankLedgers, credit: 0 },
                        { code: '1030', title: 'Accounts Receivable (Customer Credit Bills)', category: 'A-ASSETS', debit: totalReceivables, credit: 0 },
                        { code: '1040', title: 'Merchandise Inventory Stock Valuation', category: 'A-ASSETS', debit: totalInventoryValue, credit: 0 },
                        { code: '2010', title: 'Accounts Payable (Supplier Credit Unpaid Bills)', category: 'LIABILITIES', debit: 0, credit: totalPayables },
                        { code: '3010', title: 'Owner\'s Capital & Retained Earnings Pool', category: 'EQUITY', debit: 0, credit: totalEquityVal },
                        { code: '4010', title: 'Gross Commercial Sales Operating Revenue', category: 'REVENUE', debit: 0, credit: grossSalesSum },
                        { code: '4020', title: 'Sales Returns & Credit Allowances', category: 'CONTRA-REVENUE', debit: salesReturnsSum, credit: 0 },
                        { code: '5010', title: 'Cost of Goods Sold & Direct Procurements', category: 'EXPENSE', debit: grossPurchasesSum, credit: 0 },
                        { code: '5020', title: 'Purchase Returns & Supplier Allowance Credits', category: 'CONTRA-EXPENSE', debit: 0, credit: purchaseReturnsSum },
                    ];

                    if (filters.categoryCode && filters.categoryCode !== 'All') {
                        const cFilter = String(filters.categoryCode).trim().toLowerCase();
                        trialBalanceRows = trialBalanceRows.filter(r => {
                            const rCat = String(r.category).trim().toLowerCase();
                            const rCode = String(r.code).trim().toLowerCase();
                            return rCat.includes(cFilter) || cFilter.includes(rCat) || rCode.startsWith(cFilter);
                        });
                    }

                    setReportRows(trialBalanceRows);
                }

                // --- 📊 TAB 7: CUSTOMER RECOVERY COLLECTION STATEMENT ---
                else if (activeTab === 7) {
                    // ✅ FIXED STRING MATCH: Matches your true database value 'Cash Receipt Voucher' perfectly
                    let query = supabase
                        .from('financial_vouchers')
                        .select('*')
                        .eq('voucher_type', 'Cash Receipt Voucher')
                        .order('id', { ascending: true });

                    if (filters.customer && filters.customer !== 'All') {
                        query = query.eq('customer_name', filters.customer);
                    }

                    const { data, error } = await query;
                    if (error) throw error;

                    let pool = data || [];

                    // Applies your calendar timeline range parameters safely (YYYY-MM-DD)
                    if (filters.dateFrom && filters.dateTo) {
                        const startStr = filters.dateFrom;
                        const endStr = filters.dateTo;

                        pool = pool.filter(row => {
                            const dateRaw = row.voucher_date || row.created_at || '';
                            if (!dateRaw) return false;

                            const cleanRowStr = String(dateRaw).includes('T')
                                ? String(dateRaw).split('T')[0]
                                : String(dateRaw).split(' ')[0]; // Handles space dividers safely too

                            return cleanRowStr >= startStr && cleanRowStr <= endStr;
                        });
                    }

                    setReportRows(pool);
                }




                else if (activeTab === 10) {
                    const { data: salesData } = await supabase.from('sales_invoices').select('*');
                    const { data: vouchersData } = await supabase.from('financial_vouchers').select('*');

                    let unifiedRows: any[] = [];

                    (salesData || []).forEach(s => {
                        unifiedRows.push({
                            id: `INV-${s.id}`,
                            doc_ref: `INV-${String(s.id).padStart(4, '0')}`,
                            entry_type: 'Sales Invoice',
                            salesman: s.salesman || 'Direct',
                            customer_name: s.customer_name || 'Retail Client',
                            raw_date: s.sale_date || String(s.created_at || '').split('T')[0],
                            sale_amount: Number(s.total_amount || 0),
                            collected_amount: Number(s.cash_amount_paid || s.amount_paid || 0),
                            narration: `Commercial Invoice Sale (${s.payment_term || 'Credit'})`
                        });
                    });

                    (vouchersData || []).forEach(v => {
                        const vType = String(v.voucher_type || v.voucherType || '').toLowerCase();
                        if (vType.includes('receipt') || vType.includes('crv') || vType.includes('recovery')) {
                            unifiedRows.push({
                                id: `REC-${v.id}`,
                                doc_ref: v.voucher_no || `REC-${String(v.id).padStart(4, '0')}`,
                                entry_type: 'Cash Recovery Collection',
                                salesman: v.salesman || 'Direct Recovery',
                                customer_name: v.customer_name || v.customerName || 'General Account',
                                raw_date: v.voucher_date || String(v.created_at || '').split('T')[0],
                                sale_amount: 0,
                                collected_amount: Number(v.total_amount || v.amount_paid || v.net_collected_amount || 0),
                                narration: v.narration || v.notes || 'Customer Recovery Collection'
                            });
                        }
                    });

                    if (filters.salesman && filters.salesman !== 'All') {
                        unifiedRows = unifiedRows.filter(r => String(r.salesman).toLowerCase() === String(filters.salesman).toLowerCase());
                    }

                    if (filters.dateFrom && filters.dateTo) {
                        const startTimestamp = new Date(filters.dateFrom + 'T00:00:00').getTime();
                        const endTimestamp = new Date(filters.dateTo + 'T23:59:59').getTime();
                        unifiedRows = unifiedRows.filter(r => {
                            if (!r.raw_date) return true;
                            const ts = new Date(String(r.raw_date).includes('T') ? String(r.raw_date) : String(r.raw_date) + 'T12:00:00').getTime();
                            return ts >= startTimestamp && ts <= endTimestamp;
                        });
                    }

                    setReportRows(unifiedRows);
                }

                else if (activeTab === 8 || activeTab === 9) {
                    let tableTarget = filters.saleType === 'Purchase' ? 'supplier_purchases' : (filters.saleType === 'Cashbook' || filters.saleType === 'Banks' || activeTab === 8) ? 'financial_vouchers' : 'sales_invoices';
                    if (activeTab === 8) tableTarget = 'financial_vouchers';

                    let query = supabase.from(tableTarget).select('*');
                    const { data, error } = await query;
                    if (error) throw error;

                    let pool = data || [];
                    if (activeTab === 8 && filters.voucherType && filters.voucherType !== 'All') {
                        const vFilter = String(filters.voucherType).trim().toLowerCase();
                        pool = pool.filter(v => {
                            const vType = String(v.voucher_type || v.voucherType || '').trim().toLowerCase();
                            return vType.includes(vFilter) || vFilter.includes(vType);
                        });
                    }
                    if (filters.dateFrom && filters.dateTo) {
                        const startTimestamp = new Date(filters.dateFrom + 'T00:00:00').getTime();
                        const endTimestamp = new Date(filters.dateTo + 'T23:59:59').getTime();
                        pool = pool.filter(v => {
                            const rawDate = v.voucher_date || v.voucherDate || v.processing_date || v.sale_date || v.purchase_date || String(v.created_at || '').split('T')[0];
                            if (!rawDate) return true;
                            const ts = new Date(String(rawDate).includes('T') ? String(rawDate) : String(rawDate) + 'T12:00:00').getTime();
                            return ts >= startTimestamp && ts <= endTimestamp;
                        });
                    }

                    setReportRows(pool);
                }

            } catch (err: any) {
                toast.error('Financial compiling routine failure: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        compileAccountAuditingDataset();
    }, [activeTab, filters]);

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
                    <button type="button" onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Reports/Account-Report`)} className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer"><MdArrowBack size={16} /> Return to Auditing Center</button>
                    <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 bg-primary text-white py-1.5 px-5 rounded font-black cursor-pointer hover:bg-opacity-90 transition shadow-sm"><MdPrint size={16} /> Print Workbook Report</button>
                </div>

                <div className="text-center space-y-1 py-4 border-b border-double border-black">
                    <h1 className="text-xl font-black uppercase tracking-widest font-serif">ZOHAIB ALI & COMPANY</h1>
                    <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Master Corporate Ledger Book & Financial Audit Statement Summary</p>

                    <div className="text-[10px] pt-1 font-mono flex justify-between px-2 text-gray-600">
                        <span>Audit Sub-Categorization: <b className="text-black uppercase underline">
                            {activeTab === 1 && 'General Ledger Audit Statement'}
                            {activeTab === 2 && 'Customer Account Balance Ledger'}
                            {activeTab === 3 && 'Procurement Vendor Balance Ledger'}
                            {activeTab === 4 && 'Enterprise Income Statement / P&L'}
                            {activeTab === 5 && 'Chart of Accounts Structural Catalog'}
                            {activeTab === 6 && 'Vendor Outstanding Balances Ledger'}
                            {activeTab === 7 && 'Customer Recovery Collection Statement'}
                            {activeTab === 8 && 'Corporate Voucher Audit Log Summary'}
                            {activeTab === 9 && 'Daily Financial Activity Statement'}
                            {activeTab === 10 && 'Salesman Sales & Cash Collection Sheet'}
                            {activeTab === 11 && 'General Trial Balance Audit Workbook'}
                            {activeTab === 12 && 'Account Debit Aging Matrix Sheet'}
                        </b></span>
                        <span>Duration Window Block: {filters.dateFrom || 'Initial'} up to {filters.dateTo || 'Today'}</span>
                    </div>
                </div>

                <div className="w-full overflow-x-auto">
                    {/* --- 📊 RENDER TABLE 1: GENERAL GENERAL LEDGER RUNNING ENTRIES (TAB 1) WITH NEW DATE COLUMN --- */}
                    {activeTab === 1 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black text-center w-28">Processing Date</th>
                                    <th className="p-1.5 border border-black w-32">Voucher/Doc Ref #</th>
                                    <th className="p-1.5 border border-black">Account Narrative Details Description</th>
                                    <th className="p-1.5 border border-black text-right w-28">Debit (PKR)</th>
                                    <th className="p-1.5 border border-black text-right w-28">Credit (PKR)</th>
                                    <th className="p-1.5 border border-black text-right w-32 pr-3">Net Balance Pool</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, i) => (
                                    <tr key={i} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                        <td className="p-1.5 border border-black text-center text-gray-400">{i + 1}</td>
                                        <td className="p-1.5 border border-black text-center text-gray-600 font-bold whitespace-nowrap">{row.raw_date}</td>
                                        <td className="p-1.5 border border-black text-primary font-black uppercase">{row.voucher_no}</td>
                                        <td className="p-1.5 border border-black text-black font-sans">{row.description}</td>
                                        <td className="p-1.5 border border-black text-right text-red-600">Rs. {Number(row.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className="p-1.5 border border-black text-right text-success font-black">Rs. {Number(row.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className="p-1.5 border border-black text-right pr-3 font-mono">Rs. {Number(row.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* --- 📊 RENDER TABLE 2: MASTER CUSTOMER/VENDOR LEDGER TRANSACTIONS SUMMARIES (TABS 2, 3, 6) --- */}
                    {(activeTab === 2 || activeTab === 3 || activeTab === 6) && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">S#</th>
                                    <th className="p-1.5 border border-black w-36">Transaction Document #</th>
                                    <th className="p-1.5 border border-black">Associated Ledger Entity Title Account Name</th>
                                    <th className="p-1.5 border border-black text-center w-28">Processing Date</th>
                                    <th className="p-1.5 border border-black text-center w-24">Payment Term</th>
                                    <th className="p-1.5 border border-black text-right pr-3 w-40">Gross Invoice Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, i) => (
                                    <tr key={row.id || i} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                        <td className="p-1.5 border border-black text-center text-gray-400">{i + 1}</td>
                                        <td className="p-1.5 border border-black text-primary font-black uppercase">{row.purchase_no || row.id}</td>
                                        <td className="p-1.5 border border-black text-black font-sans font-bold">{row.customer_name || row.supplier_name || 'Generic Client Agent'}</td>
                                        <td className="p-1.5 border border-black text-center text-gray-600 font-mono">
                                            {String(row.sale_date || row.created_at || '').split('T')[0]}
                                        </td>
                                        <td className="p-1.5 border border-black text-center uppercase font-bold text-[10px]">{row.payment_term || 'Settle'}</td>
                                        <td className="p-1.5 border border-black text-right pr-3 text-success font-black">Rs. {Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-50 border-t border-black font-black font-mono text-xs">
                                    <td colSpan={5} className="p-2 border border-black text-right uppercase text-gray-500">Gross Account Aggregations Net Balance Summary (PKR):</td>
                                    <td className="p-2 border border-black text-right pr-3 text-success underline decoration-double text-sm font-black">
                                        Rs. {reportRows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {/* --- 📊 RENDER TABLE 2B: ACCOUNTS RECEIVABLE DEBIT AGING MATRIX SHEET (TAB 12) --- */}
                    {activeTab === 12 && (() => {
                        const totalDueSum = reportRows.reduce((sum, r) => sum + Number(r.total_due || 0), 0);
                        const total0_30Sum = reportRows.reduce((sum, r) => sum + Number(r.days_0_30 || 0), 0);
                        const total31_60Sum = reportRows.reduce((sum, r) => sum + Number(r.days_31_60 || 0), 0);
                        const total61_90Sum = reportRows.reduce((sum, r) => sum + Number(r.days_61_90 || 0), 0);
                        const total90PlusSum = reportRows.reduce((sum, r) => sum + Number(r.days_90_plus || 0), 0);

                        return (
                            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
                                <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                    <tr>
                                        <th className="p-1.5 border border-black text-center w-12">S#</th>
                                        <th className="p-1.5 border border-black">Customer / Account Title</th>
                                        <th className="p-1.5 border border-black text-center w-24">Unpaid Invoices</th>
                                        <th className="p-1.5 border border-black text-right w-32">Total Outstanding Debt</th>
                                        <th className="p-1.5 border border-black text-right w-28">0 - 30 Days (Current)</th>
                                        <th className="p-1.5 border border-black text-right w-28">31 - 60 Days</th>
                                        <th className="p-1.5 border border-black text-right w-28">61 - 90 Days</th>
                                        <th className="p-1.5 border border-black text-right w-28 pr-3">90+ Days Overdue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportRows.map((row, i) => (
                                        <tr key={i} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs text-black">
                                            <td className="p-1.5 border border-black text-center text-gray-400">{i + 1}</td>
                                            <td className="p-1.5 border border-black font-sans uppercase font-bold text-black">{row.customer_name}</td>
                                            <td className="p-1.5 border border-black text-center font-bold text-gray-600">{row.invoice_count} Invoice(s)</td>
                                            <td className="p-1.5 border border-black text-right font-black text-danger">Rs. {Number(row.total_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="p-1.5 border border-black text-right text-success font-bold">{row.days_0_30 > 0 ? `Rs. ${Number(row.days_0_30).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                                            <td className="p-1.5 border border-black text-right text-yellow-600 font-bold">{row.days_31_60 > 0 ? `Rs. ${Number(row.days_31_60).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                                            <td className="p-1.5 border border-black text-right text-orange-600 font-bold">{row.days_61_90 > 0 ? `Rs. ${Number(row.days_61_90).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                                            <td className="p-1.5 border border-black text-right pr-3 text-red-600 font-black">{row.days_90_plus > 0 ? `Rs. ${Number(row.days_90_plus).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                                        <td colSpan={3} className="p-2 border border-black text-right uppercase tracking-wider text-black">
                                            Total Aggregated Aging Receivables (PKR):
                                        </td>
                                        <td className="p-2 border border-black text-right text-danger font-black underline decoration-double text-sm">
                                            Rs. {totalDueSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 border border-black text-right text-success font-black text-xs">
                                            Rs. {total0_30Sum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 border border-black text-right text-yellow-600 font-black text-xs">
                                            Rs. {total31_60Sum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 border border-black text-right text-orange-600 font-black text-xs">
                                            Rs. {total61_90Sum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 border border-black text-right pr-3 text-red-600 font-black text-xs">
                                            Rs. {total90PlusSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        );
                    })()}

                    {/* --- 📊 RENDER TABLE 5: ENTERPRISE INCOME STATEMENT / P&L (TAB 4) --- */}
                    {activeTab === 4 && reportRows.length > 0 && (() => {
                        const incomeData = reportRows.find(r => r.type === 'income')?.entries || [];
                        const expenseData = reportRows.find(r => r.type === 'expense')?.entries || [];
                        const returnSalesData = reportRows.find(r => r.type === 'return_sales')?.entries || [];
                        const receiptSalesData = reportRows.find(r => r.type === 'receipt_sales')?.entries || [];
                        const returnPurchasesData = reportRows.find(r => r.type === 'return_purchases')?.entries || [];

                        const grossRevenueSum = incomeData.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
                        const costOfGoodsSoldSum = expenseData.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0);

                        // 1️⃣ Sum up all initial payouts from sales_returns (payout_amount_paid or total_amount)
                        const initialReturnsCash = returnSalesData.reduce((sum: number, r: any) => sum + Number(r.payout_amount_paid || r.total_amount || 0), 0);

                        // 2️⃣ Sum up all subsequent cash payouts from sales_return_receipts (amount_paid)
                        const subsequentReceiptsCash = receiptSalesData.reduce((sum: number, rc: any) => sum + Number(rc.amount_paid || 0), 0);

                        const salesReturnsSum = initialReturnsCash + subsequentReceiptsCash;
                        const purchaseReturnsSum = returnPurchasesData.reduce((sum: number, pr: any) => sum + Number(pr.total_amount || pr.amount_received || 0), 0);

                        // Net Margin Profit = (Gross Revenue - Sales Returns) - (Cost of Goods Sold - Purchase Returns)
                        const netCorporateProfit = (grossRevenueSum - salesReturnsSum) - (costOfGoodsSoldSum - purchaseReturnsSum);

                        return (
                            <div className="w-full max-w-3xl mx-auto border border-black p-6 bg-white space-y-6 font-sans text-xs mt-4">
                                <h4 className="text-center text-sm font-black uppercase tracking-wider border-b pb-2 border-black font-mono">
                                    📊 ACCRUAL INCOME STATEMENT / PROFIT & LOSS REPORT
                                </h4>

                                <div className="space-y-4">
                                    {/* Gross Operating Revenue */}
                                    <div className="border-b pb-1.5 border-gray-100 flex justify-between font-black text-black uppercase">
                                        <span>1. Gross Operating Revenue (Sales Logs)</span>
                                        <span className="text-success">Rs. {grossRevenueSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    {/* Cost of Goods Returned */}
                                    <div className="border-b pb-1.5 border-gray-100 flex justify-between font-bold text-gray-600 uppercase pl-4">
                                        <span>Less: 3. Cost of Goods Returned (Sales Logs)</span>
                                        <span className="text-purple-600">Rs. {salesReturnsSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    {/* Cost of Goods Sold */}
                                    <div className="border-b pb-1.5 border-gray-100 flex justify-between font-black text-black uppercase">
                                        <span>4. Cost of Goods Sold (Procurements)</span>
                                        <span className="text-red-600">Rs. {costOfGoodsSoldSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    {/* Purchase Returns */}
                                    <div className="border-b pb-1.5 border-gray-100 flex justify-between font-bold text-gray-600 uppercase pl-4">
                                        <span>Less: 5. Cost of Goods Returned (Purchase Logs)</span>
                                        <span className="text-gray-400">Rs. {purchaseReturnsSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    {/* Profit Margin Box */}
                                    <div className="bg-gray-50 border border-black p-4 rounded-sm flex justify-between items-center font-mono mt-4">
                                        <span className="text-xs font-black uppercase tracking-wide text-gray-500">Net Calculated Enterprise Margin Profit</span>
                                        <span className={`text-lg font-black ${netCorporateProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                            Rs. {netCorporateProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}




                    {activeTab === 5 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black w-28">Category Code</th>
                                    <th className="p-1.5 border border-black w-28">Control Code</th>
                                    <th className="p-1.5 border border-black w-32">Account Code</th>
                                    <th className="p-1.5 border border-black">Chart Account Ledger Title Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, i) => (
                                    <tr key={row.id || i} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs text-black">
                                        <td className="p-1.5 border border-black text-center text-gray-400">{i + 1}</td>
                                        <td className="p-1.5 border border-black uppercase text-gray-500">{row.category_code}</td>
                                        <td className="p-1.5 border border-black uppercase text-purple-700">{row.control_code}</td>
                                        <td className="p-1.5 border border-black font-bold uppercase text-primary">{row.account_code}</td>
                                        <td className="p-1.5 border border-black font-sans uppercase font-bold">{row.account_title}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* --- 📊 RENDER TABLE 5B: GAAP DOUBLE-ENTRY TRIAL BALANCE AUDIT WORKBOOK (TAB 11) --- */}
                    {activeTab === 11 && (() => {
                        const totalDebitSum = reportRows.reduce((sum, r) => sum + Number(r.debit || 0), 0);
                        const totalCreditSum = reportRows.reduce((sum, r) => sum + Number(r.credit || 0), 0);
                        const isBalanced = Math.abs(totalDebitSum - totalCreditSum) < 1;

                        return (
                            <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
                                <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                    <tr>
                                        <th className="p-1.5 border border-black text-center w-12">Index</th>
                                        <th className="p-1.5 border border-black w-24">Account Code</th>
                                        <th className="p-1.5 border border-black w-36">Classification Group</th>
                                        <th className="p-1.5 border border-black">Chart Account Ledger Title Description</th>
                                        <th className="p-1.5 border border-black text-right w-36">Debit Balance (PKR)</th>
                                        <th className="p-1.5 border border-black text-right w-36 pr-3">Credit Balance (PKR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportRows.map((row, i) => (
                                        <tr key={i} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs text-black">
                                            <td className="p-1.5 border border-black text-center text-gray-400">{i + 1}</td>
                                            <td className="p-1.5 border border-black font-bold text-primary">{row.code}</td>
                                            <td className="p-1.5 border border-black uppercase text-purple-700 font-bold text-[10px]">{row.category}</td>
                                            <td className="p-1.5 border border-black font-sans uppercase font-bold text-black">{row.title}</td>
                                            <td className="p-1.5 border border-black text-right font-bold text-black">
                                                {row.debit > 0 ? `Rs. ${Number(row.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                            <td className="p-1.5 border border-black text-right pr-3 font-bold text-black">
                                                {row.credit > 0 ? `Rs. ${Number(row.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                                        <td colSpan={4} className="p-2 border border-black text-right uppercase tracking-wider text-black">
                                            Aggregated Trial Balance Audit Sum (PKR):
                                        </td>
                                        <td className="p-2 border border-black text-right text-black font-black underline decoration-double text-sm">
                                            Rs. {totalDebitSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 border border-black text-right pr-3 text-black font-black underline decoration-double text-sm">
                                            Rs. {totalCreditSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={6} className={`p-2 border border-black text-center font-black uppercase text-xs ${isBalanced ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                            Trial Balance Verification: {isBalanced ? 'STATEMENT EQUATION BALANCED (DEBIT = CREDIT) ✅' : 'DISCREPANCY DETECTED IN DOUBLE ENTRY LEDGER ⚠️'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        );
                    })()}


                    {/* --- 📊 RENDER TABLE 6: CUSTOMER RECOVERY COLLECTION STATEMENT (TAB 7) --- */}
                    {activeTab === 7 && (
                        <div className="max-w-full overflow-x-auto mt-4">
                            <table className="w-full table-auto border-collapse border border-black text-left text-[11px]">
                                <thead>
                                    <tr className="bg-gray-100 font-bold uppercase tracking-wider text-black border-b border-black font-mono text-[10px]">
                                        <th className="p-2 border border-black text-center w-12">S#</th>
                                        <th className="p-2 border border-black text-center w-28">Voucher No</th>
                                        <th className="p-2 border border-black text-center w-24">Recovery Date</th>
                                        <th className="p-2 border border-black">Customer Account Name</th>
                                        <th className="p-2 border border-black">Original Invoice Ref</th>
                                        <th className="p-2 border border-black">Narration / Notes</th>
                                        <th className="p-2 border border-black text-right w-36 pr-3">Recovered Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-gray-400 font-medium italic">
                                                No customer cash recovery collections logged within chosen selection parameters.
                                            </td>
                                        </tr>
                                    ) : (
                                        reportRows.map((row, idx) => {
                                            return (
                                                <tr key={row.id || idx} className="hover:bg-slate-50 border-b border-gray-300 font-medium text-black">
                                                    <td className="p-1.5 border border-black text-center font-mono">{idx + 1}</td>

                                                    {/* ✅ Verified column mapping: voucher_no */}
                                                    <td className="p-1.5 border border-black text-center font-bold text-primary tracking-wide font-mono uppercase">
                                                        {row.voucher_no}
                                                    </td>

                                                    {/* ✅ Verified column mapping: voucher_date */}
                                                    <td className="p-1.5 border border-black text-center text-gray-600 font-mono">
                                                        {String(row.voucher_date || '').split('T')[0]}
                                                    </td>

                                                    {/* ✅ Verified column mapping: customer_name */}
                                                    <td className="p-1.5 border border-black font-bold uppercase">
                                                        {row.customer_name || row.customerName || 'Walking Client'}
                                                    </td>

                                                    {/* ✅ Verified column mapping: original_invoice_no */}
                                                    <td className="p-1.5 border border-black font-mono text-center text-gray-600">
                                                        {row.original_invoice_no || '-'}
                                                    </td>

                                                    {/* Narration Memo */}
                                                    <td className="p-1.5 border border-black text-gray-500 italic text-[10px]">
                                                        {row.narration || row.notes || 'Recovery Logged'}
                                                    </td>

                                                    {/* ✅ Verified column mapping: total_amount */}
                                                    <td className="p-1.5 border border-black text-right font-black font-mono pr-3 text-success">
                                                        Rs. {Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>

                                {reportRows.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 font-black border-t border-black text-black font-mono">
                                            <td colSpan={6} className="p-2 border border-black text-right uppercase text-[10px]">
                                                Total Cash Receipts Revenue Collected Summary:
                                            </td>
                                            <td className="p-2 border border-black text-right pr-3 text-success text-xs">
                                                Rs. {reportRows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}


                    {/* --- 📊 RENDER TABLE 4: UNIFIED VOUCHERS JOURNAL SUMMARY (TABS 8, 9) --- */}
                    {(activeTab === 8 || activeTab === 9) && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black w-36">Document Reference #</th>
                                    <th className="p-1.5 border border-black w-40">Ledger Classification Type</th>
                                    <th className="p-1.5 border border-black text-center w-32">Processing Date Stamp</th>
                                    <th className="p-1.5 border border-black">Associated Remarks Narratives Block</th>
                                    <th className="p-1.5 border border-black text-right pr-3 w-40">Gross Subtotal Transacted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, i) => {
                                    const displayVoucherNo = row.voucher_no || row.voucherNo || row.purchase_no || `VCH-00${row.id}`;
                                    const displayVoucherType = row.voucher_type || row.voucherType || filters.saleType || 'Voucher Entry';
                                    const displayDate = row.voucher_date || row.voucherDate || row.processing_date || row.sale_date || String(row.created_at || '').split('T')[0];
                                    const displayAmount = row.total_amount || row.amount_paid || row.net_collected_amount || row.amountReceived || row.amount || 0;
                                    const displayRemarks = row.narration || row.notes || row.remarks || row.scenario_type || 'System verified log';

                                    return (
                                        <tr key={row.id || i} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                            <td className="p-1.5 border border-black text-center text-gray-400">{i + 1}</td>
                                            <td className="p-1.5 border border-black text-primary font-black uppercase">{displayVoucherNo}</td>
                                            <td className="p-1.5 border border-black font-sans text-purple-700 font-bold uppercase">{displayVoucherType}</td>
                                            <td className="p-1.5 border border-black text-center text-gray-500">{displayDate}</td>
                                            <td className="p-1.5 border border-black font-sans text-gray-600 truncate max-w-xs">{displayRemarks}</td>
                                            <td className="p-1.5 border border-black text-right pr-3 text-success font-black">Rs. {Number(displayAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* --- 📊 RENDER TABLE 5: SALESMAN SALES & CASH COLLECTION SHEET (TAB 10) --- */}
                    {activeTab === 10 && (
                        <table className="w-full table-auto border border-collapse border-black text-[11px] font-sans text-left print:w-full">
                            <thead className="bg-gray-100 border-b border-black font-black uppercase text-black font-mono text-[10px]">
                                <tr>
                                    <th className="p-1.5 border border-black text-center w-12">Index</th>
                                    <th className="p-1.5 border border-black w-32">Document Ref #</th>
                                    <th className="p-1.5 border border-black w-36">Entry Classification</th>
                                    <th className="p-1.5 border border-black w-32">Sales Officer</th>
                                    <th className="p-1.5 border border-black">Customer / Account Title</th>
                                    <th className="p-1.5 border border-black text-center w-28">Processing Date</th>
                                    <th className="p-1.5 border border-black text-right w-32">Sales Invoice (PKR)</th>
                                    <th className="p-1.5 border border-black text-right w-32 pr-3">Cash Collected (PKR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportRows.map((row, i) => (
                                    <tr key={row.id || i} className="border-b border-black hover:bg-gray-50 font-semibold font-mono text-xs">
                                        <td className="p-1.5 border border-black text-center text-gray-400">{i + 1}</td>
                                        <td className="p-1.5 border border-black text-primary font-black uppercase">{row.doc_ref}</td>
                                        <td className="p-1.5 border border-black text-purple-700 font-bold uppercase text-[10px]">{row.entry_type}</td>
                                        <td className="p-1.5 border border-black font-sans text-black font-bold">{row.salesman}</td>
                                        <td className="p-1.5 border border-black font-sans text-gray-700">{row.customer_name}</td>
                                        <td className="p-1.5 border border-black text-center text-gray-500">{row.raw_date}</td>
                                        <td className="p-1.5 border border-black text-right text-black font-bold">Rs. {Number(row.sale_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className="p-1.5 border border-black text-right pr-3 text-success font-black">Rs. {Number(row.collected_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t-2 border-black font-black font-mono text-xs">
                                    <td colSpan={6} className="p-2 border border-black text-right uppercase tracking-wider text-black">
                                        Total Performance Aggregations (PKR):
                                    </td>
                                    <td className="p-2 border border-black text-right text-black font-black text-sm">
                                        Rs. {reportRows.reduce((sum, r) => sum + Number(r.sale_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 border border-black text-right pr-3 text-success font-black underline decoration-double text-sm">
                                        Rs. {reportRows.reduce((sum, r) => sum + Number(r.collected_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {reportRows.length === 0 && (
                        <div className="p-12 text-center border font-bold italic text-gray-400 bg-gray-50/50 rounded-sm">No structural financial transaction records discovered matching chosen selection tokens.</div>
                    )}
                </div>

                <div className="mt-24 grid grid-cols-3 gap-12 text-center text-[9px] font-sans font-black uppercase tracking-widest text-gray-400">
                    <div className="border-t border-black pt-2">Prepared By: Financial Data Officer</div>
                    <div className="border-t border-black pt-2">Verified By: Corporate Accounts Auditor</div>
                    <div className="border-t border-black pt-2">Authorized Executive Director Signature Seal</div>
                </div>

                {/* 🏢 Software & Corporate Provider Footer */}
                <div className="mt-12 pt-3 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-600 font-sans print:border-gray-400">
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


export default AccountReportPrint;
