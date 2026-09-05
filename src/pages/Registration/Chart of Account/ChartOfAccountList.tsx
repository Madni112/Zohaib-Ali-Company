import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdAdd, MdAccountBalanceWallet, MdAutoAwesome, MdFolder, MdFolderOpen, MdInsertDriveFile, MdRemove } from 'react-icons/md';

const RECOMMENDED_DEFAULT_ACCOUNTS = [
    { account_code: '1010', account_title: 'Cash Box', category_code: '1. ASSETS', control_code: 'Cash', notes: 'Main cash in hand vault / cash register' },
    { account_code: '1011', account_title: 'Opening Balance', category_code: '3. EQUITY', control_code: 'Opening Balances', notes: 'Initial capital equity and opening balance account' },
    { account_code: '1020', account_title: 'Account Receivables (Payment From Customers)', category_code: '1. ASSETS', control_code: 'Customers', notes: 'Trade debtors and customer invoice receivables ledger' },
    { account_code: '1030', account_title: 'Merchandise Inventory (Stock in Hand)', category_code: '1. ASSETS', control_code: 'Inventory', notes: 'Stock assets for warehouse valuation' },
    { account_code: '2010', account_title: 'Accounts Payable (Trade Creditors)', category_code: '2. LIABILITIES', control_code: 'Vendor', notes: 'Supplier procurement and vendor liability' },
    { account_code: '4010', account_title: 'Sales Income Account', category_code: '4. REVENUE', control_code: 'Sales', notes: 'Primary gross commercial sales income' },
    { account_code: '4020', account_title: 'Discount Allowed (Sales Discount)', category_code: '4. REVENUE', control_code: 'Discounts', notes: 'Concessions granted to buyers' },
    { account_code: '4030', account_title: 'Discount Received (Purchase Discount)', category_code: '4. REVENUE', control_code: 'Discounts', notes: 'Discounts received from vendors' },
    { account_code: '5010', account_title: 'Purchases / Cost of Goods Sold', category_code: '5. EXPENSES', control_code: 'Cost of Sales', notes: 'Direct procurement cost of inventory' },
    { account_code: '5020', account_title: 'Office / Warehouse Rent Expense', category_code: '5. EXPENSES', control_code: 'Rent Expenses', notes: 'Monthly premises rental' },
    { account_code: '5030', account_title: 'Salaries & Staff Wages Expense', category_code: '5. EXPENSES', control_code: 'Payroll', notes: 'Monthly employee compensation' },
    { account_code: '5040', account_title: 'Transportation & Freight Charges', category_code: '5. EXPENSES', control_code: 'Logistics', notes: 'Carriage, courier, and shipping charges' },
    { account_code: '000', account_title: 'Electricity Bill', category_code: '5. EXPENSES', control_code: 'Utility Bills', notes: 'Monthly electricity and power utility expenses' },
];

const RECOMMENDED_CATEGORIES = [
    { name: '1. ASSETS' },
    { name: '2. LIABILITIES' },
    { name: '3. EQUITY' },
    { name: '4. REVENUE' },
    { name: '5. EXPENSES' },
];

const RECOMMENDED_CONTROLS = [
    { category_name: '1. ASSETS', control_name: 'Cash' },
    { category_name: '1. ASSETS', control_name: 'Banks' },
    { category_name: '1. ASSETS', control_name: 'Customers' },
    { category_name: '1. ASSETS', control_name: 'Inventory' },
    { category_name: '2. LIABILITIES', control_name: 'Vendor' },
    { category_name: '2. LIABILITIES', control_name: 'Payroll' },
    { category_name: '4. REVENUE', control_name: 'Sales' },
    { category_name: '4. REVENUE', control_name: 'Discounts' },
    { category_name: '4. REVENUE', control_name: 'Other Income' },
    { category_name: '5. EXPENSES', control_name: 'Cost of Sales' },
    { category_name: '5. EXPENSES', control_name: 'Utility Bills' },
    { category_name: '5. EXPENSES', control_name: 'Rent Expenses' },
    { category_name: '5. EXPENSES', control_name: 'Payroll' },
    { category_name: '5. EXPENSES', control_name: 'Logistics' },
    { category_name: '5. EXPENSES', control_name: 'General Expenses' },
    { category_name: '3. EQUITY', control_name: 'Opening Balances' },
    { category_name: '3. EQUITY', control_name: 'Capital' },
];

