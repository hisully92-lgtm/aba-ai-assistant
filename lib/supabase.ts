import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import * as SecureStore from "expo-secure-store";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  "https://cxljdpslpydbcuoyimhj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bGpkcHNscHlkYmN1b3lpbWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTY0OTUsImV4cCI6MjA5NDQzMjQ5NX0.-0z8Uayp2O6mZHwsWUJx1EJmZuDRbkP304eE70lqNSo",
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);