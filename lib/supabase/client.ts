import { createClient } from "@supabase/supabase-js";

let _client: any = null;

export const supabase: any = new Proxy({} as any, {
  get(_target, prop) {
    if (!_client) {
      _client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            flowType: "pkce",
          },
        }
      );
    }
    return (_client as any)[prop];
  },
});