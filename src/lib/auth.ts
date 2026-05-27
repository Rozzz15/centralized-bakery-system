import { supabase } from "./supabase";
import type { Role } from "../types";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email ?? "",
    displayName: data.display_name,
    role: data.role as Role,
  };
}

export async function updateProfile(userId: string, updates: { display_name?: string; email?: string; role?: Role }) {
  console.log("updateProfile called with:", userId, updates);
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select();

  if (error) {
    console.error("updateProfile error:", error);
    throw error;
  }
  console.log("updateProfile success, rows:", data?.length, data);
  return data;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
