import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wpzwntbgpeiiclytuuht.supabase.co';
const supabaseKey = 'sb_publishable_IpW1ssWRf1_q6-J0hvXTzA_kVDyZcjy';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const mapping = {
    'A-Assets': '1. ASSETS',
    'L-Liabilities': '2. LIABILITIES',
    'Equity/Capital': '3. EQUITY',
    'Income': '4. REVENUE',
    'Expenses': '5. EXPENSES'
  };

  for (const [oldName, newName] of Object.entries(mapping)) {
    console.log(`Migrating ${oldName} to ${newName}`);
    await supabase.from('chart_of_accounts').update({ category_code: newName }).eq('category_code', oldName);
    await supabase.from('coa_categories').update({ name: newName }).eq('name', oldName);
    await supabase.from('coa_controls').update({ category_name: newName }).eq('category_name', oldName);
  }
  console.log('Migration done');
}
run();
