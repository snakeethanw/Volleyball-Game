import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://anfhxqxmnzensbrkagsp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iQXkNHrw5WLHEabeAebyVA_s1illpsJ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
