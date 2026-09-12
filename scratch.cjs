const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_KEY';

// I will just read the actual keys from Context/supabaseClient.ts
const fs = require('fs');
const content = fs.readFileSync('./src/Context/supabaseClient.ts', 'utf8');
const urlMatch = content.match(/supabaseUrl = '([^']+)'/);
const keyMatch = content.match(/supabaseAnonKey = '([^']+)'/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  supabase.from('opening_stocks').select('product_name, itemName, quantity, qty, location, warehouse_name').then(res => {
    console.log(JSON.stringify(res, null, 2));
  });
}
