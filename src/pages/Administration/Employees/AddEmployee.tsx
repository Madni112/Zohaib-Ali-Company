import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';

const AddEmployee = () => {
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [designations, setDesignations] = useState<any[]>([]);

  const location = useLocation();
  const navigate = useNavigate();

  const editData = location.state?.employee;
  const isEditMode = !!editData;

  useEffect(() => {
    const fetchActiveDesignations = async () => {
      try {
        setMetadataLoading(true);
        const { data } = await supabase
          .from('hr_designations')
          .select('id, title')
          .order('title', { ascending: true });
        if (data) setDesignations(data);
      } catch (err: any) {
        console.error('Metadata retrieval failure:', err.message);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchActiveDesignations();
  }, []);

  const validationSchema = Yup.object().shape({
    name: Yup.string().required('Employee name field is mandatory'),
    designation: Yup.string().required('Role assignment is mandatory'),
    gender: Yup.string().required('Required'),
    joiningDate: Yup.string().required('Required'),
    phone: Yup.string().matches(/^[0-9+]*$/, 'Must be a valid telephone value').nullable(),
    cnic: Yup.string().nullable(),
    address: Yup.string().nullable()
  });

  if (metadataLoading) {
    return (
      <div className="flex h-48 items-center justify-center bg-white dark:bg-boxdark rounded border border-stroke">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        
        <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
          <h3 className="font-semibold text-black dark:text-white text-base">
            {isEditMode ? `Modify Employee Account: ${editData.name}` : 'Register New Staff Employee'}
          </h3>
          <button
            type="button"
            onClick={() => navigate('/Administration/Employees/List')}
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to Directory
          </button>
        </div>

        <Formik
          initialValues={isEditMode ? {
            name: editData.name || '',
            designation: editData.designation || '',
            phone: editData.phone || '',
            cnic: editData.cnic || '',
            gender: editData.gender || 'Male',
            joiningDate: editData.joining_date || '',
            address: editData.address || ''
          } : {
            name: '',
            designation: '',
            phone: '',
            cnic: '',
            gender: 'Male',
            joiningDate: new Date().toISOString().split('T')[0], 
            address: ''
          }}
          enableReinitialize={true}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            setLoading(true);

            const databasePayload = {
              name: values.name.trim(),
              designation: values.designation,
              phone: values.phone.trim(),
              cnic: values.cnic.trim(),
              gender: values.gender,
              joining_date: values.joiningDate,
              address: values.address.trim()
            };

            try {
              if (isEditMode) {
                const { error } = await supabase
                  .from('hr_employees')
                  .update(databasePayload)
                  .eq('id', editData.id);

                if (error) throw error;
                toast.success('Employee profile logs updated successfully!');
              } else {
                const { error } = await supabase
                  .from('hr_employees')
                  .insert([databasePayload]);

                if (error) throw error;
                toast.success('Employee card added to live ledger database successfully!');
              }
              navigate('/Administration/Employees/List');
            } catch (err: any) {
              toast.error('DB Operation Error: ' + err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ handleChange, values, errors, touched }) => (
            <Form className="p-6.5 text-xs text-gray-600 dark:text-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                
                <div>
                  <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Employee Full Name: *</label>
                  {/* FIXED: Removed typo token completely and enforced standardized h-10 box height metrics matching other form components */}
                  <input 
                    type="text" 
                    name="name" 
                    onChange={handleChange} 
                    value={values.name} 
                    className={`w-full rounded border px-3 h-10 outline-none focus:border-primary bg-transparent text-xs font-bold text-black dark:text-white ${touched.name && errors.name ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} 
                    placeholder="Enter full legal identification name" 
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Assigned Designation Role: *</label>
                  <select 
                    name="designation" 
                    onChange={handleChange} 
                    value={values.designation} 
                    className={`w-full rounded border px-3 h-10 bg-transparent outline-none focus:border-primary text-xs font-semibold text-black dark:text-white ${touched.designation && errors.designation ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                  >
                    <option value="" className="dark:bg-boxdark">-- Select Designation Rank --</option>
                    {designations.map(d => (
                      <option key={d.id} value={d.title} className="dark:bg-boxdark">{d.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Gender: *</label>
                  <select 
                    name="gender" 
                    onChange={handleChange} 
                    value={values.gender} 
                    className={`w-full rounded border px-3 h-10 bg-transparent outline-none focus:border-primary text-xs font-semibold text-black dark:text-white border-stroke dark:border-strokedark`}
                  >
                    <option className="dark:bg-boxdark" value="Male">Male</option>
                    <option className="dark:bg-boxdark" value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Joining Date: *</label>
                  <input 
                    type="date" 
                    name="joiningDate" 
                    onChange={handleChange} 
                    value={values.joiningDate} 
                    className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-transparent outline-none focus:border-primary text-xs font-semibold text-black dark:text-white" 
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Phone Number:</label>
                  <input 
                    type="text" 
                    name="phone" 
                    onChange={handleChange} 
                    value={values.phone} 
                    className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-transparent outline-none focus:border-primary text-xs text-black dark:text-white" 
                    placeholder="e.g., 03001234567" 
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">CNIC Identification Number:</label>
                  <input 
                    type="text" 
                    name="cnic" 
                    onChange={handleChange} 
                    value={values.cnic} 
                    className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-transparent outline-none focus:border-primary text-xs text-black dark:text-white" 
                    placeholder="e.g., 41303-1234567-1" 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Residential Address:</label>
                  <input 
                    type="text" 
                    name="address" 
                    onChange={handleChange} 
                    value={values.address} 
                    className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-transparent outline-none focus:border-primary text-xs text-black dark:text-white" 
                    placeholder="Enter permanent house street/city address lines" 
                  />
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-stroke dark:border-strokedark">
                <button
                  type="button"
                  onClick={() => navigate('/Administration/Employees/List')}
                  className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                >
                  {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Employee Details' : 'Save Employee Card'}</span>}
                </button>
              </div>

            </Form>
          )}
        </Formik>

      </div>
    </div>
  );
};

export default AddEmployee;
