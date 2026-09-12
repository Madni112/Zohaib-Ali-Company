const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://wpzwntbgpeiiclytuuht.supabase.co',
  'sb_publishable_IpW1ssWRf1_q6-J0hvXTzA_kVDyZcjy'
);

async function run() {
  // Get all opening stocks - no filter
  const { data: all, error } = await supabase.from('opening_stocks').select('id, product_name, itemName, quantity, qty, location, warehouse_name').limit(10);
  console.log("FIRST 10 opening_stocks:", JSON.stringify(all, null, 2));
  if (error) console.error("Error:", error);
  
  // Count total
  const { count } = await supabase.from('opening_stocks').select('id', { count: 'exact', head: true });
  console.log("Total opening_stocks count:", count);
}
run();
