import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form, FieldArray } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';

const AddStockTransfer = () => {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);
  const [productList, setProductList] = useState<any[]>([]);

  const location = useLocation();
  const navigate = useNavigate();

  const editData = location.state?.transfer;
  const isEditMode = !!editData;

  useEffect(() => {
    const fetchTransferMetadata = async () => {
      try {
        setMetadataLoading(true);
        const { data: locData } = await supabase.from('inventory_locations').select('id, name').order('name', { ascending: true });
        const { data: prodData } = await supabase.from('products').select('id, product_name, current_stock, uom');

        if (locData) setLocations(locData);
        if (prodData) setProductList(prodData);
      } catch (err: any) {
        toast.error('Failed to load system metadata setup list vectors');
      } finally {
        setMetadataLoading(false);
      }
    };
    fetchTransferMetadata();
  }, []);

  const handleProductSelectionWithWarehouseBalance = async (selectedName: string, index: number, sourceWarehouse: string, setFieldValue: any) => {
    if (!selectedName) {
      setFieldValue(`items.${index}.itemName`, '');
      setFieldValue(`items.${index}.availableQty`, 0);
      return;
    }

    setFieldValue(`items.${index}.itemName`, selectedName);

    if (!sourceWarehouse) {
      setFieldValue(`items.${index}.availableQty`, 0);
      return;
    }

    try {
      const { data: stockRecord, error } = await supabase
        .from('warehouse_inventory')
        .select('quantity')
        .ilike('product_name', selectedName)
        .ilike('warehouse_name', sourceWarehouse)
        .maybeSingle();

      if (error) throw error;
      setFieldValue(`items.${index}.availableQty`, stockRecord ? Number(stockRecord.quantity) : 0);
    } catch (err: any) {
      console.error(err.message);
      setFieldValue(`items.${index}.availableQty`, 0);
    }
  };

  const validationSchema = Yup.object().shape({
    fromLocation: Yup.string().required('Source location is mandatory'),
    toLocation: Yup.string().required('Destination location is mandatory')
      .notOneOf([Yup.ref('fromLocation')], 'Source and Destination warehouses cannot be identical!'),
    transferDate: Yup.string().required('Required'),
    items: Yup.array().of(
      Yup.object().shape({
        itemName: Yup.string().required('Required'),
        qty: Yup.number().typeError('Numeric values only').min(1, 'Min 1').required('Required')
      })
    ).min(1, 'Please add at least one stock row line item')
  });

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['-', 'e', 'E', '+'].includes(e.key) && e.preventDefault();

  if (metadataLoading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
  return (
    <div className="mx-auto max-w-6xl text-xs text-black dark:text-bodydark">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">

        <div className="border-b border-stroke py-4 px-6.5 dark:border-stroke dark:border-strokedark flex justify-between items-center">
          <h3 className="font-semibold text-black dark:text-white text-base">
            {isEditMode ? `View Transfer Slip: ${editData.transfer_no}` : 'Initialize Multi-Warehouse Stock Transfer'}
          </h3>
          <button type="button" onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Administration/StockTransfer/List`)} className="text-sm font-medium text-primary hover:underline">
            Back to History
          </button>
        </div>


        <Formik
          initialValues={isEditMode ? {
            transferNo: editData.transfer_no || '',
            fromLocation: editData.from_location || '',
            toLocation: editData.to_location || '',
            transferDate: editData.transfer_date || '',
            status: editData.status || 'Confirm',
            remarks: editData.remarks || '',
            items: (editData.items || []).map((item: any) => ({
              itemName: item.itemName || '',
              qty: item.qty || 1,
              uom: item.uom || 'Nos',
              availableQty: item.availableQty || 0
            }))
          } : {
            transferNo: `TRF-${Date.now().toString().slice(-6)}`,
            fromLocation: '',
            toLocation: '',
            transferDate: new Date().toISOString().split('T')[0],
            status: 'Confirm',
            remarks: '',
            items: [{ itemName: '', qty: 1, uom: 'Nos', availableQty: 0 }]
          }}
          enableReinitialize={true}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            if (isEditMode && editData.status === 'Confirm') {
              toast.error('Confirmed transfer slips cannot be re-modified or adjusted to prevent accounting lines mismatch fraud.');
              return;
            }

            try {
              setLoading(true);

              for (const item of values.items) {
                const { data: sourceStock } = await supabase
                  .from('warehouse_inventory')
                  .select('quantity')
                  .eq('product_name', item.itemName)
                  .eq('warehouse_name', values.fromLocation)
                  .maybeSingle();

                let availablePoolFunds = 0;
                if (sourceStock) {
                  availablePoolFunds = Number(sourceStock.quantity);
                } else {
                  const localMatch = productList.find(p => p.product_name === item.itemName);
                  availablePoolFunds = localMatch ? Number(localMatch.current_stock) : 0;
                }

                if (availablePoolFunds < Number(item.qty)) {
                  toast.error(`Insufficient Balance: "${item.itemName}" only has ${availablePoolFunds} items left in "${values.fromLocation}" warehouse partition.`);
                  setLoading(false);
                  return;
                }
              }

              for (const item of values.items) {
                const { data: sourceStock } = await supabase
                  .from('warehouse_inventory')
                  .select('id, quantity')
                  .ilike('product_name', item.itemName)
                  .ilike('warehouse_name', values.fromLocation)
                  .maybeSingle();

                if (sourceStock) {
                  await supabase
                    .from('warehouse_inventory')
                    .update({ quantity: Number(sourceStock.quantity) - Number(item.qty) })
                    .eq('id', sourceStock.id);
                } else {
                  const localMatch = productList.find(p => p.product_name === item.itemName);
                  const baseGlobalStock = localMatch ? Number(localMatch.current_stock) : 0;
                  await supabase
                    .from('warehouse_inventory')
                    .insert([{ product_name: item.itemName, warehouse_name: values.fromLocation, quantity: Math.max(0, baseGlobalStock - Number(item.qty)) }]);
                }

                const { data: destStock } = await supabase
                  .from('warehouse_inventory')
                  .select('id, quantity')
                  .ilike('product_name', item.itemName)
                  .ilike('warehouse_name', values.toLocation)
                  .maybeSingle();

                if (destStock) {
                  await supabase
                    .from('warehouse_inventory')
                    .update({ quantity: Number(destStock.quantity) + Number(item.qty) })
                    .eq('id', destStock.id);
                } else {
                  await supabase
                    .from('warehouse_inventory')
                    .insert([{ product_name: item.itemName, warehouse_name: values.toLocation, quantity: Number(item.qty) }]);
                }
              }

              const databasePayload = {
                transfer_no: values.transferNo,
                from_location: values.fromLocation,
                to_location: values.toLocation,
                transfer_date: values.transferDate,
                status: 'Confirm',
                remarks: (values.remarks || '').trim(),
                items: values.items
              };


              const { error } = isEditMode
                ? await supabase.from('stock_transfers').update(databasePayload).eq('id', editData.id)
                : await supabase.from('stock_transfers').insert([databasePayload]);

              if (error) throw error;
              toast.success('Internal stock distribution movement transaction saved successfully!');
              navigate(`${tenantId ? `/${tenantId}` : ''}/Administration/StockTransfer/List`);
            } catch (err: any) {

              toast.error('Transaction Failed: ' + err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ handleChange, values, errors, touched, setFieldValue }) => (
            <Form className="p-6.5 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">Transfer Document #:</label>
                  <input type="text" name="transferNo" readOnly value={values.transferNo} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-gray-50 dark:bg-meta-4/10 font-bold font-mono text-primary outline-none" />
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">Source Warehouse (From): *</label>
                  <select
                    name="fromLocation"
                    disabled={isEditMode}
                    value={values.fromLocation}
                    onChange={async (e) => {
                      const selectedWH = e.target.value;
                      setFieldValue('fromLocation', selectedWH);
                      if (values.items && values.items.length > 0) {
                        for (let idx = 0; idx < values.items.length; idx++) {
                          const rowItem = values.items[idx];
                          if (rowItem.itemName) {
                            if (!selectedWH) {
                              setFieldValue(`items.${idx}.availableQty`, 0);
                            } else {
                              const { data: stockRecord } = await supabase
                                .from('warehouse_inventory')
                                .select('quantity')
                                .ilike('product_name', rowItem.itemName)
                                .ilike('warehouse_name', selectedWH)
                                .maybeSingle();

                              setFieldValue(`items.${idx}.availableQty`, stockRecord ? Number(stockRecord.quantity) : 0);
                            }
                          }
                        }
                      }
                    }}
                    className={`w-full rounded border p-2 bg-transparent outline-none text-black dark:text-white font-semibold focus:border-primary ${touched.fromLocation && errors.fromLocation ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                  >
                    <option value="" className="bg-white dark:bg-boxdark font-semibold text-black dark:text-white text-xs py-1">Select Departure Point</option>
                    {locations.map(l => <option key={l.id} value={l.name} className="bg-white dark:bg-boxdark font-semibold text-black dark:text-white text-xs py-1">{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">Destination Warehouse (To): *</label>
                  <select name="toLocation" disabled={isEditMode} onChange={handleChange} value={values.toLocation} className={`w-full rounded border p-2 bg-transparent outline-none text-black dark:text-white font-semibold focus:border-primary ${touched.toLocation && errors.toLocation ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}>
                    <option value="" className="bg-white dark:bg-boxdark font-semibold text-black dark:text-white text-xs py-1">Select Receiving Destination</option>
                    {locations.map(l => <option key={l.id} value={l.name} className="bg-white dark:bg-boxdark font-semibold text-black dark:text-white text-xs py-1">{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">Transfer Date: *</label>
                  <input type="date" name="transferDate" disabled={isEditMode} onChange={handleChange} value={values.transferDate} className="w-full border border-stroke dark:border-strokedark rounded p-2 bg-transparent outline-none font-bold text-black dark:text-white focus:border-primary" />
                </div>
              </div>

              <div className="border border-stroke dark:border-strokedark rounded p-4">
                <h4 className="font-bold text-primary text-xs uppercase tracking-wide mb-3">Transferred Product Lines Matrix</h4>

                <table className="w-full border-collapse border border-stroke dark:border-strokedark text-center">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-meta-4 font-bold text-black dark:text-white text-xs uppercase border-b border-stroke dark:border-strokedark">
                      <th className="p-2 border border-stroke dark:border-strokedark w-12">S#</th>
                      <th className="p-2 border border-stroke dark:border-strokedark text-left">Select Product Item Designation Label</th>
                      <th className="p-2 border border-stroke dark:border-strokedark w-36">Live Available WH Bal</th>
                      <th className="p-2 border border-stroke dark:border-strokedark w-28">UOM</th>
                      <th className="p-2 border border-stroke dark:border-strokedark w-32">Transfer Qty</th>
                      <th className="p-2 border border-stroke dark:border-strokedark w-12"></th>
                    </tr>
                  </thead>
                  <FieldArray name="items">
                    {({ push, remove }) => (
                      <tbody>
                        {values.items.map((item: any, index: number) => {
                          const matchedProdObject = productList.find(p => p.product_name === item.itemName);
                          const currentUomString = matchedProdObject ? matchedProdObject.uom : 'Nos';

                          return (
                            <tr key={index} className="bg-white dark:bg-boxdark text-xs border-b border-stroke dark:border-strokedark text-black dark:text-white">
                              <td className="p-2 border border-stroke dark:border-strokedark font-medium">{index + 1}</td>
                              <td className="p-2 border border-stroke dark:border-strokedark">
                                <select
                                  name={`items.${index}.itemName`}
                                  disabled={isEditMode}
                                  value={item.itemName}
                                  onChange={(e) => {
                                    handleProductSelectionWithWarehouseBalance(e.target.value, index, values.fromLocation, setFieldValue);
                                    const selectObj = productList.find(p => p.product_name === e.target.value);
                                    if (selectObj) setFieldValue(`items.${index}.uom`, selectObj.uom || 'Nos');
                                  }}
                                  className="w-full rounded border p-2 bg-transparent outline-none focus:border-primary font-bold text-black dark:text-white border-stroke dark:border-strokedark"
                                >
                                  <option value="" className="bg-white dark:bg-boxdark font-semibold text-black dark:text-white text-xs py-1">Pick Product</option>
                                  {productList.map(p => <option key={p.id} value={p.product_name} className="bg-white dark:bg-boxdark font-semibold text-black dark:text-white text-xs py-1">{p.product_name}</option>)}
                                </select>
                              </td>
                              <td className="p-2 border border-stroke dark:border-strokedark font-bold text-success font-mono text-center w-36 text-sm">
                                {Number(item.availableQty || 0).toLocaleString()}
                              </td>
                              <td className="p-2 border border-stroke dark:border-strokedark text-gray-400 font-semibold w-28 uppercase">{currentUomString}</td>
                              <td className="p-2 border border-stroke dark:border-strokedark w-32">
                                <input
                                  type="number"
                                  name={`items.${index}.qty`}
                                  disabled={isEditMode}
                                  onKeyDown={blockInvalidChar}
                                  onChange={handleChange}
                                  value={item.qty}
                                  className="w-full text-center outline-none border border-stroke rounded p-1 font-bold text-black dark:text-white bg-transparent focus:border-primary dark:border-strokedark"
                                />
                              </td>
                              <td className="p-2 border border-stroke dark:border-strokedark text-center w-12">
                                {!isEditMode && values.items.length > 1 && (
                                  <button type="button" onClick={() => remove(index)} className="text-red-500 font-bold hover:scale-110 duration-100 cursor-pointer">✕</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {!isEditMode && (
                          <tr>
                            <td colSpan={6} className="p-2 text-left bg-gray-50/10">
                              <button type="button" onClick={() => push({ itemName: '', qty: 1, uom: 'Nos', availableQty: 0 })} className="text-success font-bold hover:underline cursor-pointer">+ Append Item Row</button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    )}
                  </FieldArray>
                </table>
              </div>

              <div>
                <label className="block text-gray-500 dark:text-gray-400 mb-1 font-medium">Transaction Remarks / Internal Tracking Notes:</label>
                <input type="text" name="remarks" disabled={isEditMode} onChange={handleChange} value={values.remarks} className="w-full border border-stroke dark:border-strokedark rounded p-2.5 bg-transparent outline-none focus:border-primary text-black dark:text-white" placeholder="Enter reason description details..." />
              </div>


              {/* ✅ MODIFIED RIGHT-ALIGNED BUTTON ROW CONTAINER */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-stroke dark:border-strokedark">
                <button
                  type="button"
                  onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Administration/StockTransfer/List`)}
                  className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                >
                  {isEditMode ? 'Close View' : 'Cancel'}
                </button>
                {!isEditMode && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                  >
                    {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>Dispatch Stock</span>}
                  </button>
                )}
              </div>

            </Form>
          )}
        </Formik>


      </div>
    </div>
  );
};

export default AddStockTransfer;
