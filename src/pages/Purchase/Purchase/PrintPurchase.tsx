import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { FiPrinter, FiArrowLeft, FiPhone, FiMapPin, FiCheckCircle } from 'react-icons/fi';

interface PurchaseItem {
  itemName?: string;
  product_name?: string;
  skuCode?: string;
  item_sr_no?: string;
  qty?: number;
  quantity?: number;
  rate?: number;
  cost_price?: number;
  discountPer?: number;
  discountAmt?: number;
  gstRate?: number;
  gstAmt?: number;
  warehouse?: string;
}

interface PurchaseData {
  id: number;
  purchase_no: string;
  supplier_name?: string;
  vendor_name?: string;
  target_warehouse?: string;
  purchase_date?: string;
  purchase_type?: string;
  payment_term?: string;
  amount_paid?: number;
  cash_amount_paid?: number;
  bank_amount_paid?: number;
  selected_bank_title?: string;
  total_amount?: number;
  remaining_balance?: number;
  remarks?: string;
  notes?: string;
  items: PurchaseItem[];
  metadata?: any;
  created_at: string;
}

const PrintPurchase = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [purchase, setPurchase] = useState<PurchaseData | null>(null);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [productsCatalog, setProductsCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchaseData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('supplier_purchases')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setPurchase(data);

        // Fetch products to know tile packings & units
        const { data: prods } = await supabase
          .from('products')
          .select('product_name, item_sr_no, category, uom, pieces_per_box, pcs_per_box, pieces_per_packing, product_description, scenario_name');
        if (prods) setProductsCatalog(prods);

        // Fetch vendor info dynamically
        const vName = data.supplier_name || data.vendor_name;
        if (vName) {
          const { data: vData } = await supabase
            .from('vendors')
            .select('*')
            .or(`vendor_name.ilike.${vName},name.ilike.${vName}`)
            .maybeSingle();
          if (vData) {
            setVendorInfo(vData);
          }
        }
      } catch (err: any) {
        toast.error('Failed to load purchase record: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchaseData();
  }, [id]);

  if (loading) return <div className="flex justify-center items-center h-screen"><Spinner /></div>;
  if (!purchase) return <div className="text-center py-20 text-gray-500 font-bold">Purchase record not found.</div>;

  // ── Compute line items ──────────────────────────────────────────────────────
  const rawItems = Array.isArray(purchase.items) ? purchase.items : [];

  let computedTotalGross = 0;
  let computedTotalDiscount = 0;
  let computedTotalGst = 0;
  let computedTotalNet = 0;

  const processedItems = rawItems.map((item) => {
    const pName = item.itemName ?? item.product_name ?? 'N/A';
    const prodMeta = productsCatalog.find(p => 
      p.product_name === pName || 
      (item.skuCode && (p.item_sr_no === item.skuCode || `SKU-${p.id}` === item.skuCode))
    );

    const isTile = Boolean(
      prodMeta && (
        String(prodMeta.category || '').toLowerCase().includes('tile') ||
        String(prodMeta.scenario_name || '').toLowerCase().includes('tile') ||
        Number(prodMeta.pieces_per_box || prodMeta.pcs_per_box || 0) > 1 ||
        String(prodMeta.uom || '').toLowerCase().includes('box')
      )
    );
    const rawPcs = Number(prodMeta?.pieces_per_box || prodMeta?.pcs_per_box || prodMeta?.pieces_per_packing || 0);
    const pcsPerBox = rawPcs > 1 ? rawPcs : 4;

    const qty = Number(item.qty ?? item.quantity ?? 0);
    const rate = Number(item.rate ?? item.cost_price ?? 0);
    const grossAmount = rate * qty;

    const discountPer = Number(item.discountPer ?? 0);
    const discountAmt = Number(item.discountAmt ?? ((grossAmount * discountPer) / 100));
    const afterDiscount = Math.max(0, grossAmount - discountAmt);

    const gstRate = Number(item.gstRate ?? 0);
    const gstAmount = Number(item.gstAmt ?? ((afterDiscount * gstRate) / 100));
    const netTotal = afterDiscount + gstAmount;

    // Quantity display string and Sq.Mtr calculations
    let qtyDisplay = `${qty}`;
    let perBoxSqm = 0;
    let perPieceSqm = 0;
    let totalLineSqm = 0;

    if (isTile) {
      const boxes = Math.floor(qty);
      const loose = Math.round((qty - boxes) * pcsPerBox);

      let tileWidthCm = 60;
      let tileHeightCm = 60;
      const desc = prodMeta?.product_description || '';
      const sku = prodMeta?.item_sr_no || item.skuCode || '';
      const sizeMatch = desc.match(/Size:\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*cm/i) ||
                        sku.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
      if (sizeMatch) {
        tileHeightCm = Number(sizeMatch[1]) || 60;
        tileWidthCm = Number(sizeMatch[2]) || 60;
      }
      perPieceSqm = (tileHeightCm * tileWidthCm) / 10000;
      perBoxSqm = perPieceSqm * pcsPerBox;
      totalLineSqm = (boxes * perBoxSqm) + (loose * perPieceSqm);

      if (boxes > 0 && loose > 0) {
        qtyDisplay = `${boxes} Box + ${loose} Pcs`;
      } else if (boxes > 0) {
        qtyDisplay = `${boxes} Box${boxes > 1 ? 'es' : ''}`;
      } else if (loose > 0) {
        qtyDisplay = `${loose} Pcs`;
      } else {
        qtyDisplay = `0 Box`;
      }
    } else if (prodMeta?.uom) {
      qtyDisplay = `${qty} ${prodMeta.uom}`;
    }

    computedTotalGross += grossAmount;
    computedTotalDiscount += discountAmt;
    computedTotalGst += gstAmount;
    computedTotalNet += netTotal;

    return {
      pName,
      skuCode: item.skuCode || prodMeta?.item_sr_no || '-',
      warehouse: item.warehouse || purchase.target_warehouse || 'Main Warehouse',
      qty,
      qtyDisplay,
      isTile,
      perBoxSqm,
      perPieceSqm,
      totalLineSqm,
      rate,
      grossAmount,
      discountPer,
      discountAmt,
      gstRate,
      gstAmount,
      netTotal
    };
  });

  const grandTotal = computedTotalNet > 0 ? computedTotalNet : Number(purchase.total_amount || 0);
  const cashPaid = Number(purchase.cash_amount_paid || 0);
  const bankPaid = Number(purchase.bank_amount_paid || 0);
  const totalPaid = (cashPaid > 0 || bankPaid > 0) ? (cashPaid + bankPaid) : Number(purchase.amount_paid || 0);
  const remainingPayable = Math.max(0, grandTotal - totalPaid);

  const purchaseNoFormatted = purchase.purchase_no || `PUR-${String(purchase.id).padStart(4, '0')}`;
  const purchaseDateFormatted = purchase.purchase_date 
    ? new Date(purchase.purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(purchase.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Number to Words Helper ───────────────────────────────────────────────
  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const n = ('000000000' + num).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0] as any] + ' ' + a[n[1][1] as any]) + 'Crore ' : '';
    str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0] as any] + ' ' + a[n[2][1] as any]) + 'Lakh ' : '';
    str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0] as any] + ' ' + a[n[3][1] as any]) + 'Thousand ' : '';
    str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0] as any] + ' ' + a[n[4][1] as any]) + 'Hundred ' : '';
    str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0] as any] + ' ' + a[n[5][1] as any]) : '';
    return str.trim() + ' Rupees Only';
  };

  const amountInWords = numberToWords(Math.round(grandTotal));

  return (
    <div className="mx-auto max-w-4xl p-2 sm:p-4 md:p-6 bg-white text-slate-900 font-sans min-h-screen relative print:p-0 print:m-0 print:max-w-full">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          aside, nav, header, .no-print, button {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            font-size: 10.5px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          table {
            width: 100% !important;
            table-layout: fixed !important;
          }
          .print-table th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            border-bottom: 1px solid #94a3b8 !important;
          }
          .print-table td {
            border-bottom: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>

      {/* ── TOP ACTION BAR (Hidden on Print) ─────────────────────────────────── */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Purchases/List`)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition cursor-pointer"
          >
            <FiArrowLeft size={14} /> Back to Purchases List
          </button>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Inbound Purchase Consignment Voucher</h1>
            <p className="text-[11px] text-slate-400 font-mono">PO Ref: {purchaseNoFormatted}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-2.5 text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-md transition cursor-pointer"
        >
          <FiPrinter size={16} /> Print Purchase Note
        </button>
      </div>

      {/* ── PRINTABLE DOCUMENT CONTAINER ───────────────────────────────────── */}
      <div className="print-card border border-slate-200 rounded-xl p-5 sm:p-7 bg-white shadow-xs print:border-none print:p-0 print:shadow-none">
        
        {/* ── 1. CORPORATE HEADER ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b-2 border-emerald-600">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-base shadow-sm">Z</span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">ZOHAIB ALI & COMPANY</h2>
            </div>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">Wholesale Tile & Sanitary Procurement Hub</p>
            <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-slate-600 mt-1.5 font-medium">
              <span className="flex items-center gap-1"><FiMapPin className="text-emerald-600" /> Main Showroom & Warehouse Yard, Pakistan</span>
              <span className="flex items-center gap-1"><FiPhone className="text-emerald-600" /> Hotline: 03128039911</span>
            </div>
          </div>

          <div className="text-left sm:text-right bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200/80 min-w-[200px]">
            <span className="block text-[9px] font-black text-emerald-800 uppercase tracking-widest">Document Type</span>
            <span className="block text-xs sm:text-sm font-black text-emerald-950 mt-0.5">GOODS RECEIVING NOTE</span>
            <span className="block text-[10.5px] text-slate-500 font-semibold font-mono mt-0.5">PO: <strong className="text-slate-900 font-black">{purchaseNoFormatted}</strong></span>
            <span className="block text-[10.5px] text-slate-500 font-semibold mt-0.5">Date: <strong className="text-slate-900">{purchaseDateFormatted}</strong></span>
          </div>
        </div>

        {/* ── 2. METADATA CARDS: VENDOR & INWARD SETTLEMENT ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          {/* Vendor Card */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block mb-1">Supplying Factory / Wholesale Vendor</span>
            <h3 className="text-xs font-black text-slate-900">{purchase.supplier_name || purchase.vendor_name || 'General Factory Vendor'}</h3>
            {vendorInfo?.contact_name && (
              <p className="text-[11px] text-slate-600 mt-0.5"><strong className="text-slate-700">Contact:</strong> {vendorInfo.contact_name}</p>
            )}
            {(vendorInfo?.cell_no || vendorInfo?.phone_no || vendorInfo?.phone) && (
              <p className="text-[11px] text-slate-600 mt-0.5 font-mono"><strong className="text-slate-700">Phone:</strong> {vendorInfo.cell_no || vendorInfo.phone_no || vendorInfo.phone}</p>
            )}
            {vendorInfo?.address && (
              <p className="text-[11px] text-slate-600 mt-0.5"><strong className="text-slate-700">Address:</strong> {vendorInfo.address} {vendorInfo?.city ? `(${vendorInfo.city})` : ''}</p>
            )}
          </div>

          {/* Inward Details Card */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block mb-1">Inbound Consignment Coordinates</span>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Destination Warehouse:</span>
                <strong className="text-slate-900 font-bold">{purchase.target_warehouse || 'Main Warehouse'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Term / Method:</span>
                <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.2 rounded text-[10.5px]">{purchase.payment_term || 'By Cash'}</span>
              </div>
              {purchase.selected_bank_title && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Disbursed From Bank:</span>
                  <strong className="text-slate-900 font-mono text-[10.5px]">{purchase.selected_bank_title}</strong>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Consignment Status:</span>
                <strong className="text-emerald-700 font-bold inline-flex items-center gap-1"><FiCheckCircle size={11} /> Stock Received & Added</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. RECEIVED ITEMS INVENTORY TABLE ── */}
        <div className="rounded-lg border border-slate-200 my-4 overflow-hidden">
          <table className="w-full text-left border-collapse print-table">
            <thead>
              <tr className="bg-slate-100 text-[9.5px] font-black uppercase text-slate-700 border-b border-slate-300">
                <th className="py-2 px-2 w-[5%] text-center">S#</th>
                <th className="py-2 px-2 w-[15%]">SKU Code</th>
                <th className="py-2 px-2 w-[30%]">Product Description</th>
                <th className="py-2 px-2 w-[16%]">Destination</th>
                <th className="py-2 px-2 w-[16%] text-center">Received Qty</th>
                <th className="py-2 px-2 w-[9%] text-right">Cost Rate</th>
                <th className="py-2 px-2 w-[9%] text-right pr-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {processedItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2 px-2 text-center text-slate-400 font-mono text-[10.5px]">{idx + 1}</td>
                  <td className="py-2 px-2 font-mono font-bold text-slate-900 text-[10.5px]">{item.skuCode}</td>
                  <td className="py-2 px-2">
                    <span className="font-bold text-slate-900 block leading-tight">{item.pName}</span>
                    {item.isTile && item.perBoxSqm > 0 && (
                      <span className="text-[9.5px] font-mono text-emerald-700 font-semibold block mt-0.5">
                        [Tile Metric] 1 Box = {item.perBoxSqm.toFixed(2)} sq.m
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-slate-600 text-[10.5px] font-medium leading-tight">{item.warehouse}</td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex flex-col items-center justify-center font-mono">
                      <span className="font-bold text-slate-900 text-[11px]">{item.qtyDisplay}</span>
                      {item.isTile && item.totalLineSqm > 0 && (
                        <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 mt-0.5">
                          {item.totalLineSqm.toFixed(2)} sq.m
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-semibold text-slate-800 text-[10.5px]">
                    Rs. {item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-black text-slate-900 pr-2 text-[10.5px]">
                    Rs. {item.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 4. FINANCIAL SUMMARY & WORDS BREAKDOWN ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start my-4">
          {/* Amount in words and notes */}
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Total Amount in Words:</span>
              <p className="font-bold text-slate-800 italic">{amountInWords}</p>
            </div>

            {(purchase.remarks || purchase.notes) && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Procurement / Consignment Remarks:</span>
                <p className="text-slate-700 font-medium">{purchase.remarks || purchase.notes}</p>
              </div>
            )}
          </div>

          {/* Payables Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-sans font-semibold">Gross Total Bill:</span>
              <strong className="font-black text-xs text-slate-900">Rs. {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </div>

            <div className="flex justify-between items-center text-emerald-700 pt-1 border-t border-slate-200">
              <span className="font-sans font-semibold">Amount Paid Upfront:</span>
              <strong className="font-black text-xs">Rs. {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </div>

            {cashPaid > 0 && bankPaid > 0 && (
              <div className="text-[9.5px] text-slate-500 flex justify-between px-2">
                <span>(Cash: Rs. {cashPaid.toLocaleString()} + Bank: Rs. {bankPaid.toLocaleString()})</span>
              </div>
            )}

            <div className="flex justify-between items-center text-rose-700 pt-1.5 border-t-2 border-slate-300">
              <span className="font-sans font-bold">Remaining Vendor Payable:</span>
              <strong className="font-black text-sm">Rs. {remainingPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>

        {/* ── 5. VERIFICATION SIGNATURES FOOTER ── */}
        <div className="grid grid-cols-3 gap-6 pt-8 mt-6 border-t border-slate-200 text-center text-[10.5px]">
          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Goods Received & Inspected
            </div>
            <span className="text-[9px] text-slate-400">(Storekeeper / Warehouse)</span>
          </div>

          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Accounts Verification
            </div>
            <span className="text-[9px] text-slate-400">(Accountant / Ledger Entry)</span>
          </div>

          <div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              Authorized Signature
            </div>
            <span className="text-[9px] text-slate-400">(Executive Management)</span>
          </div>
        </div>

        <div className="text-center text-[9px] text-slate-400 font-mono mt-6 pt-3 border-t border-slate-100">
          This is an official computer-generated Goods Receiving Note generated by Zohaib Ali & Company ERP.
        </div>

      </div>
    </div>
  );
};

export default PrintPurchase;