const ChartOfAccountList = () => {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchGeneralLedgerAccounts();
    }, []);

    const handleSeedRecommendedAccounts = async () => {
        if (!window.confirm('Would you like to auto-populate the recommended standard business Chart of Accounts (Receivables, Inventory, Payables, Sales Income, Purchases, Rent, Salaries, Discounts, etc.)? Any existing accounts will be preserved.')) return;

        try {
            setSeeding(true);

            // 1. Seed missing Categories
            const { data: existingCats } = await supabase.from('coa_categories').select('name');
            const existingCatNames = new Set((existingCats || []).map((c: any) => String(c.name).trim().toLowerCase()));
            const catsToInsert = RECOMMENDED_CATEGORIES.filter(c => !existingCatNames.has(c.name.toLowerCase()));
            if (catsToInsert.length > 0) {
                await supabase.from('coa_categories').insert(catsToInsert);
            }

            // 2. Seed missing Controls
            const { data: existingCtrls } = await supabase.from('coa_controls').select('category_name, control_name');
            const existingCtrlKeys = new Set((existingCtrls || []).map((c: any) => `${c.category_name}:::${c.control_name}`.toLowerCase()));
            const ctrlsToInsert = RECOMMENDED_CONTROLS.filter(c => !existingCtrlKeys.has(`${c.category_name}:::${c.control_name}`.toLowerCase()));
            if (ctrlsToInsert.length > 0) {
                await supabase.from('coa_controls').insert(ctrlsToInsert);
            }

            // 3. Seed missing Accounts
            const { data: existingAccounts } = await supabase.from('chart_of_accounts').select('account_code');
            const existingCodes = new Set((existingAccounts || []).map((a: any) => String(a.account_code).trim()));
            const accountsToInsert = RECOMMENDED_DEFAULT_ACCOUNTS.filter(a => !existingCodes.has(a.account_code));

            if (accountsToInsert.length > 0) {
                const { error: accInsertErr } = await supabase.from('chart_of_accounts').insert(accountsToInsert);
                if (accInsertErr) throw accInsertErr;
                toast.success(`Successfully populated ${accountsToInsert.length} recommended standard business accounts!`);
            } else {
                toast.success('All recommended standard accounts are already present in your directory.');
            }

            await fetchGeneralLedgerAccounts();
        } catch (err: any) {
            toast.error('Failed to populate default accounts: ' + err.message);
        } finally {
            setSeeding(false);
        }
    };

    const fetchGeneralLedgerAccounts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('chart_of_accounts')
                .select('*')
                .order('account_code', { ascending: true });

            if (error) throw error;
            setAccounts(data || []);
        } catch (err: any) {
            toast.error('Failed to load ledger accounts: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async (id: number | string) => {
        if (!window.confirm('Are you completely sure you want to permanently delete this sub-ledger account record? This can break historic financial statements.')) return;

        try {
            const { error } = await supabase
                .from('chart_of_accounts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Account profile removed cleanly from financial database.');
            fetchGeneralLedgerAccounts();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const filteredAccounts = accounts.filter((acc) =>
        acc.account_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.account_code?.includes(searchTerm) ||
        acc.control_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.category_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    };

    const isExpanded = (nodeId: string) => {
        return expandedNodes[nodeId] === true; // Default to false (collapsed)
    };

    const treeData = React.useMemo(() => {
        const tree: Record<string, Record<string, any[]>> = {};
        filteredAccounts.forEach(acc => {
            const cat = acc.category_code || 'Uncategorized';
            const ctrl = acc.control_code || 'Unassigned';
            if (!tree[cat]) tree[cat] = {};
            if (!tree[cat][ctrl]) tree[cat][ctrl] = [];
            tree[cat][ctrl].push(acc);
        });
        return tree;
    }, [filteredAccounts]);

    const handleKeyDown = (e: React.KeyboardEvent, type: string, id: string, payload?: any) => {
        if (e.key === 'ArrowRight') {
            if (!isExpanded(id)) toggleNode(id);
        } else if (e.key === 'ArrowLeft') {
            if (isExpanded(id)) toggleNode(id);
        } else if (e.key === 'Enter') {
            if (type === 'account' && payload) {
                navigate('/Registration/Chart-of-Account/Add', { state: { account: payload } });
            } else {
                toggleNode(id);
            }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const focusableElements = Array.from(document.querySelectorAll('.keyboard-nav-node')) as HTMLElement[];
            const currentIndex = focusableElements.indexOf(e.currentTarget as HTMLElement);
            if (e.key === 'ArrowDown' && currentIndex < focusableElements.length - 1) {
                focusableElements[currentIndex + 1].focus();
            } else if (e.key === 'ArrowUp' && currentIndex > 0) {
                focusableElements[currentIndex - 1].focus();
            }
        }
    };

    return (
        <div className="mx-auto max-w-7xl flex flex-col gap-6 relative text-xs">

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                    Chart of Accounts Ledger Directory
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={seeding}
                        onClick={handleSeedRecommendedAccounts}
                        className="flex items-center gap-1.5 justify-center rounded bg-emerald-600 hover:bg-emerald-700 py-2 px-3.5 text-xs font-bold text-white transition duration-150 shadow-sm cursor-pointer disabled:opacity-50"
                        title="Auto-create recommended business accounts (Receivables, Inventory, Payables, Sales, Rent, Salaries, etc.)"
                    >
                        <MdAutoAwesome size={15} />
                        {seeding ? 'Populating...' : 'Auto-Load Recommended Accounts'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/Registration/Chart-of-Account/Add')}
                        className="flex items-center justify-center rounded bg-primary py-2 px-4 text-xs font-bold text-white hover:bg-opacity-90 transition duration-150 shadow-sm cursor-pointer"
                    >
                        + Add New Account
                    </button>
                </div>
            </div>

            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {/* Pagination removed for tree view continuous flow */}
                    </div>

                    <div className="flex items-center gap-2 text-xs w-full sm:w-auto text-gray-500 dark:text-gray-400">
                        <span>Search:</span>
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search code, titles, controls..." className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none text-xs text-black dark:text-white focus:border-primary" />
                    </div>
                </div>

                <div className="max-w-full overflow-x-auto rounded-md bg-white dark:bg-meta-4/10 p-2 sm:p-4 border border-stroke dark:border-strokedark font-sans">
                    {loading ? (
                        <div className="text-center py-12"><Spinner /></div>
                    ) : filteredAccounts.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 italic">No ledger financial accounts found.</div>
                    ) : (
                        <div className="flex flex-col gap-2 min-w-[600px]">
                            {/* Header row to align columns */}
                            <div className="flex items-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-2 pb-2 border-b border-stroke dark:border-strokedark">
                                <div className="flex-1">Account Title / Group</div>
                                <div className="w-24 text-right">Account Code</div>
                                <div className="w-28 flex justify-center">Actions</div>
                            </div>

                            {Object.entries(treeData).sort(([a], [b]) => a.localeCompare(b)).map(([category, controls]) => (
                                <div key={category} className="flex flex-col gap-1.5">
                                    {/* Level 1: Category */}
                                    <div 
                                        className="keyboard-nav-node focus:outline-none focus:ring-2 focus:ring-primary focus:bg-slate-100 dark:focus:bg-slate-700 flex items-center gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-100 dark:border-slate-800 group"
                                        tabIndex={0}
                                        onKeyDown={(e) => handleKeyDown(e, 'category', `cat-${category}`)}
                                        onClick={() => toggleNode(`cat-${category}`)}
                                    >
                                        <button tabIndex={-1} className="text-slate-400 hover:text-emerald-600 transition bg-white dark:bg-slate-700 p-0.5 rounded shadow-sm border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                                            {isExpanded(`cat-${category}`) ? <MdRemove size={14} /> : <MdAdd size={14} />}
                                        </button>
                                        <MdFolder className="text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 transition" size={18} />
                                        <span className="font-black text-[13px] text-slate-900 dark:text-white uppercase tracking-tight">{category}</span>
                                        <span className="ml-2 text-[9px] font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">Category</span>
                                    </div>

                                    {isExpanded(`cat-${category}`) && (
                                        <div className="pl-6 flex flex-col gap-1 mt-0.5 border-l-2 border-slate-100 dark:border-slate-800 ml-3.5 mb-2">
                                            {Object.entries(controls).sort(([a], [b]) => a.localeCompare(b)).map(([control, accs]) => (
                                                <div key={control} className="flex flex-col gap-1 mt-0.5">
                                                    {/* Level 2: Control Group */}
                                                    <div 
                                                        className="keyboard-nav-node focus:outline-none focus:ring-2 focus:ring-primary focus:bg-slate-100 dark:focus:bg-slate-700 flex items-center gap-2 p-1.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 rounded transition group cursor-pointer"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => handleKeyDown(e, 'control', `ctrl-${category}-${control}`)}
                                                        onClick={() => toggleNode(`ctrl-${category}-${control}`)}
                                                    >
                                                        <button tabIndex={-1} className="text-slate-400 hover:text-emerald-600 transition bg-white dark:bg-slate-700 p-0.5 rounded shadow-sm border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                                                            {isExpanded(`ctrl-${category}-${control}`) ? <MdRemove size={12} /> : <MdAdd size={12} />}
                                                        </button>
                                                        <MdFolderOpen className="text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 transition" size={16} />
                                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{control}</span>
                                                        <span className="ml-2 text-[9px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">Group</span>
                                                    </div>

                                                    {isExpanded(`ctrl-${category}-${control}`) && (
                                                        <div className="pl-6 flex flex-col gap-1 mt-0.5 border-l-2 border-slate-100 dark:border-slate-800 ml-3.5 pb-2">
                                                            {accs.map((acc, index) => (
                                                                <div 
                                                                    key={acc.id} 
                                                                    className={`keyboard-nav-node focus:outline-none focus:ring-2 focus:ring-primary focus:bg-slate-100 dark:focus:bg-slate-700 flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition ${index !== accs.length - 1 ? 'border-b border-stroke dark:border-strokedark/50' : ''}`}
                                                                    tabIndex={0}
                                                                    onKeyDown={(e) => handleKeyDown(e, 'account', `acc-${acc.id}`, acc)}
                                                                >
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                        <MdInsertDriveFile className="text-slate-400 shrink-0" size={15} />
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{acc.account_title}</span>
                                                                    </div>
                                                                    <div className="w-24 text-right pr-4 text-emerald-600 dark:text-emerald-500 font-bold tracking-wider">{acc.account_code}</div>
                                                                    <div className="w-28 flex justify-center">
                                                                        <TableActions
                                                                            onEdit={() => navigate('/Registration/Chart-of-Account/Add', { state: { account: acc } })}
                                                                            onDelete={() => handleDeleteAccount(acc.id)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>

        </div>

    );
};

export default ChartOfAccountList;
