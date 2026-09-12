-- ============================================================
-- 04_stock_balances.sql
-- Server-side stock balances so pages never download ledgers.
--
-- Creates:
--   • stock_balances          (product + warehouse + available qty)
--   • rebuild_stock_balance() computes one product (or all)
--   • triggers keep it in sync on every stock-changing table
--
-- Run AFTER taking a project backup. Undo: run 04_stock_balances_down.sql
-- ============================================================

-- 1) The balance table (RLS intentionally OFF = readable by the anon app key)
CREATE TABLE IF NOT EXISTS public.stock_balances (
    product_name   text           NOT NULL,
    warehouse_name text           NOT NULL DEFAULT 'Global / Unassigned',
    quantity       numeric(15,2)  NOT NULL DEFAULT 0,
    updated_at     timestamptz    NOT NULL DEFAULT now(),
    PRIMARY KEY (product_name, warehouse_name)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_product_lower
    ON public.stock_balances (lower(btrim(product_name)));

CREATE INDEX IF NOT EXISTS idx_stock_balances_wh_lower
    ON public.stock_balances (lower(btrim(warehouse_name)));

-- ============================================================
-- 2) Rebuild function
-- Formula (matches stockCalculator.ts "available"):
--   opening + purchased + salesReturned + transferIn
--   - sold - purchaseReturned - transferOut
-- GRN counts as its accepted qty (rejected never adds stock)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_products_from_items(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec record;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RETURN;
    END IF;

    FOR rec IN
        SELECT DISTINCT lower(btrim(COALESCE(e->>'product_name', e->>'itemName', e->>'item_name', ''))) AS p
        FROM jsonb_array_elements(p_items) AS e
        WHERE btrim(COALESCE(e->>'product_name', e->>'itemName', e->>'item_name', '')) <> ''
    LOOP
        PERFORM public.rebuild_stock_balance(rec.p);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_stock_balance(p_product text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match     text;
    v_sales_ret text;
    v_sql       text;
    v_filter    text;
BEGIN
    v_match := CASE
        WHEN p_product IS NULL OR btrim(p_product) = '' THEN NULL
        ELSE lower(btrim(p_product))
    END;

    IF v_match IS NULL THEN
        DELETE FROM public.stock_balances;
    ELSE
        DELETE FROM public.stock_balances WHERE lower(btrim(product_name)) = v_match;
    END IF;

    -- Include sales_returns only when it actually has an items column
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name  = 'sales_returns'
              AND column_name = 'items'
        ) THEN $SR$
      UNION ALL
      -- 5b. Sales returns (stock comes back in) (+)
      SELECT lower(btrim(COALESCE(e->>'product_name', e->>'itemName', e->>'item_name'))),
             btrim(COALESCE(NULLIF(btrim(COALESCE(e->>'warehouse', e->>'location', e->>'receiving_warehouse')), ''),
                            NULLIF(btrim(COALESCE(sr.warehouse_name, sr.source_warehouse)), ''),
                            'Global / Unassigned')),
             (COALESCE(NULLIF(e->>'qty', ''), e->>'quantity', '0'))::numeric
      FROM public.sales_returns sr
      CROSS JOIN LATERAL jsonb_array_elements(sr.items) AS e
      WHERE lower(btrim(COALESCE(sr.status, ''))) <> 'cancel'
    $SR$
        ELSE ''
    END INTO v_sales_ret;

    v_filter := CASE WHEN v_match IS NULL THEN 'TRUE'
                     ELSE 'btrim(product_name) = ' || quote_literal(v_match)
                END;

    v_sql := $Q$
      WITH parts AS (
        -- 1. Opening stocks (+)
        SELECT lower(btrim(COALESCE(os.product_name, os."itemName"))) AS product_name,
               btrim(COALESCE(NULLIF(btrim(os.location), ''), 'Global / Unassigned')) AS warehouse_name,
               COALESCE(os.qty, os.quantity, 0)::numeric AS qty
        FROM public.opening_stocks os

        UNION ALL
        -- 2. Purchases: not cancelled and not already linked to a GRN (+)
        SELECT lower(btrim(COALESCE(e->>'product_name', e->>'itemName', e->>'item_name'))),
               btrim(COALESCE(NULLIF(btrim(COALESCE(e->>'warehouse', e->>'location')), ''),
                              NULLIF(btrim(p.target_warehouse), ''),
                              'Global / Unassigned')),
               (COALESCE(NULLIF(e->>'qty', ''), e->>'quantity', '0'))::numeric
        FROM public.supplier_purchases p
        CROSS JOIN LATERAL jsonb_array_elements(p.items) AS e
        WHERE lower(btrim(COALESCE(p.payment_term, ''))) NOT IN ('cancel', 'deleted', 'draft')
          AND NOT (
                ((p.metadata ? 'grn_id') AND btrim(p.metadata ->> 'grn_id') <> '')
             OR (jsonb_typeof(p.metadata -> 'grn_ids') = 'array'
                 AND jsonb_array_length(p.metadata -> 'grn_ids') > 0)
          )

        UNION ALL
        -- 3. GRN accepted quantities (+)
        SELECT lower(btrim(COALESCE(gi.product_name, ''))),
               btrim(COALESCE(NULLIF(btrim(gi.warehouse_name), ''), 'Global / Unassigned')),
               COALESCE(gi.accepted_qty,
                        CASE WHEN g.status = 'Partially Received' THEN 0 ELSE gi.qty END,
                        0)::numeric
        FROM public.grn_items gi
        JOIN public.grn_receipts g ON g.id = gi.grn_id
        WHERE g.status IN ('Confirm', 'Partially Received', 'Billed', 'Rejected')

        UNION ALL
        -- 4. Sales invoices (stock out) (-)
        SELECT lower(btrim(COALESCE(e->>'product_name', e->>'itemName', e->>'item_name'))),
               btrim(COALESCE(NULLIF(btrim(COALESCE(e->>'warehouse', e->>'location')), ''),
                              NULLIF(btrim(s.dispatch_warehouse), ''),
                              'Global / Unassigned')),
               -1 * (COALESCE(NULLIF(e->>'qty', ''), e->>'quantity', '0'))::numeric
        FROM public.sales_invoices s
        CROSS JOIN LATERAL jsonb_array_elements(s.items) AS e
        WHERE lower(btrim(COALESCE(s.sale_status, ''))) NOT IN ('cancel', 'deleted')

        UNION ALL
        -- 5. Purchase returns (stock out) (-)
        SELECT lower(btrim(COALESCE(e->>'product_name', e->>'itemName', e->>'item_name'))),
               btrim(COALESCE(NULLIF(btrim(COALESCE(e->>'warehouse', e->>'location')), ''),
                              NULLIF(btrim(COALESCE(pr.source_warehouse, pr.warehouse_name)), ''),
                              'Global / Unassigned')),
               -1 * (COALESCE(NULLIF(e->>'qty', ''), e->>'quantity', '0'))::numeric
        FROM public.purchase_returns pr
        CROSS JOIN LATERAL jsonb_array_elements(pr.items) AS e
        WHERE lower(btrim(COALESCE(pr.status, ''))) NOT IN ('cancel', 'deleted')
    $Q$ || v_sales_ret || $Q$
        UNION ALL
        -- 6a. Stock transfers: leave source (-)
        SELECT lower(btrim(COALESCE(e->>'product_name', e->>'itemName', e->>'item_name'))),
               btrim(COALESCE(NULLIF(btrim(st.from_location), ''), 'Global / Unassigned')),
               -1 * (COALESCE(NULLIF(e->>'qty', ''), e->>'quantity', e->>'transfer_qty', '0'))::numeric
        FROM public.stock_transfers st
        CROSS JOIN LATERAL jsonb_array_elements(st.items) AS e

        UNION ALL
        -- 6b. Stock transfers: arrive at destination (+)
        SELECT lower(btrim(COALESCE(e->>'product_name', e->>'itemName', e->>'item_name'))),
               btrim(COALESCE(NULLIF(btrim(st.to_location), ''), 'Global / Unassigned')),
               (COALESCE(NULLIF(e->>'qty', ''), e->>'quantity', e->>'transfer_qty', '0'))::numeric
        FROM public.stock_transfers st
        CROSS JOIN LATERAL jsonb_array_elements(st.items) AS e
      )
      INSERT INTO public.stock_balances (product_name, warehouse_name, quantity, updated_at)
      SELECT product_name, warehouse_name, round(SUM(qty)::numeric, 2), now()
      FROM parts
      WHERE btrim(product_name) <> ''
        AND ($Q$ || v_filter || $Q$)
      GROUP BY product_name, warehouse_name
      HAVING abs(SUM(qty)) > 0.0001;
    $Q$;

    EXECUTE v_sql;
END;
$$;

-- ============================================================
-- 3) Triggers
-- ============================================================

