import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { useAuth } from '../../../Context/Auth';
import Spinner from '../../../ui/Spinner';
import { MdInventory, MdEvent, MdBusiness, MdDelete, MdEdit, MdSearch, MdVisibility } from 'react-icons/md';
import { useModal } from '../../../Context/Modal';
import VerifyInward from '../Inward Challan/VerifyInward';
import toast from 'react-hot-toast';

const GRNList = () => {
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const { showModal, hideModal } = useModal();
    const [grns, setGrns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string, status: string, items: any[]) => {
        if (!window.confirm('Are you sure you want to delete this GRN? This action cannot be undone.')) return;
        
        try {
            setDeletingId(id);
            
            // Revert inventory
            if (status === 'Confirm' || status === 'Billed' || status === 'Partially Received') {
                for (const item of items) {
                    const { data: stock } = await supabase
                        .from('warehouse_inventory')
                        .select('id, quantity')
                        .ilike('product_name', item.product_name)
                        .ilike('warehouse_name', item.warehouse_name)
                        .maybeSingle();
                        
                    if (stock) {
                        const qtyToRevert = Number(item.accepted_qty ?? item.qty ?? 0);
                        const newQty = Math.max(0, Number(stock.quantity) - qtyToRevert);
                        await supabase.from('warehouse_inventory').update({ quantity: newQty }).eq('id', stock.id);
                    }
                }
            }

            const { error } = await supabase.from('grn_receipts').delete().eq('id', id);
            if (error) throw error;
            
            toast.success('GRN deleted successfully and inventory reverted.');
            setGrns(prev => prev.filter(g => g.id !== id));
        } catch (err: any) {
            toast.error('Failed to delete GRN: ' + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const filteredGrns = grns.filter(g => {
        const query = searchTerm.toLowerCase();
        return (
            (g.grn_no || '').toLowerCase().includes(query) ||
            (g.vendor_name || '').toLowerCase().includes(query) ||
            (g.receipt_date || '').toLowerCase().includes(query) ||
            (g.status || '').toLowerCase().includes(query)
        );
    });

    const totalEntries = filteredGrns.length;
    const totalPages = Math.ceil(totalEntries / entriesPerPage);
    const startIndex = (currentPage - 1) * entriesPerPage;
    const paginatedGrns = filteredGrns.slice(startIndex, startIndex + entriesPerPage);

    useEffect(() => {
        const fetchGRNs = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('grn_receipts')
                    .select('*, grn_items(*)')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setGrns(data || []);
            } catch (err: any) {
                console.error('Failed to fetch GRNs:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchGRNs();
    }, []);

    return (
        <div className="mx-auto max-w-7xl pb-12">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                        <MdInventory className="text-primary" size={24} />
                        Goods Receipt Notes (GRN)
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Manage physical inventory receipts from vendors</p>
                </div>
                <button
                    onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/GRN/Add`)}
                    className="mt-4 sm:mt-0 px-4 py-2 bg-primary text-white font-bold rounded shadow hover:bg-opacity-90"
                >
                    + Log New GRN
                </button>
            </div>

            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
                <div className="p-4 border-b border-stroke dark:border-strokedark flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">Show</span>
                        <select 
                            className="border border-stroke dark:border-strokedark bg-transparent rounded p-1 outline-none text-sm font-bold text-black dark:text-white"
                            value={entriesPerPage}
                            onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="text-sm font-medium text-gray-500">entries</span>
                    </div>

                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <MdSearch size={18} />
                        </span>
                        <input 
                            type="text" 
                            placeholder="Search GRNs..." 
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-9 pr-4 py-2 border border-stroke dark:border-strokedark rounded bg-gray-50 dark:bg-meta-4/20 outline-none focus:border-primary text-sm min-w-[250px] text-black dark:text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-left dark:bg-meta-4 text-[10px] font-black uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                                <th className="py-3 px-4 w-12 text-center">S#</th>
                                <th className="py-3 px-4 w-40">GRN No</th>
                                <th className="py-3 px-4">Vendor Profile</th>
                                <th className="py-3 px-4 text-center">Receipt Date</th>
                                <th className="py-3 px-4 text-center">Items Count</th>
                                <th className="py-3 px-4 text-center">Status</th>
                                <th className="py-3 px-4 text-center w-24">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-12"><Spinner /></td></tr>
                            ) : paginatedGrns.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-sm text-gray-500 italic">No GRNs found.</td></tr>
                            ) : (
                                paginatedGrns.map((grn, idx) => (
                                    <tr key={grn.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-black dark:text-white text-xs">
                                        <td className="py-3 px-4 text-center text-gray-400">{idx + 1}</td>
                                        <td className="py-3 px-4 font-bold font-mono text-primary">{grn.grn_no}</td>
                                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                            <span className="flex items-center gap-1"><MdBusiness className="text-gray-400" />{grn.vendor_name}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-gray-500">
                                            <span className="inline-flex items-center gap-1 font-mono text-[11px]"><MdEvent />{grn.receipt_date}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center font-mono">
                                            {grn.grn_items?.length || 0}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-2 py-0.5 border text-[10px] rounded-full font-bold uppercase tracking-wide whitespace-nowrap ${grn.status === 'Billed'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                                                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                                                }`}>
                                                {grn.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => {
                                                        showModal(
                                                            <VerifyInward 
                                                                inwardId={grn.id} 
                                                                readonly={true}
                                                                onCancel={() => hideModal()} 
                                                            />,
                                                            "View GRN Details",
                                                            undefined,
                                                            "max-w-5xl"
                                                        );
                                                    }}
                                                    className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 transition"
                                                    title="View QC Details"
                                                >
                                                    <MdVisibility size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Purchase/GRN/Edit/${grn.id}`)}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 transition"
                                                    title="Edit"
                                                >
                                                    <MdEdit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(grn.id, grn.status, grn.grn_items)}
                                                    disabled={deletingId === grn.id}
                                                    className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 transition disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    <MdDelete size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-stroke dark:border-strokedark flex items-center justify-between text-sm text-gray-500">
                    <div>
                        Showing {totalEntries > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + entriesPerPage, totalEntries)} of {totalEntries} entries
                    </div>
                    <div className="flex gap-1">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className="px-3 py-1 border border-stroke dark:border-strokedark rounded hover:bg-gray-50 dark:hover:bg-meta-4/20 disabled:opacity-50 text-black dark:text-white"
                        >
                            Prev
                        </button>
                        <button 
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="px-3 py-1 border border-stroke dark:border-strokedark rounded hover:bg-gray-50 dark:hover:bg-meta-4/20 disabled:opacity-50 text-black dark:text-white"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GRNList;
