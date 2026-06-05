import { createClient } from '@supabase/supabase-js'

// 1. Session-ID generieren oder aus dem LocalStorage holen
const getSessionId = () => {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem("campfire_session_id");
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem("campfire_session_id", id);
  }
  return id;
};

const localSessionId = getSessionId();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 2. Client erstellen UND die Session-ID standardmäßig in JEDEN Request packen
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      "x-client-session-id": localSessionId
    }
  }
})