import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';

const AddTransportation = () => {
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const editData = location.state?.vehicle; // Handles edit mode references seamlessly
    const isEditMode = !!editData;

    const validationSchema = Yup.object().shape({
        name: Yup.string().required('Transport agency name is mandatory'),
        contactNumber: Yup.string().required('Contact number is mandatory'),
        email: Yup.string().email('Must be a valid email format').nullable(),
        address: Yup.string().nullable()
    });

    return (
        <div className="mx-auto max-w-4xl">
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">

                <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
                    <h3 className="font-semibold text-black dark:text-white text-base">
                        {isEditMode ? `Modify Transportation: ${editData.name}` : 'Add Transportation'}
                    </h3>
                    <button
                        type="button"
                        onClick={() => navigate('/Administration/Transportation/List')}
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        Back to Directory
                    </button>
                </div>

                <Formik
                    initialValues={isEditMode ? {
                        name: editData.name || '',
                        contactNumber: editData.contact_number || '',
                        email: editData.email || '',
                        address: editData.address || ''
                    } : {
                        name: '',
                        contactNumber: '',
                        email: '',
                        address: ''
                    }}
                    enableReinitialize={true}
                    validationSchema={validationSchema}
                    onSubmit={async (values) => {
                        setLoading(true);

                        const databasePayload = {
                            name: values.name.trim(),
                            contact_number: values.contactNumber.trim(),
                            email: values.email.trim().toLowerCase(),
                            address: values.address.trim()
                        };

                        try {
                            if (isEditMode) {
                                const { error } = await supabase
                                    .from('logistics_transportation')
                                    .update(databasePayload)
                                    .eq('id', editData.id);

                                if (error) throw error;
                                toast.success('Transport agency logs modified successfully!');
                            } else {
                                const { error } = await supabase
                                    .from('logistics_transportation')
                                    .insert([databasePayload]);

                                if (error) throw error;
                                toast.success('New transport agency record saved successfully!');
                            }
                            navigate('/Administration/Transportation/List');
                        } catch (err: any) {
                            toast.error('Database Save Error: ' + err.message);
                        } finally {
                            setLoading(false);
                        }
                    }}
                >
                    {({ handleChange, values, errors, touched }) => (
                        <Form className="p-6.5 text-xs text-gray-600 dark:text-gray-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

                            <div>
                                <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">
                                    Name: *
                                </label>
                                    <input
                                        type="text"
                                        name="name"
                                        onChange={handleChange}
                                        value={values.name}
                                        className={`w-full rounded border px-3 h-10 outline-none focus:border-primary dark:focus:border-primary bg-transparent text-xs font-bold text-black dark:text-white ${touched.name && errors.name ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                        placeholder="Enter transport agency name"
                                    />
                            </div>

                            <div>
                                <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">
                                    Contact Number: *
                                </label>
                                    <input
                                        type="text"
                                        name="contactNumber"
                                        onChange={handleChange}
                                        value={values.contactNumber}
                                        className={`w-full rounded border px-3 h-10 bg-transparent outline-none focus:border-primary dark:focus:border-primary text-xs font-semibold text-black dark:text-white ${touched.contactNumber && errors.contactNumber ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                        placeholder="e.g., +92-22-1112223"
                                    />
                            </div>

                            <div>
                                <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">
                                    Email:
                                </label>
                                    <input
                                        type="email"
                                        name="email"
                                        onChange={handleChange}
                                        value={values.email}
                                        className={`w-full rounded border px-3 h-10 bg-transparent outline-none focus:border-primary dark:focus:border-primary text-xs text-black dark:text-white ${touched.email && errors.email ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                        placeholder="e.g., info@transport.com"
                                    />
                            </div>

                            <div>
                                <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">
                                    Address:
                                </label>
                                    <input
                                        type="text"
                                        name="address"
                                        onChange={handleChange}
                                        value={values.address}
                                        className={`w-full rounded border px-3 h-10 outline-none focus:border-primary dark:focus:border-primary bg-transparent text-xs text-black dark:text-white ${touched.address && errors.address ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                        placeholder="Enter office terminal street address coordinates"
                                    />
                            </div>
                            

                            </div>

                            <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-stroke dark:border-strokedark">
                                <button
                                    type="button"
                                    onClick={() => navigate('/Administration/Transportation/List')}
                                    className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                                >
                                    {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Record' : 'Save Record'}</span>}
                                </button>
                            </div>

                        </Form>
                    )}
                </Formik>

            </div>
        </div >
    );
};

export default AddTransportation;
