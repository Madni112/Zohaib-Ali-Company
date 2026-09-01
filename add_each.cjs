const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://wpzwntbgpeiiclytuuht.supabase.co', 'sb_publishable_IpW1ssWRf1_q6-J0hvXTzA_kVDyZcjy');

async function run() {
  const { data, error } = await supabase.from('inventory_uom').insert([
    {
      tenant_id: 'bashir',
      short_code: 'EACH',
      full_name: 'Each',
      category: 'PACKAGING UNITS',
      is_active: true
    }
  ]);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully inserted EACH UOM.');
  }
}
run();
