import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { 
  MdStore, 
  MdPerson, 
  MdReceipt, 
  MdAttachMoney, 
  MdEvent, 
  MdAccountBalance, 
  MdCheckCircle, 
  MdArrowBack, 
  MdInfoOutline,
  MdOutlinePayment
} from 'react-icons/md';

function AddPurchaseReceipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId } = useAuth();

  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);

  const [vendorOptions, setVendorOptions] = useState<any[]>([]);
  const [purchaseOptions, setPurchaseOptions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<any[]>([]);

  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedVendorObj, setSelectedVendorObj] = useState<any>(null);
  const [selectedPurchaseNo, setSelectedPurchaseNo] = useState<string>('');
  const [selectedPurchaseObj, setSelectedPurchaseObj] = useState<any>(null);

  // Balances
  const [vendorTotalOutstanding, setVendorTotalOutstanding] = useState<number>(0);
  const [poGrossBill, setPoGrossBill] = useState<number>(0);
  const [poPaidUpfront, setPoPaidUpfront] = useState<number>(0);
  const [poPastReceiptsPaid, setPoPastReceiptsPaid] = useState<number>(0);
  const [effectiveDueForThisReceipt, setEffectiveDueForThisReceipt] = useState<number>(0);
  const [poAllocationsMap, setPoAllocationsMap] = useState<Record<string, { gross: number; upfront: number; pastReceipts: number; due: number }>>({});

  const editData = location.state?.receiptRecord;
  const isEditMode = !!editData;

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
    const fetchMetadata = async () => {
      try {
        setMetadataLoading(true);
        // 1. Fetch Vendors
        const { data: vData } = await supabase.from('vendors').select('*').order('vendor_name', { ascending: true });
        const normalizedVendors = (vData || []).map((v: any) => ({
          ...v,
          vendor_name: v.vendor_name || v.name || 'Unnamed Vendor'
        }));
        setVendorOptions(normalizedVendors);

        // 2. Fetch Banks & COA
        const { data: bankData } = await supabase.from('banks').select('id, bankName, accountTitle, accountNumber');
        const { data: coaData } = await supabase.from('chart_of_accounts').select('account_code, account_title, control_code, category_code');

        if (bankData) setBankAccounts(bankData);
        if (coaData) setCoaAccounts(coaData);

        // 3. Fetch all Supplier Purchases
        const { data: purData } = await supabase
          .from('supplier_purchases')
          .select('*')
          .order('id', { ascending: false });

        if (purData) setPurchaseOptions(purData);

        // If in Edit Mode, restore state
        if (isEditMode && editData) {
          const vName = editData.customer_name || editData.customerName || '';
          setSelectedVendor(vName);
          const matchedVendor = normalizedVendors.find(v => v.vendor_name.toLowerCase() === vName.toLowerCase());
          if (matchedVendor) setSelectedVendorObj(matchedVendor);

          const poRef = editData.original_invoice_no || editData.metadata?.linkedPurchaseNo || '';
          if (poRef) {
            setSelectedPurchaseNo(poRef);
            const cleanId = String(poRef).replace(/\D/g, '');
            const matchedPo = purData?.find(p => p.purchase_no === poRef || String(p.id) === cleanId);
            if (matchedPo) setSelectedPurchaseObj(matchedPo);
          }

          calculateVendorBalances(vName, poRef, purData || [], editData.id);
        }
      } catch (err: any) {
        console.error(err.message);
        toast.error('Failed to load payment metadata: ' + err.message);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchMetadata();
  }, [isEditMode, editData]);

  // ── Calculate Live Balances for Vendor & Selected PO ───────────────────────
  const calculateVendorBalances = async (
    vendorName: string, 
    poNumber: string, 
    allPurchases: any[], 
    currentEditVoucherId: number | null = null
  ) => {
    if (!vendorName) {
      setVendorTotalOutstanding(0);
      setPoGrossBill(0);
      setPoPaidUpfront(0);
      setPoPastReceiptsPaid(0);
      setEffectiveDueForThisReceipt(0);
      setPoAllocationsMap({});
      return;
    }

    try {
      // 1. Fetch vendor's purchases sorted chronologically (oldest first for FIFO general clearing)
      const vendorPurchases = allPurchases.filter(p => 
        (p.supplier_name || p.vendor_name || '').toLowerCase() === vendorName.toLowerCase()
      );

      const sortedVendorPurchases = [...vendorPurchases].sort((a, b) => {
        const dateA = new Date(a.purchase_date || a.created_at).getTime();
        const dateB = new Date(b.purchase_date || b.created_at).getTime();
        return dateA - dateB;
      });

      // 2. Fetch past payment vouchers for this vendor
      const { data: pastVouchers } = await supabase
        .from('financial_vouchers')
        .select('id, total_amount, original_invoice_no, metadata')
        .eq('customer_name', vendorName)
        .or('voucher_type.eq.Cash Payment Voucher,voucher_type.eq.Bank Payment Voucher');

      // Gross purchases total and initial paid
      let totalPurchasesGross = 0;
      let totalPurchasesUpfrontPaid = 0;

      vendorPurchases.forEach(p => {
        const gross = Number(p.total_amount) || 0;
        const paid = Number(p.cash_amount_paid || 0) + Number(p.bank_amount_paid || 0);
        totalPurchasesGross += gross;
        totalPurchasesUpfrontPaid += paid;
      });

      // Track PO allocations
      const allocations: Record<string, { gross: number; upfront: number; specificVouchers: number; generalAllocated: number; pastReceipts: number; due: number }> = {};
      let totalVouchersPaid = 0;
      let unallocatedGeneralVouchers = 0;

      // Initialize all POs
      sortedVendorPurchases.forEach(p => {
        const key = p.purchase_no;
        const gross = Number(p.total_amount) || 0;
        const upfront = Number(p.cash_amount_paid || 0) + Number(p.bank_amount_paid || 0);
        allocations[key] = {
          gross,
          upfront,
          specificVouchers: 0,
          generalAllocated: 0,
          pastReceipts: 0,
          due: Math.max(0, gross - upfront)
        };
      });

      // Assign PO-specific vouchers and accumulate general unallocated vouchers
      (pastVouchers || []).forEach(v => {
        if (currentEditVoucherId && v.id === currentEditVoucherId) return;
        const vAmt = Number(v.total_amount) || 0;
        totalVouchersPaid += vAmt;

        const vPoRef = v.original_invoice_no || v.metadata?.linkedPurchaseNo || '';
        if (vPoRef) {
          const cleanVPoId = String(vPoRef).replace(/\D/g, '');
          const matchedPo = sortedVendorPurchases.find(p => p.purchase_no === vPoRef || String(p.id) === cleanVPoId);
          if (matchedPo && allocations[matchedPo.purchase_no]) {
            allocations[matchedPo.purchase_no].specificVouchers += vAmt;
          } else {
            unallocatedGeneralVouchers += vAmt;
          }
        } else {
          unallocatedGeneralVouchers += vAmt;
        }
      });

      // Allocate general unallocated vouchers across open POs (FIFO order)
      let generalRemaining = unallocatedGeneralVouchers;
      sortedVendorPurchases.forEach(p => {
        const key = p.purchase_no;
        const alloc = allocations[key];
        if (alloc) {
          const dueBeforeGeneral = Math.max(0, alloc.gross - alloc.upfront - alloc.specificVouchers);
          if (dueBeforeGeneral > 0 && generalRemaining > 0) {
            const toDistribute = Math.min(dueBeforeGeneral, generalRemaining);
            alloc.generalAllocated += toDistribute;
            generalRemaining -= toDistribute;
          }
          alloc.pastReceipts = alloc.specificVouchers + alloc.generalAllocated;
          alloc.due = Math.max(0, alloc.gross - alloc.upfront - alloc.pastReceipts);
        }
      });

      setPoAllocationsMap(allocations);

      const netVendorLiability = Math.max(0, totalPurchasesGross - totalPurchasesUpfrontPaid - totalVouchersPaid);
      setVendorTotalOutstanding(netVendorLiability);

      // If a specific PO is selected
      if (poNumber && allocations[poNumber]) {
        const currentAlloc = allocations[poNumber];
        setPoGrossBill(currentAlloc.gross);
        setPoPaidUpfront(currentAlloc.upfront);
        setPoPastReceiptsPaid(currentAlloc.pastReceipts);
        setEffectiveDueForThisReceipt(currentAlloc.due);
      } else {
        // No specific PO selected -> clearing from overall vendor balance
        setPoGrossBill(totalPurchasesGross);
        setPoPaidUpfront(totalPurchasesUpfrontPaid);
        setPoPastReceiptsPaid(totalVouchersPaid);
        setEffectiveDueForThisReceipt(netVendorLiability);
      }
    } catch (err: any) {
      console.error('Balance calculation error:', err);
    }
  };

  // Vendor selection handler
  const handleVendorChange = (vName: string) => {
    setSelectedVendor(vName);
    setSelectedPurchaseNo('');
    setSelectedPurchaseObj(null);

    const vObj = vendorOptions.find(v => v.vendor_name === vName);
    setSelectedVendorObj(vObj || null);

    calculateVendorBalances(vName, '', purchaseOptions, editData?.id || null);
  };

  // PO selection handler
  const handlePurchaseSelect = (poNo: string) => {
    setSelectedPurchaseNo(poNo);
    const cleanId = String(poNo).replace(/\D/g, '');
    const poObj = purchaseOptions.find(p => p.purchase_no === poNo || String(p.id) === cleanId);
    setSelectedPurchaseObj(poObj || null);

    calculateVendorBalances(selectedVendor, poNo, purchaseOptions, editData?.id || null);
  };

  // Filtered purchases available for the selected vendor
  const vendorPurchasesList = purchaseOptions.filter(p => 
    selectedVendor && (p.supplier_name || p.vendor_name || '').toLowerCase() === selectedVendor.toLowerCase()
  );

  const validationSchema = Yup.object().shape({
    voucherType: Yup.string().required('Payment method is required'),
    paymentDate: Yup.string().required('Payment date is required'),
    amount: Yup.number()
      .typeError('Amount must be a valid number')
      .min(1, 'Amount must be greater than 0')
      .required('Payment amount is required'),
    selectedBankId: Yup.string().when('voucherType', {
      is: 'By Bank',
      then: (schema) => schema.required('Please select the source bank account'),
      otherwise: (schema) => schema.nullable()
    })
  });

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  if (metadataLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl text-xs text-slate-800 dark:text-slate-200">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MdOutlinePayment className="text-emerald-600" size={24} />
            {isEditMode ? 'Edit Vendor Purchase Receipt Voucher' : 'Log Vendor Outflow Purchase Receipt'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Disburse cash or bank wire payments to settle supplier bills and keep vendor ledgers balanced
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Receipt/List`)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
        >
          <MdArrowBack size={16} /> Back to Receipts Log
        </button>
      </div>

      <Formik
        initialValues={isEditMode && editData ? {
          voucherNo: editData.voucher_no || '',
          voucherType: editData.voucher_type === 'Bank Payment Voucher' ? 'By Bank' : 'By Cash',
          selectedBankId: editData.metadata?.selectedBankId || '',
          paymentDate: editData.voucher_date || new Date().toISOString().split('T')[0],
          amount: editData.total_amount || '',
          notes: editData.narration || ''
        } : {
          voucherNo: `PRC-${Date.now().toString().slice(-6)}`,
          voucherType: 'By Cash',
          selectedBankId: '',
          paymentDate: new Date().toISOString().split('T')[0],
          amount: '',
          notes: ''
        }}
        enableReinitialize={true}
        validationSchema={validationSchema}
        onSubmit={async (values) => {
          if (!selectedVendor) {
            toast.error('Validation Error: Please select a wholesale vendor first!');
            return;
          }

          const enteredAmount = Number(values.amount) || 0;
          if (enteredAmount <= 0) {
            toast.error('Please enter a valid disbursement amount.');
            return;
          }

          if (effectiveDueForThisReceipt > 0 && enteredAmount > effectiveDueForThisReceipt + 1) {
            toast.error(`Overpayment Warning: Total payable due is Rs. ${formatMoney(effectiveDueForThisReceipt)}.`);
            return;
          }

          try {
            setLoading(true);

            // 1. Resolve Chart of Accounts
            const cashCoa = coaAccounts.find((c: any) =>
              String(c.control_code || '').toLowerCase().includes('cash') ||
              String(c.account_title || '').toLowerCase().includes('cash')
            );

            const selectedBankObj = bankAccounts.find((b: any) => String(b.id) === String(values.selectedBankId) || String(b.bankName) === String(values.selectedBankId));
            const bankCoa = coaAccounts.find((c: any) =>
              (selectedBankObj && (
                String(c.linked_bank_id) === String(selectedBankObj.id) ||
                String(c.account_code) === String(selectedBankObj.accountNumber) ||
                String(c.account_title || '').toLowerCase().includes(String(selectedBankObj.bankName || '').toLowerCase())
              )) ||
              String(c.control_code || '').toLowerCase().includes('bank')
            );

            const payCoa = coaAccounts.find((c: any) =>
              String(c.control_code || '').toLowerCase().includes('creditor') ||
              String(c.control_code || '').toLowerCase().includes('payable') ||
              String(c.account_title || '').toLowerCase().includes('payable') ||
              String(c.account_title || '').toLowerCase().includes('creditor')
            );

            const assetAccountCode = values.voucherType === 'By Cash'
              ? (cashCoa ? String(cashCoa.account_code) : '1010')
              : (bankCoa ? String(bankCoa.account_code) : (selectedBankObj?.accountNumber || '1015'));

            const vendorAccountCode = payCoa ? String(payCoa.account_code) : (cashCoa ? String(cashCoa.account_code) : '2010');

            const balancedJournalItems = [
              { accountCode: vendorAccountCode, description: `Settled balance due to ${selectedVendor}`, debit: enteredAmount, credit: 0 },
              { accountCode: assetAccountCode, description: `Fund disbursed via ${values.voucherNo}`, debit: 0, credit: enteredAmount }
            ];

            const bankInfoStr = values.voucherType === 'By Bank' ? ` | Source Bank: ${selectedBankObj?.bankName || values.selectedBankId}` : '';
            const poInfoStr = selectedPurchaseNo ? ` | Linked PO: ${selectedPurchaseNo}` : ' | General Vendor Settlement';
            const compositeNarration = `Paid to Vendor: ${selectedVendor}${poInfoStr}${bankInfoStr} | Remarks: ${values.notes.trim()}`.trim();

            const payload = {
              voucher_no: values.voucherNo,
              voucher_type: values.voucherType === 'By Cash' ? 'Cash Payment Voucher' : 'Bank Payment Voucher',
              voucher_date: values.paymentDate,
              customerName: selectedVendor,
              customer_name: selectedVendor,
              original_invoice_no: selectedPurchaseNo || null,
              narration: compositeNarration,
              notes: compositeNarration,
              total_amount: enteredAmount,
              items: balancedJournalItems,
              metadata: { 
                selectedBankId: values.voucherType === 'By Bank' ? values.selectedBankId : null,
                selectedBankTitle: selectedBankObj ? `${selectedBankObj.bankName} - ${selectedBankObj.accountTitle}` : null,
                linkedPurchaseNo: selectedPurchaseNo || null,
                moduleSource: 'purchase_receipt'
              }
            };

            // Insert / Update in financial_vouchers
            if (isEditMode) {
              const { error: updateErr } = await supabase
                .from('financial_vouchers')
                .update(payload)
                .eq('id', editData.id);
              if (updateErr) throw updateErr;
            } else {
              const { error: insertErr } = await supabase
                .from('financial_vouchers')
                .insert([payload]);
              if (insertErr) throw insertErr;
            }

            // 2. Sync with supplier_purchases if a specific PO was linked
            if (selectedPurchaseNo) {
              const cleanId = String(selectedPurchaseNo).replace(/\D/g, '');
              const targetPo = purchaseOptions.find(p => p.purchase_no === selectedPurchaseNo || String(p.id) === cleanId);
              
              if (targetPo) {
                // Fetch all vouchers for this PO to calculate exact cumulative paid
                const { data: allVouchersForPo } = await supabase
                  .from('financial_vouchers')
                  .select('id, total_amount')
                  .eq('customer_name', selectedVendor)
                  .or(`original_invoice_no.eq.${selectedPurchaseNo},original_invoice_no.eq.${targetPo.purchase_no}`);

                const totalVoucherSum = (allVouchersForPo || []).reduce((acc: number, v: any) => acc + (Number(v.total_amount) || 0), 0);
                const upfrontPaid = Number(targetPo.cash_amount_paid || 0) + Number(targetPo.bank_amount_paid || 0);
                const newTotalPaid = upfrontPaid + totalVoucherSum;
                const newRemaining = Math.max(0, (Number(targetPo.total_amount) || 0) - newTotalPaid);

                await supabase
                  .from('supplier_purchases')
                  .update({
                    amount_paid: newTotalPaid,
                    remaining_balance: newRemaining
                  })
                  .eq('id', targetPo.id);
              }
            }

            toast.success(isEditMode ? 'Purchase payment voucher updated!' : 'Vendor payment receipt processed successfully!');
            navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Receipt/List`);
          } catch (err: any) {
            toast.error('Error processing payment: ' + err.message);
          } finally {
            setLoading(false);
          }
        }}
      >
        {({ handleChange, setFieldValue, values, errors, touched }) => {
          const enteredAmt = Number(values.amount) || 0;
          const projectedRemaining = Math.max(0, effectiveDueForThisReceipt - enteredAmt);

          return (
            <Form className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* ── LEFT COLUMN: FORM INPUTS (7 COLS) ── */}
              <div className="lg:col-span-7 bg-white dark:bg-boxdark rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-5">
                
                {/* Row 1: Voucher # & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                      Receipt Voucher #:
                    </label>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl font-mono font-black text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 text-xs">
                      {values.voucherNo}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                      Payment Date: *
                    </label>
                    <input
                      type="date"
                      name="paymentDate"
                      onChange={handleChange}
                      value={values.paymentDate}
                      className={`w-full border rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-800 font-bold outline-none text-slate-900 dark:text-white text-xs ${
                        touched.paymentDate && errors.paymentDate ? 'border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                </div>

                {/* Row 2: Target Vendor Selector */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1 flex items-center gap-1.5">
                    <MdPerson size={15} className="text-emerald-600" /> Target Wholesale Vendor: *
                  </label>
                  <select
                    value={selectedVendor}
                    disabled={isEditMode}
                    onChange={(e) => handleVendorChange(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Choose Wholesale Vendor Account --</option>
                    {vendorOptions.map(v => (
                      <option key={v.id} value={v.vendor_name}>
                        {v.vendor_name} {v.city ? `(${v.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 3: Linked Purchase Order (PO Selection) */}
                {selectedVendor && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="block text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MdReceipt size={15} className="text-emerald-600" /> Settle Specific Purchase Order (Optional):
                      </span>
                      {selectedPurchaseNo && (
                        <button
                          type="button"
                          onClick={() => handlePurchaseSelect('')}
                          className="text-[10px] text-emerald-600 hover:underline font-bold"
                        >
                          Clear Selection (Pay General Ledger)
                        </button>
                      )}
                    </label>

                    <select
                      value={selectedPurchaseNo}
                      onChange={(e) => handlePurchaseSelect(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs focus:border-emerald-600"
                    >
                      <option value="">-- General Vendor Balance Clearing (All Orders) --</option>
                      {vendorPurchasesList.map(pur => {
                        const alloc = poAllocationsMap[pur.purchase_no];
                        const bill = alloc ? alloc.gross : (Number(pur.total_amount) || 0);
                        const due = alloc ? alloc.due : Math.max(0, bill - (Number(pur.cash_amount_paid || 0) + Number(pur.bank_amount_paid || 0)));
                        return (
                          <option key={pur.id} value={pur.purchase_no}>
                            {pur.purchase_no} — Bill: Rs. {formatMoney(bill)} | Due: Rs. {formatMoney(due)} ({pur.purchase_date || 'N/A'})
                          </option>
                        );
                      })}
                    </select>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Select a specific consignment order to clear its invoice balance, or leave on General Balance to disburse funds against the vendor's total liability.
                    </p>
                  </div>
                )}

                {/* Row 4: Settlement Method (Cash / Bank) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                      Disbursement Source: *
                    </label>
                    <select
                      name="voucherType"
                      onChange={handleChange}
                      value={values.voucherType}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs focus:border-emerald-600"
                    >
                      <option value="By Cash">💵 Cash Drawer / Vault</option>
                      <option value="By Bank">🏦 Bank Wire / Online Transfer</option>
                    </select>
                  </div>

                  {values.voucherType === 'By Bank' && (
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                        Source Bank Account: *
                      </label>
                      <select
                        name="selectedBankId"
                        onChange={handleChange}
                        value={values.selectedBankId}
                        className={`w-full border rounded-xl p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none text-xs ${
                          touched.selectedBankId && errors.selectedBankId ? 'border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600'
                        }`}
                      >
                        <option value="">-- Choose Disbursing Bank --</option>
                        {bankAccounts.map(b => (
                          <option key={b.id} value={b.bankName}>
                            {b.bankName} - {b.accountTitle} ({b.accountNumber || '-'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Row 5: Amount with Quick Fill Button */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-emerald-700 dark:text-emerald-400 font-black uppercase text-[11px]">
                      Disbursed Amount (PKR): *
                    </label>
                    {effectiveDueForThisReceipt > 0 && (
                      <button
                        type="button"
                        onClick={() => setFieldValue('amount', effectiveDueForThisReceipt)}
                        className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        ⚡ Pay Full Due (Rs. {formatMoney(effectiveDueForThisReceipt)})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                      Rs.
                    </span>
                    <input
                      type="number"
                      name="amount"
                      placeholder="0"
                      onKeyDown={blockInvalidChar}
                      onChange={handleChange}
                      value={values.amount}
                      className={`w-full border rounded-xl py-3 pl-10 pr-4 bg-white dark:bg-slate-800 font-mono font-black text-slate-950 dark:text-white text-base outline-none ${
                        touched.amount && errors.amount ? 'border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                      }`}
                    />
                  </div>
                </div>

                {/* Row 6: Remarks */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] mb-1">
                    Transaction Remarks / Voucher Notes:
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    onChange={handleChange}
                    value={values.notes}
                    placeholder="Enter cheque #, online transaction reference, or clearing notes..."
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 outline-none text-slate-900 dark:text-white text-xs focus:border-emerald-600"
                  />
                </div>

                {/* Submit / Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchase-Receipt/List`)}
                    className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !selectedVendor}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-black text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                  >
                    {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Voucher' : 'Post & Disburse Receipt'}</span>}
                  </button>
                </div>

              </div>

              {/* ── RIGHT COLUMN: LIVE FINANCIAL BREAKDOWN (5 COLS) ── */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* 1. Vendor Profile Card */}
                <div className="bg-white dark:bg-boxdark rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <MdPerson className="text-emerald-600" size={16} /> Payee Vendor Profile
                  </div>

                  {selectedVendor ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Vendor:</span>
                        <strong className="text-slate-950 dark:text-white font-bold text-sm">{selectedVendor}</strong>
                      </div>
                      {selectedVendorObj?.contact_name && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Contact:</span>
                          <span className="text-slate-800 dark:text-slate-200 font-medium">{selectedVendorObj.contact_name}</span>
                        </div>
                      )}
                      {(selectedVendorObj?.cell_no || selectedVendorObj?.phone_no) && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Phone:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">{selectedVendorObj.cell_no || selectedVendorObj.phone_no}</span>
                        </div>
                      )}
                      {selectedVendorObj?.address && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Address:</span>
                          <span className="text-slate-700 dark:text-slate-300 text-right max-w-[60%]">{selectedVendorObj.address}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400">
                      <MdInfoOutline className="mx-auto mb-1 text-slate-300" size={24} />
                      <p className="text-xs">Select a vendor on the left to inspect billing history</p>
                    </div>
                  )}
                </div>

                {/* 2. Interactive Settlement & Balance Card */}
                {selectedVendor && (
                  <div className="bg-white dark:bg-boxdark rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        <MdAccountBalance className="text-emerald-600" size={16} /> Settlement Breakdown
                      </div>
                      {selectedPurchaseNo ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                          {selectedPurchaseNo}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          General Ledger
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5 font-mono text-xs">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span className="font-sans">Gross Billed Total:</span>
                        <strong className="text-slate-900 dark:text-white font-black text-sm">
                          Rs. {formatMoney(poGrossBill)}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400">
                        <span className="font-sans">Paid Upfront:</span>
                        <span>Rs. {formatMoney(poPaidUpfront)}</span>
                      </div>

                      {poPastReceiptsPaid > 0 && (
                        <div className="flex justify-between items-center text-teal-700 dark:text-teal-400">
                          <span className="font-sans">Past Voucher Disbursements:</span>
                          <span>Rs. {formatMoney(poPastReceiptsPaid)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 font-black">
                        <span className="font-sans">Current Outstanding Due:</span>
                        <strong className="text-base">Rs. {formatMoney(effectiveDueForThisReceipt)}</strong>
                      </div>

                      {/* Live Calculation */}
                      <div className="pt-3 border-t-2 border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex justify-between items-center text-slate-500 font-sans text-[11px]">
                          <span>Paying in this Voucher:</span>
                          <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            - Rs. {formatMoney(enteredAmt)}
                          </strong>
                        </div>

                        <div className={`p-3 rounded-xl border flex justify-between items-center ${
                          projectedRemaining <= 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-900 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-amber-900 dark:text-amber-300'
                        }`}>
                          <div className="font-sans">
                            <span className="block text-[10px] font-black uppercase tracking-wider">
                              Balance After Payment:
                            </span>
                            <span className="text-[11px] font-medium">
                              {projectedRemaining <= 0 ? 'Fully Cleared & Settled' : 'Remaining Payable Balance'}
                            </span>
                          </div>
                          <strong className="font-mono font-black text-sm">
                            Rs. {formatMoney(projectedRemaining)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </Form>
          );
        }}
      </Formik>

    </div>
  );
}

export default AddPurchaseReceipt;
