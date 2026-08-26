import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdEdit, MdDelete, MdMoreVert, MdEmail, MdPhone, MdPerson, MdBusiness } from 'react-icons/md';

const VendorList = () => {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchRegisteredVendors = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('vendors')
                .select('*')
                .order('id', { ascending: false });

            if (error) throw error;
            setVendors(data || []);
        } catch (err: any) {
            toast.error('Registry Lookup Broken: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegisteredVendors();
        const closeAllActiveMenus = () => setActiveMenuId(null);
        window.addEventListener('click', closeAllActiveMenus);
        return () => window.removeEventListener('click', closeAllActiveMenus);
    }, []);

    const handleDeleteVendorRecord = async (id: string | number) => {
        if (!window.confirm('Are you absolutely certain you want to delete this vendor account entry?')) return;

        try {
            const { error } = await supabase.from('vendors').delete().eq('id', id);
            if (error) throw error;

            toast.success('Vendor profile dropped from enterprise directory successfully.');
            fetchRegisteredVendors();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const filteredVendors = vendors.filter(v =>
        (v.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalEntries = filteredVendors.length;
    const totalPages = Math.ceil(totalEntries / pageSize);
    const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalEntries);
    const paginatedVendors = filteredVendors.slice(startIndex, startIndex + pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);
    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-black dark:text-bodydark text-xs">

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-black dark:text-white">Wholesale Vendor Master Directory</h2>
                    <p className="text-xs text-gray-400">Browse supply business profiles, manage tax coordinates, and map accounts</p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/Purchase/Vendor/Add')}
                    className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-opacity-90 transition shadow-sm cursor-pointer"
                >
                    + Add New Vendor
                </button>
            </div>

            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none text-black dark:text-white font-bold"
                        >
                            {[10, 25, 50, 100].map((size) => (
                                <option key={size} value={size} className="dark:bg-boxdark">{size}</option>
                            ))}
                        </select>
                        <span>entries</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm w-full sm:w-auto text-gray-500 dark:text-gray-400">
                        <span>Search:</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search vendor name or contact profile..."
                            className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none text-black dark:text-white text-xs font-semibold"
                        />
                    </div>
                </div>

                <div className="max-w-full overflow-x-auto">
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                                <th className="py-4 px-4 font-semibold w-16">S#</th>
                                <th className="py-4 px-4 font-semibold">Vendor / Factory Name</th>
                                <th className="py-4 px-4 font-semibold">Supply Category</th>
                                <th className="py-4 px-4 font-semibold">Contact Person</th>
                                <th className="py-4 px-4 font-semibold">City & Phone</th>
                                <th className="py-4 px-4 font-semibold text-right">Opening Balance</th>
                                <th className="py-4 px-4 font-semibold w-24 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-12 text-sm"><Spinner /></td></tr>
                            ) : paginatedVendors.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-sm text-gray-500 dark:text-gray-400 italic">No business merchant vendors registered yet.</td></tr>
                            ) : (
                                paginatedVendors.map((vendor, idx) => {
                                    const serialNumber = startIndex + idx + 1;
                                    const openBal = Number(vendor.opening_balance ?? vendor.balance ?? 0);
                                    const balType = vendor.balance_type || 'Payable';

                                    return (
                                        <tr key={vendor.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-black dark:text-white text-xs">
                                            <td className="py-3.5 px-4 text-gray-400">{serialNumber}</td>
                                            <td className="py-3.5 px-4 font-bold text-primary dark:text-white">
                                                <div className="flex items-center gap-1.5">
                                                    <MdBusiness className="text-gray-400 shrink-0" size={16} />
                                                    <span>{vendor.vendor_name || vendor.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    {vendor.category || 'Tiles & Ceramics'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                                                <span className="inline-flex items-center gap-1">
                                                    <MdPerson size={14} className="text-gray-400" />
                                                    {vendor.contact_name || '-'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400">
                                                <div className="flex flex-col gap-0.5">
                                                    {vendor.city && <span className="font-bold text-slate-800 dark:text-slate-200">{vendor.city}</span>}
                                                    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                                        {vendor.cell_no || vendor.phone_no || vendor.phone || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-mono font-bold">
                                                {openBal > 0 ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className={balType === 'Payable' ? 'text-rose-600' : 'text-emerald-600'}>
                                                            Rs. {openBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-sans">
                                                            {balType === 'Payable' ? 'Payable' : 'Advance'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">Rs. 0.00</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <TableActions
                                                    onEdit={() => navigate('/Purchase/Vendor/Add', { state: { vendor } })}
                                                    onDelete={() => handleDeleteVendorRecord(vendor.id)}
                                                    editTitle="Edit Supplier"
                                                    deleteTitle="Delete Supplier"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-stroke dark:border-strokedark">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Showing {startIndex + 1} to {endIndex} of {totalEntries} entries</div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className="px-3 py-1.5 rounded text-xs font-medium border border-stroke dark:border-strokedark hover:bg-gray-100 dark:hover:bg-meta-4 transition disabled:opacity-30 cursor-pointer">Previous</button>
                            {Array.from({ length: totalPages }, (_, i) => <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1.5 rounded text-xs border transition cursor-pointer ${currentPage === i + 1 ? 'bg-primary text-white border-primary' : 'border-stroke dark:border-strokedark text-gray-500 hover:bg-gray-50'}`}>{i + 1}</button>)}
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className="px-3 py-1.5 rounded text-xs font-medium border border-stroke dark:border-strokedark hover:bg-gray-100 dark:hover:bg-meta-4 transition disabled:opacity-30 cursor-pointer">Next</button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default VendorList;
