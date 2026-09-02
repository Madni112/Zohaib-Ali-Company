const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const code = fs.readFileSync('src/Context/supabaseClient.ts', 'utf8');
const urlMatch = code.match(/supabaseUrl\s*=\s*['"`]([^'"`]+)/);
const keyMatch = code.match(/supabaseAnonKey\s*=\s*['"`]([^'"`]+)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
supabase.from('products').select('*').order('created_at', {ascending: false}).limit(5).then(res => {
  if (res.error) console.error(res.error);
  else console.log(JSON.stringify(res.data, null, 2));
});
