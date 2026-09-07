import { supabase } from './src/Context/supabaseClient';

async function rebuildInventory() {
  console.log("Fetching all ledgers to rebuild true inventory...");

  const [{ data: baseProducts }, { data: openStocks }, { data: purchases }, { data: sales }, { data: sReturns }, { data: pReturns }, { data: deliveryChallans }, { data: grnReceipts }] = await Promise.all([
    supabase.from('products').select('*'),
    supabase.from('opening_stocks').select('*'),
    supabase.from('supplier_purchases').select('id, purchase_no, items, payment_term, metadata, target_warehouse'),
    supabase.from('sales_invoices').select('items, sale_status, receipt_status, dispatch_warehouse'),
    supabase.from('sales_returns').select('*'),
    supabase.from('purchase_returns').select('*'),
    supabase.from('delivery_challans').select('*'),
    supabase.from('grn_receipts').select('*, grn_items(*)')
  ]);

  if (!baseProducts) throw new Error("Could not fetch products");

  let totalUpdates = 0;
  const newWarehouseInventory: any[] = [];

  for (const product of baseProducts) {
    const name = String(product.product_name || '').trim().toLowerCase();
    const whBreakdowns: Record<string, any> = {};

    const getWh = (whName: string) => {
      const key = String(whName || 'Global / Unassigned').trim();
      if (!whBreakdowns[key]) {
        whBreakdowns[key] = { opening: 0, purchased: 0, sold: 0, salesReturned: 0, purchaseReturned: 0, hold: 0, rejected: 0 };
      }
      return whBreakdowns[key];
    };

    // 1. Live stock
    let liveStock = 0;
    (openStocks || []).forEach((os: any) => {
      const osName = String(os.product_name || os.item_name || os.itemName || os.item_details || os.itemDetails || '').trim().toLowerCase();
      if (osName === name || osName.includes(name) || name.includes(osName)) {
        const qty = Number(os.quantity || os.qty || 0);
        liveStock += qty;
        getWh(os.warehouse_name || os.location || 'Global / Unassigned').opening += qty;
      }
    });

    // 2. Purchased stock
    let totalPurchased = 0;
    (purchases || []).forEach((p: any) => {
      const termClean = String(p.payment_term || '').trim().toLowerCase();
      const metadata = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
      const hasGrn = metadata?.grn_id || (Array.isArray(metadata?.grn_ids) && metadata.grn_ids.length > 0) || (grnReceipts || []).some((g: any) => (p.purchase_no && g.grn_no?.includes(p.purchase_no)) || (p.id && g.metadata?.linkedPurchaseId === p.id));
      if (termClean !== 'cancel' && termClean !== 'deleted' && termClean !== 'draft' && !hasGrn) {
        const itemsArray = Array.isArray(p.items) ? p.items : JSON.parse(p.items || '[]');
        itemsArray.forEach((item: any) => {
          const pName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
          if (pName === name || pName.includes(name)) {
            const qty = Number(item.qty || item.quantity || 0);
            totalPurchased += qty;
            getWh(item.warehouse || item.location || p.target_warehouse || p.receiving_warehouse || p.warehouse || 'Global / Unassigned').purchased += qty;
          }
        });
      }
    });

    // 2.5 GRN stock
    let totalRejected = 0;
    (grnReceipts || []).forEach((grn: any) => {
      if (grn.status === 'Confirm' || grn.status === 'Partially Received' || grn.status === 'Billed' || grn.status === 'Rejected') {
        (grn.grn_items || []).forEach((item: any) => {
          const pName = String(item.product_name || '').trim().toLowerCase();
          if (pName === name || pName.includes(name)) {
            const accepted = Number(item.accepted_qty ?? (grn.status === 'Partially Received' ? 0 : item.qty) ?? 0);
            const rejected = Number(item.rejected_qty ?? 0);
            const fullQty = accepted + rejected;
            totalPurchased += fullQty;
            totalRejected += rejected;
            const warehouse = item.warehouse_name || grn.target_warehouse || grn.warehouse || 'Global / Unassigned';
            getWh(warehouse).purchased += fullQty;
            getWh(warehouse).rejected += rejected;
          }
        });
      }
    });

    // 3. Sold stock
    let totalSold = 0;
    (sales || []).forEach((s: any) => {
      const statusClean = String(s.sale_status || '').trim().toLowerCase();
      if (statusClean !== 'cancel' && statusClean !== 'deleted') {
        const itemsArray = Array.isArray(s.items) ? s.items : JSON.parse(s.items || '[]');
        itemsArray.forEach((item: any) => {
          const sName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
          if (sName === name || sName.includes(name)) {
            const qty = Number(item.qty || item.quantity || 0);
            totalSold += qty;
            getWh(item.warehouse || item.location || s.dispatch_warehouse || s.warehouse || 'Global / Unassigned').sold += qty;
          }
        });
      }
    });

    // 4. Sales returns
    let totalSalesReturned = 0;
    (sReturns || []).forEach((sr: any) => {
      if (String(sr.status || '').trim().toLowerCase() !== 'cancel') {
        const itemsArray = Array.isArray(sr.items) ? sr.items : JSON.parse(sr.items || '[]');
        itemsArray.forEach((item: any) => {
          const srName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
          if (srName === name || srName.includes(name)) {
            const qty = Number(item.qty || item.quantity || 0);
            totalSalesReturned += qty;
            getWh(item.warehouse || item.location || sr.receiving_warehouse || sr.warehouse || 'Global / Unassigned').salesReturned += qty;
          }
        });
      }
    });

    // 5. Purchase returns
    let totalPurchaseReturned = 0;
    (pReturns || []).forEach((pr: any) => {
      const statusClean = String(pr.status || '').trim().toLowerCase();
      if (statusClean !== 'cancel' && statusClean !== 'deleted') {
        const itemsArray = Array.isArray(pr.items) ? pr.items : JSON.parse(pr.items || '[]');
        itemsArray.forEach((item: any) => {
          const prName = String(item.product_name || item.itemName || item.item_name || '').trim().toLowerCase();
          if (prName === name || prName.includes(name)) {
            const qty = Number(item.qty || item.quantity || 0);
            totalPurchaseReturned += qty;
            getWh(item.warehouse || item.location || pr.dispatch_warehouse || pr.warehouse || 'Global / Unassigned').purchaseReturned += qty;
          }
        });
      }
    });

    // 6. Committed Stock
    let totalHold = 0;
    (deliveryChallans || []).forEach((dc: any) => {
      const statusClean = String(dc.status || '').trim().toLowerCase();
      if (statusClean !== 'cancel' && statusClean !== 'deleted') {
        const itemsArray = Array.isArray(dc.items) ? dc.items : (typeof dc.items === 'string' ? JSON.parse(dc.items || '[]') : []);
        itemsArray.forEach((item: any) => {
          const dcName = String(item.product_name || item.itemName || item.pDescription || '').trim().toLowerCase();
          if (dcName === name || dcName.includes(name)) {
            const orderQty = Number(item.orderQty ?? item.qty ?? 0);
            const dispatchedQty = Number(item.dispatchedQty ?? (statusClean === 'approved' || statusClean === 'dispatched' || statusClean === 'fully dispatched' ? orderQty : 0));
            let holdQty = 0;
            if (statusClean === 'pending approval' || statusClean === 'pending') {
              holdQty = orderQty;
            } else {
              holdQty = Number(item.holdQty !== undefined ? item.holdQty : Math.max(0, orderQty - dispatchedQty));
            }
            totalHold += holdQty;
            getWh(item.warehouse || item.location || dc.dispatch_warehouse || dc.warehouse || 'Global / Unassigned').hold += holdQty;
          }
        });
      }
    });

    const trueRemainingStock = (liveStock + totalPurchased + totalSalesReturned) - totalSold - totalPurchaseReturned - totalRejected;
    const onHandStock = trueRemainingStock + totalHold;

    Object.keys(whBreakdowns).forEach(wh => {
      const w = whBreakdowns[wh];
      const wAvailable = (w.opening + w.purchased + w.salesReturned) - w.sold - w.purchaseReturned - (w.rejected || 0);

      // Add to bulk insert for warehouse_inventory
      if (wAvailable !== 0) {
        newWarehouseInventory.push({
          product_name: product.product_name,
          warehouse_name: wh,
          quantity: wAvailable
        });
      }
    });

    if (Number(product.current_stock) !== trueRemainingStock) {
      await supabase.from('products').update({ current_stock: trueRemainingStock }).eq('id', product.id);
      totalUpdates++;
    }
  }

  console.log(`Rebuilding warehouse_inventory table entirely with ${newWarehouseInventory.length} rows...`);
  const { error: delErr } = await supabase.from('warehouse_inventory').delete().neq('id', 0); // Delete all
  if (delErr) throw delErr;

  const { error: insErr } = await supabase.from('warehouse_inventory').insert(newWarehouseInventory);
  if (insErr) throw insErr;

  console.log(`Inventory fully rebuilt! Updated ${totalUpdates} master products.`);
}

rebuildInventory().catch(console.error);
