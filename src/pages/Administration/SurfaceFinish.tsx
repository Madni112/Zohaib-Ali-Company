import React, { useEffect, useState } from 'react';
import { supabase } from '../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../ui/Spinner';
import TableActions from '../../ui/TableActions';
import { MdAdd, MdClose, MdTexture, MdCheckCircle } from 'react-icons/md';



const SurfaceFinish = () => {
  const [finishes, setFinishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form inputs state
  const [finishName, setFinishName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);

  // Pagination and search
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchFinishes();
  }, []);

  const fetchFinishes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_surface_finishes')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching finishes:', error);
        toast.error('Failed to load Brands');
        setFinishes([]);
      } else if (data) {
        setFinishes(data);
      }
    } catch (err: any) {
      console.error('Error fetching finishes:', err);
      toast.error('Failed to load Brands');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = finishName.trim();

    if (!cleanName) {
      toast.error('Brand name cannot be empty');
      return;
    }

    try {
      setSubmitting(true);

      const isDuplicate = finishes.some(
        (f) => f.name.toLowerCase() === cleanName.toLowerCase() && f.id !== editingId
      );
      if (isDuplicate) {
        toast.error('This Brand is already registered');
        setSubmitting(false);
        return;
      }

      // Try database upsert first
      try {
        if (editingId) {
          const oldBrand = finishes.find(f => f.id === editingId);
          const oldBrandName = oldBrand?.name;

          await supabase
            .from('inventory_surface_finishes')
            .update({ name: cleanName })
            .eq('id', editingId);

          if (oldBrandName && oldBrandName !== cleanName) {
            const { error: cascadeError } = await supabase
              .from('products')
              .update({ Brand: cleanName })
              .eq('Brand', oldBrandName);

            if (cascadeError) {
              console.error('Failed to cascade Brand name update to products:', cascadeError);
              toast.error('Brand updated, but failed to link existing products.');
            }
          }
        } else {
          await supabase
            .from('inventory_surface_finishes')
            .insert([{ name: cleanName }]);
        }
      } catch (dbErr) {
        console.warn('Database save note:', dbErr);
      }

      // Update local state directly to match Supabase response instead of manual ID generation
      fetchFinishes();
      
      setFinishName('');
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerEdit = (finish: any) => {
    setEditingId(finish.id);
    setFinishName(finish.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFinishName('');
  };

  const handleDeleteFinish = async (id: number | string) => {
    if (!window.confirm('Are you sure you want to delete this Brand?')) return;
    try {
      const { error } = await supabase.from('inventory_surface_finishes').delete().eq('id', id);
      if (error) {
        toast.error('Deletion failed: ' + error.message);
        return;
      }
      
      toast.success('Brand deleted');
      fetchFinishes(); // Refresh the list
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const filteredFinishes = finishes.filter((f) =>
    (f.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredFinishes.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedFinishes = filteredFinishes.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-slate-800 dark:text-slate-100 font-sans">

      {/* SCREEN ROUTE TITLE HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
          Brands
        </h2>
      </div>

      {/* REGISTRATION FORM */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#111827] p-5 sm:p-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <MdTexture className="text-teal-600 text-lg" />
            <span>{editingId ? 'Edit Tile Brand' : 'Register New Tile Brand'}</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
            {finishes.length} Finishes Registered
          </span>
        </div>

        <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1.5">
              Brand Name *
            </label>
            <input
              type="text"
              required
              value={finishName}
              onChange={(e) => setFinishName(e.target.value)}
              placeholder="e.g. Lappato / Semi-Polished, Matte, High Gloss"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-50/50 dark:bg-slate-800/80 outline-none focus:border-teal-600 text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 py-2.5 px-6 text-xs font-bold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Spinner /> : editingId ? <MdCheckCircle /> : <MdAdd />}
              <span>{editingId ? 'Update Finish' : 'Add Brand'}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                <MdClose /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* FINISHES DIRECTORY TABLE */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#111827] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-200 py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-teal-600 text-xs font-bold text-slate-800 dark:text-white transition"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-2 text-xs w-full sm:w-auto text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Search:</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Brandes..."
              className="w-full sm:w-72 rounded-xl border border-slate-200 py-2 px-3.5 bg-slate-50/50 dark:bg-slate-800/60 dark:border-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-800 dark:text-white transition"
            />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <th className="py-3.5 px-4 w-16 text-center">S#</th>
                <th className="py-3.5 px-4">Brand Name</th>
                <th className="py-3.5 px-4 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-12">
                    <Spinner />
                  </td>
                </tr>
              ) : paginatedFinishes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-xs text-slate-400 italic">
                    No Brandes found.
                  </td>
                </tr>
              ) : (
                paginatedFinishes.map((finish, idx) => (
                  <tr key={finish.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs">
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{startIndex + idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <MdTexture className="text-teal-600 text-sm shrink-0" />
                      <span>{finish.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <TableActions
                        onEdit={() => handleTriggerEdit(finish)}
                        onDelete={() => handleDeleteFinish(finish.id)}
                        editTitle="Edit Finish"
                        deleteTitle="Delete Finish"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Showing {filteredFinishes.length > 0 ? startIndex + 1 : 0} to{' '}
            {Math.min(startIndex + pageSize, filteredFinishes.length)} of {filteredFinishes.length} finishes
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 font-bold text-teal-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SurfaceFinish;
