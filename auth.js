import { supabase } from "./supabaseClient.js";

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.log("getUser error:", error);
    return null;
  }
  return data.user || null;
}

export async function signInWithEmail(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email, password) {
  return await supabase.auth.signUp({ email, password });
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onLogin(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN") {
      callback();
    }
  });
}
