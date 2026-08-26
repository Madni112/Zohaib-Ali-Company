import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';

function AddInvoiceReceipt() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);


  const [invoiceOptions, setInvoiceOptions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<any[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState<number>(0);
  const [remainingBalance, setRemainingBalance] = useState<number>(0);
  const [totalReturnedCredit, setTotalReturnedCredit] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedInvoiceIdx, setHighlightedInvoiceIdx] = useState(0);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [salesman, setSalesman] = useState('');

  const editData = location.state?.receipt;
  const isEditMode = !!editData;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.invoice-search-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchReceiptMetadata = async () => {
      try {
        const { data: invData } = await supabase.from('sales_invoices').select('id, customer_name, total_amount, receipt_status, cash_amount_paid').order('id', { ascending: false });
        const { data: returnRecords } = await supabase.from('sales_returns').select('original_invoice_no, total_amount');
        const { data: pastReceipts } = await supabase.from('financial_vouchers').select('id, original_invoice_no, total_amount').or('voucher_type.eq.Cash Receipt Voucher,voucher_type.eq.Bank Receipt Voucher');
        const { data: bankData } = await supabase.from('banks').select('id, bankName, accountTitle, accountNumber');
        const { data: coaData } = await supabase.from('chart_of_accounts').select('account_code, account_title, control_code, category_code');

        if (bankData) setBankAccounts(bankData);
        if (coaData) setCoaAccounts(coaData);

        if (invData) {
          const currentEditId = editData?.id || null;
          const processedInvoices = invData.map((inv: any) => {
            const invIdStr = String(inv.id).trim().toLowerCase();
            const isMarkedReturned = String(inv.receipt_status || '').toUpperCase() === 'RETURNED';

            const matchedReturns = (returnRecords || []).filter((r: any) => {
              const cleanRef = String(r.original_invoice_no || '').replace('INV-', '').trim().toLowerCase();
              return cleanRef === invIdStr;
            });
            const sumReturns = matchedReturns.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);

            const matchedVouchers = (pastReceipts || []).filter((v: any) => {
              if (isEditMode && v.id === currentEditId) return false;
              const cleanRef = String(v.original_invoice_no || '').replace('INV-', '').trim().toLowerCase();
              return cleanRef === invIdStr;
            });
            const sumVouchers = matchedVouchers.reduce((sum: number, v: any) => sum + (Number(v.total_amount) || 0), 0);

            const initPaid = Number(inv.cash_amount_paid || 0);
            const totalBilled = Number(inv.total_amount || 0);
            const netRemaining = Math.max(0, totalBilled - initPaid - sumVouchers - sumReturns);

            const isReturnedOrSettled = isMarkedReturned || sumReturns >= totalBilled || netRemaining <= 0.01;

            return {
              ...inv,
              netRemaining,
              sumReturns,
              isReturnedOrSettled,
              statusBadge: isMarkedReturned || sumReturns >= totalBilled ? 'RETURNED' : (netRemaining <= 0.01 ? 'FULLY SETTLED' : 'OPEN')
            };
          });

          setInvoiceOptions(processedInvoices);
        }

        if (isEditMode && editData) {
          const invId = String(editData.original_invoice_no).replace('INV-', '').trim();
          setSelectedInvoiceId(invId);
          setCustomerName(editData.customerName || editData.customer_name || '');
          setSalesman(editData.salesman || 'General');

          // 🔍 Fetch live invoice data, returns and other vouchers to compute remaining balance
          const { data: currentInv } = await supabase
            .from('sales_invoices')
            .select('*')
            .eq('id', Number(invId))
            .maybeSingle();

          if (currentInv) {
            const netTotal = Number(currentInv.total_amount) || 0;
            setInvoiceTotal(netTotal);
            setCustomerName(currentInv.customer_name || editData.customerName || editData.customer_name || '');
            setSalesman(currentInv.salesman || editData.salesman || 'General');

            const { data: returnRecords } = await supabase
              .from('sales_returns')
              .select('total_amount')
              .or(`original_invoice_no.eq.${invId},original_invoice_no.eq.INV-${invId}`);

            const totalReturnedValue = returnRecords
              ? returnRecords.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0)
              : 0;
            setTotalReturnedCredit(totalReturnedValue);

            const initialPaid = Number(currentInv.cash_amount_paid || 0) + Number(currentInv.bank_amount || 0);
            
            // Other vouchers excluding current voucher being edited
            const otherVouchersTotal = (pastReceipts || [])
              .filter((v: any) => {
                if (v.id === editData.id) return false;
                const cleanRef = String(v.original_invoice_no || '').replace('INV-', '').trim().toLowerCase();
                return cleanRef === invId.toLowerCase();
              })
              .reduce((sum: number, v: any) => sum + (Number(v.total_amount) || 0), 0);

            // Max payable on this receipt = netTotal - initialPaid - otherVouchers - returns
            const netRemainingForThisReceipt = Math.max(0, netTotal - initialPaid - otherVouchersTotal - totalReturnedValue);
            setRemainingBalance(netRemainingForThisReceipt);
          }
        }
      } catch (err: any) {
        console.error('Metadata load failure:', err.message);
      }
    };
    fetchReceiptMetadata();
  }, [isEditMode, editData]);

  useEffect(() => {
    const handleOutsideClick = () => setIsDropdownOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  const validationSchema = Yup.object().shape({
    invoiceNo: Yup.string(),
    paymentTerm: Yup.string(),
    receiptDate: Yup.string(),
    customerName: Yup.string(),
    amount: Yup.number(),
    selectedBankId: Yup.string()
  });
  const handleInstantSelect = async (invoiceId: string, values: any) => {
    if (!invoiceId) return;
    try {
      const { data: invData, error } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('id', Number(invoiceId))
        .single();

      if (error || !invData) {
        toast.error('Sales invoice not found.');
        return;
      }

      if (String(invData.receipt_status || '').toUpperCase() === 'RETURNED') {
        toast.error(`Cannot log receipt: Invoice #${invoiceId} is marked as RETURNED.`);
        setSelectedInvoiceId('');
        setCustomerName('');
        setRemainingBalance(0);
        values.amount = 0;
        return;
      }

      const netTotal = Number(invData.total_amount) || 0;
      setInvoiceTotal(netTotal);

      const { data: pastReceipts } = await supabase
        .from('financial_vouchers')
        .select('id, total_amount')
        .eq('original_invoice_no', invoiceId)
        .or('voucher_type.eq.Cash Receipt Voucher,voucher_type.eq.Bank Receipt Voucher,voucher_type.eq.Cash & Bank Receipt Voucher');

      const { data: returnRecords } = await supabase
        .from('sales_returns')
        .select('total_amount')
        .or(`original_invoice_no.eq.${invoiceId},original_invoice_no.eq.INV-${invoiceId}`);

      const totalReturnedValue = returnRecords
        ? returnRecords.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0)
        : 0;
      setTotalReturnedCredit(totalReturnedValue);

      const totalPaidAtSaleTime = Number(invData.cash_amount_paid || 0) + Number(invData.bank_amount || 0);
      const currentEditId = editData?.id || null;
      const totalPaidViaVouchers = pastReceipts ? pastReceipts.filter((r: any) => !isEditMode || r.id !== currentEditId).reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0) : 0;

      const netRemaining = Math.max(0, netTotal - totalPaidAtSaleTime - totalPaidViaVouchers - totalReturnedValue);

      if (netRemaining <= 0.01) {
        toast.error(`Cannot log receipt: Invoice #${invoiceId} has no remaining balance (Fully settled/returned).`);
        setSelectedInvoiceId('');
        setCustomerName('');
        setRemainingBalance(0);
        values.amount = 0;
        return;
      }

      setRemainingBalance(netRemaining);

      setSelectedInvoiceId(String(invoiceId));
      setCustomerName(invData.customerName || invData.customer_name || 'General Client');
      setSalesman(invData.salesman || 'General');
      values.amount = netRemaining;

      setIsDropdownOpen(false);
      setSearchQuery('');
      toast.success(`Invoice ID ${invoiceId} loaded!`);
    } catch (err: any) {
      console.error(err);
    }
  };
  return (
    <div className="mx-auto max-w-full text-xs">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="flex items-center justify-between border-b border-stroke py-4 px-6.5 dark:border-strokedark">
          <h3 className="font-semibold text-black dark:text-white text-base">Invoice Receipt Processing Wizard</h3>
          <button type="button" onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Registration/InvoiceReceipt/List`)} className="text-sm font-medium text-primary hover:underline cursor-pointer">See List</button>
        </div>


        <div className="p-6">
          <Formik
            initialValues={isEditMode ? {
              receiptNo: editData.voucher_no || '',
              paymentTerm: editData.metadata?.paymentTerm || (editData.voucher_type === 'Bank Receipt Voucher' ? 'By Bank' : (editData.metadata?.cashAmount && editData.metadata?.bankAmount ? 'Split (Cash & Bank)' : 'By Cash')),
              selectedBankId: editData.metadata?.selectedBankId || '',
              receiptDate: editData.voucher_date || '',
              cashAmount: editData.metadata?.cashAmount || (editData.voucher_type === 'Cash Receipt Voucher' ? editData.total_amount : ''),
              bankAmount: editData.metadata?.bankAmount || (editData.voucher_type === 'Bank Receipt Voucher' ? editData.total_amount : ''),
              amount: editData.total_amount || 0,
              notes: editData.narration || ''
            } : {
              receiptNo: `RCP-${Date.now().toString().slice(-6)}`,
              paymentTerm: 'By Cash',
              selectedBankId: '',
              receiptDate: new Date().toISOString().split('T')[0],
              customerName: '',
              salesman: '',
              cashAmount: '',
              bankAmount: '',
              amount: '',
              notes: ''
            }}
            enableReinitialize={true}
            validationSchema={validationSchema}
            onSubmit={async () => { }}
          >
            {({ handleChange, values, setFieldValue }: any) => {
              const filteredInvoiceOptions = invoiceOptions.filter(inv =>
                inv.id.toString().includes(searchQuery) ||
                inv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
              );

              const handleValidateAndSubmit = async () => {
                if (!selectedInvoiceId) return toast.error('Validation Error: Original Invoice ID is missing!');
                if (!values.receiptDate) return toast.error('Validation Error: Clearing Date field cannot be empty!');

                let finalEnteredAmount = 0;
                let cashPortion = 0;
                let bankPortion = 0;

                if (values.paymentTerm === 'By Cash') {
                  cashPortion = Number(values.cashAmount ?? values.amount) || 0;
                  finalEnteredAmount = cashPortion;
                } else if (values.paymentTerm === 'By Bank') {
                  bankPortion = Number(values.bankAmount ?? values.amount) || 0;
                  finalEnteredAmount = bankPortion;
                  if (!values.selectedBankId) return toast.error('Validation Error: Target bank account selector is empty!');
                } else if (values.paymentTerm === 'Split (Cash & Bank)') {
                  cashPortion = Number(values.cashAmount) || 0;
                  bankPortion = Number(values.bankAmount) || 0;
                  finalEnteredAmount = cashPortion + bankPortion;
                  if (!values.selectedBankId && bankPortion > 0) return toast.error('Validation Error: Target bank account selector is empty for bank portion!');
                }

                if (finalEnteredAmount <= 0) return toast.error('Validation Error: Collected payment amount must be greater than 0 PKR!');

                if (finalEnteredAmount > remainingBalance) {
                  return toast.error(`Validation Error: Overpayment blocked! You entered Rs. ${finalEnteredAmount.toLocaleString()}, but the true remaining invoice balance is only Rs. ${remainingBalance.toLocaleString()}.`);
                }

                if (!customerName) return toast.error('Validation Error: Customer data is unverified!');

                try {
                  setLoading(true);
                  // Dynamically resolve COA account codes from live Supabase records
                  const cashCoa = coaAccounts.find((c: any) =>
                    String(c.control_code || '').toLowerCase().includes('cash') ||
                    String(c.account_title || '').toLowerCase().includes('cash')
                  );

                  const selectedBankObj = bankAccounts.find((b: any) => String(b.id) === String(values.selectedBankId));
                  const bankCoa = coaAccounts.find((c: any) =>
                    (selectedBankObj && (
                      String(c.linked_bank_id) === String(selectedBankObj.id) ||
                      String(c.account_code) === String(selectedBankObj.accountNumber) ||
                      String(c.account_title || '').toLowerCase().includes(String(selectedBankObj.bankName || '').toLowerCase())
                    )) ||
                    String(c.control_code || '').toLowerCase().includes('bank')
                  );

                  const recCoa = coaAccounts.find((c: any) =>
                    String(c.control_code || '').toLowerCase().includes('debtor') ||
                    String(c.control_code || '').toLowerCase().includes('receivable') ||
                    String(c.account_title || '').toLowerCase().includes('receivable')
                  );

                  const cashAccountCode = cashCoa ? String(cashCoa.account_code) : '1010';
                  const bankAccountCode = bankCoa ? String(bankCoa.account_code) : (selectedBankObj?.accountNumber || '1015');
                  const customerAccountCode = recCoa ? String(recCoa.account_code) : '1010';

                  const balancedJournalItems: any[] = [];

                  if (cashPortion > 0) {
                    balancedJournalItems.push({ accountCode: cashAccountCode, salesman: salesman, description: `Cash Received via INV-${selectedInvoiceId}`, debit: cashPortion, credit: 0 });
                  }
                  if (bankPortion > 0) {
                    balancedJournalItems.push({ accountCode: bankAccountCode, salesman: salesman, description: `Bank Wire Received via INV-${selectedInvoiceId}`, debit: bankPortion, credit: 0 });
                  }
                  balancedJournalItems.push({ accountCode: customerAccountCode, salesman: salesman, description: `Debt cleared against INV-${selectedInvoiceId}`, debit: 0, credit: finalEnteredAmount });

                  const bankTrackingString = (values.paymentTerm === 'By Bank' || values.paymentTerm === 'Split (Cash & Bank)') && selectedBankObj 
                    ? ` | Bank: ${selectedBankObj.bankName} - ${selectedBankObj.accountTitle}` 
                    : '';
                  const compositeNarration = `Customer: ${customerName} | Salesman: ${salesman} | Invoice Ref: INV-${selectedInvoiceId}${bankTrackingString} | Note: ${(values.notes || '').trim()}`.trim();

                  const voucherTypeString = values.paymentTerm === 'Split (Cash & Bank)'
                    ? 'Cash & Bank Receipt Voucher'
                    : (values.paymentTerm === 'By Bank' ? 'Bank Receipt Voucher' : 'Cash Receipt Voucher');

                  const payload = {
                    voucher_no: values.receiptNo,
                    voucher_type: voucherTypeString,
                    voucher_date: values.receiptDate,
                    original_invoice_no: selectedInvoiceId,
                    customerName: customerName,
                    customer_name: customerName,
                    salesman: salesman,
                    narration: compositeNarration,
                    notes: compositeNarration,
                    total_amount: finalEnteredAmount,
                    bank_title: selectedBankObj?.accountTitle || null,
                    linked_bank_title: selectedBankObj?.accountTitle || null,
                    items: balancedJournalItems,
                    metadata: {
                      paymentTerm: values.paymentTerm,
                      selectedBankId: values.selectedBankId,
                      cashAmount: cashPortion,
                      bankAmount: bankPortion
                    }
                  };

                  const { error } = isEditMode
                    ? await supabase.from('financial_vouchers').update(payload).eq('id', editData.id)
                    : await supabase.from('financial_vouchers').insert([payload]);

                  if (error) throw error;

                  const netOutstandingAfterPayment = remainingBalance - finalEnteredAmount;
                  let targetStatusString = 'Partial';
                  if (netOutstandingAfterPayment <= 1) {
                    targetStatusString = 'Paid';
                  } else if (finalEnteredAmount === 0) {
                    targetStatusString = 'Unpaid';
                  }

                  await supabase
                    .from('sales_invoices')
                    .update({ receipt_status: targetStatusString })
                    .eq('id', Number(selectedInvoiceId));

                  toast.success('Invoice receipt processed successfully!');
                  navigate(`${tenantId ? `/${tenantId}` : ''}/Registration/InvoiceReceipt/List`);

                } catch (err: any) {
                  toast.error(err.message);
                } finally {
                  setLoading(false);
                }
              };


              return (
                <Form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-gray-500 mb-1 font-bold uppercase">Receipt Note #:</label>
                      <p className="text-primary font-bold p-2 bg-gray-50 dark:bg-meta-4/10 rounded font-mono text-sm">{values.receiptNo}</p>
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1 font-bold uppercase">Original Invoice ID: *</label>
                      <div className="relative invoice-search-container">
                        <input
                          type="text"
                          autoComplete="off"
                          disabled={isEditMode}
                          value={searchQuery}
                          onFocus={() => {
                            if (!isEditMode) {
                              setIsDropdownOpen(true);
                              setHighlightedInvoiceIdx(0);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHighlightedInvoiceIdx(prev => prev < filteredInvoiceOptions.length - 1 ? prev + 1 : 0);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHighlightedInvoiceIdx(prev => prev > 0 ? prev - 1 : filteredInvoiceOptions.length - 1);
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (filteredInvoiceOptions.length > 0) {
                                const chosen = filteredInvoiceOptions[highlightedInvoiceIdx] || filteredInvoiceOptions[0];
                                if (!chosen.isReturnedOrSettled) {
                                  handleInstantSelect(String(chosen.id), values);
                                  setSearchQuery(`INV-${String(chosen.id).padStart(4, '0')} - ${chosen.customer_name}`);
                                  setIsDropdownOpen(false);
                                } else {
                                  toast.error(`Invoice #INV-${String(chosen.id).padStart(4, '0')} is ${chosen.statusBadge} and cannot be selected.`);
                                }
                              }
                            } else if (e.key === 'Tab' || e.key === 'Escape') {
                              setIsDropdownOpen(false);
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSearchQuery(val);
                            setIsDropdownOpen(true);
                            setHighlightedInvoiceIdx(0);

                            // Exact match check (e.g. typing "0005" or "5")
                            const cleanedVal = val.replace(/^inv-?/i, '').trim();
                            const matched = invoiceOptions.find(inv => String(inv.id) === cleanedVal);
                            if (matched && !matched.isReturnedOrSettled) {
                              handleInstantSelect(String(matched.id), values);
                            }
                          }}
                          placeholder={selectedInvoiceId ? `INV-${selectedInvoiceId.padStart(4, '0')} - ${customerName}` : 'Type invoice # or customer name...'}
                          className={`w-full rounded border p-2 bg-white dark:bg-boxdark font-bold text-black dark:text-white outline-none ${!selectedInvoiceId && !searchQuery ? 'border-stroke dark:border-strokedark' : 'border-primary shadow-sm'} ${isEditMode ? 'opacity-50 cursor-not-allowed' : 'focus:border-primary'}`}
                        />

                        {/* RICH SEARCHABLE INVOICE DROPDOWN (Z-STACK ELEVATED) */}
                        {isDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1.5 w-full min-w-[340px] max-h-[290px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A222C] shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 z-[99999] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                            {filteredInvoiceOptions.length === 0 ? (
                              <div className="p-4 text-gray-400 text-center text-xs italic">No matching invoices found</div>
                            ) : (
                              filteredInvoiceOptions.map((inv, invIdx) => {
                                const isDisabled = inv.isReturnedOrSettled;
                                const isHighlighted = invIdx === highlightedInvoiceIdx;

                                return (
                                  <div
                                    key={inv.id}
                                    onMouseEnter={() => setHighlightedInvoiceIdx(invIdx)}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      if (isDisabled) {
                                        toast.error(`Invoice #INV-${String(inv.id).padStart(4, '0')} is ${inv.statusBadge} and cannot be selected.`);
                                        return;
                                      }
                                      handleInstantSelect(String(inv.id), values);
                                      setSearchQuery(`INV-${String(inv.id).padStart(4, '0')} - ${inv.customer_name}`);
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
                                          INV-{String(inv.id).padStart(4, '0')}
                                        </span>
                                        {isDisabled && (
                                          <span className="text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.2 rounded">
                                            {inv.statusBadge}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        {inv.customer_name}
                                      </span>
                                    </div>
                                    <div className="text-right font-mono text-xs pl-2">
                                      {isDisabled ? (
                                        <span className="text-gray-400">Rs. {Number(inv.total_amount || 0).toLocaleString()}</span>
                                      ) : (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Due: Rs. {Number(inv.netRemaining || 0).toLocaleString()}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1 font-bold uppercase">Clearing Date: *</label>
                      <input type="date" name="receiptDate" onChange={handleChange} value={values.receiptDate} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-bold text-black dark:text-white" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-500 mb-1 font-bold uppercase">Customer Name:</label>
                      <input type="text" name="customerName" readOnly value={customerName} className="w-full rounded border border-stroke p-2 bg-gray-100 dark:bg-meta-4/30 outline-none font-bold text-gray-600 dark:text-gray-300" placeholder="" />
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1 font-bold uppercase">Salesman:</label>
                      <input type="text" name="salesman" readOnly value={salesman} className="w-full rounded border border-stroke p-2 bg-gray-100 dark:bg-meta-4/30 outline-none font-bold text-gray-500" placeholder="" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-gray-500 mb-1 font-bold uppercase">Payment Settlement Mode: *</label>
                          <select
                            name="paymentTerm"
                            onChange={(e) => {
                              handleChange(e);
                              if (e.target.value === 'By Cash') {
                                setFieldValue('selectedBankId', '');
                                setFieldValue('bankAmount', '');
                              }
                              if (selectedInvoiceId) {
                                handleInstantSelect(selectedInvoiceId, values);
                              }
                            }}
                            value={values.paymentTerm}
                            className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-white text-black dark:bg-boxdark dark:text-white font-bold outline-none text-xs h-[38px]"
                          >
                            <option value="By Cash">By Cash</option>
                            <option value="By Bank">By Bank</option>
                            <option value="Split (Cash & Bank)">Cash & Bank Combined</option>
                          </select>
                        </div>

                        {(values.paymentTerm === 'By Bank' || values.paymentTerm === 'Split (Cash & Bank)') ? (
                          <div>
                            <label className="block text-gray-500 mb-1 font-bold uppercase text-primary">Target Bank Account: *</label>
                            <select
                              name="selectedBankId"
                              onChange={handleChange}
                              value={values.selectedBankId}
                              className="w-full border rounded p-2 bg-white text-black dark:bg-boxdark dark:text-white font-bold outline-none border-stroke dark:border-strokedark text-xs h-[38px]"
                            >
                              <option value="">-- Select Active Bank Ledger --</option>
                              {bankAccounts.map(b => <option key={b.id} value={b.id}>{`${b.bankName} - ${b.accountTitle} (${b.accountNumber || '-'})`}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-gray-500 mb-1 font-bold uppercase text-success">Target Cash Vault Account:</label>
                            <div className="p-2 rounded border border-stroke bg-gray-50 dark:bg-meta-4/10 font-bold text-success text-xs h-[38px] flex items-center">
                              Main Cash Ledger Register
                            </div>
                          </div>
                        )}
                      </div>

                      {values.paymentTerm === 'Split (Cash & Bank)' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-500 mb-1 font-bold uppercase text-success">Cash Amount (PKR): *</label>
                            <input
                              type="number"
                              name="cashAmount"
                              onKeyDown={blockInvalidChar}
                              onChange={handleChange}
                              value={values.cashAmount}
                              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-extrabold text-success text-sm"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-500 mb-1 font-bold uppercase text-primary">Bank Amount (PKR): *</label>
                            <input
                              type="number"
                              name="bankAmount"
                              onKeyDown={blockInvalidChar}
                              onChange={handleChange}
                              value={values.bankAmount}
                              className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-extrabold text-primary text-sm"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-gray-500 mb-1 font-bold uppercase text-success">
                            {values.paymentTerm === 'By Bank' ? 'Bank Wire Amount (PKR): *' : 'Cash Amount (PKR): *'}
                          </label>
                          <input
                            type="number"
                            name="amount"
                            onKeyDown={blockInvalidChar}
                            onChange={handleChange}
                            value={values.amount}
                            className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-extrabold text-success text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      )}

                      {invoiceTotal > 0 && (
                        <div className="flex flex-col gap-1.5 mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-sans">
                          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                            <span>Original Invoice Total:</span>
                            <b className="font-mono text-slate-800 dark:text-slate-200">Rs. {invoiceTotal.toLocaleString()}</b>
                          </div>
                          {totalReturnedCredit > 0 && (
                            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 font-bold rounded border border-amber-200/50 text-[11px] animate-pulse">
                              ⚠️ Sales Return Deducted: Rs. {totalReturnedCredit.toLocaleString()}
                            </div>
                          )}
                          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-semibold border-t border-slate-200 dark:border-slate-700 pt-1">
                            <span>Max Available for this Receipt:</span>
                            <b className="font-mono text-emerald-600 dark:text-emerald-400">Rs. {remainingBalance.toLocaleString()}</b>
                          </div>

                          {values.paymentTerm === 'Split (Cash & Bank)' && (
                            <div className="flex justify-between items-center text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-700 pt-1">
                              <span>Total This Collection (Cash + Bank):</span>
                              <b className="font-mono text-emerald-700">Rs. {(Number(values.cashAmount || 0) + Number(values.bankAmount || 0)).toLocaleString()}</b>
                            </div>
                          )}

                          <div className="flex justify-between items-center text-danger font-bold border-t border-dashed border-slate-200 dark:border-slate-700 pt-1">
                            <span>Net Balance Remaining After Payment:</span>
                            <b className="font-mono">
                              Rs. {Math.max(0, remainingBalance - (values.paymentTerm === 'Split (Cash & Bank)' ? (Number(values.cashAmount || 0) + Number(values.bankAmount || 0)) : (Number(values.amount) || 0))).toLocaleString()}
                            </b>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1 font-bold uppercase">Transaction Memo Remarks:</label>
                      <textarea name="notes" rows={4} onChange={handleChange} value={values.notes} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent outline-none text-black dark:text-white text-xs" placeholder="Add receipt memos..." />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-stroke dark:border-strokedark">
                    <button
                      type="button"
                      onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Registration/InvoiceReceipt/List`)}
                      className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleValidateAndSubmit}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                    >
                      {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Receipt' : 'Record Receipt'}</span>}
                    </button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </div>
      </div>
    </div>
  );
}

export default AddInvoiceReceipt;
