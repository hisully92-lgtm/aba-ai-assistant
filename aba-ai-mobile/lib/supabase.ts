import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase = createClient(
  "https://cxljdpslpydbcuoyimhj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bGpkcHNscHlkYmN1b3lpbWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTY0OTUsImV4cCI6MjA5NDQzMjQ5NX0.-0z8Uayp2O6mZHwsWUJx1EJmZuDRbkP304eE70lqNSo",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);