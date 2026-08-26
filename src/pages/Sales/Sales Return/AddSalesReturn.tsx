import React, { useState, useEffect, useRef } from 'react';
import { FieldArray, Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../Context/supabaseClient';
import Spinner from '../../../ui/Spinner';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../Context/Auth';

const AddSalesReturn = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const routeStateData = location.state?.invoice || location.state?.item || location.state?.record || location.state?.returnRecord;
  const isEditMode = !!routeStateData && (
    routeStateData.hasOwnProperty('original_invoice_no') ||
    routeStateData.hasOwnProperty('return_no') ||
    routeStateData.hasOwnProperty('payout_amount_paid')
  );
  const isDirectInvoiceLink = !!routeStateData && !isEditMode;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [defaultInvoices, setDefaultInvoices] = useState<any[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([]);
  const [isInvoiceAlreadyReturned, setIsInvoiceAlreadyReturned] = useState(false);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [banksList, setBanksList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<string[]>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState(
    isDirectInvoiceLink && routeStateData
      ? `INV-${routeStateData.id} (${routeStateData.customer_name || ''})`
      : (isEditMode && routeStateData ? `INV-${routeStateData.original_invoice_no?.replace('INV-', '')} (${routeStateData.customer_name || ''})` : '')
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightInvoiceIdx, setHighlightInvoiceIdx] = useState(0);
  const [isSelectionMade, setIsSelectionMade] = useState(isEditMode || isDirectInvoiceLink);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sales-return-invoice-search-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [origInvoiceCashMetrics, setOrigInvoiceCashMetrics] = useState({
    grandTotal: isDirectInvoiceLink && routeStateData ? Number(routeStateData.total_amount || 0) : 0,
    cashReceivedBox: isDirectInvoiceLink && routeStateData ? Number(routeStateData.cash_amount_paid || 0) : 0
  });

  const syncInvoicePaymentMetrics = async (invoiceId: string | number, invObj?: any) => {
    const cleanId = String(invoiceId || '').replace(/\D/g, '');
    if (!cleanId) {
      setOrigInvoiceCashMetrics({ grandTotal: 0, cashReceivedBox: 0 });
      return;
    }

    try {
      let inv = invObj;
      if (!inv) {
        const { data } = await supabase.from('sales_invoices').select('*').eq('id', Number(cleanId)).maybeSingle();
        inv = data;
      }
      if (!inv) return;

      const upfrontCash = Number(inv.cash_amount_paid || 0);
      const upfrontBank = Number(inv.bank_amount || 0);

      // Fetch subsequent receipt vouchers
      const { data: vouchers } = await supabase
        .from('financial_vouchers')
        .select('total_amount')
        .or('voucher_type.eq.Cash Receipt Voucher,voucher_type.eq.Bank Receipt Voucher,voucher_type.eq.Cash & Bank Receipt Voucher')
        .or(`original_invoice_no.eq.${cleanId},original_invoice_no.eq.INV-${cleanId}`);

      const subsequentCollected = (vouchers || []).reduce((sum: number, v: any) => sum + (Number(v.total_amount) || 0), 0);
      const totalPaid = upfrontCash + upfrontBank + subsequentCollected;

      setOrigInvoiceCashMetrics({
        grandTotal: Number(inv.total_amount || 0),
        cashReceivedBox: totalPaid
      });

      if (inv.dispatch_warehouse) {
        setOrigInvoiceWarehouse(inv.dispatch_warehouse);
      }
    } catch (err) {
      console.error('Failed to sync invoice payment metrics:', err);
    }
  };

  const [origInvoiceWarehouse, setOrigInvoiceWarehouse] = useState<string>('Wearhouse A');

  const [returnInitData, setReturnInitData] = useState<any>({
    returnNo: isEditMode ? `RTN-${String(routeStateData.id).padStart(4, '0')}` : '(Auto Generated)',
    returnDate: routeStateData?.return_date || new Date().toISOString().split('T')[0],
    invoiceIdRef: isEditMode ? routeStateData.original_invoice_no?.replace('INV-', '') : (isDirectInvoiceLink ? String(routeStateData.id) : ''),
    customerName: routeStateData?.customer_name || '',
    settlementMode: routeStateData?.settlement_mode || 'Cash',
    selectedBankAccountId: routeStateData?.linked_bank_title || '',
    payoutAmountPaid: routeStateData?.payout_amount_paid || 0,
    cashPayoutPaid: routeStateData?.metadata?.cashPayoutPaid || (routeStateData?.settlement_mode === 'Bank' ? 0 : (routeStateData?.payout_amount_paid || 0)),
    bankPayoutPaid: routeStateData?.metadata?.bankPayoutPaid || (routeStateData?.settlement_mode === 'Bank' ? (routeStateData?.payout_amount_paid || 0) : 0),
    items: routeStateData?.items || []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    isDirectInvoiceLink && routeStateData
      ? String(routeStateData.id)
      : (isEditMode && routeStateData ? String(routeStateData.original_invoice_no?.replace('INV-', '') || '') : '')
  );

  useEffect(() => {
    const fetchMetadataCatalog = async () => {
      try {
        setInitialLoading(true);
        const { data: invoicesData, error: invError } = await supabase
          .from('sales_invoices')
          .select('*')
          .order('id', { ascending: false });

        if (invError) {
          console.error('Invoice fetch error:', invError);
          toast.error('Error loading invoices: ' + invError.message);
        }

        const { data: prodsData } = await supabase
          .from('products')
          .select('id, product_name, category, uom, pieces_per_box, pcs_per_box, pieces_per_packing, product_description, item_sr_no');

        if (prodsData) setProductsList(prodsData);

        const { data: bankAccounts } = await supabase
          .from('banks')
          .select('id, bankName, accountTitle');

        if (bankAccounts) setBanksList(bankAccounts);

        const { data: locMaster } = await supabase.from('inventory_locations').select('name');
        const { data: wh } = await supabase.from('opening_stocks').select('location');
        const { data: invWh } = await supabase.from('warehouse_inventory').select('warehouse_name');
        const combinedLocs = [
          ...(locMaster || []).map((l: any) => l.name),
          ...(wh || []).map((w: any) => w.location),
          ...(invWh || []).map((iw: any) => iw.warehouse_name)
        ];
        const uniqueLocations = Array.from(new Set(combinedLocs.map((loc: any) => String(loc || '').trim()).filter(Boolean)));
        setWarehousesList(uniqueLocations.length > 0 ? uniqueLocations : ['Main Shop / Counter', 'Wearhouse A', 'Wearhouse B']);

        if (invoicesData) {
          setDefaultInvoices(invoicesData);
        }

        const lookupId = isEditMode ? routeStateData.original_invoice_no?.replace('INV-', '') : (isDirectInvoiceLink ? routeStateData.id : null);
        if (lookupId && invoicesData) {
          const matchedInv = invoicesData.find(i => String(i.id) === String(lookupId));
          if (matchedInv) {
            await syncInvoicePaymentMetrics(lookupId, matchedInv);
          }
        }

        if (isEditMode && routeStateData) {
          const extractedCleanInvoiceId = String(routeStateData.original_invoice_no || '').replace('INV-', '');
          setSelectedInvoiceId(extractedCleanInvoiceId);

          const { data: actualReturnRecord } = await supabase
            .from('sales_returns')
            .select('payout_amount_paid, total_amount')
            .eq('id', routeStateData.id)
            .maybeSingle();

          const realPayout = actualReturnRecord ? Number(actualReturnRecord.payout_amount_paid || 0) : Number(routeStateData.payout_amount_paid || 0);

          setReturnInitData({
            returnNo: `RTN-${String(routeStateData.id).padStart(4, '0')}`,
            returnDate: routeStateData.return_date || new Date().toISOString().split('T')[0],
            invoiceIdRef: extractedCleanInvoiceId,
            customerName: routeStateData.customer_name || '',
            settlementMode: routeStateData.settlement_mode || 'Cash',
            selectedBankAccountId: routeStateData.linked_bank_title || '',
            payoutAmountPaid: realPayout,
            items: routeStateData.items || []
          });
        } else if (isDirectInvoiceLink && routeStateData) {
          setSelectedInvoiceId(String(routeStateData.id));
          await loadInvoiceAndComputeReturnableItems(routeStateData.id, routeStateData);
        }
      } catch (err: any) {
        toast.error('Failed to load tracking data registers: ' + err.message);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchMetadataCatalog();
  }, [routeStateData, isEditMode, isDirectInvoiceLink]);

  const loadInvoiceAndComputeReturnableItems = async (invoiceId: string | number, invObj?: any, setFieldValue?: any) => {
    const cleanId = String(invoiceId || '').replace(/\D/g, '');
    if (!cleanId) return;

    try {
      let inv = invObj;
      if (!inv) {
        const { data } = await supabase.from('sales_invoices').select('*').eq('id', Number(cleanId)).maybeSingle();
        inv = data;
      }
      if (!inv) return;

      // 1. Fetch previous returns for this invoice
      let query = supabase
        .from('sales_returns')
        .select('id, items')
        .or(`original_invoice_no.eq.${cleanId},original_invoice_no.eq.INV-${cleanId},original_invoice_no.eq.INV-${cleanId.padStart(4, '0')}`);

      if (isEditMode && routeStateData?.id) {
        query = query.neq('id', routeStateData.id);
      }

      const { data: previousReturns } = await query;

      // 2. Map already returned quantities per product
      const alreadyReturnedQtyMap: Record<string, number> = {};
      (previousReturns || []).forEach((ret: any) => {
        (ret.items || []).forEach((item: any) => {
          const key = String(item.itemName || item.product_name || item.name || '').trim().toLowerCase();
          if (key) {
            alreadyReturnedQtyMap[key] = (alreadyReturnedQtyMap[key] || 0) + (Number(item.qty) || 0);
          }
        });
      });

      // 3. Compute remaining returnable quantities
      const returnableItems: any[] = [];
      (inv.items || []).forEach((origItem: any) => {
        const key = String(origItem.itemName || origItem.product_name || origItem.name || '').trim().toLowerCase();
        const origQty = Number(origItem.qty) || 0;
        const returnedQtySoFar = alreadyReturnedQtyMap[key] || 0;
        const remainingQty = Math.max(0, origQty - returnedQtySoFar);

        if (remainingQty > 0 || isEditMode) {
          returnableItems.push({
            ...origItem,
            returnDestinationWarehouse: origItem.returnDestinationWarehouse || origItem.warehouse || inv.dispatch_warehouse || 'Main Shop / Counter',
            soldQty: isEditMode ? origQty : remainingQty,
            maxQty: isEditMode ? origQty : remainingQty,
            qty: isEditMode ? (Number(origItem.qty) || 1) : remainingQty
          });
        }
      });

      const isFullyReturned = !isEditMode && (returnableItems.length === 0 || returnableItems.every(i => (Number(i.qty) || 0) <= 0));
      setIsInvoiceAlreadyReturned(isFullyReturned);

      if (setFieldValue) {
        setFieldValue('invoiceIdRef', inv.id);
        setFieldValue('customerName', inv.customer_name);
        setFieldValue('items', returnableItems);

        const returnTotalVal = returnableItems.reduce((acc: number, item: any) => {
          const itemQty = Number(item.qty) || 0;
          const itemRp = Number(item.rp) || 0;
          const itemGst = Number(item.gstRate ?? item.gst_rate ?? 0);
          const itemFTax = Number(item.fTaxPer ?? item.f_tax_per ?? 0);
          const base = itemRp * itemQty;
          return acc + (base + (base / 100 * itemGst) + (base / 100 * itemFTax));
        }, 0);

        const upfrontCash = Number(inv.cash_amount_paid || 0);
        const upfrontBank = Number(inv.bank_amount || 0);
        const totalPaid = upfrontCash + upfrontBank;
        if (totalPaid > 0) {
          setFieldValue('payoutAmountPaid', Number(Math.min(returnTotalVal, totalPaid).toFixed(2)));
          if (upfrontBank > 0 && inv.selected_bank) {
            setFieldValue('settlementMode', 'Bank');
            setFieldValue('selectedBankAccountId', inv.selected_bank);
          }
        }
      }

      await syncInvoicePaymentMetrics(inv.id, inv);
      return returnableItems;
    } catch (err) {
      console.error('Error loading returnable items:', err);
    }
  };


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
    if (isSelectionMade || isEditMode) return;
    const term = invoiceSearchQuery.trim().toLowerCase();
    if (!term || term.startsWith('inv-')) {
      setFilteredInvoices(defaultInvoices.slice(0, 3));
      return;
    }

    const filtered = defaultInvoices.filter(inv => {
      const cleanNum = term.replace(/\D/g, '');
      if (cleanNum && String(inv.id) === cleanNum) return true;
      return (
        String(inv.id).toLowerCase().includes(term) ||
        `inv-${inv.id}`.toLowerCase().includes(term) ||
        String(inv.customer_name).toLowerCase().includes(term)
      );
    });

    setFilteredInvoices(filtered);
  }, [invoiceSearchQuery, defaultInvoices, isSelectionMade, isEditMode]);


  const validationSchema = Yup.object().shape({
    invoiceIdRef: Yup.string().required('Please select a valid invoice'),
    customerName: Yup.string().required('Customer name is required'),
    settlementMode: Yup.string().oneOf(['Cash', 'Bank', 'Split']).required('Please select settlement mode'),
    selectedBankAccountId: Yup.string().when('settlementMode', {
      is: (val: string) => val === 'Bank' || val === 'Split',
      then: (schema) => schema.required('Please select a bank account for bank payout'),
      otherwise: (schema) => schema.notRequired()
    }),
    payoutAmountPaid: Yup.number().min(0, 'Payout amount cannot be negative').typeError('Must be a number').nullable(),
    cashPayoutPaid: Yup.number().min(0, 'Cash payout cannot be negative').typeError('Must be a number').nullable(),
    bankPayoutPaid: Yup.number().min(0, 'Bank payout cannot be negative').typeError('Must be a number').nullable(),
    items: Yup.array().of(
      Yup.object().shape({
        itemName: Yup.string().required('Item name required'),
        qty: Yup.number().min(0.001, 'Please enter a return quantity greater than 0').required('Quantity required')
      })
    ).min(1, 'At least one item must be returned')
  });

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  if (initialLoading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-white text-xs">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="flex items-center justify-between border-b border-stroke py-4 px-6.5 dark:border-strokedark">
          <h3 className="font-semibold text-black dark:text-white text-base">
            {isEditMode ? 'Modify Sales Return Note Record' : 'Compile Sales Return Note Credit Slip'}
          </h3>
          <button onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Sales-Return/Debit-Notes/List`)} className="text-sm font-medium text-primary hover:underline">See Logs List</button>
        </div>

        <Formik
          initialValues={returnInitData}
          validationSchema={validationSchema}
          enableReinitialize={true}
          onSubmit={async (values) => {
            if (!values.invoiceIdRef) {
              toast.error('Please select an invoice first.');
              return;
            }
            if (isInvoiceAlreadyReturned && !isEditMode) {
              toast.error('Audit Block: Submission denied. This invoice is already settled as returned.');
              return;
            }

            const itemsTotalSum = values.items.reduce((acc: number, item: any) => {
              const itemQty = Number(item.qty) || 0;
              const itemRp = Number(item.rp) || 0;
              const itemGst = Number(item.gstRate ?? item.gst_rate ?? 0);
              const itemFTax = Number(item.fTaxPer ?? item.f_tax_per ?? 0);
              const base = itemRp * itemQty;
              return acc + (base + (base / 100 * itemGst) + (base / 100 * itemFTax));
            }, 0);

            if (itemsTotalSum <= 0) {
              toast.error('Validation Error: Returned quantity cannot be 0. Please specify boxes or pieces to return.');
              return;
            }

            let finalPayoutPaid = 0;
            let cashRefundPart = 0;
            let bankRefundPart = 0;

            if (values.settlementMode === 'Cash') {
              cashRefundPart = Number(values.cashPayoutPaid ?? values.payoutAmountPaid) || 0;
              finalPayoutPaid = cashRefundPart;
            } else if (values.settlementMode === 'Bank') {
              bankRefundPart = Number(values.bankPayoutPaid ?? values.payoutAmountPaid) || 0;
              finalPayoutPaid = bankRefundPart;
            } else if (values.settlementMode === 'Split') {
              cashRefundPart = Number(values.cashPayoutPaid) || 0;
              bankRefundPart = Number(values.bankPayoutPaid) || 0;
              finalPayoutPaid = cashRefundPart + bankRefundPart;
            }

            const maxAllowedPayout = Math.min(itemsTotalSum, origInvoiceCashMetrics.cashReceivedBox);

            if (finalPayoutPaid > maxAllowedPayout) {
              toast.error(`Validation Error: Payout amount (Rs. ${finalPayoutPaid.toLocaleString()}) cannot exceed the maximum payable refund of Rs. ${maxAllowedPayout.toLocaleString()} (Items Worth: Rs. ${itemsTotalSum.toLocaleString()}, Total Cash Received: Rs. ${origInvoiceCashMetrics.cashReceivedBox.toLocaleString()}).`);
              return;
            }

            const payoutAmountPaid = (values.invoiceIdRef && origInvoiceCashMetrics.cashReceivedBox === 0)
              ? 0
              : finalPayoutPaid;

            const finalCalculatedReturnStatus = (values.invoiceIdRef && origInvoiceCashMetrics.cashReceivedBox === 0)
              ? 'Credit Settled'
              : (payoutAmountPaid >= itemsTotalSum ? 'Paid' : 'Credit Settled');


            const primaryReturnWh = values.items[0]?.returnDestinationWarehouse || origInvoiceWarehouse || 'Main Shop / Counter';

            const databasePayload = {
              return_no: values.returnNo?.startsWith('RTN-') ? values.returnNo : `RTN-${Date.now().toString().slice(-6)}`,
              invoice_no: `INV-${values.invoiceIdRef}`,
              customer_name: values.customerName,
              return_date: values.returnDate,
              settlement_mode: values.settlementMode,
              bank_name: (values.settlementMode === 'Bank' || values.settlementMode === 'Split') ? values.selectedBankAccountId : null,
              warehouse_name: primaryReturnWh,
              payout_amount_paid: payoutAmountPaid,
              total_amount: itemsTotalSum,
              status: finalCalculatedReturnStatus,
              items: values.items
            };


            try {
              setLoading(true);
              if (isEditMode) {
                const { error } = await supabase
                  .from('sales_returns')
                  .update(databasePayload)
                  .eq('id', routeStateData.id);
                if (error) throw error;
                toast.success('Sales Return Entry Modified Successfully!');
              } else {
                const { error } = await supabase.from('sales_returns').insert([databasePayload]);
                if (error) throw error;

                for (const item of values.items) {
                  const qty = Number(item.qty) || 0;
                  if (!qty) continue;

                  const { data: activeProd } = await supabase.from('products').select('current_stock').eq('product_name', item.itemName).maybeSingle();
                  if (activeProd) {
                    await supabase.from('products').update({ current_stock: (Number(activeProd.current_stock) || 0) + qty }).eq('product_name', item.itemName);
                  }

                  const targetWh = item.returnDestinationWarehouse || primaryReturnWh;
                  const { data: whRow } = await supabase
                    .from('warehouse_inventory')
                    .select('id, quantity')
                    .ilike('product_name', item.itemName)
                    .ilike('warehouse_name', targetWh)
                    .maybeSingle();

                  if (whRow) {
                    await supabase.from('warehouse_inventory').update({ quantity: (Number(whRow.quantity) || 0) + qty }).eq('id', whRow.id);
                  } else {
                    await supabase.from('warehouse_inventory').insert([{ product_name: item.itemName, warehouse_name: targetWh, quantity: qty }]);
                  }
                }
                toast.success('Sales Return Registered!');
              }
              navigate(`${tenantId ? `/${tenantId}` : ''}/Sales-Return/Debit-Notes/List`);

            } catch (err: any) {
              toast.error(err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ values, handleChange, handleBlur, setFieldValue, errors, touched, submitCount }) => {
            const hasAttempted = submitCount > 0;
            return (
              <Form className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-end">
                  <div>
                    <label className="block font-medium mb-1">Return Memo ID Code #:</label>
                    <p className="text-danger font-bold text-sm">{values.returnNo}</p>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Processing Return Date:</label>
                    <input type="date" name="returnDate" onChange={handleChange} value={values.returnDate} className="w-full rounded border border-stroke p-2 text-sm bg-white dark:bg-boxdark font-semibold outline-none text-black dark:text-white" />
                  </div>

                  <div>
                    <label className="block font-medium text-primary font-bold mb-1">Search / Select Invoice: *</label>
                    <div className="relative sales-return-invoice-search-container">
                      {(() => {
                        const q = searchQuery.toLowerCase().trim();
                        const filtered = defaultInvoices.filter((inv: any) => {
                          if (!q) return true;
                          const invIdStr = String(inv.id).toLowerCase();
                          const invCode = `inv-${String(inv.id).padStart(4, '0')}`.toLowerCase();
                          const cust = (inv.customer_name || '').toLowerCase();
                          return invIdStr.includes(q) || invCode.includes(q) || cust.includes(q);
                        });

                        return (
                          <div className="relative">
                            <input
                              type="text"
                              autoComplete="off"
                              disabled={isEditMode}
                              value={searchQuery}
                              onFocus={() => {
                                if (!isEditMode) {
                                  setIsDropdownOpen(true);
                                  setHighlightInvoiceIdx(0);
                                }
                              }}
                              onClick={() => {
                                if (!isEditMode) {
                                  setIsDropdownOpen(true);
                                  setHighlightInvoiceIdx(0);
                                }
                              }}
                              onKeyDown={async (e) => {
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setHighlightInvoiceIdx(prev => prev < filtered.length - 1 ? prev + 1 : 0);
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setHighlightInvoiceIdx(prev => prev > 0 ? prev - 1 : filtered.length - 1);
                                } else if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (filtered.length > 0) {
                                    const chosen = filtered[highlightInvoiceIdx] || filtered[0];
                                    setSelectedInvoiceId(String(chosen.id));
                                    await loadInvoiceAndComputeReturnableItems(chosen.id, chosen, setFieldValue);
                                    setSearchQuery(`INV-${String(chosen.id).padStart(4, '0')} - ${chosen.customer_name || 'Customer'}`);
                                    setIsDropdownOpen(false);
                                  }
                                } else if (e.key === 'Tab' || e.key === 'Escape') {
                                  setIsDropdownOpen(false);
                                }
                              }}
                              onChange={async (e) => {
                                const val = e.target.value;
                                setSearchQuery(val);
                                setIsDropdownOpen(true);
                                setHighlightInvoiceIdx(0);

                                const cleanedVal = val.replace(/^inv-?/i, '').trim();
                                const exactMatch = defaultInvoices.find(inv => String(inv.id) === cleanedVal);
                                if (exactMatch) {
                                  setSelectedInvoiceId(String(exactMatch.id));
                                  await loadInvoiceAndComputeReturnableItems(exactMatch.id, exactMatch, setFieldValue);
                                }
                              }}
                              placeholder={values.invoiceIdRef ? `INV-${String(values.invoiceIdRef).padStart(4, '0')} — ${values.customerName || 'Customer'}` : 'Type invoice # or customer name...'}
                              className={`w-full rounded border p-2 text-sm bg-white dark:bg-boxdark font-bold text-black dark:text-white outline-none ${!values.invoiceIdRef && !searchQuery ? 'border-stroke dark:border-strokedark' : 'border-primary shadow-sm'} ${isEditMode ? 'opacity-50 cursor-not-allowed' : 'focus:border-primary'}`}
                            />

                            {/* RICH SEARCHABLE INVOICE DROPDOWN (ELEVATED Z-INDEX) */}
                            {isDropdownOpen && !isEditMode && (
                              <div className="absolute left-0 top-full mt-1.5 w-full min-w-[340px] max-h-[290px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A222C] shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 z-[99999] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                                {filtered.length === 0 ? (
                                  <div className="p-3 text-gray-400 text-center text-xs italic">No matching open invoices located</div>
                                ) : (
                                  filtered.map((inv: any, invIdx: number) => {
                                    const isHighlighted = invIdx === highlightInvoiceIdx;
                                    return (
                                      <div
                                        key={inv.id}
                                        onMouseEnter={() => setHighlightInvoiceIdx(invIdx)}
                                        onMouseDown={async (e) => {
                                          e.preventDefault();
                                          setSelectedInvoiceId(String(inv.id));
                                          await loadInvoiceAndComputeReturnableItems(inv.id, inv, setFieldValue);
                                          setSearchQuery(`INV-${String(inv.id).padStart(4, '0')} - ${inv.customer_name || 'Customer'}`);
                                          setIsDropdownOpen(false);
                                          toast.success(`Invoice INV-${String(inv.id).padStart(4, '0')} loaded!`);
                                        }}
                                        className={`p-3 cursor-pointer transition flex items-center justify-between group ${
                                          isHighlighted
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                                        }`}
                                      >
                                        <div className="flex flex-col gap-0.5 text-left">
                                          <span className="font-mono font-bold text-xs text-primary group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                            INV-{String(inv.id).padStart(4, '0')}
                                          </span>
                                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                            {inv.customer_name || 'Walk-in Customer'}
                                          </span>
                                        </div>
                                        <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400 pl-2">
                                          Rs. {Number(inv.total_amount || 0).toLocaleString()}
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    {hasAttempted && errors.invoiceIdRef && !values.invoiceIdRef && <p className="text-red-500 font-bold text-[10px] mt-0.5">⚠️ Required Field</p>}
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Customer / Account Title:</label>
                    <input type="text" name="customerName" disabled value={values.customerName} className="w-full rounded border border-stroke p-2 text-sm bg-gray-100 dark:bg-meta-4/20 text-gray-500 font-bold outline-none cursor-not-allowed" placeholder="Linked Account Name..." />
                  </div>
                </div>

                {values.invoiceIdRef && (
                  <div className="mb-4 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/80 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-black dark:text-white">
                    <div>
                      <span className="text-gray-500">Linked Invoice Ref:</span> <strong className="text-primary font-bold ml-1">INV-{String(values.invoiceIdRef).padStart(4, '0')}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Billed Invoice:</span> <strong className="text-black dark:text-white ml-1">Rs. {origInvoiceCashMetrics.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Amount Received (Cash/Bank):</span> <strong className="text-success font-black ml-1">Rs. {origInvoiceCashMetrics.cashReceivedBox.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Outstanding Credit Balance Due:</span> <strong className="text-danger font-black ml-1">Rs. {Math.max(0, origInvoiceCashMetrics.grandTotal - origInvoiceCashMetrics.cashReceivedBox).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                )}

                <div className="w-full overflow-x-auto rounded-sm border border-stroke dark:border-strokedark mb-6 whitespace-nowrap">
                  <table className="w-full table-auto border-collapse text-[12px] min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-meta-4 text-center font-bold uppercase text-black dark:text-white border-b border-stroke">
                        <th className="p-2 w-12">S#</th>
                        <th className="p-2 text-left">Item Name Description</th>
                        <th className="p-2 w-44 text-center">Return Receiving Location</th>
                        <th className="p-2 w-28 text-right pr-2">Sale Price</th>
                        <th className="p-2 w-24 text-center">Returned Qty</th>
                        <th className="p-2 w-28 text-right pr-2">Amount (PKR)</th>
                        {values.items.some((i: any) => Number(i.gstRate || i.gst_rate || 0) > 0 || Number(i.fTaxPer || i.f_tax_per || 0) > 0) && (
                          <>
                            <th className="p-2 w-16 text-center">GST %</th>
                            <th className="p-2 w-24 text-right pr-2">GST Amt</th>
                            <th className="p-2 w-16 text-center">F.Tax %</th>
                            <th className="p-2 w-24 text-right pr-2">F.Tax Amt</th>
                          </>
                        )}
                        <th className="p-2 w-32 text-right pr-2 bg-red-50 dark:bg-meta-4/10">Net Return Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {values.items.length === 0 ? (
                        <tr className="text-center bg-white dark:bg-boxdark border-b border-stroke text-gray-400 dark:text-gray-500 py-6">
                          <td colSpan={12} className="p-6 font-medium italic text-xs">
                            🔍 Please select an invoice from the search box above to load sold items eligible for return.
                          </td>
                        </tr>
                      ) : (
                        values.items.map((item: any, index: number) => {
                          const rp = Number(item.rp) || 0;
                          const qty = Number(item.qty) || 0;
                          const gstRate = Number(item.gstRate || item.gst_rate || 0);
                          const fTaxPer = Number(item.fTaxPer || item.f_tax_per || 0);
                          const hasTax = values.items.some((i: any) => Number(i.gstRate || i.gst_rate || 0) > 0 || Number(i.fTaxPer || i.f_tax_per || 0) > 0);

                          const selectedProd = productsList.find(p => p.product_name === item.itemName || (item.skuCode && (p.item_sr_no === item.skuCode || `SKU-${p.id}` === item.skuCode)));
                          const isTile = Boolean(
                            selectedProd && (
                              String(selectedProd.category || '').toLowerCase().includes('tile')
                            )
                          );
                          const rawPcs = Number(selectedProd?.pieces_per_box || selectedProd?.pcs_per_box || selectedProd?.pieces_per_packing || 0);
                          const pcsPerBox = rawPcs > 1 ? rawPcs : (isTile ? 4 : 1);
                          const uomName = selectedProd?.uom ? selectedProd.uom : (isTile ? 'BOX' : 'PCS');

                          // Max returnable sold quantity breakdown
                          const maxSoldQty = Number(item.soldQty || item.maxQty || 0);
                          const totalSoldPieces = isTile && pcsPerBox > 1 ? Math.round(maxSoldQty * pcsPerBox) : 0;
                          const maxSoldBoxes = isTile && pcsPerBox > 1 ? Math.floor(totalSoldPieces / pcsPerBox) : Math.floor(maxSoldQty);
                          const maxSoldLoosePcs = isTile && pcsPerBox > 1 ? (totalSoldPieces % pcsPerBox) : 0;

                          const grossBaseAmount = rp * qty;
                          const calculatedGstAmount = (grossBaseAmount / 100) * gstRate;
                          const calculatedFurtherTaxAmount = (grossBaseAmount / 100) * fTaxPer;
                          const taxInclusiveLineTotal = grossBaseAmount + calculatedGstAmount + calculatedFurtherTaxAmount;

                          return (
                            <tr key={index} className="text-center bg-white dark:bg-boxdark border-b border-stroke text-black dark:text-white font-mono font-semibold">
                              <td className="p-2 font-semibold font-sans">{index + 1}</td>
                              <td className="p-2 text-left font-bold font-sans text-xs">
                                <div>{item.itemName || 'Product Description'}</div>
                                {selectedProd?.category && (
                                  <span className="text-[10px] text-gray-400 font-sans font-normal">{selectedProd.category}</span>
                                )}
                              </td>

                              {/* RETURN RECEIVING WAREHOUSE / SHOP DESTINATION */}
                              <td className="p-2 w-44">
                                <select
                                  value={item.returnDestinationWarehouse || 'Main Shop / Counter'}
                                  onChange={(e) => setFieldValue(`items[${index}].returnDestinationWarehouse`, e.target.value)}
                                  className="w-full text-xs font-semibold bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded p-1.5 outline-none text-black dark:text-white focus:border-primary"
                                >
                                  {warehousesList.map((whName, whIdx) => (
                                    <option key={whIdx} value={whName}>
                                      {whName}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="p-2 text-right pr-2">Rs. {rp.toFixed(2)}</td>

                              {/* RETURNED QUANTITY COLUMN */}
                              <td className="p-2 min-w-[250px]">
                                {isTile ? (
                                  (() => {
                                    // Parse tile dimensions from product description or SKU (e.g. "60 × 60 cm" or "Size: 60 × 60 cm")
                                    let tileWidthCm = 60;
                                    let tileHeightCm = 60;
                                    const desc = selectedProd?.product_description || '';
                                    const sku = selectedProd?.item_sr_no || '';
                                    const sizeMatch = desc.match(/Size:\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*cm/i) ||
                                                      sku.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
                                    if (sizeMatch) {
                                      tileHeightCm = Number(sizeMatch[1]) || 60;
                                      tileWidthCm = Number(sizeMatch[2]) || 60;
                                    }
                                    const perPieceSqm = (tileHeightCm * tileWidthCm) / 10000;
                                    const perBoxSqm = perPieceSqm * pcsPerBox;

                                    const currentQty = Number(item.qty || 0);
                                    const boxes = Math.floor(currentQty);
                                    const loosePcs = Math.round((currentQty - boxes) * pcsPerBox);
                                    const totalLineSqm = (boxes * perBoxSqm) + (loosePcs * perPieceSqm);

                                    return (
                                      <div className="flex flex-col gap-1">
                                        {/* ── TOP BADGES: Per Box Sq.Mtr & Per Piece Sq.Mtr ── */}
                                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1 font-mono">
                                          <span className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800/60 font-bold">
                                            Box: {perBoxSqm.toFixed(2)} sq.m
                                          </span>
                                          <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 font-bold">
                                            Pc: {perPieceSqm.toFixed(4)} sq.m
                                          </span>
                                        </div>

                                        {/* ── INPUTS CONTAINER ── */}
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/90 p-1.5 rounded-lg border border-stroke dark:border-strokedark shadow-inner">
                                          {/* RETURN BOXES INPUT */}
                                          <div className="flex-1 flex items-center bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-md px-2 py-1 focus-within:border-primary shadow-sm">
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              onKeyDown={blockInvalidChar}
                                              value={(() => {
                                                const b = Math.floor(Number(item.qty || 0));
                                                return b === 0 ? '' : b;
                                              })()}
                                              placeholder="0"
                                              onChange={(e) => {
                                                const val = e.target.value.trim();
                                                const newBoxes = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                                                const currentLoose = Math.round((Number(item.qty || 0) - Math.floor(Number(item.qty || 0))) * pcsPerBox);
                                                const combined = Number((newBoxes + currentLoose / pcsPerBox).toFixed(3));
                                                const capped = Math.min(combined, maxSoldQty || 9999);
                                                setFieldValue(`items[${index}].qty`, capped);

                                                if (origInvoiceCashMetrics.cashReceivedBox > 0) {
                                                  const updatedItems = [...values.items];
                                                  updatedItems[index] = { ...updatedItems[index], qty: capped };
                                                  const newReturnVal = updatedItems.reduce((acc: number, i: any) => {
                                                    const iQty = Number(i.qty) || 0;
                                                    const iRp = Number(i.rp) || 0;
                                                    const iGst = Number(i.gstRate ?? i.gst_rate ?? 0);
                                                    const iFTax = Number(i.fTaxPer ?? i.f_tax_per ?? 0);
                                                    const base = iRp * iQty;
                                                    return acc + (base + (base / 100 * iGst) + (base / 100 * iFTax));
                                                  }, 0);
                                                  setFieldValue('payoutAmountPaid', Number(Math.min(newReturnVal, origInvoiceCashMetrics.cashReceivedBox).toFixed(2)));
                                                }
                                              }}
                                              className="w-full bg-transparent text-center font-black text-sm text-primary outline-none min-w-[36px]"
                                            />
                                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 pl-1 select-none">Box</span>
                                          </div>

                                          <span className="text-gray-400 font-black text-sm select-none">+</span>

                                          {/* RETURN LOOSE PIECES INPUT */}
                                          <div className="flex-1 flex items-center bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-md px-2 py-1 focus-within:border-emerald-500 shadow-sm">
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              onKeyDown={blockInvalidChar}
                                              value={(() => {
                                                const currentLoose = Math.round((Number(item.qty || 0) - Math.floor(Number(item.qty || 0))) * pcsPerBox);
                                                return currentLoose === 0 ? '' : currentLoose;
                                              })()}
                                              placeholder={`${pcsPerBox}`}
                                              onChange={(e) => {
                                                const val = e.target.value.trim();
                                                const enteredLoose = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                                                const currentBoxes = Math.floor(Number(item.qty || 0));

                                                const extraBoxes = Math.floor(enteredLoose / pcsPerBox);
                                                const remLoose = enteredLoose % pcsPerBox;
                                                const finalBoxes = currentBoxes + extraBoxes;
                                                const combined = remLoose > 0 
                                                  ? Number((finalBoxes + remLoose / pcsPerBox).toFixed(3)) 
                                                  : finalBoxes;
                                                const capped = Math.min(combined, maxSoldQty || 9999);
                                                setFieldValue(`items[${index}].qty`, capped);

                                                if (origInvoiceCashMetrics.cashReceivedBox > 0) {
                                                  const updatedItems = [...values.items];
                                                  updatedItems[index] = { ...updatedItems[index], qty: capped };
                                                  const newReturnVal = updatedItems.reduce((acc: number, i: any) => {
                                                    const iQty = Number(i.qty) || 0;
                                                    const iRp = Number(i.rp) || 0;
                                                    const iGst = Number(i.gstRate ?? i.gst_rate ?? 0);
                                                    const iFTax = Number(i.fTaxPer ?? i.f_tax_per ?? 0);
                                                    const base = iRp * iQty;
                                                    return acc + (base + (base / 100 * iGst) + (base / 100 * iFTax));
                                                  }, 0);
                                                  setFieldValue('payoutAmountPaid', Number(Math.min(newReturnVal, origInvoiceCashMetrics.cashReceivedBox).toFixed(2)));
                                                }
                                              }}
                                              className="w-full bg-transparent text-center font-black text-sm text-emerald-600 outline-none min-w-[36px]"
                                            />
                                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 pl-1 select-none">Pcs</span>
                                          </div>
                                        </div>

                                        {/* ── BOTTOM TOTAL SQ.MTR CALCULATION ── */}
                                        <div className="text-center font-mono text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/30 rounded py-0.5 border border-teal-200/60 dark:border-teal-800/40">
                                          Total: <span className="text-xs font-black">{totalLineSqm.toFixed(2)}</span> sq.m
                                          <span className="text-slate-400 font-sans font-normal ml-1">({boxes} Box{boxes !== 1 ? 'es' : ''}{loosePcs > 0 ? ` + ${loosePcs} Pcs` : ''})</span>
                                        </div>

                                        <span className="text-[10px] text-gray-400 font-sans font-medium text-center">
                                          Max Returnable Sold: {maxSoldBoxes} Box {maxSoldLoosePcs > 0 ? `+ ${maxSoldLoosePcs} Pcs` : ''}
                                        </span>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1 rounded-md border border-stroke dark:border-strokedark w-28 mx-auto">
                                      <input
                                        type="number"
                                        min="1"
                                        max={item.soldQty || item.maxQty || 9999}
                                        value={item.qty}
                                        onKeyDown={blockInvalidChar}
                                        onChange={(e) => {
                                          const inputVal = Number(e.target.value) || 0;
                                          const maxAllowed = (item.soldQty || item.maxQty || 9999);
                                          const finalVal = Math.min(Math.max(1, inputVal), maxAllowed);
                                          setFieldValue(`items[${index}].qty`, finalVal);

                                          if (origInvoiceCashMetrics.cashReceivedBox > 0) {
                                            const updatedItems = [...values.items];
                                            updatedItems[index] = { ...updatedItems[index], qty: finalVal };
                                            const newReturnVal = updatedItems.reduce((acc: number, i: any) => {
                                              const iQty = Number(i.qty) || 0;
                                              const iRp = Number(i.rp) || 0;
                                              const iGst = Number(i.gstRate || i.gst_rate || 0);
                                              const iFTax = Number(i.fTaxPer || i.f_tax_per || 0);
                                              const base = iRp * iQty;
                                              return acc + (base + (base / 100 * iGst) + (base / 100 * iFTax));
                                            }, 0);
                                            setFieldValue('payoutAmountPaid', Number(Math.min(newReturnVal, origInvoiceCashMetrics.cashReceivedBox).toFixed(2)));
                                          }
                                        }}
                                        className="w-full bg-transparent text-center font-black text-xs text-primary outline-none"
                                      />
                                      <span className="text-[10px] text-gray-500 font-bold pr-1 uppercase">{uomName}</span>
                                    </div>
                                    {item.soldQty ? (
                                      <span className="block text-[9px] text-gray-400 font-sans font-normal mt-0.5">Sold: {item.soldQty} {uomName}</span>
                                    ) : null}
                                  </div>
                                )}
                              </td>

                              <td className="p-2 text-right pr-2 text-gray-700 dark:text-gray-300">Rs. {grossBaseAmount.toFixed(2)}</td>
                              {hasTax && (
                                <>
                                  <td className="p-2 text-center text-xs text-gray-400 font-sans">{gstRate}%</td>
                                  <td className="p-2 text-right pr-2 text-gray-400">Rs. {calculatedGstAmount.toFixed(2)}</td>
                                  <td className="p-2 text-center text-xs text-gray-400 font-sans">{fTaxPer}%</td>
                                  <td className="p-2 text-right pr-2 text-gray-400">Rs. {calculatedFurtherTaxAmount.toFixed(2)}</td>
                                </>
                              )}
                              <td className="p-2 text-right text-danger font-black pr-2 bg-red-50/30 dark:bg-meta-4/5 text-sm">Rs. {taxInclusiveLineTotal.toFixed(2)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col md:flex-row justify-between gap-10 mt-6 px-4 pb-4">
                  <div className="flex flex-col gap-4 w-full md:w-1/2 border border-stroke p-4 rounded dark:border-strokedark bg-slate-50/10 space-y-1">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-white mb-2">1. Refund Settlement Mode Select: *</h4>
                      <select
                        name="settlementMode"
                        value={values.settlementMode}
                        onChange={(e) => {
                          handleChange(e);
                          if (e.target.value === 'Cash') {
                            setFieldValue('selectedBankAccountId', '');
                            setFieldValue('bankPayoutPaid', 0);
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
                      <div className="transition-all duration-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-white mb-2">Select Target Settlement Corporate Bank Profile: *</h4>
                        <select
                          name="selectedBankAccountId"
                          value={values.selectedBankAccountId}
                          onChange={handleChange}
                          className={`w-full border rounded p-2 bg-white dark:bg-boxdark outline-none font-bold text-xs text-black dark:text-white focus:border-primary ${hasAttempted && errors.selectedBankAccountId ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                        >
                          <option value="">-- Choose Account Wire Registry --</option>
                          {banksList.map(b => (
                            <option key={b.id} value={b.accountTitle}>{b.bankName} - {b.accountTitle}</option>
                          ))}
                        </select>
                        {hasAttempted && errors.selectedBankAccountId && <p className="text-red-500 text-[10px] font-bold mt-1">⚠️ Required field</p>}
                      </div>
                    )}

                    <div className="border-t border-stroke dark:border-strokedark my-2"></div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-danger mb-2">2. Refund Payout Remitted Amount (PKR): *</h4>
                      
                      {values.invoiceIdRef && origInvoiceCashMetrics.cashReceivedBox === 0 ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded text-[11px] text-amber-800 dark:text-amber-300 font-semibold space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold uppercase tracking-wide text-danger text-xs">Payout: Rs. 0.00</span>
                            <span className="text-[9px] bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-black tracking-wider">CREDIT ADJUSTMENT ONLY</span>
                          </div>
                          <p className="text-[10px] leading-relaxed text-gray-600 dark:text-gray-400 font-normal">
                            ℹ️ This invoice was billed <b>ON CREDIT</b> with <b>Rs. 0.00 cash/bank payment received</b>. Cash payout is locked to <b>Rs. 0.00</b>. The return item value will automatically credit & adjust the customer's account ledger balance.
                          </p>
                        </div>
                      ) : values.settlementMode === 'Split' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-danger mb-1">Cash Refund (PKR): *</label>
                            <input
                              type="number"
                              name="cashPayoutPaid"
                              onKeyDown={blockInvalidChar}
                              onFocus={(e) => {
                                if (Number(values.cashPayoutPaid) === 0) setFieldValue('cashPayoutPaid', '');
                              }}
                              onBlur={(e) => {
                                handleBlur(e);
                                if (values.cashPayoutPaid === '' || values.cashPayoutPaid === undefined || values.cashPayoutPaid === null) {
                                  setFieldValue('cashPayoutPaid', 0);
                                }
                              }}
                              onChange={(e) => {
                                const valStr = e.target.value;
                                if (valStr === '') {
                                  setFieldValue('cashPayoutPaid', '');
                                } else {
                                  const val = Number(valStr);
                                  setFieldValue('cashPayoutPaid', isNaN(val) ? '' : Math.max(0, val));
                                }
                              }}
                              value={values.cashPayoutPaid === 0 ? '' : (values.cashPayoutPaid ?? '')}
                              placeholder="0.00"
                              className="w-full rounded border border-stroke p-2 bg-transparent text-right font-black text-danger text-sm focus:border-primary outline-none text-black dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-primary mb-1">Bank Refund (PKR): *</label>
                            <input
                              type="number"
                              name="bankPayoutPaid"
                              onKeyDown={blockInvalidChar}
                              onFocus={(e) => {
                                if (Number(values.bankPayoutPaid) === 0) setFieldValue('bankPayoutPaid', '');
                              }}
                              onBlur={(e) => {
                                handleBlur(e);
                                if (values.bankPayoutPaid === '' || values.bankPayoutPaid === undefined || values.bankPayoutPaid === null) {
                                  setFieldValue('bankPayoutPaid', 0);
                                }
                              }}
                              onChange={(e) => {
                                const valStr = e.target.value;
                                if (valStr === '') {
                                  setFieldValue('bankPayoutPaid', '');
                                } else {
                                  const val = Number(valStr);
                                  setFieldValue('bankPayoutPaid', isNaN(val) ? '' : Math.max(0, val));
                                }
                              }}
                              value={values.bankPayoutPaid === 0 ? '' : (values.bankPayoutPaid ?? '')}
                              placeholder="0.00"
                              className="w-full rounded border border-stroke p-2 bg-transparent text-right font-black text-primary text-sm focus:border-primary outline-none text-black dark:text-white"
                            />
                          </div>
                        </div>
                      ) : (
                        <input
                          type="number"
                          name={values.settlementMode === 'Bank' ? 'bankPayoutPaid' : 'payoutAmountPaid'}
                          onKeyDown={blockInvalidChar}
                          onFocus={(e) => {
                            const activeVal = values.settlementMode === 'Bank' ? (values.bankPayoutPaid ?? values.payoutAmountPaid) : values.payoutAmountPaid;
                            if (Number(activeVal) === 0) {
                              if (values.settlementMode === 'Bank') {
                                setFieldValue('bankPayoutPaid', '');
                                setFieldValue('payoutAmountPaid', '');
                              } else {
                                setFieldValue('payoutAmountPaid', '');
                                setFieldValue('cashPayoutPaid', '');
                              }
                            }
                          }}
                          onBlur={(e) => {
                            handleBlur(e);
                            const activeVal = values.settlementMode === 'Bank' ? (values.bankPayoutPaid ?? values.payoutAmountPaid) : values.payoutAmountPaid;
                            if (activeVal === '' || activeVal === undefined || activeVal === null) {
                              if (values.settlementMode === 'Bank') {
                                setFieldValue('bankPayoutPaid', 0);
                                setFieldValue('payoutAmountPaid', 0);
                              } else {
                                setFieldValue('payoutAmountPaid', 0);
                                setFieldValue('cashPayoutPaid', 0);
                              }
                            }
                          }}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            if (valStr === '') {
                              if (values.settlementMode === 'Bank') {
                                setFieldValue('bankPayoutPaid', '');
                                setFieldValue('payoutAmountPaid', '');
                              } else {
                                setFieldValue('payoutAmountPaid', '');
                                setFieldValue('cashPayoutPaid', '');
                              }
                              return;
                            }
                            const val = Number(valStr);
                            const currentReturnTotal = values.items.reduce((acc: number, i: any) => {
                              const iQty = Number(i.qty) || 0;
                              const iRp = Number(i.rp) || 0;
                              const iGst = Number(i.gstRate ?? i.gst_rate ?? 0);
                              const iFTax = Number(i.fTaxPer ?? i.f_tax_per ?? 0);
                              const base = iRp * iQty;
                              return acc + (base + (base / 100 * iGst) + (base / 100 * iFTax));
                            }, 0);
                            const maxLimit = origInvoiceCashMetrics.cashReceivedBox > 0
                              ? Math.min(currentReturnTotal, origInvoiceCashMetrics.cashReceivedBox)
                              : currentReturnTotal;
                            const cappedVal = Math.min(Math.max(0, val), maxLimit);
                            if (values.settlementMode === 'Bank') {
                              setFieldValue('bankPayoutPaid', cappedVal);
                              setFieldValue('payoutAmountPaid', cappedVal);
                            } else {
                              setFieldValue('payoutAmountPaid', cappedVal);
                              setFieldValue('cashPayoutPaid', cappedVal);
                            }
                          }}
                          value={(() => {
                            const val = values.settlementMode === 'Bank' ? (values.bankPayoutPaid ?? values.payoutAmountPaid) : values.payoutAmountPaid;
                            return val === 0 ? '' : (val ?? '');
                          })()}
                          placeholder="0.00"
                          className="w-full rounded border border-stroke p-2 bg-transparent text-right font-black text-danger text-sm focus:border-primary outline-none text-black dark:text-white"
                        />
                      )}
                    </div>

                  </div>

                  <div className="w-full md:w-1/3 space-y-3 text-xs text-black dark:text-white font-semibold">
                    {values.invoiceIdRef && (
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/80 rounded-xl p-3 space-y-1.5 font-mono text-[11px] text-gray-500 dark:text-gray-300">
                        <h5 className="font-bold text-emerald-700 dark:text-emerald-400 text-[10px] uppercase tracking-wide">📄 Source Invoice Audit Profile</h5>
                        <div className="flex justify-between"><span>Original Grand Total:</span><b className="text-black dark:text-white">Rs. {origInvoiceCashMetrics.grandTotal.toLocaleString()}</b></div>
                        <div className="flex justify-between border-t pt-1 border-emerald-100 dark:border-slate-800"><span>Total Received (Cash/Bank):</span><b className="text-success font-black text-xs">Rs. {origInvoiceCashMetrics.cashReceivedBox.toLocaleString()}</b></div>
                      </div>
                    )}


                    <div className="flex justify-between border-b pb-1 dark:border-strokedark pt-1">
                      <span>Net Return Items Value:</span>
                      <b className="text-danger text-sm">
                        Rs. {values.items.reduce((acc: number, i: any) => {
                          const itemQty = Number(i.qty) || 0;
                          const itemRp = Number(i.rp) || 0;
                          const itemGst = Number(i.gstRate ?? i.gst_rate ?? 0);
                          const itemFTax = Number(i.fTaxPer ?? i.f_tax_per ?? 0);
                          const base = itemRp * itemQty;
                          return acc + (base + (base / 100 * itemGst) + (base / 100 * itemFTax));
                        }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </b>
                    </div>

                    <div className="flex justify-between pt-1 font-mono text-[10px] text-gray-400">
                      <span>Calculated Return Strategy:</span>
                      <b className="uppercase underline text-black dark:text-white">
                        {(() => {
                          const payout = Number(values.payoutAmountPaid) || 0;
                          const returnTotalSum = values.items.reduce((acc: number, i: any) => {
                            const itemQty = Number(i.qty) || 0;
                            const itemRp = Number(i.rp) || 0;
                            const itemGst = Number(i.gstRate ?? i.gst_rate ?? 0);
                            const itemFTax = Number(i.fTaxPer ?? i.f_tax_per ?? 0);
                            const base = itemRp * itemQty;
                            return acc + (base + (base / 100 * itemGst) + (base / 100 * itemFTax));
                          }, 0);

                          if (payout >= returnTotalSum - 0.01 && payout > 0) {
                            return values.settlementMode === 'Bank' ? 'Bank Refund (Paid in Full)' : 'Cash Refund (Paid in Full)';
                          }
                          if (payout > 0) {
                            return `Partial Refund (Rs. ${payout.toFixed(2)} Paid, Balance on Credit)`;
                          }
                          return 'Credit Settled (0 Cash Owed)';
                        })()}
                      </b>
                    </div>

                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-stroke dark:border-strokedark flex flex-col md:flex-row justify-between items-center bg-gray-50 dark:bg-meta-4/5 p-4 rounded-sm gap-4">
                  <div>
                    {isInvoiceAlreadyReturned && !isEditMode && (
                      <p className="text-red-500 font-black text-xs tracking-wide bg-red-50 border border-red-200 py-1.5 px-4 rounded shadow-xs animate-pulse">
                        ⚠️ This Invoice has already been fully returned (No returnable quantity remaining)
                      </p>
                    )}

                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Sales-Return/Debit-Notes/List`)}
                      className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={loading || (isInvoiceAlreadyReturned && !isEditMode)}
                      className={`rounded-xl py-3 px-8 font-bold text-xs transition shadow-md flex items-center gap-2
                        ${(isInvoiceAlreadyReturned && !isEditMode)
                          ? 'bg-gray-400 opacity-40 cursor-not-allowed text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                        }`}
                    >
                      {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Modify Entry' : 'Save Record'}</span>}
                    </button>
                  </div>
                </div>
              </Form>
            );
          }}
        </Formik>
      </div>
    </div>
  );
};

export default AddSalesReturn;
