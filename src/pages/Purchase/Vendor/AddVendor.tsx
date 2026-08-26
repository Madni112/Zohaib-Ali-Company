import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { useAuth } from '../../../Context/Auth';
import { FiArrowLeft, FiCheckCircle, FiUser, FiCreditCard, FiDollarSign } from 'react-icons/fi';

const AddVendor = () => {
  const [loading, setLoading] = useState(false);
  const { tenantId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const editData = location.state?.vendorRecord || location.state?.vendor;
  const isEditMode = !!editData;

  const validationSchema = Yup.object().shape({
    vendorName: Yup.string().required('Vendor / Factory Corporate Name is required'),
    cellNo: Yup.string().nullable(),
    email: Yup.string().email('Please enter a valid email address').nullable(),
    openingBalance: Yup.number().typeError('Must be numeric').min(0, 'Cannot be negative').nullable()
  });

  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) =>
    ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault();

  return (
    <div className="mx-auto max-w-5xl text-black dark:text-bodydark text-xs pb-12">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        
        {/* Header Bar */}
        <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="font-bold text-black dark:text-white text-base">
              {isEditMode ? `Modify Vendor Profile: ${editData?.vendor_name || editData?.name}` : 'Register New Commercial Vendor'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Manage factory suppliers, tile & sanitary manufacturers, opening ledger, and credit terms</p>
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
            category: editData?.category || 'Tiles & Ceramics',
            cellNo: editData?.cell_no || editData?.phone || '',
            phoneNo: editData?.phone_no || '',
            email: editData?.email || '',
            city: editData?.city || 'Gujranwala',
            address: editData?.address || '',
            openingBalance: Number(editData?.opening_balance ?? editData?.balance ?? 0),
            balanceType: editData?.balance_type || 'Payable',
            creditTerms: editData?.credit_terms || 'Cash on Delivery',
            bankName: editData?.bank_name || '',
            accountTitle: editData?.account_title || '',
            accountNo: editData?.account_no || ''
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
                category: values.category || 'Tiles & Ceramics',
                cell_no: values.cellNo.trim() || null,
                phone: values.cellNo.trim() || null,
                phone_no: values.phoneNo.trim() || null,
                email: values.email.trim() || null,
                city: values.city.trim() || null,
                address: values.address.trim() || null,
                opening_balance: Number(values.openingBalance || 0),
                balance: Number(values.openingBalance || 0),
                balance_type: values.balanceType,
                credit_terms: values.creditTerms,
                bank_name: values.bankName.trim() || null,
                account_title: values.accountTitle.trim() || null,
                account_no: values.accountNo.trim() || null
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
            <Form className="p-6 space-y-6">
              
              {/* Section 1: Business Identity & Contact */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-stroke dark:border-strokedark text-primary font-bold text-xs">
                  <FiUser size={16} /> <span>1. Corporate Identity & Contact Details</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-gray-500 mb-1.5 font-bold">Vendor / Factory Corporate Name: *</label>
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
                    <label className="block text-gray-500 mb-1.5 font-bold">Supply Line / Category:</label>
                    <select
                      name="category"
                      onChange={handleChange}
                      value={values.category}
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-bold text-black dark:text-white outline-none focus:border-primary"
                    >
                      <option value="Tiles & Ceramics">Tiles & Ceramics</option>
                      <option value="Sanitary Ware & Fittings">Sanitary Ware & Fittings</option>
                      <option value="Hardware & Tools">Hardware & Tools</option>
                      <option value="Pipes & Bath Accessories">Pipes & Bath Accessories</option>
                      <option value="Imported Granite & Marble">Imported Granite & Marble</option>
                      <option value="General Procurement">General Procurement</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Contact Person / Representative:</label>
                    <input
                      type="text"
                      name="contactName"
                      onChange={handleChange}
                      value={values.contactName}
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-semibold text-black dark:text-white outline-none focus:border-primary"
                      placeholder="e.g., M. Tariq (Sales Manager)"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Mobile / WhatsApp Cell No.:</label>
                    <input
                      type="text"
                      name="cellNo"
                      onChange={handleChange}
                      value={values.cellNo}
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-bold font-mono text-black dark:text-white outline-none focus:border-primary"
                      placeholder="e.g., 0300-1234567"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Landline / Office Phone:</label>
                    <input
                      type="text"
                      name="phoneNo"
                      onChange={handleChange}
                      value={values.phoneNo}
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs text-black dark:text-white outline-none focus:border-primary"
                      placeholder="e.g., 055-3850000"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Corporate Email Address (Optional):</label>
                    <input
                      type="email"
                      name="email"
                      onChange={handleChange}
                      value={values.email}
                      className={`w-full rounded border px-3 h-10 bg-white dark:bg-boxdark text-xs text-black dark:text-white outline-none focus:border-primary ${touched.email && errors.email ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                      placeholder="orders@mastertiles.com"
                    />
                    {touched.email && errors.email && <p className="text-red-500 font-bold text-[10px] mt-1">{String(errors.email)}</p>}
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">City / Industrial Hub:</label>
                    <select
                      name="city"
                      onChange={handleChange}
                      value={values.city}
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-bold text-black dark:text-white outline-none focus:border-primary"
                    >
                      <option value="Gujranwala">Gujranwala</option>
                      <option value="Lahore">Lahore</option>
                      <option value="Karachi">Karachi</option>
                      <option value="Rawalpindi">Rawalpindi</option>
                      <option value="Islamabad">Islamabad</option>
                      <option value="Faisalabad">Faisalabad</option>
                      <option value="Multan">Multan</option>
                      <option value="Peshawar">Peshawar</option>
                      <option value="Sialkot">Sialkot</option>
                      <option value="Other">Other / International</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-gray-500 mb-1.5 font-bold">Physical Factory / Warehouse Address:</label>
                    <input
                      type="text"
                      name="address"
                      onChange={handleChange}
                      value={values.address}
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs text-black dark:text-white outline-none focus:border-primary"
                      placeholder="e.g., G.T. Road, Industrial Estate, Gujranwala"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Opening Ledger & Credit Terms */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-stroke dark:border-strokedark text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <FiDollarSign size={16} /> <span>2. Opening Balance Ledger & Credit Terms</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Opening Ledger Balance (PKR):</label>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={blockInvalidChar}
                      name="openingBalance"
                      onChange={handleChange}
                      value={values.openingBalance === 0 ? '' : values.openingBalance}
                      placeholder="0.00"
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-black font-mono text-black dark:text-white outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Balance Nature / Type:</label>
                    <select
                      name="balanceType"
                      onChange={handleChange}
                      value={values.balanceType}
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-bold text-black dark:text-white outline-none focus:border-primary"
                    >
                      <option value="Payable">Payable (We Owe Vendor / Credit Balance)</option>
                      <option value="Advance">Advance (Vendor Owes Us / Debit Balance)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Standard Payment / Credit Terms:</label>
                    <select
                      name="creditTerms"
                      onChange={handleChange}
                      value={values.creditTerms}
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-bold text-black dark:text-white outline-none focus:border-primary"
                    >
                      <option value="Cash on Delivery">Cash on Delivery (Immediate Settlement)</option>
                      <option value="7 Days Credit">7 Days Credit</option>
                      <option value="15 Days Credit">15 Days Credit</option>
                      <option value="30 Days Credit">30 Days Credit (Monthly)</option>
                      <option value="45 Days Credit">45 Days Credit</option>
                      <option value="60 Days Credit">60 Days Credit</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Vendor Receiving Bank Details */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-stroke dark:border-strokedark text-blue-600 dark:text-blue-400 font-bold text-xs">
                  <FiCreditCard size={16} /> <span>3. Vendor Receiving Bank Coordinates (For Direct Wire / Cheque Settlements)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Receiving Bank Name:</label>
                    <input
                      type="text"
                      name="bankName"
                      onChange={handleChange}
                      value={values.bankName}
                      placeholder="e.g., Meezan Bank / HBL / Bank Alfalah"
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-semibold text-black dark:text-white outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Account Title:</label>
                    <input
                      type="text"
                      name="accountTitle"
                      onChange={handleChange}
                      value={values.accountTitle}
                      placeholder="e.g., Master Ceramics Industries Ltd"
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-semibold text-black dark:text-white outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 mb-1.5 font-bold">Account Number / IBAN:</label>
                    <input
                      type="text"
                      name="accountNo"
                      onChange={handleChange}
                      value={values.accountNo}
                      placeholder="e.g., PK36MEZN00012345678901"
                      className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-white dark:bg-boxdark text-xs font-mono font-bold text-black dark:text-white outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-stroke dark:border-strokedark">
                <button
                  type="button"
                  onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/Vendor/List`)}
                  className="rounded bg-slate-100 dark:bg-slate-800 py-2.5 px-6 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition text-xs shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 bg-primary text-white py-2.5 px-8 rounded font-bold text-xs hover:bg-opacity-90 transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <><FiCheckCircle size={14} /> {isEditMode ? 'Update Vendor Account' : 'Save Vendor Profile'}</>}
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
