import { supabase } from '../Context/supabaseClient';

export interface CreateClientUserPayload {
  email: string;
  password: string;
  fullName: string;
  businessName: string;
  tenantSlug: string; // e.g. 'bashir', 'client2'
  role?: 'Admin' | 'Manager' | 'Cashier' | 'Accountant' | 'Salesman';
  phone?: string;
  sellerNTNCNIC?: string;
  sellerProvince?: string;
  sellerAddress?: string;
  businessActivity?: string;
  businessSector?: string;
  defaultScenarioId?: string;
  allowedModules?: string[];
}

/**
 * Verifies if a given tenant slug exists in the system.
 */
export const verifyTenantSlug = async (slug: string): Promise<boolean> => {
  const clean = slug.replace(/^tenant=/, '').replace(/^tenant-/, '').toLowerCase().trim();
  if (!clean || ['auth', 'dev', 'assets', 'api', 'signin', 'login', 'dashboard', 'static'].includes(clean)) {
    return false;
  }

  // Fast check for registered base tenants
  if (['bashir', 'client2'].includes(clean)) return true;

  try {
    const { data } = await supabase
      .from('tenants')
      .select('slug')
      .eq('slug', clean)
      .maybeSingle();

    return Boolean(data && data.slug);
  } catch (_) {
    return false;
  }
};

/**
 * Service to register a new Client Company with complete details.
 * Attaches tenant_id to user_metadata and records in public.tenants.
 */
export const registerClient = async (payload: CreateClientUserPayload) => {
  const cleanSlug = payload.tenantSlug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');

  // 1. Sign up the user in Supabase Auth with tenant metadata
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName || payload.businessName,
        business_name: payload.businessName,
        tenant_id: cleanSlug,
        role: payload.role || 'Admin',
        seller_ntn_cnic: payload.sellerNTNCNIC || '',
        seller_province: payload.sellerProvince || 'SINDH',
        seller_address: payload.sellerAddress || '',
        business_activity: payload.businessActivity || 'Wholesale / Retails',
        business_sector: payload.businessSector || 'All Other Sectors',
        default_scenario_id: payload.defaultScenarioId || 'SN001',
        allowed_modules: payload.allowedModules || [],
      },
    },
  });

  if (authError) {
    throw new Error(`Authentication Registration Error: ${authError.message}`);
  }

  // 2. Record the client business in the tenants table
  try {
    await supabase.from('tenants').upsert([
      {
        slug: cleanSlug,
        name: payload.businessName,
        email: payload.email,
        seller_ntn_cnic: payload.sellerNTNCNIC || '',
        seller_province: payload.sellerProvince || 'SINDH',
        seller_address: payload.sellerAddress || '',
        business_activity: payload.businessActivity || 'Wholesale / Retails',
        business_sector: payload.businessSector || 'All Other Sectors',
        default_scenario_id: payload.defaultScenarioId || 'SN001',
        allowed_modules: payload.allowedModules || [],
      },
    ], { onConflict: 'slug' });
  } catch (e) {
    console.warn('Tenants table sync error:', e);
  }

  return {
    success: true,
    user: authData.user,
    tenantId: cleanSlug,
    businessName: payload.businessName,
  };
};
