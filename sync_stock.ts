import { supabase } from './src/Context/supabaseClient';

async function syncStock() {
  console.log("Fetching all products...");
  const { data: products, error: pErr } = await supabase.from('products').select('id, product_name, current_stock');
  if (pErr) throw pErr;

  console.log(`Found ${products.length} products. Fetching warehouse inventory...`);
  const { data: whInventory, error: wErr } = await supabase.from('warehouse_inventory').select('*');
  if (wErr) throw wErr;

  let updateCount = 0;

  for (const product of products) {
    const partitions = whInventory.filter((w: any) => w.product_name && w.product_name.trim().toLowerCase() === product.product_name.trim().toLowerCase());
    const totalWhQty = partitions.reduce((sum: number, p: any) => sum + (Number(p.quantity) || 0), 0);
    const masterQty = Number(product.current_stock) || 0;

    if (totalWhQty !== masterQty) {
      console.log(`[SYNC] ${product.product_name} | Master: ${masterQty} -> Should be: ${totalWhQty}`);
      
      const { error: updateErr } = await supabase
        .from('products')
        .update({ current_stock: totalWhQty })
        .eq('id', product.id);
        
      if (updateErr) {
        console.error(`Failed to update ${product.product_name}:`, updateErr);
      } else {
        updateCount++;
      }
    }
  }

  console.log(`\nSync Complete! Updated master stock for ${updateCount} products.`);
}

syncStock().catch(console.error);
