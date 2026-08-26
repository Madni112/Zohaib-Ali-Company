import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';

const AddLocation = () => {
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const editData = location.state?.location;
    const isEditMode = !!editData;

    const validationSchema = Yup.object().shape({
        name: Yup.string().required('Location name is mandatory'),
        locationType: Yup.string().required('Please choose a location classification type'),
        address: Yup.string().required('Physical address details are mandatory'),
        contactPhone: Yup.string().matches(/^[0-9+]*$/, 'Must be a valid phone number value').nullable()
    });

    return (
        <div className="mx-auto max-w-4xl">
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">

                <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
                    <h3 className="font-semibold text-black dark:text-white text-base">
                        {isEditMode ? `Modify Location: ${editData.name}` : 'Register New Warehouse / Sale Point'}
                    </h3>
                    <button
                        type="button"
                        onClick={() => navigate('/Administration/Locations/List')}
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        Back to Directory
                    </button>
                </div>

                <Formik
                    initialValues={isEditMode ? {
                        name: editData.name || '',
                        locationType: editData.location_type || '',
                        address: editData.address || '',
                        contactPhone: editData.contact_phone || ''
                    } : {
                        name: '',
                        locationType: '',
                        address: '',
                        contactPhone: ''
                    }}
                    enableReinitialize={true}
                    validationSchema={validationSchema}
                    onSubmit={async (values) => {
                        setLoading(true);

                        const databasePayload = {
                            name: values.name.trim(),
                            location_type: values.locationType,
                            address: values.address.trim(),
                            contact_phone: values.contactPhone.trim()
                        };

                        try {
                            if (isEditMode) {
                                const { error } = await supabase
                                    .from('inventory_locations')
                                    .update(databasePayload)
                                    .eq('id', editData.id);

                                if (error) throw error;
                                toast.success('Location profile configurations updated successfully!');
                            } else {
                                const { error } = await supabase
                                    .from('inventory_locations')
                                    .insert([databasePayload]);

                                if (error) throw error;
                                toast.success('New location point saved to live database parameters successfully!');
                            }
                            navigate('/Administration/Locations/List');
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
                                    <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Location / Site Name: *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        onChange={handleChange}
                                        value={values.name}
                                        className={`w-full rounded border px-3 h-10 outline-none focus:border-primary bg-transparent text-xs font-bold text-black dark:text-white ${touched.name && errors.name ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                        placeholder="e.g., Warehouse A, Hyderabad Retail Counter"
                                    />
                                </div>

                                <div>
                                    {/* ENFORCED SPECIFIC LOCATION TYPE OPTIONS SELECT DROPDOWN ROW ELEMENT */}
                                    <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Location Type Classification: *</label>
                                    <select
                                        name="locationType"
                                        onChange={handleChange}
                                        value={values.locationType}
                                        className={`w-full rounded border px-3 h-10 bg-transparent outline-none focus:border-primary text-xs font-semibold text-black dark:text-white ${touched.locationType && errors.locationType ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                    >
                                        <option value="" className="dark:bg-boxdark text-gray-400">Select location type</option>
                                        <option value="Sale Point" className="dark:bg-boxdark">Sale Point (Retail Depot Counter)</option>
                                        <option value="Storage Point" className="dark:bg-boxdark">Storage Point (Warehouse Reserve WH)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Phone Number:</label>
                                    <input
                                        type="text"
                                        name="contactPhone"
                                        onChange={handleChange}
                                        value={values.contactPhone}
                                        className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-transparent outline-none focus:border-primary text-xs text-black dark:text-white"
                                        placeholder="e.g., 022-1112223"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block font-medium text-black dark:text-white text-xs uppercase tracking-wide">Physical Address Coordinates: *</label>
                                    <input
                                        type="text"
                                        name="address"
                                        onChange={handleChange}
                                        value={values.address}
                                        className={`w-full rounded border px-3 h-10 outline-none focus:border-primary bg-transparent text-xs text-black dark:text-white ${touched.address && errors.address ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                                        placeholder="Enter complete plot street location details lines"
                                    />
                                </div>

                            </div>

                            <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-stroke dark:border-strokedark">
                                <button
                                    type="button"
                                    onClick={() => navigate('/Administration/Locations/List')}
                                    className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 px-6 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 px-8 font-bold text-white transition disabled:opacity-50 shadow-md text-xs cursor-pointer flex items-center gap-2"
                                >
                                    {loading ? <Spinner color="border-white" size="w-4 h-4" /> : <span>{isEditMode ? 'Update Location Details' : 'Save Location Spot'}</span>}
                                </button>
                            </div>

                        </Form>
                    )}
                </Formik>

            </div>
        </div>
    );
};

export default AddLocation;
