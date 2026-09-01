import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { FiArrowLeft, FiCheckCircle } from 'react-icons/fi';

const AddVendor = () => {
  const [loading, setLoading] = useState(false);
  const { tenantId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const editData = location.state?.vendorRecord || location.state?.vendor;
  const isEditMode = !!editData;

  const validationSchema = Yup.object().shape({
    vendorName: Yup.string().required('Vendor Name is required'),
    cellNo: Yup.string().nullable(),
    email: Yup.string().email('Please enter a valid email address').nullable()
  });

  return (
    <div className="mx-auto max-w-4xl text-black dark:text-bodydark text-xs pb-12">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        
        {/* Header Bar */}
        <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
          <div>
            <h3 className="font-bold text-black dark:text-white text-base">
              {isEditMode ? `Modify Vendor: ${editData?.vendor_name || editData?.name}` : 'Add New Commercial Vendor'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Register wholesale suppliers and factory merchant accounts</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Vendor/List`)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20"
          >
            <FiArrowLeft size={14} /> Back to Vendor Directory
          </button>
        </div>

        <Formik
          initialValues={{
            vendorName: editData?.vendor_name || editData?.name || '',
            contactName: editData?.contact_name || '',
            cellNo: editData?.cell_no || editData?.phone || '',
            phoneNo: editData?.phone_no || '',
            email: editData?.email || '',
            address: editData?.address || ''
          }}
          enableReinitialize={true}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            try {
              setLoading(true);

              const databasePayload = {
                vendor_name: values.vendorName.trim(),
                name: values.vendorName.trim(),
                contact_name: values.contactName.trim() || null,
                cell_no: values.cellNo.trim() || null,
                phone: values.cellNo.trim() || null,
                phone_no: values.phoneNo.trim() || null,
                email: values.email.trim() || null,
                address: values.address.trim() || null
              };

              const { error } = isEditMode
                ? await supabase.from('vendors').update(databasePayload).eq('id', editData.id)
                : await supabase.from('vendors').insert([databasePayload]);

              if (error) throw error;

              toast.success(isEditMode ? 'Vendor profile updated successfully!' : 'New vendor registered successfully!');
              navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Vendor/List`);
            } catch (err: any) {
              toast.error('Transaction Error: ' + err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ handleChange, values, errors, touched }) => (
            <Form className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="md:col-span-2">
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Vendor Corporate Name: *</label>
                  <input
                    type="text"
                    name="vendorName"
                    onChange={handleChange}
                    value={values.vendorName}
                    className={`w-full rounded border px-3 h-10 bg-white dark:bg-boxdark text-xs font-bold text-black dark:text-white outline-none focus:border-primary ${touched.vendorName && errors.vendorName ? 'border-red-500 bg-red-50/10' : 'border-stroke dark:border-strokedark'}`}
                    placeholder="e.g., Master Tiles & Ceramics / Sonex Sanitary"
                  />
                  {touched.vendorName && errors.vendorName && <p className="text-red-500 font-bold text-[10px] mt-1">{String(errors.vendorName)}</p>}
                </div>

                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Contact Person / Representative:</label>
                  <input
                    type="text"
                    name="contactName"
                    onChange={handleChange}
                    value={values.contactName}
                    className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-medium text-black dark:text-white outline-none focus:border-primary"
                    placeholder="e.g., M. Tariq (Manager)"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Mobile / WhatsApp No.:</label>
                  <input
                    type="text"
                    name="cellNo"
                    onChange={(e) => {
                      e.target.value = e.target.value.replace(/[^0-9]/g, '');
                      handleChange(e);
                    }}
                    value={values.cellNo}
                    className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-bold font-mono text-black dark:text-white outline-none focus:border-primary"
                    placeholder="e.g., 0300-1234567"
                  />
                </div>


                <div>
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Email Address (Optional):</label>
                  <input
                    type="email"
                    name="email"
                    onChange={handleChange}
                    value={values.email}
                    className={`w-full rounded border px-3 h-10 bg-white dark:bg-boxdark text-xs text-black dark:text-white outline-none focus:border-primary ${touched.email && errors.email ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                    placeholder="vendor@domain.com"
                  />
                  {touched.email && errors.email && <p className="text-red-500 font-bold text-[10px] mt-1">{String(errors.email)}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Business / Factory Physical Address:</label>
                  <input
                    type="text"
                    name="address"
                    onChange={handleChange}
                    value={values.address}
                    className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs text-black dark:text-white outline-none focus:border-primary"
                    placeholder="Plot reference, industrial area, city..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stroke dark:border-strokedark">
                <button
                  type="button"
                  onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Vendor/List`)}
                  className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                >
                  {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <><FiCheckCircle size={15} /> <span>{isEditMode ? 'Update Vendor Account' : 'Save Vendor Profile'}</span></>}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default AddVendor;
