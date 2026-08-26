import React, { useEffect, useState } from 'react'; 
import { useNavigate } from 'react-router-dom'; 
import { supabase } from '../../../Context/supabaseClient'; 
import { toast } from 'react-hot-toast'; 
import Spinner from '../../../ui/Spinner'; 
import TableActions from '../../../ui/TableActions';
import { useAuth } from '../../../Context/Auth';

const CustomerHistory = () => { 
  const { tenantId } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true); 
  const navigate = useNavigate(); 


  // Datatable search and pagination trackers
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { 
    fetchCustomers(); 
  }, []); 

  const fetchCustomers = async () => { 
    setLoading(true); 
    try { 
      const { data, error } = await supabase 
        .from('customers') 
        .select('*') 
        .order('customerName', { ascending: true }); 
      
      if (error) throw error; 
      setCustomers(data || []); 
    } catch (err: any) { 
      toast.error(err.message); 
    } finally { 
      setLoading(false); 
    } 
  }; 

  const handleDelete = async (id: string) => { 
    if (window.confirm('Are you sure you want to delete this customer? This cannot be undone.')) { 
      try { 
        const { error } = await supabase.from('customers').delete().eq('id', id); 
        if (error) throw error; 
        toast.success('Customer deleted successfully'); 
        fetchCustomers(); 
      } catch (err: any) { 
        toast.error(err.message); 
      } 
    } 
  }; 

  // Live filter query filter condition evaluation
  const filteredCustomers = customers.filter(c => 
    c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ntnNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.primaryPhone?.includes(searchTerm)
  );

  // Pagination calculation vectors
  const totalEntries = filteredCustomers.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  return ( 
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-6 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5"> 
      
      {/* Dynamic Header Layout */}
      <div className="flex justify-between items-center mb-6"> 
        <h4 className="text-xl font-semibold text-black dark:text-white">Customer Database</h4> 
        <button 
          onClick={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Customers/customer-details`)} 
          className="bg-primary text-white py-2 px-4 rounded text-sm font-medium hover:bg-opacity-90 transition cursor-pointer shadow-sm" 
        > 
          + Add New Customer
        </button> 
      </div> 


      {/* Datatable Filter Control Header Line */}
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
            placeholder="Search customers..."
            className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none focus:border-primary text-sm text-black dark:text-white"
          />
        </div>
      </div>

      {/* Core Table Canvas Frame */}
      <div className="max-w-full overflow-x-auto"> 
        <table className="w-full table-auto border-collapse"> 
          <thead> 
            <tr className="bg-gray-2 text-left dark:bg-meta-4"> 
              <th className="py-4 px-4 font-medium text-black dark:text-white text-sm w-16">S#</th>
              <th className="min-w-[200px] py-4 px-4 font-medium text-black dark:text-white text-sm">Name</th> 
              <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white text-sm">NTN / CNIC</th> 
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white text-sm">Phone</th> 
              <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white text-sm">Province</th> 
              <th className="py-4 px-4 font-medium text-black dark:text-white text-sm text-center w-28">Actions</th> 
            </tr> 
          </thead> 
          <tbody> 
            {loading ? ( 
              <tr><td colSpan={6} className="text-center py-12"><Spinner /></td></tr> 
            ) : paginatedCustomers.length === 0 ? ( 
              <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">No matching customer entries found.</td></tr> 
            ) : ( 
              paginatedCustomers.map((c, idx) => {
                const serialNumber = startIndex + idx + 1;

                return ( 
                  <tr key={c.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150"> 
                    <td className="py-3.5 px-4 text-sm text-black dark:text-white">{serialNumber}</td>
                    <td className="py-3.5 px-4 text-sm"> 
                      <p className="font-medium text-black dark:text-white">{c.customerName}</p> 
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.company || 'Private Customer'}</p> 
                    </td> 
                    <td className="py-3.5 px-4 text-sm"> 
                      <p className="text-black dark:text-white font-mono text-xs">NTN: {c.ntnNo || 'N/A'}</p> 
                      {c.stRegNo && <p className="text-[11px] text-primary font-mono font-semibold">STRN: {c.stRegNo}</p>}
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">CNIC: {c.cnicNo || 'N/A'}</p> 
                    </td> 
                    <td className="py-3.5 px-4 text-sm text-black dark:text-white"><p>{c.primaryPhone || 'N/A'}</p></td> 
                    <td className="py-3.5 px-4 text-sm text-black dark:text-white"><p>{c.province || 'N/A'}</p></td> 
                    <td className="py-3.5 px-4 text-center"> 
                      <TableActions
                        onEdit={() => navigate(`${tenantId ? `/${tenantId}` : ''}/Customers/customer-details`, { state: { customer: c } })}
                        onDelete={() => handleDelete(c.id)}
                        editTitle="Edit Customer"
                        deleteTitle="Delete Customer"
                      />
                    </td> 

                  </tr> 
                );
              }) 
            )} 
          </tbody> 
        </table> 
      </div> 

      {/* CALCULATED DATA COORDS SUMMARY METRIC FOOTER STRIP */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-stroke dark:border-strokedark">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {startIndex + 1} to {endIndex} of {totalEntries} entries
          {searchTerm && ` (filtered from ${customers.length} total customers)`}
        </div>

        {/* Dynamic Page Controls Buttons Array Map */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              className="px-3 py-1.5 rounded text-xs font-medium border border-stroke dark:border-strokedark hover:bg-gray-100 dark:hover:bg-meta-4 transition disabled:opacity-30"
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index + 1}
                onClick={() => setCurrentPage(index + 1)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                  currentPage === index + 1
                    ? 'bg-primary text-white border-primary'
                    : 'border-stroke dark:border-strokedark text-gray-500 hover:bg-gray-50'
                }`}
              >
                {index + 1}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 rounded text-xs font-medium border border-stroke dark:border-strokedark hover:bg-gray-100 dark:hover:bg-meta-4 transition disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

    </div> 
  ); 
}; 

export default CustomerHistory;
