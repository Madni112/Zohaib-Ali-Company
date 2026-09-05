import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDCErrors() {
  const { data, error } = await supabase.from('delivery_challans').insert([{
    invoice_no: 'test-123',
    customer_name: 'test',
    shipping_address: 'test',
    challan_date: new Date().toISOString().split('T')[0],
    dispatch_warehouse: 'test',
    transport_name: 'test',
    transportation: 'test',
    po_no: 'test',
    po_date: null,
    vehicle_no: 'test',
    remarks: 'test',
    total_quantity: 1,
    total_amount: 1,
    total_discount: 0,
    total_net_amount: 1,
    status: 'Pending Approval',
    items: []
  }]);

  console.log('Error:', error);
}

checkDCErrors();
