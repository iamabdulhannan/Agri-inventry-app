import './storage-polyfill'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'))

/** Same Supabase project (tables, views and RPCs) as the web app */
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// keep the token refresh loop tied to the app being in the foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
