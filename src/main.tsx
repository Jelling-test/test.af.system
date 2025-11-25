import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";

async function bootstrapAuth() {
  try {
    // 1) Supabase action_link flow: tokens delivered in URL hash
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const h = new URLSearchParams(hash);
    const access_token = h.get('access_token');
    const refresh_token = h.get('refresh_token');
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      return;
    }

    // 2) Fallback: OTP flow via query params
    const q = new URLSearchParams(window.location.search);
    const email = q.get('email');
    const token = q.get('token');
    const type = (q.get('type') as any) || 'magiclink';
    if (email && token) {
      await supabase.auth.verifyOtp({ email, token, type: type as any });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (e) {
    // Do not block render on auth bootstrap errors
    console.error('Auth bootstrap error', e);
  }
}

await bootstrapAuth();

createRoot(document.getElementById("root")!).render(<App />);
