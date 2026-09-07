import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDCs() {
  console.log("Fetching all Delivery Challans...");
  const { data: challans, error } = await supabase.from('delivery_challans').select('*');
  
  if (error) {
    console.error("Error fetching challans:", error);
    return;
  }

  let fixedCount = 0;

  for (const c of challans) {
    if (!c.items || !Array.isArray(c.items)) continue;
    
    let needsUpdate = false;
    const updatedItems = c.items.map(item => {
      // If holdQty is 0 but orderQty > dispatchedQty, it means it spawned a sub-challan
      // and we need to fix the double count!
      if (item.holdQty === 0 && Number(item.orderQty) > Number(item.dispatchedQty)) {
        needsUpdate = true;
        return {
          ...item,
          orderQty: Number(item.dispatchedQty || 0),
          qty: Number(item.dispatchedQty || 0)
        };
      }
      return item;
    });

    if (needsUpdate) {
      console.log(`Fixing double-count for Challan: ${c.challan_no || c.id}`);
      const { error: updateErr } = await supabase
        .from('delivery_challans')
        .update({ items: updatedItems })
        .eq('id', c.id);
        
      if (updateErr) {
        console.error(`Failed to update ${c.challan_no}:`, updateErr);
      } else {
        fixedCount++;
      }
    }
  }

  console.log(`Finished! Fixed ${fixedCount} historical Delivery Challans.`);
}

fixDCs();
