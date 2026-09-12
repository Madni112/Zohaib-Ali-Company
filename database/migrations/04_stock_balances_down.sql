-- ============================================================
-- 04_stock_balances_down.sql
-- Full undo of 04_stock_balances.sql
-- Drops the triggers, functions and the stock_balances table.
-- Original data tables are NOT touched.
-- ============================================================

DROP TRIGGER IF EXISTS trg_opening_stocks_balance    ON public.opening_stocks;
DROP TRIGGER IF EXISTS trg_supplier_purchases_balance ON public.supplier_purchases;
DROP TRIGGER IF EXISTS trg_sales_invoices_balance    ON public.sales_invoices;
DROP TRIGGER IF EXISTS trg_sales_returns_balance     ON public.sales_returns;
DROP TRIGGER IF EXISTS trg_purchase_returns_balance  ON public.purchase_returns;
DROP TRIGGER IF EXISTS trg_stock_transfers_balance   ON public.stock_transfers;
DROP TRIGGER IF EXISTS trg_grn_items_balance         ON public.grn_items;
DROP TRIGGER IF EXISTS trg_grn_receipts_balance      ON public.grn_receipts;

DROP FUNCTION IF EXISTS public.trg_opening_stocks();
DROP FUNCTION IF EXISTS public.trg_json_items_table();
DROP FUNCTION IF EXISTS public.trg_grn_items();
DROP FUNCTION IF EXISTS public.trg_grn_receipts();
DROP FUNCTION IF EXISTS public.refresh_products_from_items(jsonb);
DROP FUNCTION IF EXISTS public.rebuild_stock_balance(text);

DROP TABLE IF EXISTS public.stock_balances;
