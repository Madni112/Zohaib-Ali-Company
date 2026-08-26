import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';

function AddPurchaseReceipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);

  const [vendorOptions, setVendorOptions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<any[]>([]);
  const [localVendor, setLocalVendor] = useState('');
  const [totalOutstandingLiability, setTotalOutstandingLiability] = useState<number>(0);

  const editData = location.state?.receiptRecord;
  const isEditMode = !!editData;

  useEffect(() => {
    const fetchPaymentMetadata = async () => {
      try {
        setMetadataLoading(true);
        const { data: vData } = await supabase.from('vendors').select('*');
        const normalizedVendors = (vData || []).map((v: any) => ({
          id: v.id,
          vendor_name: v.vendor_name || v.name || 'Unnamed Vendor'
        })).sort((a: any, b: any) => a.vendor_name.localeCompare(b.vendor_name));

        const { data: bankData } = await supabase.from('banks').select('id, bankName, accountTitle, accountNumber');
        const { data: coaData } = await supabase.from('chart_of_accounts').select('account_code, account_title, control_code, category_code');

        setVendorOptions(normalizedVendors);
        if (bankData) setBankAccounts(bankData);
        if (coaData) setCoaAccounts(coaData);

        if (isEditMode && editData) {
          const name = editData.customer_name || '';
          setLocalVendor(name);
          handleInstantVendorLookup(name);
        }
      } catch (err: any) {
        console.error(err.message);
      } finally {
        setMetadataLoading(false);
      }
    };
    fetchPaymentMetadata();
  }, [isEditMode, editData]);

  const handleInstantVendorLookup = async (vendorName: string) => {
    if (!vendorName) {
      setTotalOutstandingLiability(0);
      return;
    }
    try {
      const { data: purchases } = await supabase
        .from('supplier_purchases')
        .select('total_amount, amount_paid')
        .eq('supplier_name', vendorName);

      const { data: pastPayments } = await supabase
        .from('financial_vouchers')
        .select('id, total_amount')
        .eq('customer_name', vendorName)
        .or('voucher_type.eq.Cash Payment Voucher,voucher_type.eq.Bank Payment Voucher');

      let grossPurchasesCost = 0;
      if (purchases) {
        purchases.forEach((p: any) => {
          grossPurchasesCost += (Number(p.total_amount) || 0) - (Number(p.amount_paid) || 0);
        });
      }

      let totalClearedViaVouchers = 0;
      if (pastPayments) {
        const currentEditId = editData?.id || null;
        pastPayments.forEach((v: any) => {
          if (!isEditMode || v.id !== currentEditId) {
            totalClearedViaVouchers += (Number(v.total_amount) || 0);
          }
        });
      }

      const netOwedLiability = Math.max(0, grossPurchasesCost - totalClearedViaVouchers);
      setTotalOutstandingLiability(netOwedLiability);
    } catch (err: any) {
      console.error(err);
    }
  };

  const validationSchema = Yup.object().shape({
    voucherType: Yup.string().required('Required'),
    paymentDate: Yup.string().required('Required'),
    amount: Yup.number().typeError('Must be a number').min(1, 'Amount must be greater than 0').required('Required'),
    selectedBankId: Yup.string().when('voucherType', {
      is: 'By Bank',
      then: () => Yup.string().required('Source bank is required'),
      otherwise: () => Yup.string().nullable()
    })
  });

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  if (metadataLoading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
  return (
    <div className="mx-auto max-w-full text-xs text-black dark:text-bodydark">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="flex items-center justify-between border-b border-stroke py-4 px-6.5 dark:border-strokedark">
          <h3 className="font-semibold text-black dark:text-white text-base">
            {isEditMode ? 'Modify Purchase Receipt Voucher' : 'Log Vendor Outflow Purchase Receipt'}
          </h3>
          <button type="button" onClick={() => navigate('/Purchase/Purchase-Receipt/List')} className="text-sm font-medium text-primary hover:underline cursor-pointer">Back to Registry Log</button>
        </div>

        <div className="p-6">
          <Formik
            initialValues={isEditMode ? {
              voucherNo: editData.voucher_no || '',
              voucherType: editData.voucher_type === 'Bank Payment Voucher' ? 'By Bank' : 'By Cash',
              selectedBankId: editData.metadata?.selectedBankId || '',
              paymentDate: editData.voucher_date || '',
              amount: editData.total_amount || '',
              notes: editData.narration || ''
            } : {
              voucherNo: `PRC-${Date.now().toString().slice(-6)}`,
              voucherType: 'By Cash',
              selectedBankId: '',
              paymentDate: '',
              amount: '',
              notes: ''
            }}
            enableReinitialize={true}
            validationSchema={validationSchema}
            onSubmit={async (values) => {
              if (!localVendor) {
                toast.error('Validation Error: Please pick a wholesale vendor account profile first!');
                return;
              }
              const enteredAmount = Number(values.amount) || 0;
              if (enteredAmount > totalOutstandingLiability) {
                toast.error(`Overpayment Error: Outstanding balance due is Rs. ${totalOutstandingLiability.toLocaleString()}.`);
                return;
              }

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

                const payCoa = coaAccounts.find((c: any) =>
                  String(c.control_code || '').toLowerCase().includes('creditor') ||
                  String(c.control_code || '').toLowerCase().includes('payable') ||
                  String(c.account_title || '').toLowerCase().includes('payable') ||
                  String(c.account_title || '').toLowerCase().includes('creditor')
                );

                const assetAccountCode = values.voucherType === 'By Cash'
                  ? (cashCoa ? String(cashCoa.account_code) : '1010')
                  : (bankCoa ? String(bankCoa.account_code) : (selectedBankObj?.accountNumber || '1015'));


                const vendorAccountCode = payCoa ? String(payCoa.account_code) : (cashCoa ? String(cashCoa.account_code) : '1010');

                const balancedJournalItems = [
                  { accountCode: vendorAccountCode, description: `Settled balance due to ${localVendor}`, debit: enteredAmount, credit: 0 },
                  { accountCode: assetAccountCode, description: `Fund drawn via ${values.voucherNo}`, debit: 0, credit: enteredAmount }
                ];

                const bankTrackingString = values.voucherType === 'By Bank' ? ` | Source Bank: ${values.selectedBankId}` : '';
                const compositeNarration = `Paid to Vendor: ${localVendor} | Ref: ${values.voucherNo}${bankTrackingString} | Remarks: ${values.notes.trim()}`.trim();

                const payload = {
                  voucher_no: values.voucherNo,
                  voucher_type: values.voucherType === 'By Cash' ? 'Cash Payment Voucher' : 'Bank Payment Voucher',
                  voucher_date: values.paymentDate,
                  customerName: localVendor,
                  customer_name: localVendor,
                  narration: compositeNarration,
                  notes: compositeNarration,
                  total_amount: enteredAmount,
                  items: balancedJournalItems,
                  metadata: { 
                    selectedBankId: values.voucherType === 'By Bank' ? values.selectedBankId : null,
                    moduleSource: 'purchase_receipt'
                  }
                };

                const { error: voucherError } = isEditMode
                  ? await supabase.from('financial_vouchers').update(payload).eq('id', editData.id)
                  : await supabase.from('financial_vouchers').insert([payload]);

                if (voucherError) throw voucherError;

                toast.success('Purchase Receipt payment processed successfully!');
                navigate('/Purchase/Purchase-Receipt/List');
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setLoading(false);
              }
            }}
          >
            {({ handleChange, values, errors, touched }) => (
              <Form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-gray-500 mb-1 font-bold uppercase">Receipt Note #:</label>
                    <p className="text-primary font-bold p-2.5 bg-gray-50 dark:bg-meta-4/10 rounded font-mono text-sm border dark:border-strokedark">{values.voucherNo}</p>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1 font-bold uppercase">Settlement Method: *</label>
                    <select name="voucherType" onChange={handleChange} value={values.voucherType} className="w-full border border-stroke p-2.5 bg-white text-black dark:bg-boxdark dark:text-white font-bold outline-none text-xs dark:border-strokedark">
                      <option value="By Cash">By Cash Drawer</option>
                      <option value="By Bank">By Bank Wire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1 font-bold uppercase">Select Target Vendor: *</label>
                    <select
                      value={localVendor}
                      disabled={isEditMode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLocalVendor(val);
                        handleInstantVendorLookup(val);
                      }}
                      className="w-full border border-stroke dark:border-strokedark rounded p-2.5 bg-white text-black dark:bg-boxdark dark:text-white font-bold outline-none text-xs"
                    >
                      <option value="">-- Choose Vendor Account --</option>
                      {vendorOptions.map(v => <option key={v.id} value={v.vendor_name}>{v.vendor_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1 font-bold uppercase">Payment Date: *</label>
                    <input type="date" name="paymentDate" onChange={handleChange} value={values.paymentDate} className={`w-full border rounded p-2 bg-transparent font-bold outline-none text-black dark:text-white text-xs ${touched.paymentDate && errors.paymentDate ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} />
                  </div>
                </div>
                {values.voucherType === 'By Bank' && (
                  <div className="p-4 bg-primary/5 rounded border border-primary/20 animate-fade-in md:w-1/2">
                    <label className="block text-primary dark:text-white font-bold mb-1.5 uppercase text-[11px]">Source Bank Account: *</label>
                    <select name="selectedBankId" onChange={handleChange} value={values.selectedBankId} className="w-full border rounded p-2.5 bg-white text-black dark:bg-boxdark dark:text-white font-bold outline-none border-stroke dark:border-strokedark text-xs">
                      <option value="">-- Select Bank Account Title --</option>
                      {bankAccounts.map(b => <option key={b.id} value={b.bankName}>{b.bankName} - {b.accountTitle} ({b.accountNumber || '-'})</option>)}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-500 mb-1 font-bold uppercase text-success">Transferred Amount (PKR): *</label>
                    <input type="number" name="amount" onKeyDown={blockInvalidChar} onChange={handleChange} value={values.amount} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent font-black text-success text-sm placeholder-0.00" />
                    {localVendor && (
                      <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold text-xs rounded border border-red-200/50 inline-block tracking-wide">
                        📉 Current Credit Debt Owed: <span className="underline font-black text-sm ml-1">Rs. {totalOutstandingLiability.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1 font-bold uppercase">Remarks Description Notes:</label>
                    <textarea name="notes" rows={2} onChange={handleChange} value={values.notes} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent outline-none text-black dark:text-white text-xs placeholder-Enter transfer tracking receipt codes notes..." />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stroke dark:border-strokedark">
                  <button 
                    type="button" 
                    onClick={() => navigate('/Purchase/Purchase-Receipt/List')} 
                    className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading || !localVendor} 
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                  >
                    {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Receipt' : 'Record Receipt'}</span>}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}

export default AddPurchaseReceipt;
