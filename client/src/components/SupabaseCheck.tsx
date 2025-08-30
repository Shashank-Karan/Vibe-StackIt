import { useEffect } from 'react';
import { checkSupabaseConnection } from '../lib/checkSupabase';

export default function SupabaseCheck() {
  useEffect(() => {
    checkSupabaseConnection();
  }, []);

  return <div>Checking Supabase connection... (see console)</div>;
}
