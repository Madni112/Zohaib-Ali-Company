import React, { useState, useEffect, useRef } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../Context/supabaseClient';
import Spinner from '../../../ui/Spinner';
import { useNavigate, useLocation } from 'react-router-dom';

const SaleReturnReceiptAdd = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const routeReceiptRow = location.state?.receiptRecord || location.state?.item || location.state?.record;
    const isEditMode = !!routeReceiptRow;

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);
    const [onCreditReturns, setOnCreditReturns] = useState<any[]>([]);
    const [filteredReturns, setFilteredReturns] = useState<any[]>([]);
    const [banksList, setBanksList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [highlightReturnIdx, setHighlightReturnIdx] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [selectedReturnDetails, setSelectedReturnDetails] = useState<any>({
        totalAmount: 0,
        alreadyPaid: 0,
        remainingDue: 0
    });

    const [initialFormValues, setInitialFormValues] = useState<any>({
        processingDate: new Date().toISOString().split('T')[0],
        returnRowId: '',
        returnNoRef: '',
        invoiceNoRef: '',
        customerName: '',
        settlementMode: 'Cash',
        selectedBankTitle: '',
        cashPaid: 0,
        bankPaid: 0,
        amountPaid: 0,
        remainingBalanceMax: 99999999
    });

    useEffect(() => {
        const fetchVoucherMetadata = async () => {
            try {
                setInitialLoading(true);

                // 1. Fetch raw returns data from database matching exact schema
                const { data: returnsData } = await supabase
                    .from('sales_returns')
                    .select('id, return_no, invoice_no, customer_name, total_amount, payout_amount_paid, status, return_date');

                // 2. Fetch sales_invoices to inspect cash and bank collected payments
                const { data: invoicesData } = await supabase
                    .from('sales_invoices')
                    .select('id, cash_amount_paid, bank_amount, payment_term, total_amount');

                // 3. Fetch all existing receipts to dynamically aggregate them on the fly
                const { data: allReceiptsData } = await supabase
                    .from('sales_return_receipts')
                    .select('sales_return_id, amount_paid');

                const { data: bankAccounts } = await supabase
                    .from('banks')
                    .select('id, bankName, accountTitle');

                if (bankAccounts) setBanksList(bankAccounts);

                if (returnsData) {
                    const compiledReturnsPool = returnsData.map(r => {
                        const cleanInvNo = String(r.invoice_no || '').replace(/^inv-?/i, '').trim();
                        const formattedInvNo = cleanInvNo ? `INV-${cleanInvNo.padStart(4, '0')}` : (r.invoice_no || `INV-${r.id}`);

                        const returnTotalVal = Number(r.total_amount || 0);

                        const associatedReceipts = (allReceiptsData || []).filter(rec => String(rec.sales_return_id) === String(r.id));
                        const totalReceiptsSum = associatedReceipts.reduce((sum, rec) => sum + Number(rec.amount_paid || 0), 0);

                        const initialPaidAtReturnCreation = Number(r.payout_amount_paid || 0);
                        const totalPaidSoFar = initialPaidAtReturnCreation + totalReceiptsSum;
                        const dynamicRemainingOwed = Math.max(0, returnTotalVal - totalPaidSoFar);

                        const isSettled = dynamicRemainingOwed <= 0.01;

                        return {
                            ...r,
                            original_invoice_no: formattedInvNo,
                            computed_total_paid: totalPaidSoFar,
                            computed_remaining_due: dynamicRemainingOwed,
                            is_fully_settled: isSettled,
                            statusBadge: isSettled 
                                ? 'FULLY REFUNDED' 
                                : `OPEN (Rs. ${dynamicRemainingOwed.toFixed(2)} DUE)`
                        };
                    });

                    setOnCreditReturns(compiledReturnsPool);
                    setFilteredReturns(compiledReturnsPool);


                    if (isEditMode && routeReceiptRow) {
                        const currentActiveReturn = compiledReturnsPool.find(r => String(r.id) === String(routeReceiptRow.sales_return_id));
                        if (currentActiveReturn) {
                            // Back out the current receipt value during edits to calculate the true baseline
                            const isolatedPaidPool = Math.max(0, Number(currentActiveReturn.computed_total_paid) - Number(routeReceiptRow.amount_paid || 0));
                            const trueNetItemsReturnVal = Number(currentActiveReturn.total_net_amount || currentActiveReturn.total_amount || 0);
                            const isolatedRemainingDue = Math.max(0, trueNetItemsReturnVal - isolatedPaidPool);

                            setSearchQuery(`${routeReceiptRow.original_invoice_no} (${routeReceiptRow.customer_name})`);
                            setSelectedReturnDetails({
                                totalAmount: trueNetItemsReturnVal,
                                alreadyPaid: isolatedPaidPool,
                                remainingDue: isolatedRemainingDue
                            });

                            setInitialFormValues({
                                processingDate: routeReceiptRow.processing_date || new Date().toISOString().split('T')[0],
                                returnRowId: routeReceiptRow.sales_return_id || '',
                                invoiceNoRef: routeReceiptRow.original_invoice_no || '',
                                customerName: routeReceiptRow.customer_name || '',
                                settlementMode: routeReceiptRow.settlement_mode || 'Cash',
                                selectedBankTitle: routeReceiptRow.bank_account_title || '',
                                cashPaid: routeReceiptRow.metadata?.cashPaid || (routeReceiptRow.settlement_mode === 'Bank' ? 0 : (routeReceiptRow.amount_paid || 0)),
                                bankPaid: routeReceiptRow.metadata?.bankPaid || (routeReceiptRow.settlement_mode === 'Bank' ? (routeReceiptRow.amount_paid || 0) : 0),
                                amountPaid: routeReceiptRow.amount_paid || 0,
                                remainingBalanceMax: isolatedRemainingDue
                            });
                        }
                    }
                }
            } catch (err: any) {
                toast.error('Failed to load credit return registers: ' + err.message);
            } finally {
                setInitialLoading(false);
            }
        };
        fetchVoucherMetadata();
    }, [routeReceiptRow, isEditMode]);


    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);
    useEffect(() => {
        if (isEditMode) return;
        const term = searchQuery.trim().toLowerCase();
        if (!term) {
            setFilteredReturns(onCreditReturns);
            return;
        }
        const filtered = onCreditReturns.filter(r =>
            String(r.original_invoice_no || '').toLowerCase().includes(term) ||
            String(r.return_no || '').toLowerCase().includes(term) ||
            String(r.customer_name || '').toLowerCase().includes(term)
        );
        setFilteredReturns(filtered);
    }, [searchQuery, onCreditReturns, isEditMode]);

    const validationSchema = Yup.object().shape({
        returnRowId: Yup.string().required('Please select an invoice return record'),
        customerName: Yup.string().required('Customer name required'),
        invoiceNoRef: Yup.string().required('Invoice reference required'),
        settlementMode: Yup.string().oneOf(['Cash', 'Bank', 'Split']).required('Required'),
        selectedBankTitle: Yup.string().when('settlementMode', {
            is: (val: string) => val === 'Bank' || val === 'Split',
            then: (schema) => schema.required('Please select target bank profile'),
            otherwise: (schema) => schema.notRequired()
        }),
        amountPaid: Yup.number().min(0).nullable(),
        cashPaid: Yup.number().min(0).nullable(),
        bankPaid: Yup.number().min(0).nullable()
    });

    const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
        ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

    if (initialLoading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;

    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-white text-xs">
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="flex items-center justify-between border-b border-stroke py-4 px-6.5 dark:border-strokedark">
                    <h3 className="font-semibold text-black dark:text-white text-base">
                        {isEditMode ? 'Modify Return Note Cash-Back Settlement Entry' : 'Authorize Remaining Return Cash-Back Settlement Note'}
                    </h3>
                    <button onClick={() => navigate('/sales/sales-return-receipt/list')} className="text-sm font-medium text-primary hover:underline">Cancel & Return</button>
                </div>

                <Formik
                    initialValues={initialFormValues}
                    validationSchema={validationSchema}
                    enableReinitialize={true}

                    onSubmit={async (values) => {
                        let finalAmountToSave = 0;
                        let cashVal = 0;
                        let bankVal = 0;

                        if (values.settlementMode === 'Cash') {
                            cashVal = Number(values.amountPaid !== undefined && values.amountPaid !== '' ? values.amountPaid : values.cashPaid) || 0;
                            finalAmountToSave = cashVal;
                        } else if (values.settlementMode === 'Bank') {
                            bankVal = Number(values.amountPaid !== undefined && values.amountPaid !== '' ? values.amountPaid : values.bankPaid) || 0;
                            finalAmountToSave = bankVal;
                        } else if (values.settlementMode === 'Split') {
                            cashVal = Number(values.cashPaid) || 0;
                            bankVal = Number(values.bankPaid) || 0;
                            finalAmountToSave = cashVal + bankVal;
                        }

                        if (finalAmountToSave <= 0) {
                            toast.error('Validation Error: Refund payout amount must be greater than 0 PKR!');
                            return;
                        }

                        const maxLimit = values.remainingBalanceMax ?? selectedReturnDetails.remainingDue ?? 999999;
                        if (finalAmountToSave > maxLimit + 0.05) {
                            toast.error(`Validation Error: Remitted amount (Rs. ${finalAmountToSave.toLocaleString()}) exceeds the maximum outstanding refund due (Rs. ${maxLimit.toLocaleString()})!`);
                            return;
                        }

                        try {
                            setLoading(true);

                            const receiptPayload = {
                                receipt_no: routeReceiptRow?.receipt_no || `REC-${Date.now().toString().slice(-6)}`,
                                sales_return_id: values.returnRowId ? Number(values.returnRowId) : null,
                                return_no: values.returnNoRef || null,
                                invoice_no: values.invoiceNoRef,
                                customer_name: values.customerName,
                                payment_date: values.processingDate,
                                settlement_mode: values.settlementMode,
                                payment_mode: values.settlementMode,
                                bank_name: (values.settlementMode === 'Bank' || values.settlementMode === 'Split') ? values.selectedBankTitle : null,
                                amount_paid: finalAmountToSave,
                                payment_status: 'Paid'
                            };

                            if (isEditMode) {
                                const { error: updateReceiptError } = await supabase
                                    .from('sales_return_receipts')
                                    .update(receiptPayload)
                                    .eq('id', routeReceiptRow.id);

                                if (updateReceiptError) throw updateReceiptError;
                                toast.success('Collection receipt modification authorized!');
                            } else {
                                const { error: insertError } = await supabase
                                    .from('sales_return_receipts')
                                    .insert([receiptPayload]);

                                if (insertError) throw insertError;
                                toast.success('Cash-back collection voucher approved!');
                            }
                            navigate('/sales/sales-return-receipt/list');
                        } catch (err: any) {
                            toast.error('Remittance processing failure: ' + err.message);
                        } finally {
                            setLoading(false);
                        }
                    }}
                >
                    {({ values, handleChange, handleBlur, setFieldValue, errors, touched, submitCount }) => {
                        const hasAttempted = submitCount > 0;
                        return (
                            <Form className="p-6 grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
                                <div>
                                    <label className="block font-bold text-gray-500 mb-1">Receipt Date:</label>
                                    <input type="date" name="processingDate" onChange={handleChange} value={values.processingDate} className="w-full rounded border border-stroke p-2 text-sm bg-white dark:bg-boxdark outline-none font-semibold text-black dark:text-white" />
                                </div>

                                <div className="relative space-y-1" ref={dropdownRef}>
                                    <label className="block font-bold text-primary mb-1">Search Outstanding Return Invoice: *</label>
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Type Invoice # or Name..."
                                        value={searchQuery}
                                        onFocus={() => {
                                            if (!isEditMode) {
                                                setIsDropdownOpen(true);
                                                setHighlightReturnIdx(0);
                                            }
                                        }}
                                        onClick={() => {
                                            if (!isEditMode) {
                                                setIsDropdownOpen(true);
                                                setHighlightReturnIdx(0);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setHighlightReturnIdx(prev => prev < filteredReturns.length - 1 ? prev + 1 : 0);
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setHighlightReturnIdx(prev => prev > 0 ? prev - 1 : filteredReturns.length - 1);
                                            } else if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (filteredReturns.length > 0) {
                                                    const r = filteredReturns[highlightReturnIdx] || filteredReturns[0];
                                                    if (r.is_fully_settled) {
                                                        toast.error(`Return note ${r.original_invoice_no} is ${r.statusBadge} and cannot be selected.`);
                                                        return;
                                                    }
                                                    setFieldValue('returnRowId', r.id);
                                                    setFieldValue('returnNoRef', r.return_no || `RTN-${r.id}`);
                                                    setFieldValue('invoiceNoRef', r.original_invoice_no);
                                                    setFieldValue('customerName', r.customer_name);
                                                    setFieldValue('remainingBalanceMax', r.computed_remaining_due);
                                                    setSearchQuery(`${r.original_invoice_no} (${r.customer_name})`);

                                                    setSelectedReturnDetails({
                                                        totalAmount: Number(r.total_amount || 0),
                                                        alreadyPaid: Number(r.computed_total_paid),
                                                        remainingDue: Number(r.computed_remaining_due)
                                                    });
                                                    setIsDropdownOpen(false);
                                                }
                                            } else if (e.key === 'Tab' || e.key === 'Escape') {
                                                setIsDropdownOpen(false);
                                            }
                                        }}
                                        onChange={(e) => {
                                            if (!isEditMode) {
                                                setSearchQuery(e.target.value);
                                                setIsDropdownOpen(true);
                                                setHighlightReturnIdx(0);
                                            }
                                        }}
                                        className={`w-full rounded border p-2 text-xs font-bold outline-none ${isEditMode ? 'bg-gray-100 dark:bg-meta-4/20 text-gray-500 cursor-not-allowed' : 'bg-white dark:bg-boxdark text-black dark:text-white focus:border-primary'} ${hasAttempted && errors.returnRowId ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                    />

                                    {/* RICH SEARCHABLE RETURN INVOICE DROPDOWN (ELEVATED Z-INDEX) */}
                                    {isDropdownOpen && !isEditMode && (
                                        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[340px] max-h-[290px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A222C] shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 z-[99999] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                                            {filteredReturns.length === 0 ? (
                                                <div className="p-3 text-center text-xs text-gray-400 font-medium italic">No pending return options profiles.</div>
                                            ) : (
                                                filteredReturns.map((r, rIdx) => {
                                                    const isDisabled = r.is_fully_settled;
                                                    const isHighlighted = rIdx === highlightReturnIdx;

                                                    return (
                                                        <div
                                                            key={r.id}
                                                            onMouseEnter={() => setHighlightReturnIdx(rIdx)}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                if (isDisabled) {
                                                                    toast.error(`Return note ${r.original_invoice_no} is ${r.statusBadge} and cannot be selected.`);
                                                                    return;
                                                                }

                                                                setFieldValue('returnRowId', r.id);
                                                                setFieldValue('returnNoRef', r.return_no || `RTN-${r.id}`);
                                                                setFieldValue('invoiceNoRef', r.original_invoice_no);
                                                                setFieldValue('customerName', r.customer_name);
                                                                setFieldValue('remainingBalanceMax', r.computed_remaining_due);
                                                                setSearchQuery(`${r.original_invoice_no} (${r.customer_name})`);

                                                                setSelectedReturnDetails({
                                                                    totalAmount: Number(r.total_amount || 0),
                                                                    alreadyPaid: Number(r.computed_total_paid),
                                                                    remainingDue: Number(r.computed_remaining_due)
                                                                });
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            className={`p-3 cursor-pointer transition flex items-center justify-between group ${
                                                                isDisabled
                                                                    ? 'bg-gray-50 dark:bg-meta-4/20 text-gray-400 cursor-not-allowed opacity-70'
                                                                    : isHighlighted
                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500'
                                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col gap-0.5 text-left">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-bold text-xs text-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                                                        {r.original_invoice_no}
                                                                    </span>
                                                                    {r.return_no && (
                                                                        <span className="text-[9px] font-mono text-gray-400">
                                                                            ({r.return_no})
                                                                        </span>
                                                                    )}
                                                                    {isDisabled && (
                                                                        <span className="text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                                                            {r.statusBadge}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                    {r.customer_name}
                                                                </span>
                                                            </div>
                                                            <div className="text-right font-mono text-xs pl-2">
                                                                {isDisabled ? (
                                                                    <span className="text-gray-400">Rs. 0</span>
                                                                ) : (
                                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                                        Due: Rs. {Number(r.computed_remaining_due).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}

                                </div>
                                <div>
                                    <label className="block font-bold text-gray-500 mb-1">Customer / Account Title:</label>
                                    <input type="text" name="customerName" disabled value={values.customerName} className="w-full rounded border border-stroke p-2 text-sm bg-gray-100 dark:bg-meta-4/20 text-gray-500 font-bold outline-none cursor-not-allowed" placeholder="Customer reference..." />
                                </div>
                                <div>
                                    <label className="block font-bold text-gray-500 mb-1">Invoice Reference No:</label>
                                    <input type="text" name="invoiceNoRef" disabled value={values.invoiceNoRef} className="w-full rounded border border-stroke p-2 text-sm bg-gray-100 dark:bg-meta-4/20 text-gray-500 font-bold outline-none cursor-not-allowed" placeholder="Invoice trace..." />
                                </div>
                                <div>
                                    <label className="block font-bold text-gray-500 mb-1">Settlement Mode Selector: *</label>
                                    <select
                                        name="settlementMode"
                                        value={values.settlementMode}
                                        onChange={(e) => {
                                            handleChange(e);
                                            if (e.target.value === 'Cash') {
                                                setFieldValue('selectedBankTitle', '');
                                                setFieldValue('bankPaid', 0);
                                            }
                                        }}
                                        className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-white dark:bg-boxdark outline-none font-black text-xs text-black dark:text-white focus:border-primary"
                                    >
                                        <option value="Cash">Cash Ledger Account</option>
                                        <option value="Bank">Bank Account Wire Transfer</option>
                                        <option value="Split">Cash & Bank Refund Combined</option>
                                    </select>
                                </div>

                                {(values.settlementMode === 'Bank' || values.settlementMode === 'Split') && (
                                    <div className="md:col-span-2">
                                        <label className="block font-bold text-gray-500 mb-1">Choose Target Financial Bank Account: *</label>
                                        <select name="selectedBankTitle" value={values.selectedBankTitle} onChange={handleChange} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-white dark:bg-boxdark outline-none font-bold text-xs text-black dark:text-white focus:border-primary">
                                            <option value="">-- Choose Account Wire Registry --</option>
                                            {banksList.map(b => <option key={b.id} value={b.accountTitle}>{b.bankName} - {b.accountTitle}</option>)}
                                        </select>
                                    </div>
                                )}

                                {values.settlementMode === 'Split' ? (
                                    <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block font-bold text-danger mb-1">Cash Refund Amount (PKR): *</label>
                                            <input
                                                type="number"
                                                name="cashPaid"
                                                value={values.cashPaid === 0 ? '' : (values.cashPaid ?? '')}
                                                onKeyDown={blockInvalidChar}
                                                onFocus={(e) => {
                                                    if (Number(values.cashPaid) === 0) {
                                                        setFieldValue('cashPaid', '');
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    handleBlur(e);
                                                    if (values.cashPaid === '' || values.cashPaid === undefined || values.cashPaid === null) {
                                                        setFieldValue('cashPaid', 0);
                                                    }
                                                }}
                                                onChange={(e) => {
                                                    const valStr = e.target.value;
                                                    if (valStr === '') {
                                                        setFieldValue('cashPaid', '');
                                                    } else {
                                                        const val = Number(valStr);
                                                        setFieldValue('cashPaid', isNaN(val) ? '' : Math.max(0, val));
                                                    }
                                                }}
                                                placeholder="0.00"
                                                className="w-full rounded border border-stroke p-2 bg-transparent text-right font-black text-danger text-sm focus:border-primary outline-none text-black dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-bold text-primary mb-1">Bank Refund Amount (PKR): *</label>
                                            <input
                                                type="number"
                                                name="bankPaid"
                                                value={values.bankPaid === 0 ? '' : (values.bankPaid ?? '')}
                                                onKeyDown={blockInvalidChar}
                                                onFocus={(e) => {
                                                    if (Number(values.bankPaid) === 0) {
                                                        setFieldValue('bankPaid', '');
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    handleBlur(e);
                                                    if (values.bankPaid === '' || values.bankPaid === undefined || values.bankPaid === null) {
                                                        setFieldValue('bankPaid', 0);
                                                    }
                                                }}
                                                onChange={(e) => {
                                                    const valStr = e.target.value;
                                                    if (valStr === '') {
                                                        setFieldValue('bankPaid', '');
                                                    } else {
                                                        const val = Number(valStr);
                                                        setFieldValue('bankPaid', isNaN(val) ? '' : Math.max(0, val));
                                                    }
                                                }}
                                                placeholder="0.00"
                                                className="w-full rounded border border-stroke p-2 bg-transparent text-right font-black text-primary text-sm focus:border-primary outline-none text-black dark:text-white"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="md:col-span-2">
                                        <label className="block font-bold text-danger mb-1">Remitted Refund Amount Paid (PKR): *</label>
                                        <input
                                            type="number"
                                            name="amountPaid"
                                            value={values.amountPaid === 0 ? '' : (values.amountPaid ?? '')}
                                            onKeyDown={blockInvalidChar}
                                            onFocus={(e) => {
                                                if (Number(values.amountPaid) === 0) {
                                                    setFieldValue('amountPaid', '');
                                                }
                                            }}
                                            onBlur={(e) => {
                                                handleBlur(e);
                                                if (values.amountPaid === '' || values.amountPaid === undefined || values.amountPaid === null) {
                                                    setFieldValue('amountPaid', 0);
                                                }
                                            }}
                                            onChange={(e) => {
                                                const valStr = e.target.value;
                                                if (valStr === '') {
                                                    setFieldValue('amountPaid', '');
                                                } else {
                                                    const val = Number(valStr);
                                                    const maxLimit = values.remainingBalanceMax ?? selectedReturnDetails.remainingDue ?? 999999;
                                                    const finalVal = Math.min(Math.max(0, val), maxLimit);
                                                    setFieldValue('amountPaid', finalVal);
                                                }
                                            }}
                                            placeholder="0.00"
                                            className={`w-full rounded border p-2 bg-transparent text-right font-black text-danger text-sm focus:border-primary outline-none text-black dark:text-white ${hasAttempted && errors.amountPaid ? 'border-red-500 bg-red-50' : 'border-stroke'}`}
                                        />
                                        {hasAttempted && errors.amountPaid && <p className="text-red-500 font-bold text-[10px] mt-1">⚠️ {String(errors.amountPaid)}</p>}
                                    </div>
                                )}

                                {values.returnRowId && (
                                    <div className="md:col-span-4 bg-gray-50 dark:bg-meta-4/20 p-3 rounded border border-stroke dark:border-strokedark font-mono text-[11px] grid grid-cols-3 text-center text-gray-500 dark:text-white">
                                        <div>Total Return Value: <b className="block text-xs text-black dark:text-white">Rs. {Number(selectedReturnDetails.totalAmount || 0).toFixed(2)}</b></div>
                                        <div>Already Refunded: <b className="block text-xs text-success">Rs. {Number(selectedReturnDetails.alreadyPaid || 0).toFixed(2)}</b></div>
                                        <div>
                                            Outstanding Refund Due:
                                            <b className="block text-xs text-danger font-black">
                                                Rs. {Number(selectedReturnDetails.remainingDue || 0).toFixed(2)}
                                            </b>
                                        </div>
                                    </div>
                                )}


                                <div className="md:col-span-4 pt-4 mt-2 border-t border-stroke dark:border-strokedark flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/sales/sales-return-receipt/list')}
                                        className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                                    >
                                        {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Modify Entry' : 'Save Record'}</span>}
                                    </button>
                                </div>
                            </Form>
                        );
                    }}
                </Formik>
            </div>
        </div>
    );
};

export default SaleReturnReceiptAdd;
