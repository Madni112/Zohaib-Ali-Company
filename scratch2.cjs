const fs = require('fs');
const content = fs.readFileSync('./src/Context/supabaseClient.ts', 'utf8');
const urlMatch = content.match(/supabaseUrl = '([^']+)'/);
const keyMatch = content.match(/supabaseAnonKey = '([^']+)'/);

if (urlMatch && keyMatch) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  supabase.from('opening_stocks').select('*').ilike('product_name', '%PORCP%').then(res => {
    console.log("OPENING_STOCKS:");
    console.log(JSON.stringify(res.data, null, 2));
  });
}
