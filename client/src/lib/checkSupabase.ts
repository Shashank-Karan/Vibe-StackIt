import { supabase } from './supabaseClient';

// Simple function to check Supabase connection by fetching from a system table
export async function checkSupabaseConnection() {
  // 'pg_catalog.pg_tables' is a system table available in every Supabase project
  const { error } = await supabase.from('pg_catalog.pg_tables').select('*').limit(1);
  if (error) {
    console.error('Supabase connection failed:', error.message);
    return false;
  }
  console.log('Supabase connection successful!');
  return true;
}

// Usage example (uncomment to test):
// checkSupabaseConnection();
