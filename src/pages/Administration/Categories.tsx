import React, { useEffect, useState } from 'react';
import { supabase } from '../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../ui/Spinner';
import TableActions from '../../ui/TableActions';
import { MdDelete, MdAdd, MdEdit, MdClose, MdCategory } from 'react-icons/md';

import { useAuth } from '../../Context/Auth';

const Categories = () => {
    const { tenantId } = useAuth();
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Inline inputs form state hooks
    const [categoryName, setCategoryName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // FIXED: Added inline modification tracker states
    const [editingId, setEditingId] = useState<number | string | null>(null);

    // Pagination and Lookup filters control parameters
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchCategories();
    }, [tenantId]);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('inventory_categories')
                .select('*')
                .order('name', { ascending: true });

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            const { data, error } = await query;

            if (error) throw error;
            setCategories(data || []);
        } catch (err: any) {
            toast.error('Failed to load categories: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // HANDLES BOTH SAVE AND LIVE UPDATE DISPATCH OPERATIONS
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = categoryName.trim();

        if (!cleanName) {
            toast.error('Category name cannot be empty');
            return;
        }

        try {
            setSubmitting(true);

            // Verify duplication against other registered entries
            const isDuplicate = categories.some(
                (c) => c.name.toLowerCase() === cleanName.toLowerCase() && c.id !== editingId
            );
            if (isDuplicate) {
                toast.error('This category label is already registered');
                setSubmitting(false);
                return;
            }

            if (editingId) {
                // Path A: Edit Mode triggers a PostgREST SQL Update call
                const { error } = await supabase
                    .from('inventory_categories')
                    .update({ name: cleanName })
                    .eq('id', editingId);

                if (error) throw error;
                toast.success('Category title modified successfully!');
                setEditingId(null);
            } else {
                // Path B: Standard insertion saves a fresh entry row with tenant_id
                const insertPayload: any = { name: cleanName };
                if (tenantId) {
                    insertPayload.tenant_id = tenantId;
                }

                const { error } = await supabase
                    .from('inventory_categories')
                    .insert([insertPayload]);

                if (error) throw error;
                toast.success('Category registered successfully!');
            }

            setCategoryName('');
            fetchCategories(); // Instantly reload table list data parameters
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };


    // TRIGGERED WHEN USER CLICKS COMPONENT INLINE MDEDIT TARGET CELL BUTTON
    const handleTriggerEdit = (cat: any) => {
        setEditingId(cat.id);
        setCategoryName(cat.name); // Hydrates the text block straight back into the horizontal form field instantly
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Smooth scrolls up to top inputs bar
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setCategoryName('');
    };

    const handleDeleteCategory = async (id: number | string) => {
        if (!window.confirm('Are you certain you want to permanently remove this category item?')) return;

        try {
            const { error } = await supabase
                .from('inventory_categories')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Category removed cleanly.');
            if (editingId === id) handleCancelEdit();
            fetchCategories();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const filteredCategories = categories.filter((c) =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalEntries = filteredCategories.length;
    const totalPages = Math.ceil(totalEntries / pageSize);
    const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalEntries);
    const paginatedCategories = filteredCategories.slice(startIndex, startIndex + pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 relative">

            {/* SCREEN ROUTE TITLE HEADER */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                    Categories
                </h2>
            </div>

            <div className={`rounded-xl border shadow-xs p-5 transition duration-150
        ${editingId ? 'border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20' : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-boxdark'}`}>
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                        <MdCategory className="text-emerald-600 text-lg" />
                        <span>{editingId ? 'Modify Selected Category' : 'Register New Category'}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
                        {categories.length} Categories Registered
                    </span>
                </div>
                <form onSubmit={handleFormSubmit} className="flex flex-col md:flex-row items-end gap-4 text-xs">
                    <div className="flex-1 w-full">
                        <label className="block text-gray-500 mb-1.5 font-medium">
                            Category Name: *
                        </label>
                        <input
                            type="text"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            className="w-full border border-stroke rounded p-2.5 bg-transparent dark:border-strokedark outline-none focus:border-primary text-black dark:text-white font-bold text-xs h-[38px]"
                            placeholder="Enter category name text description (e.g. Gas Cylinders, Industrial Valve)"
                            required
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 px-5 font-bold text-slate-700 dark:text-slate-300 transition shadow-sm text-xs cursor-pointer h-[38px]"
                            >
                                <MdClose size={16} /> Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full md:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 px-8 font-bold text-white transition shadow-md text-xs cursor-pointer h-[38px] disabled:opacity-50"
                        >
                            {submitting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : editingId ? (
                                <><MdEdit size={16} /> Update Category</>
                            ) : (
                                <><MdAdd size={16} /> Save Category</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* FULL WIDTH MASTER DISPLAY DATATABLE ELEMENT GRID SECTION */}
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs font-semibold text-black dark:text-white"
                        >
                            {[5, 10, 25, 50].map((size) => (
                                <option key={size} value={size} className="dark:bg-boxdark">{size}</option>
                            ))}
                        </select>
                        <span>entries</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs w-full sm:w-auto text-gray-500 dark:text-gray-400">
                        <span>Search:</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search categories catalog records..."
                            className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs text-black dark:text-white"
                        />
                    </div>
                </div>

                <div className="max-w-full overflow-x-auto">
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr className={`bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke  dark:border-snakedark`}>
                                <th className="py-4 px-4 font-semibold text-xs w-20">S#</th>
                                <th className="py-4 px-4 font-semibold text-xs">Category Designation Name</th>
                                <th className="py-4 px-4 font-semibold text-xs w-32 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="text-center py-12 text-xs">
                                        <div className="flex justify-center items-center"><Spinner /></div>
                                    </td>
                                </tr>
                            ) : paginatedCategories.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="text-center py-10 text-xs text-gray-500 dark:text-gray-400">
                                        No data available in table
                                    </td>
                                </tr>
                            ) : (
                                paginatedCategories.map((cat, idx) => {
                                    const serialNumber = startIndex + idx + 1;
                                    const isCurrentRowEditing = editingId === cat.id;

                                    return (
                                        <tr key={cat.id} className={`border-b duration-150 text-xs
                      ${isCurrentRowEditing ? 'font-bold border-primary bg-meta-4/80' : 'border-stroke dark:border-strokedark'}`}>
                                            <td className="py-3.5 px-4 text-black dark:text-white font-medium">{serialNumber}</td>
                                            <td className="py-3.5 px-4 text-black dark:text-white uppercase tracking-tight">{cat.name}</td>

                                            <td className="py-3.5 px-4 text-center">
                                                <TableActions
                                                    onEdit={() => handleTriggerEdit(cat)}
                                                    onDelete={() => handleDeleteCategory(cat.id)}
                                                    editTitle="Edit Category"
                                                    deleteTitle="Delete Category"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* BOTTOM METRIC SUMMARY FLOORS FOOTER */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-stroke dark:border-strokedark">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Showing {startIndex + 1} to {endIndex} of {totalEntries} entries
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                className="px-2 py-1 rounded border border-stroke dark:border-strokedark hover:bg-gray-100 text-[10px] font-medium disabled:opacity-30"
                            >
                                Previous
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold border transition ${currentPage === i + 1 ? 'bg-primary text-white border-primary' : 'border-stroke dark:border-strokedark text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                className="px-2 py-1 rounded border border-stroke dark:border-strokedark hover:bg-gray-100 text-[10px] font-medium disabled:opacity-30"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Categories;
