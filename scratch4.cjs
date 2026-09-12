const fs = require('fs');
const content = fs.readFileSync('./src/Context/supabaseClient.ts', 'utf8');
const urlMatch = content.match(/supabaseUrl = '([^']+)'/);
const keyMatch = content.match(/supabaseAnonKey = '([^']+)'/);

async function run() {
  if (urlMatch && keyMatch) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    try {
      const { data: stocks, error: e1 } = await supabase.from('opening_stocks').select('*').ilike('product_name', '%PORCP%');
      console.log("OPENING_STOCKS:", JSON.stringify(stocks, null, 2));
      if(e1) console.error("E1:", e1);
    } catch(e) { console.error(e) }
  } else {
    console.log("No match for URL/Key");
  }
}
run();
