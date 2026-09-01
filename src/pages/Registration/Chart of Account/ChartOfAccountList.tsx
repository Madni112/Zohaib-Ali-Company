import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../Context/supabaseClient';
import { toast } from 'react-hot-toast';
import Spinner from '../../../ui/Spinner';
import TableActions from '../../../ui/TableActions';
import { MdAdd, MdAccountBalanceWallet, MdAutoAwesome } from 'react-icons/md';

const RECOMMENDED_DEFAULT_ACCOUNTS = [
    { account_code: '1010', account_title: 'Cash Box', category_code: 'A-Assets', control_code: 'Cash', notes: 'Main cash in hand vault / cash register' },
    { account_code: '1011', account_title: 'Opening Balance', category_code: 'Equity/Capital', control_code: 'Opening Balances', notes: 'Initial capital equity and opening balance account' },
    { account_code: '1020', account_title: 'Account Receivables (Payment From Customers)', category_code: 'A-Assets', control_code: 'Customers', notes: 'Trade debtors and customer invoice receivables ledger' },
    { account_code: '1030', account_title: 'Merchandise Inventory (Stock in Hand)', category_code: 'A-Assets', control_code: 'Inventory', notes: 'Stock assets for warehouse valuation' },
    { account_code: '2010', account_title: 'Accounts Payable (Trade Creditors)', category_code: 'L-Liabilities', control_code: 'Vendor', notes: 'Supplier procurement and vendor liability' },
    { account_code: '4010', account_title: 'Sales Income Account', category_code: 'Income', control_code: 'Sales', notes: 'Primary gross commercial sales income' },
    { account_code: '4020', account_title: 'Discount Allowed (Sales Discount)', category_code: 'Income', control_code: 'Discounts', notes: 'Concessions granted to buyers' },
    { account_code: '4030', account_title: 'Discount Received (Purchase Discount)', category_code: 'Income', control_code: 'Discounts', notes: 'Discounts received from vendors' },
    { account_code: '5010', account_title: 'Purchases / Cost of Goods Sold', category_code: 'Expenses', control_code: 'Cost of Sales', notes: 'Direct procurement cost of inventory' },
    { account_code: '5020', account_title: 'Office / Warehouse Rent Expense', category_code: 'Expenses', control_code: 'Rent Expenses', notes: 'Monthly premises rental' },
    { account_code: '5030', account_title: 'Salaries & Staff Wages Expense', category_code: 'Expenses', control_code: 'Payroll', notes: 'Monthly employee compensation' },
    { account_code: '5040', account_title: 'Transportation & Freight Charges', category_code: 'Expenses', control_code: 'Logistics', notes: 'Carriage, courier, and shipping charges' },
    { account_code: '000', account_title: 'Electricity Bill', category_code: 'Expenses', control_code: 'Utility Bills', notes: 'Monthly electricity and power utility expenses' },
];

const RECOMMENDED_CATEGORIES = [
    { name: 'A-Assets' },
    { name: 'L-Liabilities' },
    { name: 'Income' },
    { name: 'Expenses' },
    { name: 'Equity/Capital' },
];

const RECOMMENDED_CONTROLS = [
    { category_name: 'A-Assets', control_name: 'Cash' },
    { category_name: 'A-Assets', control_name: 'Banks' },
    { category_name: 'A-Assets', control_name: 'Customers' },
    { category_name: 'A-Assets', control_name: 'Inventory' },
    { category_name: 'L-Liabilities', control_name: 'Vendor' },
    { category_name: 'L-Liabilities', control_name: 'Payroll' },
    { category_name: 'Income', control_name: 'Sales' },
    { category_name: 'Income', control_name: 'Discounts' },
    { category_name: 'Income', control_name: 'Other Income' },
    { category_name: 'Expenses', control_name: 'Cost of Sales' },
    { category_name: 'Expenses', control_name: 'Utility Bills' },
    { category_name: 'Expenses', control_name: 'Rent Expenses' },
    { category_name: 'Expenses', control_name: 'Payroll' },
    { category_name: 'Expenses', control_name: 'Logistics' },
    { category_name: 'Expenses', control_name: 'General Expenses' },
    { category_name: 'Equity/Capital', control_name: 'Opening Balances' },
    { category_name: 'Equity/Capital', control_name: 'Capital' },
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

    const totalEntries = filteredAccounts.length;
    const totalPages = Math.ceil(totalEntries / pageSize);
    const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalEntries);
    const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

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
                        <span>Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="rounded border border-stroke py-1 px-2 bg-transparent dark:border-strokedark outline-none focus:border-primary text-xs font-semibold text-black dark:text-white"
                        >
                            {[10, 20, 50, 100].map((size: number) => (
                                <option key={size} value={size} className="dark:bg-boxdark">{size}</option>
                            ))}
                        </select>
                        <span>entries</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs w-full sm:w-auto text-gray-500 dark:text-gray-400">
                        <span>Search:</span>
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search code, titles, controls..." className="w-full sm:w-64 rounded border border-stroke py-1.5 px-3 bg-transparent dark:border-strokedark outline-none text-xs text-black dark:text-white" />
                    </div>
                </div>

                <div className="max-w-full overflow-x-auto">
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr className="bg-gray-2 text-left dark:bg-meta-4 text-xs font-bold uppercase tracking-wider text-black dark:text-white border-b border-stroke dark:border-strokedark">
                                <th className="py-4 px-4 font-semibold w-16">S#</th>
                                <th className="py-4 px-4 font-semibold w-28">Account Code</th>
                                <th className="py-4 px-4 font-semibold">Account Title</th>
                                <th className="py-4 px-4 font-semibold">Control Classification Group</th>
                                <th className="py-4 px-4 font-semibold w-36">Main Category</th>
                                <th className="py-4 px-4 font-semibold text-center w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-12"><Spinner /></td></tr>
                            ) : paginatedAccounts.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No ledger financial accounts registered.</td></tr>
                            ) : (
                                paginatedAccounts.map((account, idx) => {
                                    const serialNumber = startIndex + idx + 1;
                                    return (
                                        <tr key={account.id} className="border-b border-stroke dark:border-strokedark hover:bg-slate-50 dark:hover:bg-meta-4/10 duration-150">
                                            <td className="py-3.5 px-4 font-medium text-black dark:text-white">{serialNumber}</td>
                                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">{account.account_code}</td>
                                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
                                                <MdAccountBalanceWallet size={14} className="text-emerald-600 dark:text-emerald-400" /> {account.account_title}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-semibold">{account.control_code}</td>
                                            <td className="py-3.5 px-4">
                                                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                                    {account.category_code}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <TableActions
                                                    onEdit={() => navigate('/Registration/Chart-of-Account/Add', { state: { account } })}
                                                    onDelete={() => handleDeleteAccount(account.id)}
                                                    editTitle="Edit Account"
                                                    deleteTitle="Delete Account"
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
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer text-xs"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1.5 font-bold text-teal-600 text-xs">
                                Page {currentPage} of {totalPages}
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

export default ChartOfAccountList;
