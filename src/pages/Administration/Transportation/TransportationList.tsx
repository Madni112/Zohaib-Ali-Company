import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdAdd, MdLocalShipping, MdPerson, MdPhone } from 'react-icons/md';

const TransportationList = () => {
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination bounds vectors and search filtering parameters states
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchVehicles();
    }, []);

    const fetchVehicles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('logistics_transportation')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setVehicles(data || []);
        } catch (err: any) {
            toast.error('Failed to load transportation records: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVehicle = async (id: number | string) => {
        if (!window.confirm('Are you completely sure you want to permanently delete this vehicle profile record?')) return;

        try {
            const { error } = await supabase
                .from('logistics_transportation')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Vehicle deleted cleanly from logs.');
            fetchVehicles();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const filteredVehicles = vehicles.filter((v) =>
        v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.vehicle_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalEntries = filteredVehicles.length;
    const totalPages = Math.ceil(totalEntries / pageSize);
    const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalEntries);
    const paginatedVehicles = filteredVehicles.slice(startIndex, startIndex + pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 relative">

            {/* HEADER CONTROLS VIEW STRIP BUTTON LINE */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                    Transportation
                </h2>
                <button
                    type="button"
                    onClick={() => navigate('/Administration/Transportation/Add')}
                    className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-opacity-90 transition duration-150 shadow-sm"
                >
                    + Add New Vehicle
                </button>
            </div>

            {/* RE-CONSTRUCTED DATATABLE HISTORY BLOCK PANEL */}
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
                <div className="border-b border-stroke dark:border-strokedark pb-3 mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-black dark:text-white">
                        Logistics Fleets & Vehicles
                    </span>
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 font-mono">
                        {vehicles.length} Vehicles Registered
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
                            {[5, 10, 25, 50].map((size: number) => (
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
                            placeholder="Search truck number, driver, company name..."
                            className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs text-black dark:text-white"
                        />
                    </div>
                </div>

                <div className="max-w-full overflow-x-auto">
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                                <th className="py-4 px-4 font-semibold text-xs w-16">S#</th>
                                <th className="py-4 px-4 font-semibold text-xs">Logistics Transport Agency Name</th>
                                <th className="py-4 px-4 font-semibold text-xs">Official Contact Number</th>
                                <th className="py-4 px-4 font-semibold text-xs">Email Address</th>
                                <th className="py-4 px-4 font-semibold text-xs">Terminal Office Address</th>
                                <th className="py-4 px-4 font-semibold text-xs w-24 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedVehicles.map((agency, idx) => (
                                <tr key={agency.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 text-xs">
                                    <td className="py-3.5 px-4 font-medium">{startIndex + idx + 1}</td>
                                    <td className="py-3.5 px-4 font-bold text-black dark:text-white uppercase flex items-center gap-1.5"><MdLocalShipping size={14} className="text-primary" /> {agency.name}</td>
                                    <td className="py-3.5 px-4 text-gray-700 dark:text-white font-mono font-bold">{agency.contact_number}</td>
                                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 font-semibold">{agency.email || '-'}</td>
                                    <td className="py-3.5 px-4 text-gray-500 font-medium truncate max-w-xs">{agency.address || '-'}</td>
                                    <td className="py-3.5 px-4 text-center">
                                        <TableActions
                                            onEdit={() => navigate('/Administration/Transportation/Add', { state: { vehicle: agency } })}
                                            onDelete={() => handleDeleteVehicle(agency.id)}
                                            editTitle="Edit Transport Record"
                                            deleteTitle="Delete Transport Record"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* BOTTOM METRIC SUMMARY FLOOR FOOTER */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-stroke dark:border-strokedark">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Showing {startIndex + 1} to {endIndex} of {totalEntries} entries
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className="px-2 py-1 rounded border border-stroke text-[10px] font-medium disabled:opacity-30">Previous</button>
                            {Array.from({ length: totalPages }, (_, i) => (
                                <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`px-2 py-1 rounded text-[10px] font-bold border transition ${currentPage === i + 1 ? 'bg-primary text-white border-primary' : 'border-stroke dark:border-strokedark text-gray-500 hover:bg-gray-50'}`}>{i + 1}</button>
                            ))}
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className="px-2 py-1 rounded border border-stroke text-[10px] font-medium disabled:opacity-30">Next</button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default TransportationList;
