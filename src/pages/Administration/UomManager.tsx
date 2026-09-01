import React, { useEffect, useState } from 'react';
import { supabase } from '../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../ui/Spinner';
import { useAuth } from '../../Context/Auth';

const UomManager = () => {
  const { tenantId } = useAuth();
  const [uoms, setUoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUomCatalog();
  }, [tenantId]);

  const fetchUomCatalog = async () => {
    try {
      setLoading(true);
      const activeTenant = tenantId || 'bashir';

      let { data, error } = await supabase
        .from('inventory_uom')
        .select('*')
        .eq('tenant_id', activeTenant)
        .order('id', { ascending: true });

      if (error) throw error;

      // If tenant doesn't have UOM rows yet, seed from base template
      if (!data || data.length === 0) {
        const { data: templateData } = await supabase
          .from('inventory_uom')
          .select('short_code, full_name, category')
          .eq('tenant_id', 'bashir');

        if (templateData && templateData.length > 0) {
          const newRows = templateData.map(t => ({
            ...t,
            tenant_id: activeTenant,
            is_active: t.short_code === 'PCS'
          }));

          const { data: inserted, error: insertErr } = await supabase
            .from('inventory_uom')
            .upsert(newRows, { onConflict: 'tenant_id,short_code' })
            .select('*')
            .order('id', { ascending: true });

          if (!insertErr && inserted) {
            data = inserted;
          }
        }
      }

      setUoms(data || []);
    } catch (err: any) {
      toast.error('Failed to load units list from Supabase: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  // HANDLES LIVE DATABASE UPDATE WHEN USER CLICKS FLIP ON/OFF TOGGLE SWITCH BUTTON
  const handleToggleState = async (id: number | string, currentStatus: boolean) => {
    try {
      // Optimistic state change on UI for immediate interaction response
      setUoms(prev => prev.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u));

      const { error } = await supabase
        .from('inventory_uom')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error; {
        !currentStatus ?

          toast.success('UOM Turned ON') :
          toast.error('UOM Turned OFF')
      }
    } catch (err: any) {
      toast.error('Database Sync Failure: ' + err.message);
      fetchUomCatalog();
    }
  };

  // Live keypress filtering parameters matching
  const filteredUoms = uoms.filter(u =>
    u.short_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group units dynamically by their Category Strings
  const groupedUoms = filteredUoms.reduce((acc: any, curr: any) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-xs">

      {/* COMPONENT SUMMARY BAR HEADINGS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Units of Measurement (UOM) Switchboard</h2>
          <p className="text-gray-400 mt-0.5 text-xs">Turn individual units On or Off to instantly control dropdown visibility across active ERP forms.</p>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search codes or headers..."
          className="w-full sm:w-72 rounded border border-stroke py-2 px-3 bg-white dark:bg-boxdark dark:border-strokedark outline-none focus:border-primary text-black dark:text-white shadow-xs"
        />
      </div>

      {loading && uoms.length === 0 ? (
        <div className="flex h-48 items-center justify-center bg-white dark:bg-boxdark rounded border border-stroke dark:border-strokedark"><Spinner /></div>
      ) : Object.keys(groupedUoms).length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-boxdark rounded border border-stroke text-gray-500 font-medium">No active units located matching search parameters keywords.</div>
      ) : (
        /* ACCORDION CATEGORIZED GROUPS WRAPPER */
        <div className="space-y-6">
          {Object.keys(groupedUoms).map((categoryName) => (
            <div key={categoryName} className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden shadow-xs">

              {/* Categorized Ribbon Strip Label */}
              <div className="bg-gray-100 dark:bg-meta-4 px-5 py-3 border-b border-stroke dark:border-strokedark">
                <h3 className="font-extrabold text-black dark:text-white tracking-wider text-[11px] uppercase">
                  {categoryName}
                </h3>
              </div>

              {/* Grid block loop to render items side-by-side */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedUoms[categoryName].map((unit: any) => {
                  return (
                    <div
                      key={unit.id}
                      className={`flex items-center justify-between p-3 rounded border duration-150 transition
                        ${unit.is_active
                          ? 'border-success/30 bg-success/5 text-black dark:text-white font-semibold'
                          : 'border-stroke bg-white dark:border-strokedark dark:bg-boxdark text-gray-400'
                        }`}
                    >
                      <div className="truncate pr-2">
                        <span className={`font-mono font-bold mr-1.5 px-1.5 py-0.5 rounded text-[11px]
                          ${unit.is_active ? 'bg-success/20 text-success' : 'bg-gray-100 dark:bg-meta-4 text-gray-400'}`}>
                          {unit.short_code}
                        </span>
                        <span>= {unit.full_name}</span>
                      </div>

                      {/* IOS STYLED FLIP ACTIVE SWITCH TOGGLE CONTROL TRIGGER BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleToggleState(unit.id, unit.is_active)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none
                          ${unit.is_active ? 'bg-success' : 'bg-gray-300 dark:bg-meta-4'}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out
                            ${unit.is_active ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default UomManager;
