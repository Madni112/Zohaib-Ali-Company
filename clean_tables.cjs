const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://wpzwntbgpeiiclytuuht.supabase.co', 'sb_publishable_IpW1ssWRf1_q6-J0hvXTzA_kVDyZcjy');

async function clean() {
  console.log("Cleaning products...");
  const p = await supabase.from('products').delete().not('id', 'is', null);
  console.log("Products deleted:", p.error || "Success");

  console.log("Cleaning delivery_challans...");
  const d = await supabase.from('delivery_challans').delete().not('id', 'is', null);
  console.log("DC deleted:", d.error || "Success");
}
clean();
