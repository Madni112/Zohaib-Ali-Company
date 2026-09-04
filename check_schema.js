import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data: categories } = await supabase.from('inventory_categories').select('*').limit(1);
  console.log("Categories schema:", Object.keys(categories?.[0] || {}));

  const { data: products } = await supabase.from('products').select('*').limit(1);
  console.log("Products schema:", Object.keys(products?.[0] || {}));
}

checkSchema();
