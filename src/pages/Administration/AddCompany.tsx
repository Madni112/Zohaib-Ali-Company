import React, { useState, useEffect } from 'react';
import { supabase } from '../../Context/supabaseClient';
import { FiEdit, FiTrash2 } from 'react-icons/fi';

interface Company {
    id: number;
    name: string;
    created_at: string;
}

const AddCompany = () => {
    // Database states
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    // Create Form states
    const [companyName, setCompanyName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Edit Modal states
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [editName, setEditName] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Datatable pagination and search states
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setCompanies(data);
        } catch (err: any) {
            console.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    const handleAddCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName.trim()) return;

        try {
            setIsSubmitting(true);
            setMessage({ type: '', text: '' });

            const { error } = await supabase
                .from('companies')
                .insert([{ name: companyName.trim() }]);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Company successfully created!' });
            setCompanyName('');
            fetchCompanies();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCompany || !editName.trim()) return;

        try {
            setIsUpdating(true);
            const { error } = await supabase
                .from('companies')
                .update({ name: editName.trim() })
                .eq('id', editingCompany.id);

            if (error) throw error;

            setEditingCompany(null);
            fetchCompanies();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteCompany = async (id: number) => {
        if (!window.confirm('Are you completely sure you want to delete this record?')) return;

        try {
            const { error } = await supabase
                .from('companies')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchCompanies();
        } catch (err: any) {
            alert(err.message);
        }
    };

    // Filter items matching search input
    const filteredCompanies = companies.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination bounds math
    const totalEntries = filteredCompanies.length;
    const totalPages = Math.ceil(totalEntries / pageSize);
    const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalEntries);
    const paginatedCompanies = filteredCompanies.slice(startIndex, startIndex + pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 relative">

            {/* SCREEN ROUTE TITLE HEADER */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                    Company
                </h2>
            </div>

            {/* INPUT FORM BLOCK */}
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex items-center justify-between">
                    <h3 className="font-medium text-black dark:text-white">Add New Company</h3>
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 font-mono">
                        {companies.length} Companies Registered
                    </span>
                </div>
                <form onSubmit={handleAddCompany} className="p-6.5">
                    {message.text && (
                        <div className={`mb-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {message.text}
                        </div>
                    )}
                    <div className="w-full">
                        <label className="mb-2.5 block text-sm font-medium text-black dark:text-white">Company Name *</label>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Enter complete legal company name"
                                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-sm outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                                required
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="rounded bg-primary px-6 py-3 font-medium text-white hover:bg-opacity-90 transition disabled:bg-opacity-50 whitespace-nowrap"
                            >
                                {isSubmitting ? 'Adding...' : 'Add Company'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* DATATABLE DATA WRAPPER PANEL */}
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                        <span>Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none"
                        >
                            {[10, 25, 50, 100].map((size) => (
                                <option key={size} value={size} className="dark:bg-boxdark">{size}</option>
                            ))}
                        </select>
                        <span>entries</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm w-full sm:w-auto">
                        <span>Search:</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name..."
                            className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none focus:border-primary text-sm"
                        />
                    </div>
                </div>

                <div className="max-w-full overflow-x-auto">
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr className="bg-gray-2 text-left dark:bg-meta-4">
                                <th className="py-4 px-4 font-medium text-black dark:text-white text-sm w-24">S#</th>
                                <th className="py-4 px-4 font-medium text-black dark:text-white text-sm">Company Name</th>
                                <th className="py-4 px-4 font-medium text-black dark:text-white text-sm w-32 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={3} className="text-center py-8 text-sm">Loading details...</td></tr>
                            ) : paginatedCompanies.length === 0 ? (
                                <tr><td colSpan={3} className="text-center py-8 text-sm">No records identified.</td></tr>
                            ) : (
                                paginatedCompanies.map((company, idx) => {
                                    // Dynamic serial number sequence calculation logic expression
                                    const serialNumber = startIndex + idx + 1;

                                    return (
                                        <tr key={company.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10">
                                            <td className="py-3 px-4 text-sm">{serialNumber}</td>
                                            <td className="py-3 px-4 text-sm font-medium text-black dark:text-white">{company.name}</td>
                                            <td className="py-3 px-4 text-sm">
                                                <div className="flex items-center justify-center gap-4">
                                                    <button
                                                        onClick={() => { setEditingCompany(company); setEditName(company.name); }}
                                                        className="text-gray-500 hover:text-primary transition-colors p-1"
                                                        title="Edit"
                                                    >
                                                        <FiEdit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCompany(company.id)}
                                                        className="text-gray-500 hover:text-danger transition-colors p-1"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* BOTTOM METRIC SUMMARY LINES */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-stroke dark:border-strokedark">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {startIndex + 1} to {endIndex} of {totalEntries} entries
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer text-xs"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1.5 font-bold text-teal-600 text-xs">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer text-xs"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* FLOATING POPUP OVERLAY MODAL */}
            {editingCompany && (
                <div className="fixed inset-0 bg-black/50 z-99999 flex items-center justify-center p-4 backdrop-blur-xs">
                    <div className="bg-white dark:bg-boxdark rounded-sm border border-stroke dark:border-strokedark w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="border-b border-stroke dark:border-strokedark py-4 px-6">
                            <h3 className="font-medium text-black dark:text-white">Modify Company Data</h3>
                        </div>
                        <form onSubmit={handleUpdateCompany} className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-black dark:text-white">Update Company Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2.5 px-4 text-sm outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingCompany(null)}
                                    className="rounded border border-stroke dark:border-strokedark px-4 py-2 text-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-meta-4"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdating}
                                    className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-opacity-90 disabled:bg-opacity-50"
                                >
                                    {isUpdating ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddCompany;
