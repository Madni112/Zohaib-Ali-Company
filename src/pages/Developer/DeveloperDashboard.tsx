import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../ui/Spinner';
import DarkModeSwitcher from '../../components/Header/DarkModeSwitcher';
import {
  MdDashboard,
  MdPeople,
  MdAddBusiness,
  MdSecurity,
  MdCheckCircle,
  MdLaunch,
  MdRefresh,
  MdLock,
  MdStorage,
  MdCloudDone,
  MdVpnKey,
  MdLockOutline,
  MdPowerSettingsNew,
  MdContentCopy,
  MdEdit,
  MdCheck,
  MdKeyboardArrowDown,
  MdKeyboardArrowRight,
  MdAdminPanelSettings,
  MdLogout,
  MdLayers,
  MdBusiness,
  MdAddCircle,
  MdAccountBalance,
  MdLocationOn,
  MdVpnLock,
  MdBadge,
} from 'react-icons/md';
import { ROLE_PRESETS, RolePreset, getModulesForRole } from '../../constant/roles';

export interface PermissionSubNode {
  id: string;
  label: string;
}

export interface PermissionNode {
  id: string;
  label: string;
  children?: PermissionSubNode[];
}

export const PERMISSION_TREE: PermissionNode[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
  },
  {
    id: 'administration',
    label: 'Administration',
    children: [
      { id: '/Administration/Categories/List', label: 'Categories' },
      { id: '/Administration/Surface-Finish', label: 'Surface Finish' },
      { id: '/Administration/UOM/List', label: 'UOM' },
      { id: '/Administration/Brands', label: 'Brands' },
      { id: '/Administration/Products/List', label: 'Products' },
      { id: '/Administration/Locations/List', label: 'Locations' },
      { id: '/Administration/Transportation/List', label: 'Transportation' },
      { id: '/Administration/StockTransfer/List', label: 'Stock Transfer' },
      { id: '/company', label: 'Company' },
    ],
  },
  {
    id: 'registration',
    label: 'Registration',
    children: [
      { id: '/Registration/Chart-of-Account/List', label: 'Chart of Account' },
      { id: '/Registration/Vouchers/List', label: 'Vouchers' },
      { id: '/Registration/Bank-Account/BankAccountList', label: 'Bank Account' },
      { id: '/Inventory/OpeningStock/List', label: 'Opening Stock' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    children: [
      { id: '/sales/invoice/list', label: 'Invoice' },
      { id: '/Registration/InvoiceReceipt/List', label: 'Invoice Receipt' },
      { id: '/Sales-Return/Debit-Notes/List', label: 'Sales Return' },
      { id: '/sales/sales-return-receipt/list', label: 'Sales Return Receipt' },
      { id: '/Customers/list', label: 'Customers' },
      { id: '/Salesman/list', label: 'Salesman' },
      { id: '/Delivery-Challan/List', label: 'Delivery Challan' },
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    children: [
      { id: '/Purchase/Purchases/List', label: 'Purchases' },
      { id: '/Purchase/Purchase-Receipt/List', label: 'Purchase Receipt' },
      { id: '/Purchase/Purchase-Return/List', label: 'Purchase Return' },
      { id: '/Purchase/Purchase-Return-Receipt/List', label: 'Purchase Return Receipt' },
      { id: '/Purchase/Vendor/List', label: 'Vendor' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    children: [
      { id: '/Reports/Reports-Dashboard', label: 'Report Dashboard' },
      { id: '/Reports/Sales-Report', label: 'Sales Reports' },
      { id: '/Reports/Purchase-Report', label: 'Purchase Reports' },
      { id: '/Reports/Stock-Report', label: 'Stock Reports' },
      { id: '/Reports/Account-Report', label: 'Account Reports' },
      { id: '/Reports/Balance-Sheet', label: 'Balance Sheet' },
    ],
  },
];

export const getAllPermissionIds = (): string[] => {
  const ids: string[] = [];
  PERMISSION_TREE.forEach(node => {
    ids.push(node.id);
    if (node.children) {
      node.children.forEach(child => ids.push(child.id));
    }
  });
  return ids;
};

export interface EmployeeAccount {
  id: string;
  name: string;
  slug: string;
  email?: string;
  role: string;
  allowed_modules: string[];
  created_at: string;
}

// Master Super Admin / Developer Credentials
const DEV_EMAIL = 'admin@zohaibalicompany.com';
const DEV_PASSWORD = 'admin123';
const BACKUP_DEV_EMAIL = 'developer@noorhorizontechnologies.com';
const BACKUP_DEV_PASSWORD = 'NoorHorizon@5923';

/**
 * Hierarchical Permission Tree Selector Component with Group Expand/Collapse & Toggle All
 */
const PermissionTreeEditor: React.FC<{
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}> = ({ selectedIds, onChange }) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    administration: true,
    registration: true,
    sales: true,
    purchase: true,
    reports: true,
  });

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleToggleParent = (node: PermissionNode) => {
    if (!node.children) {
      const isSelected = selectedIds.includes(node.id);
      onChange(isSelected ? selectedIds.filter(id => id !== node.id) : [...selectedIds, node.id]);
      return;
    }

    const childIds = node.children.map(c => c.id);
    const allSelected = childIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      onChange(selectedIds.filter(id => id !== node.id && !childIds.includes(id)));
    } else {
      const newIds = Array.from(new Set([...selectedIds, node.id, ...childIds]));
      onChange(newIds);
    }
  };

  const handleToggleChild = (childId: string, parentNode: PermissionNode) => {
    const isSelected = selectedIds.includes(childId);
    let nextIds = isSelected
      ? selectedIds.filter(id => id !== childId)
      : [...selectedIds, childId];

    if (parentNode.children) {
      const anyChildActive = parentNode.children.some(c => nextIds.includes(c.id));
      if (anyChildActive) {
        if (!nextIds.includes(parentNode.id)) {
          nextIds.push(parentNode.id);
        }
      } else {
        nextIds = nextIds.filter(id => id !== parentNode.id);
      }
    }

    onChange(nextIds);
  };

  return (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
      {PERMISSION_TREE.map(node => {
        const hasChildren = Boolean(node.children && node.children.length > 0);
        const isExpanded = expandedNodes[node.id];

        if (!hasChildren) {
          const isChecked = selectedIds.includes(node.id);
          return (
            <div
              key={node.id}
              onClick={() => handleToggleParent(node)}
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                isChecked
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'bg-white dark:bg-boxdark border-stroke dark:border-strokedark text-gray-600 dark:text-gray-400 hover:border-emerald-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-black dark:text-white">{node.label}</span>
                <span className="text-[10px] text-gray-400">(General Overview)</span>
              </div>
              {isChecked ? (
                <MdCheckCircle className="text-emerald-600 dark:text-emerald-400 text-base" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-stroke dark:border-strokedark" />
              )}
            </div>
          );
        }

        const childIds = node.children!.map(c => c.id);
        const selectedChildrenCount = childIds.filter(id => selectedIds.includes(id)).length;
        const totalChildren = childIds.length;
        const allSelected = selectedChildrenCount === totalChildren && totalChildren > 0;
        const partiallySelected = selectedChildrenCount > 0 && selectedChildrenCount < totalChildren;

        return (
          <div
            key={node.id}
            className="rounded-xl border border-stroke dark:border-strokedark bg-white dark:bg-boxdark overflow-hidden shadow-xs"
          >
            {/* PARENT CATEGORY HEADER */}
            <div className="p-3 bg-gray-100 dark:bg-meta-4/40 flex items-center justify-between border-b border-stroke dark:border-strokedark">
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="flex items-center gap-2 text-xs font-bold text-black dark:text-white hover:text-emerald-600 transition cursor-pointer"
              >
                {isExpanded ? (
                  <MdKeyboardArrowDown className="text-lg text-gray-500" />
                ) : (
                  <MdKeyboardArrowRight className="text-lg text-gray-500" />
                )}
                <span>{node.label}</span>
                <span className="text-[10px] bg-gray-200 dark:bg-meta-4 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full font-mono">
                  {selectedChildrenCount} / {totalChildren} active
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleParent(node)}
                className={`text-[11px] px-2.5 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
                  allSelected
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : partiallySelected
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                    : 'bg-white dark:bg-boxdark text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white border border-stroke dark:border-strokedark'
                }`}
              >
                {allSelected ? (
                  <>
                    <MdCheckCircle className="text-xs text-emerald-600" /> All Selected
                  </>
                ) : (
                  'Toggle All'
                )}
              </button>
            </div>

            {/* EXPANDED SUB-PAGES / CATEGORIES */}
            {isExpanded && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50/50 dark:bg-meta-4/10">
                {node.children!.map(child => {
                  const isChildChecked = selectedIds.includes(child.id);
                  return (
                    <div
                      key={child.id}
                      onClick={() => handleToggleChild(child.id, node)}
                      className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                        isChildChecked
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-semibold'
                          : 'bg-white dark:bg-boxdark border-stroke dark:border-strokedark text-gray-700 dark:text-gray-300 hover:border-emerald-500'
                      }`}
                    >
                      <span className="truncate">{child.label}</span>
                      {isChildChecked ? (
                        <MdCheckCircle className="text-emerald-600 dark:text-emerald-400 text-sm shrink-0 ml-2" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-stroke dark:border-strokedark shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const DeveloperDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Developer Session State
  const [isDevAuthorized, setIsDevAuthorized] = useState<boolean>(() => {
    return sessionStorage.getItem('nht_dev_auth_session') === 'authorized';
  });

  // Login Form State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'create'>('overview');

  // Stats
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);

  // Employee Data
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);

  // Newly Created Result
  const [createdResult, setCreatedResult] = useState<{ name: string; email: string; role: string } | null>(null);

  // Edit Permissions Modal State
  const [editingEmployee, setEditingEmployee] = useState<EmployeeAccount | null>(null);
  const [editRole, setEditRole] = useState('Warehouse Manager');
  const [editModules, setEditModules] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Create Employee Form State
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Warehouse Manager',
    modules: ROLE_PRESETS['Warehouse Manager'].modules,
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isDevAuthorized) {
      fetchDevData();
    }
  }, [isDevAuthorized]);

  const handleDevLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const enteredEmail = emailInput.trim().toLowerCase();
    if (
      (enteredEmail === DEV_EMAIL.toLowerCase() && passwordInput === DEV_PASSWORD) ||
      (enteredEmail === BACKUP_DEV_EMAIL.toLowerCase() && passwordInput === BACKUP_DEV_PASSWORD)
    ) {
      sessionStorage.setItem('nht_dev_auth_session', 'authorized');
      setIsDevAuthorized(true);
      toast.success('Super Admin Console Access Granted');
    } else {
      setAuthError('Invalid administrator email or password.');
    }
  };

  const handleDevLogout = () => {
    sessionStorage.removeItem('nht_dev_auth_session');
    setIsDevAuthorized(false);
    setEmailInput('');
    setPasswordInput('');
    toast('Developer Session Terminated');
  };

  const fetchDevData = async () => {
    try {
      setLoading(true);

      const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
      setTotalProducts(prodCount || 0);

      const { count: invCount } = await supabase.from('sales_invoices').select('*', { count: 'exact', head: true });
      setTotalInvoices(invCount || 0);

      // Fetch saved employee tenant accounts
      const { data: tenantData } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      
      let formattedEmployees: EmployeeAccount[] = [];
      if (tenantData && tenantData.length > 0) {
        formattedEmployees = tenantData.map((t: any) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          email: t.email,
          role: t.role || t.business_activity || (t.name?.toLowerCase().includes('admin') ? 'Super Admin' : 'Staff'),
          allowed_modules: Array.isArray(t.allowed_modules) && t.allowed_modules.length > 0 ? t.allowed_modules : getAllPermissionIds(),
          created_at: t.created_at || new Date().toISOString(),
        }));
      } else {
        formattedEmployees = [
          {
            id: '1',
            name: 'Zohaib Ali (Super Admin)',
            slug: 'zohaib-admin',
            email: 'admin@zohaibalicompany.com',
            role: 'Super Admin',
            allowed_modules: ROLE_PRESETS['Super Admin'].modules,
            created_at: new Date().toISOString(),
          },
          {
            id: '2',
            name: 'Warehouse Manager',
            slug: 'warehouse-mgr',
            email: 'warehouse@zohaibalicompany.com',
            role: 'Warehouse Manager',
            allowed_modules: ROLE_PRESETS['Warehouse Manager'].modules,
            created_at: new Date().toISOString(),
          },
          {
            id: '3',
            name: 'Finance & Accounts',
            slug: 'accountant',
            email: 'accountant@zohaibalicompany.com',
            role: 'Accountant',
            allowed_modules: ROLE_PRESETS['Accountant'].modules,
            created_at: new Date().toISOString(),
          },
          {
            id: '4',
            name: 'Cashier Operator',
            slug: 'cashier',
            email: 'cashier@zohaibalicompany.com',
            role: 'Cashier',
            allowed_modules: ROLE_PRESETS['Cashier'].modules,
            created_at: new Date().toISOString(),
          },
        ];
      }

      setEmployees(formattedEmployees);
      setTotalEmployees(formattedEmployees.length);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load employee access data');
    } finally {
      setLoading(false);
    }
  };

  const applyRolePresetToNew = (presetKey: string) => {
    const preset = ROLE_PRESETS[presetKey];
    if (preset) {
      setNewEmployee(prev => ({
        ...prev,
        role: presetKey,
        modules: preset.modules,
      }));
      toast.success(`Loaded "${preset.name}" permission template`);
    }
  };

  const applyRolePresetToEdit = (presetKey: string) => {
    const preset = ROLE_PRESETS[presetKey];
    if (preset) {
      setEditRole(presetKey);
      setEditModules(preset.modules);
      toast.success(`Applied "${preset.name}" permissions`);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.email || !newEmployee.password) {
      toast.error('Please fill in all required employee fields');
      return;
    }

    try {
      setIsCreating(true);
      const cleanSlug = newEmployee.name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');

      // 1. Create User in Supabase Auth with allowed modules and role
      const { error: authError } = await supabase.auth.signUp({
        email: newEmployee.email.trim(),
        password: newEmployee.password,
        options: {
          data: {
            name: newEmployee.name.trim(),
            full_name: newEmployee.name.trim(),
            role: newEmployee.role,
            tenant_id: cleanSlug,
            business_name: 'Zohaib Ali & Company',
            allowed_modules: newEmployee.modules,
          },
        },
      });

      if (authError) throw authError;

      // 2. Record employee in tenants table
      try {
        await supabase.from('tenants').upsert([
          {
            name: newEmployee.name.trim(),
            slug: cleanSlug,
            email: newEmployee.email.trim(),
            business_activity: newEmployee.role,
            seller_address: 'Zohaib Ali & Company Headquarters',
            allowed_modules: newEmployee.modules,
          },
        ], { onConflict: 'slug' });
      } catch (err) {
        console.warn('Tenants table upsert:', err);
      }

      setCreatedResult({
        name: newEmployee.name.trim(),
        email: newEmployee.email.trim(),
        role: newEmployee.role,
      });

      toast.success(`Employee account "${newEmployee.name}" registered with role "${newEmployee.role}"!`);
      
      setNewEmployee({
        name: '',
        email: '',
        password: '',
        role: 'Warehouse Manager',
        modules: ROLE_PRESETS['Warehouse Manager'].modules,
      });
      fetchDevData();
    } catch (err: any) {
      toast.error('Registration failed: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditModal = (emp: EmployeeAccount) => {
    setEditingEmployee(emp);
    setEditRole(emp.role || 'Warehouse Manager');
    setEditModules(emp.allowed_modules || getAllPermissionIds());
  };

  const handleSaveEmployeePermissions = async () => {
    if (!editingEmployee) return;

    const isSuperAdminAccount =
      editingEmployee.role === 'Super Admin' ||
      editingEmployee.slug === 'zohaib-admin' ||
      editingEmployee.name?.toLowerCase().includes('super admin');

    if (isSuperAdminAccount) {
      toast.error('The Super Admin role is permanent and cannot be modified or downgraded.');
      setEditingEmployee(null);
      return;
    }

    try {
      setIsSavingEdit(true);
      
      // Attempt update with standard columns (business_activity, allowed_modules)
      const updatePayload: any = {
        business_activity: editRole,
        allowed_modules: editModules,
      };

      const { error } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('slug', editingEmployee.slug);

      if (error) {
        // Fallback update without crashing if specific column differs
        const { error: fallbackError } = await supabase
          .from('tenants')
          .update({ business_activity: editRole })
          .eq('slug', editingEmployee.slug);
        
        if (fallbackError) {
          console.warn('Tenant record fallback:', fallbackError);
        }
      }

      // Also update local cache for immediate effect
      try {
        localStorage.setItem(`nht_modules_${editingEmployee.slug}`, JSON.stringify(editModules));
      } catch (_) {}

      toast.success(`Role & permissions for "${editingEmployee.name}" updated!`);
      setEditingEmployee(null);
      fetchDevData();
    } catch (e: any) {
      toast.error('Update failed: ' + e.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // IF NOT AUTHENTICATED AS DEVELOPER -> SHOW SECURE LOGIN FORM
  if (!isDevAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 text-body dark:bg-boxdark-2 dark:text-bodydark flex flex-col items-center justify-center p-6 font-sans transition-colors duration-200">
        
        <div className="absolute top-6 right-6">
          <ul className="flex items-center gap-2 list-none m-0">
            <DarkModeSwitcher />
          </ul>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-boxdark border border-stroke dark:border-strokedark p-8 sm:p-10 rounded-3xl shadow-default space-y-6 transition-colors duration-200">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center text-3xl shadow-xs">
              <MdSecurity />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-black dark:text-white">Master Role & Dev Console</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Employee Access & Roles Control for Zohaib Ali & Company</p>
          </div>

          {authError && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-danger text-xs p-3 rounded-lg flex items-center gap-2">
              <MdLockOutline /> {authError}
            </div>
          )}

          <form onSubmit={handleDevLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-black dark:text-white mb-1.5">Master Developer Email</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="developer@noorhorizontechnologies.com"
                className="w-full bg-transparent dark:bg-form-input border border-stroke dark:border-form-strokedark rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black dark:text-white mb-1.5">Master Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-transparent dark:bg-form-input border border-stroke dark:border-form-strokedark rounded-xl p-3 text-xs text-black dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <MdVpnKey /> Authenticate Role Console
            </button>
          </form>

          <div className="pt-2 text-center">
            <a href="/" className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-emerald-600 transition">
              ← Return to Main Application
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-body dark:bg-boxdark-2 dark:text-bodydark font-sans p-6 md:p-10 flex flex-col items-center transition-colors duration-200">
      
      {/* HEADER */}
      <header className="w-full max-w-6xl bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-2xl p-6 shadow-default flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-2xl">
            <MdAdminPanelSettings />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-black dark:text-white tracking-tight">Zohaib Ali & Company</h1>
              <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Employee Role & Access Control
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
              Admin & Role Console: <span className="text-black dark:text-gray-200 font-medium">{DEV_EMAIL}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* TABS SWITCHER */}
          <div className="bg-gray-100 dark:bg-meta-4/30 p-1 rounded-xl border border-stroke dark:border-strokedark flex text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-1.5 px-3 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'overview' ? 'bg-white dark:bg-boxdark text-emerald-700 dark:text-white shadow-xs font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <MdDashboard /> Roles Overview
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`py-1.5 px-3 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'employees' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <MdPeople /> Employee Accounts ({employees.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`py-1.5 px-3 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'create' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <MdAddCircle /> Add Employee User
            </button>
          </div>

          <ul className="flex items-center gap-2 list-none m-0">
            <DarkModeSwitcher />
          </ul>

          <button
            onClick={handleDevLogout}
            title="Sign Out of Console"
            className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-danger border border-red-200 dark:border-red-500/30 transition cursor-pointer"
          >
            <MdLogout />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="w-full max-w-6xl space-y-6">
        
        {/* TAB 1: OVERVIEW METRICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white dark:bg-boxdark p-6 rounded-2xl border border-stroke dark:border-strokedark shadow-default transition-colors duration-200">
                <div className="flex justify-between items-center text-gray-500 dark:text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Employee Accounts</span>
                  <MdPeople className="text-emerald-600 text-xl" />
                </div>
                <div className="text-3xl font-black text-black dark:text-white">{totalEmployees}</div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Configured company user profiles</p>
              </div>

              <div className="bg-white dark:bg-boxdark p-6 rounded-2xl border border-stroke dark:border-strokedark shadow-default transition-colors duration-200">
                <div className="flex justify-between items-center text-gray-500 dark:text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Registered Products</span>
                  <MdLayers className="text-teal-600 text-xl" />
                </div>
                <div className="text-3xl font-black text-black dark:text-white">{totalProducts}</div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Inventory master catalog</p>
              </div>

              <div className="bg-white dark:bg-boxdark p-6 rounded-2xl border border-stroke dark:border-strokedark shadow-default transition-colors duration-200">
                <div className="flex justify-between items-center text-gray-500 dark:text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Processed Invoices</span>
                  <MdSecurity className="text-emerald-600 text-xl" />
                </div>
                <div className="text-3xl font-black text-black dark:text-white">{totalInvoices}</div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Total sales transactions recorded</p>
              </div>
            </div>

            {/* ROLE PRESET QUICK TEMPLATES */}
            <div className="bg-white dark:bg-boxdark p-6 rounded-2xl border border-stroke dark:border-strokedark shadow-default transition-colors duration-200">
              <h3 className="text-sm font-bold text-black dark:text-white mb-2 uppercase tracking-wider">Predefined Employee Role Templates</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Click any template below to create a new employee with pre-configured screen permissions:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                  <div
                    key={key}
                    onClick={() => {
                      applyRolePresetToNew(key);
                      setActiveTab('create');
                    }}
                    className="bg-gray-50 dark:bg-meta-4/20 p-4 rounded-xl border border-stroke dark:border-strokedark hover:border-emerald-500 dark:hover:border-emerald-500 transition cursor-pointer flex flex-col justify-between space-y-2 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{preset.icon}</span>
                        <h4 className="font-bold text-black dark:text-white text-sm group-hover:text-emerald-600 transition">{preset.name}</h4>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{preset.description}</p>
                    </div>
                    <div className="pt-2 flex justify-between items-center border-t border-stroke/50 dark:border-strokedark/50">
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        {preset.modules.length} Permitted Pages
                      </span>
                      <span className="text-xs text-emerald-600 font-bold group-hover:translate-x-1 transition-transform">
                        Use Role →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EMPLOYEE ACCOUNTS & PERMISSION MATRIX */}
        {activeTab === 'employees' && (
          <div className="bg-white dark:bg-boxdark rounded-2xl border border-stroke dark:border-strokedark shadow-default overflow-hidden transition-colors duration-200">
            <div className="p-6 border-b border-stroke dark:border-strokedark flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">Active Company Employee Accounts</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Manage individual employee permissions, roles, and allowed pages.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('create')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <MdAddCircle /> Add New Employee User
              </button>
            </div>

            <div className="max-w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-meta-4/30 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider border-b border-stroke dark:border-strokedark">
                    <th className="p-4">Employee Name</th>
                    <th className="p-4">Assigned Role</th>
                    <th className="p-4">Login Email</th>
                    <th className="p-4">Permitted Modules</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-strokedark">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-meta-4/20 transition">
                      <td className="p-4 font-bold text-black dark:text-white flex items-center gap-2">
                        <MdBadge className="text-emerald-600 text-base shrink-0" />
                        <span>{emp.name}</span>
                      </td>
                      <td className="p-4">
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-1 rounded-md text-[11px] font-bold">
                          {emp.role || 'Staff'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-gray-600 dark:text-gray-400">
                        {emp.email || '—'}
                      </td>
                      <td className="p-4">
                        <span className="bg-gray-100 dark:bg-meta-4 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-md text-[11px] font-mono border border-stroke dark:border-strokedark font-bold">
                          {emp.allowed_modules?.length || 0} pages allowed
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenEditModal(emp)}
                          className="inline-flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
                        >
                          <MdEdit /> Edit Role & Permissions
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CREATE NEW EMPLOYEE USER */}
        {activeTab === 'create' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {createdResult && (
              <div className="bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/50 rounded-2xl p-6 shadow-default space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                  <MdCheckCircle className="text-xl" />
                  <span>Employee Account Registered Successfully!</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Employee <strong>{createdResult.name}</strong> can now log into the application with email <code>{createdResult.email}</code> and their designated role <strong>{createdResult.role}</strong>.
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-boxdark p-8 rounded-2xl border border-stroke dark:border-strokedark shadow-default transition-colors duration-200">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-stroke dark:border-strokedark">
                <div>
                  <h3 className="text-xl font-extrabold text-black dark:text-white">Register New Employee User</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Assign a role (Warehouse Manager, Accountant, Cashier, etc.) and configure accessible pages.
                  </p>
                </div>
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                  <MdSecurity /> Zohaib Ali & Company RBAC
                </span>
              </div>

              <form onSubmit={handleCreateEmployee} className="space-y-6">
                
                {/* 1. EMPLOYEE DETAILS */}
                <div className="bg-gray-50 dark:bg-meta-4/20 p-5 rounded-xl border border-stroke dark:border-strokedark space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <MdBadge /> 1. Employee Profile & Login Credentials
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-black dark:text-white mb-1">
                        Employee Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ali Raza (Warehouse Lead)"
                        value={newEmployee.name}
                        onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                        className="w-full bg-white dark:bg-form-input border border-stroke dark:border-form-strokedark rounded-lg p-2.5 text-black dark:text-white text-xs outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-black dark:text-white mb-1">
                        Assigned Employee Role *
                      </label>
                      <select
                        value={newEmployee.role}
                        onChange={e => applyRolePresetToNew(e.target.value)}
                        className="w-full bg-white dark:bg-form-input border border-stroke dark:border-form-strokedark rounded-lg p-2.5 text-black dark:text-white text-xs outline-none focus:border-emerald-500 font-semibold"
                      >
                        {Object.keys(ROLE_PRESETS).map(roleKey => (
                          <option key={roleKey} value={roleKey}>
                            {ROLE_PRESETS[roleKey].name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-black dark:text-white mb-1">Login Email / Username *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. warehouse@zohaibalicompany.com"
                        value={newEmployee.email}
                        onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                        className="w-full bg-white dark:bg-form-input border border-stroke dark:border-form-strokedark rounded-lg p-2.5 text-black dark:text-white text-xs outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-black dark:text-white mb-1">Login Password *</label>
                      <input
                        type="password"
                        required
                        placeholder="8+ Characters"
                        value={newEmployee.password}
                        onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })}
                        className="w-full bg-white dark:bg-form-input border border-stroke dark:border-form-strokedark rounded-lg p-2.5 text-black dark:text-white text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. ROLE PRESETS QUICK-BAR */}
                <div className="bg-gray-50 dark:bg-meta-4/20 p-5 rounded-xl border border-stroke dark:border-strokedark space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <MdLayers /> 2. Fast Role Template Selector
                    </h4>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                      Selected: <strong className="text-emerald-600">{newEmployee.modules.length} Pages</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => applyRolePresetToNew(key)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                          newEmployee.role === key
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-boxdark text-gray-700 dark:text-gray-300 border-stroke dark:border-strokedark hover:border-emerald-500'
                        }`}
                      >
                        <span>{preset.icon}</span>
                        <span>{key}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. PERMISSION TREE EDITOR */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <MdSecurity /> 3. Fine-Grained Module & Page Permissions
                  </h4>
                  <PermissionTreeEditor
                    selectedIds={newEmployee.modules}
                    onChange={ids => setNewEmployee({ ...newEmployee, modules: ids })}
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-stroke dark:border-strokedark">
                  <button
                    type="button"
                    onClick={() => setActiveTab('employees')}
                    className="px-5 py-2.5 rounded-xl border border-stroke dark:border-strokedark text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-meta-4 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isCreating ? <Spinner /> : <MdCheckCircle />} Register Employee Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* EDIT EMPLOYEE PERMISSIONS MODAL */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/60 z-99999 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-boxdark w-full max-w-2xl rounded-3xl border border-stroke dark:border-strokedark p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-stroke dark:border-strokedark pb-4">
              <div>
                <h4 className="text-lg font-bold text-black dark:text-white">Edit Employee Role & Permissions</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Employee: <strong className="text-emerald-700 dark:text-emerald-400">{editingEmployee.name}</strong> ({editingEmployee.email})
                </p>
              </div>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] px-3 py-1 rounded-md font-mono font-bold border border-emerald-200 dark:border-emerald-800/60">
                {editModules.length} Pages Permitted
              </span>
            </div>

            {/* QUICK PRESET TEMPLATES */}
            {editingEmployee.role === 'Super Admin' || editingEmployee.slug === 'zohaib-admin' ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-3">
                <span className="text-2xl">👑</span>
                <div>
                  <h5 className="font-bold text-amber-900 dark:text-amber-200">Super Admin (Owner) Role is Permanent</h5>
                  <p className="mt-0.5 text-[11px] opacity-90">This master account maintains unrestricted access to all business modules and controls. Its role cannot be modified or downgraded.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-black dark:text-white">Role Template Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => applyRolePresetToEdit(key)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 transition cursor-pointer ${
                        editRole === key
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-gray-100 dark:bg-meta-4/40 text-gray-700 dark:text-gray-300 border-stroke dark:border-strokedark hover:border-emerald-500'
                      }`}
                    >
                      <span>{preset.icon}</span>
                      <span>{key}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PERMISSION TREE */}
            <div className="flex-1 overflow-y-auto pr-1">
              <PermissionTreeEditor
                selectedIds={editModules}
                onChange={ids => setEditModules(ids)}
              />
            </div>

            {/* MODAL ACTIONS */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stroke dark:border-strokedark">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 border border-stroke dark:border-strokedark rounded-xl hover:bg-gray-100 dark:hover:bg-meta-4 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEmployeePermissions}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? <Spinner /> : <MdCheck />} Save Role & Permissions
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default DeveloperDashboard;
