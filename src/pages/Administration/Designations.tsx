import React, { useEffect, useState } from 'react';
import { supabase } from '../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../ui/Spinner';
import TableActions from '../../ui/TableActions';
import { MdAdd, MdEdit, MdDelete, MdClose } from 'react-icons/md';

const Designations = () => {
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Inline inputs form states
  const [titleName, setTitleName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);

  // Pagination and Lookup filters control parameters
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchDesignations();
  }, []);

  const fetchDesignations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hr_designations') // Targets your exact live database table name
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      setDesignations(data || []);
    } catch (err: any) {
      toast.error('Failed to load designations: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = titleName.trim();
    
    if (!cleanTitle) {
      toast.error('Designation title cannot be empty');
      return;
    }

    try {
      setSubmitting(true);

      const isDuplicate = designations.some(
        (d) => d.title.toLowerCase() === cleanTitle.toLowerCase() && d.id !== editingId
      );
      if (isDuplicate) {
        toast.error('This rank/designation is already registered');
        setSubmitting(false);
        return;
      }

      if (editingId) {
        const { error } = await supabase
          .from('hr_designations')
          .update({ title: cleanTitle })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Designation updated successfully!');
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('hr_designations')
          .insert([{ title: cleanTitle }]);

        if (error) throw error;
        toast.success('Designation saved successfully!');
      }

      setTitleName('');
      fetchDesignations(); 
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerEdit = (item: any) => {
    setEditingId(item.id);
    setTitleName(item.title); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitleName('');
  };

  const handleDeleteDesignation = async (id: number | string) => {
    if (!window.confirm('Are you certain you want to permanently remove this designation rank?')) return;

    try {
      const { error } = await supabase
        .from('hr_designations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Designation removed from live HR logs.');
      if (editingId === id) handleCancelEdit();
      fetchDesignations();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredDesignations = designations.filter((d) =>
    d.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEntries = filteredDesignations.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedDesignations = filteredDesignations.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative">
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
          HR Staff Designations
        </h2>
      </div>

      <div className={`rounded-xl border shadow-xs p-5 transition duration-150
        ${editingId ? 'border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20' : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-boxdark'}`}>
        <form onSubmit={handleFormSubmit} className="flex flex-col md:flex-row items-end gap-4 text-xs">
          <div className="flex-1 w-full">
            <label className="block text-gray-500 mb-1.5 font-medium">
              {editingId ? 'Modify Staff Rank Title: *' : 'Create Staff Designation Rank Title: *'}
            </label>
            <input 
              type="text" 
              value={titleName} 
              onChange={(e) => setTitleName(e.target.value)} 
              className="w-full border border-stroke rounded p-2.5 bg-transparent dark:border-strokedark outline-none focus:border-primary text-black dark:text-white font-bold text-xs h-[38px]" 
              placeholder="Enter corporate position rank title (e.g. Accountant, Gatekeeper, Manager, Truck Driver)" 
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
                <><MdEdit size={16} /> Update Title</>
              ) : (
                <><MdAdd size={16} /> Save Designation</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* FULL WIDTH HISTORY DISPLAY DATATABLE */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Show</span>
            <select 
              value={pageSize} 
              onChange={(e) => setPageSize(Number(e.target.value))} 
              className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs font-semibold text-black dark:text-white"
            >
              {[5, 10, 25, 50].map((size:number) => (
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
              placeholder="Search designation records..." 
              className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs text-black dark:text-white" 
            />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                <th className="py-4 px-4 font-semibold text-xs w-20">S#</th>
                <th className="py-4 px-4 font-semibold text-xs">Staff Position Rank Title</th>
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
              ) : paginatedDesignations.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-xs text-gray-500 dark:text-gray-400">
                    No records found in database log tiers.
                  </td>
                </tr>
              ) : (
                paginatedDesignations.map((item, idx) => {
                  const serialNumber = startIndex + idx + 1;
                  const isCurrentRowEditing = editingId === item.id;

                  return (
                    <tr key={item.id} className={`border-b duration-150 text-xs
                      ${isCurrentRowEditing ? 'bg-emerald-50/30 dark:bg-emerald-950/30 font-bold border-emerald-500' : 'border-stroke dark:border-strokedark'}`}>
                      <td className="py-3.5 px-4 text-black dark:text-white font-medium">{serialNumber}</td>
                      <td className="py-3.5 px-4 text-black dark:text-white uppercase tracking-tight">{item.title}</td>
                      
                      <td className="py-3.5 px-4 text-center">
                        <TableActions
                          onEdit={() => handleTriggerEdit(item)}
                          onDelete={() => handleDeleteDesignation(item.id)}
                          editTitle="Edit Designation"
                          deleteTitle="Delete Designation"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM METRIC SUMMARY FLOORS */}
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

export default Designations;
