import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { FiPlus, FiX } from 'react-icons/fi';

const DEFAULT_CATEGORIES = [
    '1. ASSETS', '2. LIABILITIES', '3. EQUITY', '4. REVENUE', '5. EXPENSES'
];

const DEFAULT_CONTROLS = [
    'Cash', 'Banks', 'Customers', 'Inventory', 'Vendor', 'Payroll', 'Sales', 'Discounts', 'Other Income', 'Cost of Sales', 'Utility Bills', 'Rent Expenses', 'Logistics', 'General Expenses', 'Opening Balances', 'Capital'
];

const AddChartOfAccount = () => {
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(true);

  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [controlsList, setControlsList] = useState<any[]>([]);
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [showControlModal, setShowControlModal] = useState(false);
  const [newControlInput, setNewControlInput] = useState('');
  const [modalSelectedCategory, setModalSelectedCategory] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const editData = location.state?.account;
  const isEditMode = !!editData;

  const fetchLiveCOAMetadata = async () => {
    try {
      const { data: catData } = await supabase.from('coa_categories').select('name').order('name', { ascending: true });
      const { data: ctrlData } = await supabase.from('coa_controls').select('category_name, control_name').order('control_name', { ascending: true });
      const { data: bankData } = await supabase.from('banks').select('id, bankName, accountTitle, accountNumber');
      
      // Also fetch legacy unique values from chart_of_accounts to ensure nothing is missing
      const { data: legacyCOA } = await supabase.from('chart_of_accounts').select('category_code, control_code');

      // Merge Categories
      const mergedCats = new Set((catData || []).map(c => c.name));
      (legacyCOA || []).forEach(row => {
        if (row.category_code) mergedCats.add(row.category_code);
      });
      setCategoriesList(Array.from(mergedCats).sort().map(name => ({ name })));

      // Merge Controls
      const mergedCtrlsMap = new Map();
      (ctrlData || []).forEach(c => {
        mergedCtrlsMap.set(`${c.category_name}::${c.control_name}`, c);
      });
      (legacyCOA || []).forEach(row => {
        if (row.category_code && row.control_code) {
          const key = `${row.category_code}::${row.control_code}`;
          if (!mergedCtrlsMap.has(key)) {
            mergedCtrlsMap.set(key, { category_name: row.category_code, control_name: row.control_code });
          }
        }
      });
      setControlsList(Array.from(mergedCtrlsMap.values()).sort((a, b) => a.control_name.localeCompare(b.control_name)));

      if (bankData) setBankAccountsList(bankData);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setMetadataLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveCOAMetadata();
  }, []);

  const handleAddNewCategoryDB = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryInput.trim();
    if (!cleanName) return;

    try {
      setModalSubmitting(true);
      const { error } = await supabase.from('coa_categories').insert([{ name: cleanName }]);
      if (error) throw error;

      toast.success('Category level schema profile added!');
      setNewCategoryInput('');
      setShowCategoryModal(false);
      await fetchLiveCOAMetadata();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleAddNewControlDB = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCtrl = newControlInput.trim();
    if (!modalSelectedCategory || !cleanCtrl) {
      toast.error('Both parameters fields are mandatory');
      return;
    }

    try {
      setModalSubmitting(true);
      const { error } = await supabase.from('coa_controls').insert([{ category_name: modalSelectedCategory, control_name: cleanCtrl }]);
      if (error) throw error;

      toast.success('Control specification block appended safely!');
      setNewControlInput('');
      setShowControlModal(false);
      await fetchLiveCOAMetadata();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDeleteCategoryRow = async (name: string, setFieldValue: any) => {
    if (!name) return;
    if (DEFAULT_CATEGORIES.includes(name)) {
      toast.error('System default categories cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you certain you want to permanently delete "${name}" category? All linked control parameters will drop.`)) return;

    try {
      const { error } = await supabase.from('coa_categories').delete().eq('name', name);
      if (error) throw error;
      toast.success('Category option dropped successfully!');
      setFieldValue('categoryCode', '');
      setFieldValue('controlCode', '');
      await fetchLiveCOAMetadata();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteControlRow = async (controlName: string, setFieldValue: any) => {
    if (!controlName) return;
    if (DEFAULT_CONTROLS.includes(controlName)) {
      toast.error('System default controls cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you certain you want to permanently drop "${controlName}" control header row?`)) return;

    try {
      const { error } = await supabase.from('coa_controls').delete().eq('control_name', controlName);
      if (error) throw error;
      toast.success('Control parameter deleted successfully!');
      setFieldValue('controlCode', '');
      await fetchLiveCOAMetadata();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const validationSchema = Yup.object().shape({
    categoryCode: Yup.string().required('Required'),
    controlCode: Yup.string().required('Required'),
    accountCode: Yup.string().required('Required'),
    accountTitle: Yup.string().required('Required'),
    linkedBankId: Yup.string().when('controlCode', {
      is: 'Banks',
      then: () => Yup.string().required('Please select the corresponding bank account link to map validation rows'),
      otherwise: () => Yup.string().nullable()
    })
  });
  if (metadataLoading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-4xl text-xs">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">

        <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
          <h3 className="font-semibold text-black dark:text-white text-base">
            {isEditMode ? 'Modify Chart of Account Ledger' : 'Add Chart of Account'}
          </h3>
          <button
            type="button"
            onClick={() => navigate('/Registration/Chart-of-Account/List')}
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to Directory
          </button>
        </div>

        <Formik
          initialValues={isEditMode ? {
            categoryCode: editData.category_code || '',
            controlCode: editData.control_code || '',
            accountCode: editData.account_code || '',
            accountTitle: editData.account_title || '',
            notes: editData.notes || '',
            linkedBankId: editData.linked_bank_id || ''
          } : {
            categoryCode: '',
            controlCode: '',
            accountCode: '',
            accountTitle: '',
            notes: '',
            linkedBankId: ''
          }}
          enableReinitialize={true}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            setLoading(true);

            const cleanCode = values.accountCode.trim();

            try {
              // 1. Pre-check for duplicate account code in chart_of_accounts
              let checkQuery = supabase.from('chart_of_accounts').select('id, account_code, account_title').eq('account_code', cleanCode);
              if (isEditMode && editData?.id) {
                checkQuery = checkQuery.neq('id', editData.id);
              }
              const { data: existingAcc } = await checkQuery.maybeSingle();

              if (existingAcc) {
                toast.error(`Duplicate Code Error: Account code "${cleanCode}" is already used by "${existingAcc.account_title}". Please choose a different unique code.`);
                setLoading(false);
                return;
              }

              const databasePayload = {
                category_code: values.categoryCode,
                control_code: values.controlCode,
                account_code: cleanCode,
                account_title: values.accountTitle.trim(),
                notes: values.notes.trim(),
                linked_bank_id: values.controlCode === 'Banks' ? values.linkedBankId : null
              };

              const { error } = isEditMode
                ? await supabase.from('chart_of_accounts').update(databasePayload).eq('id', editData.id)
                : await supabase.from('chart_of_accounts').insert([databasePayload]);

              if (error) throw error;
              toast.success('Account registered successfully!');
              navigate('/Registration/Chart-of-Account/List');
            } catch (err: any) {
              if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
                toast.error(`Duplicate Code: Account Code "${cleanCode}" is already taken. Please enter another code.`);
              } else {
                toast.error('Failed to save account: ' + (err.message || 'Unknown error occurred.'));
              }
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ handleChange, values, errors, touched, setFieldValue }) => {
            const activeFilteredControls = controlsList.filter(c => c.category_name === values.categoryCode);

            return (
              <Form className="space-y-5 text-xs text-gray-700 dark:text-gray-300 p-6">

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <label className="w-full md:w-48 block font-bold text-black dark:text-white text-xs uppercase tracking-wide">Category Code: *</label>
                  <div className="w-full md:w-150 flex items-center gap-2">
                    <select
                      name="categoryCode"
                      value={values.categoryCode}
                      onChange={(e) => {
                        handleChange(e);
                        setFieldValue('controlCode', '');
                        setFieldValue('linkedBankId', '');
                      }}
                      className={`flex-1 rounded border px-3 h-10 bg-transparent text-xs font-semibold text-black dark:text-white outline-none focus:border-primary dark:bg-boxdark ${touched.categoryCode && errors.categoryCode ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                    >
                      <option value="" className="dark:bg-boxdark text-gray-400">-- Select Category Code --</option>
                      {categoriesList.map(c => <option key={c.name} value={c.name} className="dark:bg-boxdark">{c.name}</option>)}
                    </select>
                    {values.categoryCode && !DEFAULT_CATEGORIES.includes(values.categoryCode) && (
                      <button type="button" onClick={() => handleDeleteCategoryRow(values.categoryCode, setFieldValue)} className="h-10 w-10 shrink-0 flex items-center justify-center rounded border border-red-500/30 bg-red-50 dark:bg-red-950/20 text-red-500 hover:bg-red-500 hover:text-white transition" title="Delete selected category"><FiX size={16} /></button>
                    )}
                    <button type="button" onClick={() => setShowCategoryModal(true)} className="h-10 w-10 shrink-0 flex items-center justify-center rounded border border-stroke dark:border-strokedark bg-slate-50 dark:bg-meta-4/20 hover:bg-slate-100 text-gray-500 hover:text-black dark:hover:text-white font-bold transition"><FiPlus size={16} /></button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <label className="w-full md:w-48 block font-bold text-black dark:text-white text-xs uppercase tracking-wide">Control Code: *</label>
                  <div className="w-full md:w-150 flex items-center gap-2">
                    <select
                      name="controlCode"
                      value={values.controlCode}
                      onChange={(e) => {
                        handleChange(e);
                        setFieldValue('linkedBankId', '');
                        if (e.target.value !== 'Banks') setFieldValue('accountTitle', '');
                      }}
                      disabled={!values.categoryCode}
                      className={`flex-1 rounded border px-3 h-10 bg-transparent text-xs font-semibold text-black dark:text-white outline-none focus:border-primary disabled:opacity-50 dark:bg-boxdark ${touched.controlCode && errors.controlCode ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`}
                    >
                      <option value="" className="dark:bg-boxdark text-gray-400">-- Select Control Code --</option>
                      {activeFilteredControls.map(c => <option key={c.control_name} value={c.control_name} className="dark:bg-boxdark">{c.control_name}</option>)}
                    </select>
                    {values.controlCode && !DEFAULT_CONTROLS.includes(values.controlCode) && (
                      <button type="button" onClick={() => handleDeleteControlRow(values.controlCode, setFieldValue)} className="h-10 w-10 shrink-0 flex items-center justify-center rounded border border-red-500/30 bg-red-50 dark:bg-red-950/20 text-red-500 hover:bg-red-500 hover:text-white transition" title="Delete selected control subgroup"><FiX size={16} /></button>
                    )}
                    <button type="button" onClick={() => {
                      if (values.categoryCode) setModalSelectedCategory(values.categoryCode);
                      setShowControlModal(true);
                    }} className="h-10 w-10 shrink-0 flex items-center justify-center rounded border border-stroke dark:border-strokedark bg-slate-50 dark:bg-meta-4/20 hover:bg-slate-100 text-gray-500 hover:text-black dark:hover:text-white font-bold transition"><FiPlus size={16} /></button>
                  </div>
                </div>
                {values.controlCode === 'Banks' && (
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-success/5 p-3 rounded border border-success/20 animate-fade-in">
                    <label className="w-full md:w-48 block font-bold text-success text-xs uppercase tracking-wide">Link Bank Account: *</label>
                    <div className="w-full md:w-150">
                      <select
                        name="linkedBankId"
                        value={values.linkedBankId}
                        onChange={(e) => {
                          handleChange(e);
                          const activeMatch = bankAccountsList.find(b => String(b.id) === e.target.value);
                          if (activeMatch) {
                            const stylizedCombinedTitle = `${String(activeMatch.bankName).toUpperCase()} - ${activeMatch.accountTitle} (${activeMatch.accountNumber})`;
                            setFieldValue('accountTitle', stylizedCombinedTitle);
                          }
                        }}
                        className={`w-full rounded border px-3 h-10 bg-white dark:bg-boxdark text-xs font-bold text-black dark:text-white outline-none focus:border-success ${touched.linkedBankId && errors.linkedBankId ? 'border-red-500' : 'border-success/40'}`}
                      >
                        <option value="">-- Select Active Operational Bank Account Title Reference --</option>
                        {bankAccountsList.map(b => (
                          <option key={b.id} value={String(b.id)}>{b.bankName} - {b.accountTitle} ({b.accountNumber})</option>
                        ))}
                      </select>
                      {touched.linkedBankId && errors.linkedBankId && <p className="text-red-500 font-bold text-[10px] mt-1">{String(errors.linkedBankId)}</p>}
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <label className="w-full md:w-48 block font-bold text-black dark:text-white text-xs uppercase tracking-wide">Chart of Accounts Code: *</label>
                  <div className="w-full md:w-150">
                    <input type="text" name="accountCode" onChange={handleChange} value={values.accountCode} className={`w-full rounded border px-3 h-10 bg-transparent font-mono font-bold text-xs text-black dark:text-white ${touched.accountCode && errors.accountCode ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} placeholder="Enter Account Serial (e.g. 1010-001)" />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <label className="w-full md:w-48 block font-bold text-black dark:text-white text-xs uppercase tracking-wide">Account Title: *</label>
                  <div className="w-full md:w-150">
                    <input type="text" name="accountTitle" readOnly={values.controlCode === 'Banks'} onChange={handleChange} value={values.accountTitle} className={`w-full rounded border px-3 h-10 font-bold text-xs text-black dark:text-white ${values.controlCode === 'Banks' ? 'bg-gray-100 dark:bg-meta-4/30 text-success' : 'bg-transparent'} ${touched.accountTitle && errors.accountTitle ? 'border-red-500' : 'border-stroke dark:border-strokedark'}`} placeholder="Enter Ledger Title Name" />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <label className="w-full md:w-48 block font-bold text-black dark:text-white text-xs uppercase tracking-wide">Notes:</label>
                  <div className="w-full md:w-150">
                    <input type="text" name="notes" onChange={handleChange} value={values.notes} className="w-full rounded border border-stroke dark:border-strokedark px-3 h-10 bg-transparent outline-none focus:border-primary text-black dark:text-white" placeholder="Optional notes coordinates info" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stroke dark:border-strokedark">
                  <button
                    type="button"
                    onClick={() => navigate('/Registration/Chart-of-Account/List')}
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
            );
          }}
        </Formik>
        {showCategoryModal && (
          <div className="fixed inset-0 z-99999 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded border border-stroke bg-white p-5 shadow-2xl dark:border-strokedark dark:bg-boxdark">
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <h4 className="font-bold text-black dark:text-white uppercase tracking-wide text-xs">Add Category Node</h4>
                <button type="button" onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"><FiX size={18} /></button>
              </div>
              <form onSubmit={handleAddNewCategoryDB} className="space-y-4">
                <div>
                  <label className="block text-gray-500 mb-1 font-medium">New Category Name: *</label>
                  <input type="text" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} className="w-full border rounded h-10 px-3 bg-transparent outline-none focus:border-primary font-bold text-black dark:text-white text-xs" placeholder="e.g., Liabilities" required />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t dark:border-strokedark">
                  <button type="button" onClick={() => setShowCategoryModal(true)} className="rounded border px-4 h-9 font-medium hover:bg-gray-50 dark:hover:bg-meta-4 text-xs cursor-pointer">Cancel</button>
                  <button type="submit" disabled={modalSubmitting} className="rounded bg-success px-5 h-9 font-medium text-white hover:bg-opacity-90 text-xs cursor-pointer">{modalSubmitting ? '...' : 'Add'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showControlModal && (
          <div className="fixed inset-0 z-99999 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded border border-stroke bg-white p-5 shadow-2xl dark:border-strokedark dark:bg-boxdark">
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <h4 className="font-bold text-black dark:text-white uppercase tracking-wide text-xs">Add Control Sub-Group</h4>
                <button type="button" onClick={() => setShowControlModal(false)} className="text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"><FiX size={18} /></button>
              </div>
              <form onSubmit={handleAddNewControlDB} className="space-y-4">
                <div>
                  <label className="block text-gray-500 mb-1 font-medium">Parent Category Pillar: *</label>
                  <select value={modalSelectedCategory} onChange={(e) => setModalSelectedCategory(e.target.value)} className="w-full border rounded h-10 px-2 bg-transparent font-semibold dark:bg-boxdark text-black dark:text-white text-xs" required>
                    <option value="">-- Choose Category --</option>
                    {categoriesList.map(c => <option key={c.name} value={c.name} className="dark:bg-boxdark">{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 mb-1 font-medium">Control Account Title Name: *</label>
                  <input type="text" value={newControlInput} onChange={(e) => setNewControlInput(e.target.value)} className="w-full border rounded h-10 px-3 bg-transparent outline-none focus:border-primary font-bold text-black dark:text-white text-xs" placeholder="e.g., LOCAL PURCHASE" required />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t dark:border-strokedark">
                  <button type="button" onClick={() => setShowControlModal(false)} className="rounded border px-4 h-9 font-medium hover:bg-gray-50 dark:hover:bg-meta-4 text-xs cursor-pointer">Cancel</button>
                  <button type="submit" disabled={modalSubmitting} className="rounded bg-success px-5 h-9 font-medium text-white hover:bg-opacity-90 text-xs cursor-pointer">{modalSubmitting ? '...' : 'Add'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AddChartOfAccount;
