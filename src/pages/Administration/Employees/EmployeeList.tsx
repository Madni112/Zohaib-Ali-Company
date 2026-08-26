import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdAdd, MdBadge } from 'react-icons/md';

const EmployeeList = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination bounds vectors and search filtering parameters states
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hr_employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      toast.error('Failed to load employee directory records: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: number | string) => {
    if (!window.confirm('Are you certain you want to permanently delete this employee account?')) return;

    try {
      const { error } = await supabase
        .from('hr_employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Employee staff profile removed cleanly.');
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cnic?.includes(searchTerm)
  );

  const totalEntries = filteredEmployees.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative">
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
          Employee
        </h2>
        <button
          type="button"
          onClick={() => navigate('/Administration/Employees/Add')}
          className="flex items-center justify-center rounded bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-opacity-90 transition duration-150 shadow-sm"
        >
          + Add New
        </button>
      </div>

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
        
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
              placeholder="Search staff name, ranks, CNIC..." 
              className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs text-black dark:text-white" 
            />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                <th className="py-4 px-4 font-semibold text-xs w-16">S#</th>
                <th className="py-4 px-4 font-semibold text-xs">Staff Worker Name</th>
                <th className="py-4 px-4 font-semibold text-xs">Designation</th>
                <th className="py-4 px-4 font-semibold text-xs">Gender</th>
                <th className="py-4 px-4 font-semibold text-xs">Joining Date</th>
                <th className="py-4 px-4 font-semibold text-xs">Contact Phone</th>
                <th className="py-4 px-4 font-semibold text-xs">CNIC ID Number</th>
                <th className="py-4 px-4 font-semibold text-xs w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-xs"><Spinner /></td>
                </tr>
              ) : paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-xs text-gray-500 dark:text-gray-400">No data available in table</td>
                </tr>
              ) : (
                paginatedEmployees.map((emp, idx) => {
                  const serialNumber = startIndex + idx + 1;

                  return (
                    <tr key={emp.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150 text-xs">
                      <td className="py-3.5 px-4 font-medium">{serialNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-black dark:text-white uppercase tracking-tight">{emp.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px]">
                          <MdBadge size={12} /> {emp.designation || 'General Staff'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 font-semibold">{emp.gender || 'Male'}</td>
                      <td className="py-3.5 px-4 text-gray-500 font-medium">{emp.joining_date || 'N/A'}</td>
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 font-medium">{emp.phone || '-'}</td>
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 font-mono">{emp.cnic || '-'}</td>
                      
                      <td className="py-3.5 px-4 text-center">
                        <TableActions
                          onEdit={() => navigate('/Administration/Employees/Add', { state: { employee: emp } })}
                          onDelete={() => handleDeleteEmployee(emp.id)}
                          editTitle="Edit Employee"
                          deleteTitle="Delete Employee"
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

export default EmployeeList;
