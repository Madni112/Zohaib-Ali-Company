import React, { useEffect, useState } from 'react'; 
import { useNavigate } from 'react-router-dom'; 
import { supabase } from '../../../Context/supabaseClient'; 
import { toast } from 'react-hot-toast'; 
import Spinner from '../../../ui/Spinner'; 
import TableActions from '../../../ui/TableActions';
import { useAuth } from '../../../Context/Auth';

const SalesmanHistory = () => { 
  const [salesmen, setSalesmen] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true); 
  const navigate = useNavigate(); 

  // Datatable search and page handlers
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { 
    fetchSalesmen(); 
  }, []); 

  const fetchSalesmen = async () => { 
    setLoading(true); 
    try { 
      const { data, error } = await supabase 
        .from('salesmen') 
        .select('*') 
        .order('name', { ascending: true }); 
      
      if (error) throw error; 
      setSalesmen(data || []); 
    } catch (err: any) { 
      toast.error(err.message); 
    } finally { 
      setLoading(false); 
    } 
  }; 

  const handleDelete = async (id: string) => { 
    if (window.confirm('Are you sure you want to delete this salesman record?')) { 
      try { 
        const { error } = await supabase.from('salesmen').delete().eq('id', id); 
        if (error) throw error; 
        toast.success('Salesman record deleted successfully'); 
        fetchSalesmen(); 
      } catch (err: any) { 
        toast.error(err.message); 
      } 
    } 
  }; 

  // Live query filter match (Removed email parameter lookup)
  const filteredSalesmen = salesmen.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm) ||
    s.area?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination parameters math bounds
  const totalEntries = filteredSalesmen.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedSalesmen = filteredSalesmen.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  return ( 
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-6 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5"> 
      
      {/* Top Header Section */}
      <div className="flex justify-between items-center mb-6"> 
        <h4 className="text-xl font-semibold text-black dark:text-white">Sales Team Directory</h4> 
        <button 
          onClick={() => navigate('/Salesman/add')} 
          className="bg-primary text-white py-2 px-4 rounded text-sm font-medium hover:bg-opacity-90 transition shadow-sm" 
        > 
          + Add New 
        </button> 
      </div> 

      {/* Filter and Input line controllers */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none focus:border-primary text-sm font-medium text-black dark:text-white"
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
            placeholder="Search team..."
            className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none focus:border-primary text-sm text-black dark:text-white"
          />
        </div>
      </div>

      {/* Main Table Output Wireframe Container */}
      <div className="max-w-full overflow-x-auto"> 
        <table className="w-full table-auto border-collapse"> 
          <thead> 
            <tr className="bg-gray-2 text-left dark:bg-meta-4"> 
              <th className="py-4 px-4 font-medium text-black dark:text-white text-sm w-16">S#</th>
              <th className="min-w-[220px] py-4 px-4 font-medium text-black dark:text-white text-sm">Salesman Name</th> 
              <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white text-sm">Phone</th> 
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white text-sm">Area</th> 
              <th className="py-4 px-4 font-medium text-black dark:text-white text-sm text-center w-28">Actions</th> 
            </tr> 
          </thead> 
          <tbody> 
            {loading ? ( 
              <tr><td colSpan={5} className="py-12 text-center"><Spinner /></td></tr> 
            ) : paginatedSalesmen.length === 0 ? ( 
              <tr><td colSpan={5} className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">No salesman records found.</td></tr> 
            ) : ( 
              paginatedSalesmen.map((salesman, idx) => {
                const serialNumber = startIndex + idx + 1;

                return ( 
                  <tr key={salesman.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150"> 
                    <td className="py-3.5 px-4 text-sm text-black dark:text-white">{serialNumber}</td>
                    <td className="py-3.5 px-4 text-sm font-medium text-black dark:text-white"> 
                      {salesman.name}
                    </td> 
                    <td className="py-3.5 px-4 text-sm text-black dark:text-white"> 
                      {salesman.phone || 'N/A'}
                    </td> 
                    <td className="py-3.5 px-4 text-sm"> 
                      <p className="inline-flex rounded-full bg-success bg-opacity-10 py-1 px-3 text-xs font-medium text-success"> 
                        {salesman.area || 'General'} 
                      </p> 
                    </td> 
                    <td className="py-3.5 px-4 text-center"> 
                      <TableActions
                        onEdit={() => navigate('/Salesman/add', { state: { salesman } })}
                        onDelete={() => handleDelete(salesman.id)}
                        editTitle="Edit Salesman"
                        deleteTitle="Delete Salesman"
                      />
                    </td> 
                  </tr> 
                );
              }) 
            )} 
          </tbody> 
        </table> 
      </div> 

      {/* Pagination control footer strip */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-stroke dark:border-strokedark">
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
  ); 
}; 

export default SalesmanHistory;