-- Opening stock rows
CREATE OR REPLACE FUNCTION public.trg_opening_stocks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM public.rebuild_stock_balance(COALESCE(NEW.product_name, NEW."itemName"));
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        PERFORM public.rebuild_stock_balance(COALESCE(OLD.product_name, OLD."itemName"));
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_opening_stocks_balance ON public.opening_stocks;
CREATE TRIGGER trg_opening_stocks_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.opening_stocks
    FOR EACH ROW EXECUTE FUNCTION public.trg_opening_stocks();

-- Generic trigger for documents whose lines live in a jsonb `items` column
CREATE OR REPLACE FUNCTION public.trg_json_items_table() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM public.refresh_products_from_items(NEW.items);
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        PERFORM public.refresh_products_from_items(OLD.items);
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_supplier_purchases_balance ON public.supplier_purchases;
CREATE TRIGGER trg_supplier_purchases_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.supplier_purchases
    FOR EACH ROW EXECUTE FUNCTION public.trg_json_items_table();

DROP TRIGGER IF EXISTS trg_sales_invoices_balance ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.sales_invoices
    FOR EACH ROW EXECUTE FUNCTION public.trg_json_items_table();

DROP TRIGGER IF EXISTS trg_purchase_returns_balance ON public.purchase_returns;
CREATE TRIGGER trg_purchase_returns_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.purchase_returns
    FOR EACH ROW EXECUTE FUNCTION public.trg_json_items_table();

