import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qdwreztifisduuphdqaz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_zI-OYeKiMxJbU0cfjcxEGw_ius_J3CV'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
