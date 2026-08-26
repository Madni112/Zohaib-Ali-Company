import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdEdit, MdDelete, MdLocationOn, MdStore, MdWarehouse } from 'react-icons/md';

const LocationList = () => {
    const navigate = useNavigate();
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('inventory_locations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLocations(data || []);
        } catch (err: any) {
            toast.error('Failed to load warehouse location records: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLocation = async (id: number | string) => {
        if (!window.confirm('Are you certain you want to permanently delete this location space slot?')) return;

        try {
            const { error } = await supabase
                .from('inventory_locations')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Location removed cleanly.');
            fetchLocations();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const filteredLocations = locations.filter((loc) =>
        loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.location_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalEntries = filteredLocations.length;
    const totalPages = Math.ceil(totalEntries / pageSize);
    const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalEntries);
    const paginatedLocations = filteredLocations.slice(startIndex, startIndex + pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 relative">

            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                    Locations
                </h2>
                <button
                    type="button"
                    onClick={() => navigate('/Administration/Locations/Add')}
                    className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-opacity-90 transition duration-150 shadow-sm"
                >
                    + Add New
                </button>
            </div>

            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
                <div className="border-b border-stroke dark:border-strokedark pb-3 mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-black dark:text-white">
                        Registered Storage Locations
                    </span>
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 font-mono">
                        {locations.length} Locations Registered
                    </span>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs font-semibold text-black dark:text-white"
                        >
                            {[10, 25, 50, 100].map((size: number) => (
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
                            placeholder="Search site name, type, street..."
                            className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs text-black dark:text-white"
                        />
                    </div>
                </div>

                <div className="max-w-full overflow-x-auto">
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                                <th className="py-4 px-4 font-semibold text-xs w-16">S#</th>
                                <th className="py-4 px-4 font-semibold text-xs">Location Name Identifier</th>
                                <th className="py-4 px-4 font-semibold text-xs">Classification Type</th>
                                <th className="py-4 px-4 font-semibold text-xs">Phone</th>
                                <th className="py-4 px-4 font-semibold text-xs">Physical Address Details</th>
                                <th className="py-4 px-4 font-semibold text-xs w-24 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-xs">
                                        <div className="flex justify-center items-center"><Spinner /></div>
                                    </td>
                                </tr>
                            ) : paginatedLocations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-xs text-gray-500 dark:text-gray-400">
                                        No matching location spaces discovered in database records logs.
                                    </td>
                                </tr>
                            ) : (
                                paginatedLocations.map((loc, idx) => {
                                    const serialNumber = startIndex + idx + 1;
                                    const isSalePoint = loc.location_type === 'Sale Point';

                                    return (
                                        <tr key={loc.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 text-xs">
                                            <td className="py-3.5 px-4 font-medium">{serialNumber}</td>
                                            <td className="py-3.5 px-4 font-bold text-black dark:text-white uppercase tracking-tight flex items-center gap-1.5">
                                                <MdLocationOn size={14} className="text-primary" /> {loc.name}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px]
                          ${isSalePoint
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                        : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60'}`}>
                                                    {isSalePoint ? <MdStore size={12} /> : <MdWarehouse size={12} />}
                                                    {loc.location_type || 'Unassigned'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 font-semibold font-mono">{loc.contact_phone || '-'}</td>
                                            <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 font-medium">{loc.address || 'No Address Provided'}</td>

                                            <td className="py-3.5 px-4 text-center">
                                                <TableActions
                                                    onEdit={() => navigate('/Administration/Locations/Add', { state: { location: loc } })}
                                                    onDelete={() => handleDeleteLocation(loc.id)}
                                                    editTitle="Edit Location"
                                                    deleteTitle="Delete Location"
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
                    <div className="text-xs text-gray-500 dark:text-gray-400">Showing {startIndex + 1} to {endIndex} of {totalEntries} entries</div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className="px-2 py-1 rounded border border-stroke text-[10px] font-medium disabled:opacity-30">Previous</button>
                            {Array.from({ length: totalPages }, (_, i) => <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`px-2 py-1 rounded text-[10px] font-bold border transition ${currentPage === i + 1 ? 'bg-primary text-white border-primary' : 'border-stroke dark:border-strokedark text-gray-500 hover:bg-gray-50'}`}>{i + 1}</button>)}
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className="px-2 py-1 rounded border border-stroke text-[10px] font-medium disabled:opacity-30">Next</button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default LocationList;