DROP TRIGGER IF EXISTS trg_stock_transfers_balance ON public.stock_transfers;
CREATE TRIGGER trg_stock_transfers_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.stock_transfers
    FOR EACH ROW EXECUTE FUNCTION public.trg_json_items_table();

-- sales_returns trigger only if the table/column exists in this project
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sales_returns' AND column_name = 'items'
    ) THEN
        EXECUTE $E$
            DROP TRIGGER IF EXISTS trg_sales_returns_balance ON public.sales_returns;
            CREATE TRIGGER trg_sales_returns_balance
                AFTER INSERT OR UPDATE OR DELETE ON public.sales_returns
                FOR EACH ROW EXECUTE FUNCTION public.trg_json_items_table();
        $E$;
    END IF;
END $$;

-- GRN child lines
CREATE OR REPLACE FUNCTION public.trg_grn_items() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM public.rebuild_stock_balance(NEW.product_name);
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        PERFORM public.rebuild_stock_balance(OLD.product_name);
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_grn_items_balance ON public.grn_items;
CREATE TRIGGER trg_grn_items_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.grn_items
    FOR EACH ROW EXECUTE FUNCTION public.trg_grn_items();

-- GRN header status changes affect all of its child lines
CREATE OR REPLACE FUNCTION public.trg_grn_receipts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id uuid;
    rec record;
BEGIN
    v_id := COALESCE(NEW.id, OLD.id);
    IF v_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    FOR rec IN
        SELECT DISTINCT product_name
        FROM public.grn_items
        WHERE grn_id = v_id
          AND btrim(product_name) <> ''
    LOOP
        PERFORM public.rebuild_stock_balance(rec.product_name);
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_grn_receipts_balance ON public.grn_receipts;
CREATE TRIGGER trg_grn_receipts_balance
    AFTER INSERT OR UPDATE OF status OR DELETE ON public.grn_receipts
    FOR EACH ROW EXECUTE FUNCTION public.trg_grn_receipts();

-- ============================================================
-- 4) Initial fill from current data
-- ============================================================
SELECT public.rebuild_stock_balance();
