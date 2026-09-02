import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import { MdInbox, MdHistory } from 'react-icons/md';
import { useAuth } from '../../../Context/Auth';
import { useModal } from '../../../Context/Modal';
import VerifyInward from './VerifyInward';
import InwardChallanHistory from './InwardChallanHistory';

interface InwardChallanListProps {
  locationFilter?: 'SHOP' | 'WAREHOUSE' | 'ALL';
}

const InwardChallanList: React.FC<InwardChallanListProps> = ({ locationFilter = 'ALL' }) => {
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(10);
  const { tenantId } = useAuth();
  const { showModal, hideModal } = useModal();

  const openHistoryModal = () => {
    showModal(
      <InwardChallanHistory 
        onView={(id) => {
          showModal(
            <VerifyInward 
              inwardId={id} 
              readonly={true}
              onCancel={() => openHistoryModal()} 
            />,
            "View GRN Details",
            undefined,
            "max-w-5xl"
          );
        }}
      />,
      "Processed Inward Challans",
      undefined,
      "max-w-5xl"
    );
  };

  useEffect(() => {
    fetchPendingInwards();
  }, [locationFilter]);

  const fetchPendingInwards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('grn_receipts')
        .select('*, grn_items(*)')
        .in('status', ['Pending Inward', 'Partially Received'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      let filteredData = data || [];
      if (locationFilter !== 'ALL') {
        filteredData = filteredData.filter(grn => {
          if (locationFilter === 'SHOP') {
            // Include if there are any SHOP items that are NOT verified
            return grn.grn_items?.some((item: any) => {
              const isShop = String(item.warehouse_name).toUpperCase() === 'SHOP';
              const isUnverified = (item.accepted_qty == null) || (item.accepted_qty === 0 && item.rejected_qty === 0 && item.qty > 0);
              return isShop && isUnverified;
            });
          } else {
            // Include if there are any NON-SHOP items that are NOT verified
            return grn.grn_items?.some((item: any) => {
              const isShop = String(item.warehouse_name).toUpperCase() === 'SHOP';
              const isUnverified = (item.accepted_qty == null) || (item.accepted_qty === 0 && item.rejected_qty === 0 && item.qty > 0);
              return !isShop && isUnverified;
            });
          }
        });
      }
      
      setChallans(filteredData);
    } catch (err: any) {
      toast.error('Failed to load pending inward challans.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = challans.filter(c =>
    String(c.grn_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(c.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const currentData = filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 text-black dark:text-white text-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
            <MdInbox size={24} className="text-primary" />
            {locationFilter === 'SHOP' ? 'Shop Receiving Queue' : locationFilter === 'WAREHOUSE' ? 'Warehouse Inward Challans' : 'Receiving / QC Queue (Shop & Warehouse)'}
          </h2>
          <p className="text-gray-400 mt-0.5">Approve incoming goods and update physical inventory for your location</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={openHistoryModal}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-meta-4 dark:hover:bg-meta-4/80 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 transition w-full sm:w-auto"
          >
            <MdHistory size={18} />
            Processed History
          </button>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vendor, GRN #..."
            className="w-full sm:w-64 rounded-xl border border-stroke py-2 px-3 bg-white dark:bg-boxdark outline-none focus:border-primary font-semibold text-black dark:text-white text-xs shadow-xs"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6 overflow-hidden">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 dark:bg-meta-4 text-[10px] font-black uppercase tracking-wider border-b border-stroke text-slate-700 dark:text-white">
                <th className="py-3.5 px-4 whitespace-nowrap">Challan / GRN #</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Receipt Date</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Vendor Name</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-center">Status</th>
                <th className="py-3.5 px-4 text-center w-28 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><Spinner /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-500 font-bold italic">No pending inwards for the warehouse.</td></tr>
              ) : (
                currentData.map((rec) => (
                  <tr key={rec.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 font-semibold text-xs text-black dark:text-white">
                    <td className="py-3 px-4 font-bold font-mono text-primary whitespace-nowrap">{rec.grn_no}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{rec.receipt_date}</td>
                    <td className="py-3 px-4 font-sans font-bold whitespace-nowrap">{rec.vendor_name}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex rounded-md py-0.5 px-2.5 text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          showModal(
                            <VerifyInward 
                              inwardId={rec.id} 
                              locationFilter={locationFilter}
                              onSuccess={() => {
                                hideModal();
                                fetchPendingInwards();
                              }} 
                              onCancel={() => hideModal()}
                            />,
                            "Verify Inward Challan",
                            undefined,
                            "max-w-5xl"
                          );
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition shadow-sm cursor-pointer"
                      >
                        Verify & Receive
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {filtered.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0} to {Math.min(currentPage * entriesPerPage, filtered.length)} of {filtered.length} entries
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
              Page {currentPage} of {totalPages || 1}
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
    </div>
  );
};

export default InwardChallanList;
