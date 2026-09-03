import React, { useState } from 'react';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

const BulkProductUpload = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const parsedData = XLSX.utils.sheet_to_json(sheet);
        setData(parsedData);
        toast.success(`Parsed ${parsedData.length} rows successfully!`);
      } catch (err: any) {
        toast.error('Error parsing file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUpload = async () => {
    if (data.length === 0) {
      toast.error('No data to upload');
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    const suffixRegex = /[\.\-\s]*(a39|shop)\s*$/i;

    const cleanedRows = data.map(row => {
      return {
        ...row,
        CODE: String(row['CODE'] || '').replace(suffixRegex, '').trim(),
        DESCRIPTION: String(row['DESCRIPTION'] || '').replace(suffixRegex, '').trim()
      };
    });

    const uniqueMap = new Map();
    for (const row of cleanedRows) {
      const key = row['CODE'] || row['DESCRIPTION'];
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, row);
      }
    }
    
    const uniqueData = Array.from(uniqueMap.values());

    const payload = uniqueData.map(row => ({
      product_name: row['DESCRIPTION'],
      item_sr_no: row['CODE'],
      bin: String(row['Bin'] || '').trim(),
      purchase_price: Number(row['Purchase Price']) || 0,
      retail_price: Number(row['Sales Price']) || 0,
      mrp: Number(row['Sales Price']) || 0,
      uom: String(row['UOM'] || 'PCS').trim(),
      min_stock_alert: Number(row['Minimum']) || 0,
      category: 'General',
      pieces_per_box: 1,
      pcs_per_box: 1,
      pieces_per_packing: 1,
      profit: (Number(row['Sales Price']) || 0) - (Number(row['Purchase Price']) || 0)
    })).filter(p => p.product_name); // Only include rows with a description

    try {
      // Chunking for large files to avoid timeout
      const chunkSize = 500;
      let lastErrorMsg = '';
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from('products').insert(chunk);
        
        if (error) {
          console.error(error);
          lastErrorMsg = error.message;
          errorCount += chunk.length;
        } else {
          successCount += chunk.length;
        }
      }

      if (errorCount === 0) {
        toast.success(`Successfully uploaded ${successCount} products!`);
        setData([]); // clear data
      } else {
        toast.error(`Failed to upload. Error: ${lastErrorMsg}`);
      }
    } catch (err: any) {
      toast.error('Bulk insert failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-slate-800 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Bulk Product Upload
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Upload products from Excel/CSV</p>
        </div>
        <button
          onClick={() => navigate('/Administration/Products/List')}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
        >
          Back to Products
        </button>
      </div>

      <div className="bg-white dark:bg-boxdark rounded-2xl shadow-sm border border-slate-200 dark:border-strokedark p-6 flex flex-col gap-6">
        <div>
          <label className="block text-sm font-semibold mb-2">Select Excel File (.xlsx, .csv)</label>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileUpload}
            className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
          />
        </div>

        {data.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Preview ({data.length} rows)</h3>
              <button
                onClick={handleUpload}
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? 'Uploading...' : 'Confirm & Upload to Database'}
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-strokedark rounded-xl max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-300">
              <table className="w-full whitespace-nowrap text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-meta-4 shadow-sm z-10">
                  <tr>
                    <th className="py-3 px-4 text-xs font-black uppercase text-slate-500">CODE</th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-slate-500">DESCRIPTION</th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-slate-500">Bin</th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-slate-500 text-right">Purchase Price</th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-slate-500 text-right">Sales Price</th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-slate-500">UOM</th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-slate-500 text-right">Minimum</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/30 text-sm">
                      <td className="py-2.5 px-4 font-mono">{row['CODE'] || '-'}</td>
                      <td className="py-2.5 px-4 font-semibold truncate max-w-xs" title={row['DESCRIPTION']}>{row['DESCRIPTION'] || '-'}</td>
                      <td className="py-2.5 px-4">{row['Bin'] || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{Number(row['Purchase Price'] || 0).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600">{Number(row['Sales Price'] || 0).toFixed(2)}</td>
                      <td className="py-2.5 px-4">{row['UOM'] || 'PCS'}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{row['Minimum'] || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 100 && (
                <div className="p-3 text-center text-xs text-slate-500 font-semibold bg-slate-50 dark:bg-meta-4/30">
                  Showing first 100 rows only...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkProductUpload;
