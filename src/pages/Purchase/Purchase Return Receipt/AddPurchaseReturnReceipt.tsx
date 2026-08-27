import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { 
  MdPerson, 
  MdReceipt, 
  MdEvent, 
  MdArrowBack, 
  MdAccountBalance, 
  MdSearch, 
  MdClear,
  MdCheckCircle,
  MdInfoOutline
} from 'react-icons/md';
import { FiPrinter } from 'react-icons/fi';

const AddPurchaseReturnReceipt: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId } = useAuth();

  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);

  const [returnOptions, setReturnOptions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  
  // Searchable Return Dropdown States
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [isReturnDropdownOpen, setIsReturnDropdownOpen] = useState(false);
  const [highlightedReturnIndex, setHighlightedReturnIndex] = useState(0);
  const returnDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedReturnDetails, setSelectedReturnDetails] = useState<{
    total: number;
    upfront: number;
    subsequent: number;
    pending: number;
    vendor: string;
    returnDate: string;
    itemsCount: number;
  }>({
    total: 0,
    upfront: 0,
    subsequent: 0,
    pending: 0,
    vendor: '',
    returnDate: '',
    itemsCount: 0
  });

  const [shouldPrintAfterSave, setShouldPrintAfterSave] = useState(false);

  const editData = location.state?.receiptRecord;
  const isEditMode = !!editData;

  const [defaultReceiptNo] = useState(() => 
    isEditMode && editData?.receipt_no 
      ? editData.receipt_no 
      : `PRR-${Math.floor(100000 + Math.random() * 900000)}`
  );

  const formatMoney = (val: number | string | undefined | null): string => {
    const num = Number(val) || 0;
    if (Number.isInteger(num)) {
      return num.toLocaleString('en-US');
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  useEffect(() => {
    const fetchReceiptMetadata = async () => {
      try {
        setMetadataLoading(true);

        // 1. Fetch Purchase Returns
        const { data: rData } = await supabase
          .from('purchase_returns')
          .select('*')
          .order('id', { ascending: false });

        // 2. Fetch Banks
        const { data: bankData } = await supabase
          .from('banks')
          .select('id, bankName, accountNumber, accountTitle');

        // 3. Fetch COA for balanced journal entry
        const { data: coaData } = await supabase
          .from('chart_of_accounts')
          .select('id, account_code, account_title, control_code');

        if (rData) setReturnOptions(rData);
        if (bankData) setBankAccounts(bankData);
        if (coaData) setChartOfAccounts(coaData);

        if (isEditMode && editData) {
          setReturnSearchQuery(editData.return_no || '');
          handleActiveReturnCalculation(editData.return_no, rData || []);
        }
      } catch (err: any) {
        toast.error('Failed to load return receipt lookups: ' + err.message);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchReceiptMetadata();
  }, [isEditMode, editData]);

  // Outside click listener for return dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (returnDropdownRef.current && !returnDropdownRef.current.contains(e.target as Node)) {
        setIsReturnDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleActiveReturnCalculation = async (returnNo: string, allReturnsList: any[]) => {
    if (!returnNo) {
      setSelectedReturnDetails({ total: 0, upfront: 0, subsequent: 0, pending: 0, vendor: '', returnDate: '', itemsCount: 0 });
      return;
    }
    const matchedReturn = allReturnsList.find(r => r.return_no?.toLowerCase() === returnNo.toLowerCase());
    if (matchedReturn) {
      const gross = Number(matchedReturn.total_amount) || 0;
      const upfrontPaid = Number(matchedReturn.amount_paid) || 0;

      const { data: receiptsData } = await supabase
        .from('purchase_return_receipts')
        .select('id, amount_received')
        .eq('return_no', matchedReturn.return_no);

      let subsequentPaidSum = 0;
      if (receiptsData) {
        receiptsData.forEach((rec: any) => {
          if (!isEditMode || rec.id !== editData?.id) {
            subsequentPaidSum += Number(rec.amount_received) || 0;
          }
        });
      }

      const totalPaidSoFar = upfrontPaid + subsequentPaidSum;
      const remainingDue = Math.max(0, gross - totalPaidSoFar);

      const itemsArray = Array.isArray(matchedReturn.items) ? matchedReturn.items : [];

      setSelectedReturnDetails({
        total: gross,
        upfront: upfrontPaid,
        subsequent: subsequentPaidSum,
        pending: remainingDue,
        vendor: matchedReturn.vendor_name || matchedReturn.supplier_name || 'General Vendor',
        returnDate: matchedReturn.return_date || matchedReturn.created_at?.split('T')[0] || '',
        itemsCount: itemsArray.length
      });
    }
  };

  const filteredReturnOptions = returnOptions.filter(r => {
    const q = returnSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const rNo = (r.return_no || '').toLowerCase();
    const vName = (r.vendor_name || r.supplier_name || '').toLowerCase();
    const poRef = (r.purchase_no || '').toLowerCase();
    return rNo.includes(q) || vName.includes(q) || poRef.includes(q);
  });

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  if (metadataLoading) {
    return (
      <div className="flex h-64 items-center justify-center bg-white dark:bg-boxdark rounded-xl shadow-xs">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl text-xs text-black dark:text-bodydark antialiased font-sans">
      
      {/* Header Breadcrumb */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-black text-sm">
              <MdReceipt size={16} />
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              {isEditMode ? 'Edit Vendor Refund Voucher' : 'Vendor Purchase Return Collection'}
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Log inward cash/bank refund payouts recovered from suppliers on debit note returns
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return-Receipt/List`)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stroke bg-white dark:bg-boxdark dark:border-strokedark font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition text-xs shadow-xs cursor-pointer"
        >
          <MdArrowBack size={15} /> Back to Receipts
        </button>
      </div>

      <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6 sm:p-8">
        
        <Formik
          initialValues={isEditMode ? {
            receiptNo: editData.receipt_no || defaultReceiptNo,
            returnNo: editData.return_no || '',
            paymentMethod: editData.payment_method || 'By Cash',
            selectedBankId: editData.metadata?.selectedBankId || '',
            cashAmount: editData.metadata?.cashAmount || editData.amount_received || '',
            bankAmount: editData.metadata?.bankAmount || '',
            paymentDate: editData.payment_date || new Date().toISOString().split('T')[0],
            amount: editData.amount_received || '',
            notes: editData.remarks || ''
          } : {
            receiptNo: defaultReceiptNo,
            returnNo: '',
            paymentMethod: 'By Cash',
            selectedBankId: bankAccounts[0]?.id || '',
            cashAmount: '',
            bankAmount: '',
            paymentDate: new Date().toISOString().split('T')[0],
            amount: '',
            notes: ''
          }}
          validationSchema={Yup.object().shape({
            returnNo: Yup.string().required('Please select a target return note'),
            paymentMethod: Yup.string().required('Required'),
            paymentDate: Yup.string().required('Required'),
            amount: Yup.number().min(1, 'Amount must be greater than 0').required('Required')
          })}
          onSubmit={async (values) => {
            const finalAmount = Number(values.amount) || 0;
            const cashPortion = values.paymentMethod === 'Split' ? Number(values.cashAmount || 0) : (values.paymentMethod === 'By Cash' ? finalAmount : 0);
            const bankPortion = values.paymentMethod === 'Split' ? Number(values.bankAmount || 0) : (values.paymentMethod === 'By Bank' ? finalAmount : 0);

            if (values.paymentMethod === 'Split' && Math.abs(cashPortion + bankPortion - finalAmount) > 0.01) {
              toast.error('Split amounts (Cash + Bank) must equal the total collected amount!');
              return;
            }

            if (selectedReturnDetails.pending > 0 && finalAmount > selectedReturnDetails.pending + 0.01) {
              const confirmOver = window.confirm(`Collected amount (Rs. ${formatMoney(finalAmount)}) exceeds the pending return balance (Rs. ${formatMoney(selectedReturnDetails.pending)}). Proceed anyway?`);
              if (!confirmOver) return;
            }

            try {
              setLoading(true);

              const selectedBankObj = bankAccounts.find(b => String(b.id) === String(values.selectedBankId));

              // 1. Prepare Purchase Return Receipt Record
              const receiptPayload = {
                receipt_no: values.receiptNo,
                return_no: values.returnNo,
                vendor_name: selectedReturnDetails.vendor,
                payment_date: values.paymentDate,
                payment_method: values.paymentMethod,
                amount_received: finalAmount,
                remarks: values.notes.trim() || null,
                metadata: {
                  selectedBankId: (values.paymentMethod === 'By Bank' || values.paymentMethod === 'Split') ? values.selectedBankId : null,
                  selectedBankTitle: selectedBankObj ? `${selectedBankObj.bankName} - ${selectedBankObj.accountTitle || selectedBankObj.accountNumber}` : null,
                  cashAmount: cashPortion,
                  bankAmount: bankPortion,
                  returnGross: selectedReturnDetails.total,
                  previousCollected: selectedReturnDetails.upfront + selectedReturnDetails.subsequent,
                  remainingDueAfterReceipt: Math.max(0, selectedReturnDetails.pending - finalAmount)
                }
              };

              let savedReceiptId = editData?.id;

              if (isEditMode) {
                const { error: updateErr } = await supabase
                  .from('purchase_return_receipts')
                  .update(receiptPayload)
                  .eq('id', editData.id);
                if (updateErr) throw updateErr;
              } else {
                const { data: insertedRec, error: insertErr } = await supabase
                  .from('purchase_return_receipts')
                  .insert([receiptPayload])
                  .select('id')
                  .single();
                if (insertErr) throw insertErr;
                savedReceiptId = insertedRec?.id;
              }

              // 2. Generate Balanced Journal Voucher in financial_vouchers
              const cashCoa = chartOfAccounts.find(c => String(c.account_code) === '1010' || String(c.account_title || '').toLowerCase().includes('cash in hand'));
              const bankCoa = chartOfAccounts.find(c => String(c.account_code) === '1015' || String(c.account_title || '').toLowerCase().includes('bank'));
              const payCoa = chartOfAccounts.find(c => 
                String(c.account_code) === '2010' || 
                String(c.account_title || '').toLowerCase().includes('payable') ||
                String(c.control_code || '').toLowerCase().includes('payable')
              );

              const cashAccountCode = cashCoa ? String(cashCoa.account_code) : '1010';
              const bankAccountCode = bankCoa ? String(bankCoa.account_code) : (selectedBankObj?.accountNumber || '1015');
              const vendorAccountCode = payCoa ? String(payCoa.account_code) : '2010';

              let voucherTypeRecord = 'Cash Receipt Voucher';
              let balancedJournalItems: any[] = [];

              if (values.paymentMethod === 'By Cash') {
                voucherTypeRecord = 'Cash Receipt Voucher';
                balancedJournalItems = [
                  { accountCode: cashAccountCode, description: `Cash refund received from ${selectedReturnDetails.vendor} via ${values.receiptNo}`, debit: finalAmount, credit: 0 },
                  { accountCode: vendorAccountCode, description: `Debit note settlement for ${values.returnNo}`, debit: 0, credit: finalAmount }
                ];
              } else if (values.paymentMethod === 'By Bank') {
                voucherTypeRecord = 'Bank Receipt Voucher';
                balancedJournalItems = [
                  { accountCode: bankAccountCode, description: `Bank wire refund received from ${selectedReturnDetails.vendor} via ${values.receiptNo}`, debit: finalAmount, credit: 0 },
                  { accountCode: vendorAccountCode, description: `Debit note settlement for ${values.returnNo}`, debit: 0, credit: finalAmount }
                ];
              } else {
                voucherTypeRecord = 'Cash & Bank Receipt Voucher';
                balancedJournalItems = [
                  ...(cashPortion > 0 ? [{ accountCode: cashAccountCode, description: `Cash refund received via ${values.receiptNo}`, debit: cashPortion, credit: 0 }] : []),
                  ...(bankPortion > 0 ? [{ accountCode: bankAccountCode, description: `Bank wire refund received via ${values.receiptNo}`, debit: bankPortion, credit: 0 }] : []),
                  { accountCode: vendorAccountCode, description: `Debit note settlement for ${values.returnNo}`, debit: 0, credit: finalAmount }
                ];
              }

              const methodStr = values.paymentMethod === 'Split'
                ? ` | Split (Cash: Rs. ${formatMoney(cashPortion)} + Bank: Rs. ${formatMoney(bankPortion)})`
                : (values.paymentMethod === 'By Bank' ? ` | Source Bank: ${selectedBankObj?.bankName || values.selectedBankId}` : ' | Mode: Cash Drawer');

              const compositeNarration = `Vendor Refund Collected: ${selectedReturnDetails.vendor} | Debit Note: ${values.returnNo}${methodStr} | Remarks: ${values.notes.trim()}`.trim();

              const voucherPayload = {
                voucher_no: values.receiptNo,
                voucher_type: voucherTypeRecord,
                voucher_date: values.paymentDate,
                customerName: selectedReturnDetails.vendor,
                customer_name: selectedReturnDetails.vendor,
                original_invoice_no: values.returnNo,
                narration: compositeNarration,
                notes: compositeNarration,
                total_amount: finalAmount,
                items: balancedJournalItems,
                metadata: {
                  selectedBankId: (values.paymentMethod === 'By Bank' || values.paymentMethod === 'Split') ? values.selectedBankId : null,
                  selectedBankTitle: selectedBankObj ? `${selectedBankObj.bankName} - ${selectedBankObj.accountTitle}` : null,
                  linkedReturnNo: values.returnNo,
                  cashAmount: cashPortion,
                  bankAmount: bankPortion,
                  paymentTerm: values.paymentMethod,
                  moduleSource: 'purchase_return_receipt'
                }
              };

              // Upsert voucher into financial_vouchers
              const { data: existingVoucher } = await supabase
                .from('financial_vouchers')
                .select('id')
                .eq('voucher_no', values.receiptNo)
                .maybeSingle();

              if (existingVoucher) {
                await supabase.from('financial_vouchers').update(voucherPayload).eq('id', existingVoucher.id);
              } else {
                await supabase.from('financial_vouchers').insert([voucherPayload]);
              }

              // 3. Update return note amount_paid and status
              const { data: targetReturn } = await supabase
                .from('purchase_returns')
                .select('id, total_amount, amount_paid')
                .eq('return_no', values.returnNo)
                .single();

              if (targetReturn) {
                const totalGross = Number(targetReturn.total_amount) || 0;
                const newPaidSum = (Number(targetReturn.amount_paid) || 0) + finalAmount;
                await supabase
                  .from('purchase_returns')
                  .update({
                    amount_paid: newPaidSum,
                    amount_received: newPaidSum,
                    status: newPaidSum >= totalGross - 1 ? 'Refunded' : 'Partial Refund'
                  })
                  .eq('id', targetReturn.id);
              }

              toast.success(isEditMode ? 'Vendor refund collection updated!' : 'Vendor refund collection logged successfully!');

              if (shouldPrintAfterSave && savedReceiptId) {
                navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return-Receipt/Print/${savedReceiptId}`);
              } else {
                navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return-Receipt/List`);
              }

            } catch (err: any) {
              toast.error('Submission error: ' + err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ handleChange, values, setFieldValue, touched, errors, handleSubmit }) => (
            <Form className="space-y-6">
              
              {/* Row 1: Receipt No, Target Return Dropdown, Payment Method, Entry Date */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                
                {/* 1. Receipt Code # */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Receipt Code #:
                  </label>
                  <div className="p-2.5 bg-slate-50 dark:bg-meta-4/20 border border-stroke dark:border-strokedark rounded-lg font-mono font-black text-primary text-xs flex items-center justify-between">
                    <span>{values.receiptNo}</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-sans uppercase font-bold">Auto</span>
                  </div>
                </div>

                {/* 2. Select Target Return Note (Searchable Dropdown) */}
                <div className="relative" ref={returnDropdownRef}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>Target Return Note: <span className="text-rose-500">*</span></span>
                    {values.returnNo && (
                      <span className="text-[10px] text-emerald-600 font-bold font-mono">Linked</span>
                    )}
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search return # or vendor..."
                      value={returnSearchQuery}
                      onChange={(e) => {
                        setReturnSearchQuery(e.target.value);
                        setIsReturnDropdownOpen(true);
                      }}
                      onFocus={() => setIsReturnDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (!isReturnDropdownOpen) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedReturnIndex(prev => Math.min(prev + 1, filteredReturnOptions.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedReturnIndex(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredReturnOptions[highlightedReturnIndex]) {
                            const sel = filteredReturnOptions[highlightedReturnIndex];
                            setFieldValue('returnNo', sel.return_no);
                            setReturnSearchQuery(`${sel.return_no} (${sel.vendor_name || 'Vendor'})`);
                            setIsReturnDropdownOpen(false);
                            handleActiveReturnCalculation(sel.return_no, returnOptions);
                          }
                        } else if (e.key === 'Escape') {
                          setIsReturnDropdownOpen(false);
                        }
                      }}
                      className="w-full rounded-lg border border-stroke bg-white p-2.5 pr-8 text-xs font-bold text-slate-900 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark dark:text-white"
                    />
                    {returnSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setReturnSearchQuery('');
                          setFieldValue('returnNo', '');
                          setSelectedReturnDetails({ total: 0, upfront: 0, subsequent: 0, pending: 0, vendor: '', returnDate: '', itemsCount: 0 });
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 cursor-pointer"
                      >
                        <MdClear size={16} />
                      </button>
                    )}
                  </div>

                  {touched.returnNo && errors.returnNo && (
                    <p className="text-rose-500 text-[10px] mt-1 font-semibold">{errors.returnNo}</p>
                  )}

                  {/* Floating Options Dropdown */}
                  {isReturnDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-stroke bg-white shadow-xl dark:border-strokedark dark:bg-boxdark">
                      {filteredReturnOptions.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-400 italic">
                          No matching return notes found
                        </div>
                      ) : (
                        filteredReturnOptions.map((r, idx) => {
                          const gross = Number(r.total_amount) || 0;
                          const upfront = Number(r.amount_paid) || 0;
                          const isSelected = values.returnNo === r.return_no;
                          const isHighlighted = highlightedReturnIndex === idx;

                          return (
                            <div
                              key={r.id || r.return_no}
                              onClick={() => {
                                setFieldValue('returnNo', r.return_no);
                                setReturnSearchQuery(`${r.return_no} (${r.vendor_name || 'Vendor'})`);
                                setIsReturnDropdownOpen(false);
                                handleActiveReturnCalculation(r.return_no, returnOptions);
                              }}
                              className={`p-2.5 border-b border-stroke/50 dark:border-strokedark/50 cursor-pointer transition flex items-center justify-between text-xs ${
                                isSelected ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700' : isHighlighted ? 'bg-slate-100 dark:bg-meta-4/30 text-slate-900' : 'hover:bg-slate-50 dark:hover:bg-meta-4/20 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <div>
                                <div className="font-mono font-black text-primary flex items-center gap-1.5">
                                  {r.return_no}
                                  <span className="text-[10px] text-gray-400 font-sans font-medium">({r.return_date || 'N/A'})</span>
                                </div>
                                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                  Vendor: {r.vendor_name || 'General Vendor'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-bold text-slate-900 dark:text-white">
                                  Rs. {formatMoney(gross)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Mode: {r.payment_term || 'On Credit'}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Collection Method */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Collection Method: <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="paymentMethod"
                    value={values.paymentMethod}
                    onChange={(e) => {
                      handleChange(e);
                      if (e.target.value === 'By Cash') {
                        setFieldValue('cashAmount', values.amount);
                        setFieldValue('bankAmount', 0);
                      } else if (e.target.value === 'By Bank') {
                        setFieldValue('bankAmount', values.amount);
                        setFieldValue('cashAmount', 0);
                      }
                    }}
                    className="w-full rounded-lg border border-stroke bg-white p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark dark:text-white cursor-pointer"
                  >
                    <option value="By Cash">By Cash (Cash Drawer)</option>
                    <option value="By Bank">By Bank Wire / Cheque</option>
                    <option value="Split">Split (Cash + Bank Wire)</option>
                  </select>
                </div>

                {/* 4. Entry Date */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Collection Date: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    value={values.paymentDate}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-stroke bg-white p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark dark:text-white font-mono"
                  />
                </div>

              </div>

              {/* Bank Account Selector (Shown if By Bank or Split) */}
              {(values.paymentMethod === 'By Bank' || values.paymentMethod === 'Split') && (
                <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-meta-4/20 border border-teal-200 dark:border-teal-800/60 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300 mb-1 flex items-center gap-1.5">
                      <MdAccountBalance size={14} /> Receiving Bank Account: <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="selectedBankId"
                      value={values.selectedBankId}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-teal-300 bg-white p-2.5 text-xs font-bold text-slate-900 outline-none dark:border-teal-700 dark:bg-boxdark dark:text-white cursor-pointer"
                    >
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - {b.accountTitle || b.accountNumber} ({b.accountNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-teal-800 dark:text-teal-300">
                    <p className="font-semibold">Deposit Ledger Sync:</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      Funds received will be credited to this company bank account and debited to your banking GL ledger automatically.
                    </p>
                  </div>
                </div>
              )}

              {/* Target Return Information Summary Card */}
              {values.returnNo && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-meta-4/20 border border-stroke dark:border-strokedark">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-stroke dark:border-strokedark">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Selected Debit Note</span>
                      <h4 className="text-base font-black text-primary font-mono">{values.returnNo}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-200 dark:bg-meta-4 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-md text-[11px] font-black uppercase inline-flex items-center gap-1">
                        <MdPerson size={13} /> {selectedReturnDetails.vendor}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 font-mono">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Gross Return Bill:</span>
                      <strong className="text-slate-900 dark:text-white text-xs font-black">Rs. {formatMoney(selectedReturnDetails.total)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Upfront Refund:</span>
                      <strong className="text-slate-600 dark:text-slate-300 text-xs font-bold">Rs. {formatMoney(selectedReturnDetails.upfront)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Past Receipts:</span>
                      <strong className="text-slate-600 dark:text-slate-300 text-xs font-bold">Rs. {formatMoney(selectedReturnDetails.subsequent)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block font-sans">Pending To Collect:</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 text-xs font-black">Rs. {formatMoney(selectedReturnDetails.pending)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 2: Collected Amount, Split Inputs & Remarks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Amount Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center justify-between">
                      <span>Total Amount Collected (PKR): <span className="text-rose-500">*</span></span>
                      {selectedReturnDetails.pending > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFieldValue('amount', selectedReturnDetails.pending);
                            if (values.paymentMethod === 'By Cash') setFieldValue('cashAmount', selectedReturnDetails.pending);
                            if (values.paymentMethod === 'By Bank') setFieldValue('bankAmount', selectedReturnDetails.pending);
                          }}
                          className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                        >
                          Fill Full Balance (Rs. {formatMoney(selectedReturnDetails.pending)})
                        </button>
                      )}
                    </label>
                    <input
                      type="number"
                      name="amount"
                      placeholder="0.00"
                      onKeyDown={blockInvalidChar}
                      value={values.amount}
                      onChange={(e) => {
                        handleChange(e);
                        const v = e.target.value;
                        if (values.paymentMethod === 'By Cash') setFieldValue('cashAmount', v);
                        if (values.paymentMethod === 'By Bank') setFieldValue('bankAmount', v);
                      }}
                      className="w-full rounded-lg border-2 border-emerald-500/60 bg-emerald-50/20 p-3 text-base font-black font-mono text-emerald-800 outline-none focus:border-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-300"
                    />
                    {touched.amount && errors.amount && (
                      <p className="text-rose-500 text-[10px] mt-1 font-semibold">{errors.amount}</p>
                    )}
                  </div>

                  {/* Split payment cash + bank Breakdown */}
                  {values.paymentMethod === 'Split' && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-meta-4/20 border border-stroke dark:border-strokedark grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cash Inflow Portion:</label>
                        <input
                          type="number"
                          name="cashAmount"
                          value={values.cashAmount}
                          onKeyDown={blockInvalidChar}
                          onChange={handleChange}
                          placeholder="Cash amount"
                          className="w-full rounded border border-stroke p-2 text-xs font-mono font-bold outline-none dark:border-strokedark bg-white dark:bg-boxdark"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bank Wire Portion:</label>
                        <input
                          type="number"
                          name="bankAmount"
                          value={values.bankAmount}
                          onKeyDown={blockInvalidChar}
                          onChange={handleChange}
                          placeholder="Bank amount"
                          className="w-full rounded border border-stroke p-2 text-xs font-mono font-bold outline-none dark:border-strokedark bg-white dark:bg-boxdark"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Remarks / Memo */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Refund Remarks / Cheque Details:
                  </label>
                  <textarea
                    name="notes"
                    rows={4}
                    value={values.notes}
                    onChange={handleChange}
                    placeholder="e.g. Received online cash refund from vendor for damaged tile batch, Cheque #49281..."
                    className="w-full rounded-lg border border-stroke bg-white p-3 text-xs text-slate-900 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark dark:text-white"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-stroke dark:border-strokedark flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Return-Receipt/List`)}
                  className="rounded-lg border border-stroke py-2.5 px-6 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-meta-4/20 transition text-xs cursor-pointer shadow-xs"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShouldPrintAfterSave(true);
                    handleSubmit();
                  }}
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 px-6 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <FiPrinter size={14} />
                  <span>Save & Print Receipt</span>
                </button>

                <button
                  type="submit"
                  onClick={() => setShouldPrintAfterSave(false)}
                  disabled={loading}
                  className="rounded-lg bg-primary hover:bg-opacity-90 py-2.5 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                >
                  {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Refund' : 'Save & Collect Refund'}</span>}
                </button>
              </div>

            </Form>
          )}
        </Formik>

      </div>
    </div>
  );
};

export default AddPurchaseReturnReceipt;
