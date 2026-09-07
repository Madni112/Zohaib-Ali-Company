import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStock() {
  const { data, error } = await supabase
    .from('warehouse_inventory')
    .select('*')
    .ilike('warehouse_name', '%A-39%');
    
  console.log("Error:", error);
  console.log("Data for A-39:", JSON.stringify(data, null, 2));
  
  const { data: pData } = await supabase
    .from('warehouse_inventory')
    .select('*')
    .ilike('product_name', '%COMMODE%');
    
  console.log("Data for COMMODE:", JSON.stringify(pData, null, 2));
}

checkStock();
