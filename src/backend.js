import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;

// Live table: loads rows once, then applies realtime changes one row at a time.
// Pass `limit` to keep only the newest N rows (e.g. chat history).
export function useTable(table, enabled = true, limit = 0) {
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => {
    let q = supabase.from(table).select('*');
    q = limit ? q.order('created_at', { ascending: false }).limit(limit) : q.order('created_at', { ascending: true });
    const { data } = await q;
    if (data) setRows(limit ? data.reverse() : data);
  }, [table, limit]);
  useEffect(() => {
    if (!enabled) return undefined;
    let first = true;
    load();
    const apply = (p) => {
      const row = p.new;
      if (p.eventType === 'DELETE') setRows((r) => r.filter((x) => x.id !== p.old.id));
      else if (p.eventType === 'UPDATE') setRows((r) => r.map((x) => (x.id === row.id ? row : x)));
      else setRows((r) => (r.some((x) => x.id === row.id) ? r : [...r, row].slice(limit ? -limit : 0)));
    };
    const ch = supabase.channel(`rt-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, apply)
      // After a dropped connection comes back, resync anything we missed.
      .subscribe((status) => { if (status === 'SUBSCRIBED') { if (first) first = false; else load(); } });
    return () => { supabase.removeChannel(ch); };
  }, [table, enabled, load, limit]);
  return [rows, load];
}

// Shared event settings (e.g. the code-freeze deadline).
export function useSetting(name, enabled = true) {
  const [value, setValue] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const load = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', name).maybeSingle();
      setValue(data ? data.value : null);
    };
    load();
    const ch = supabase.channel(`rt-setting-${name}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [name, enabled]);
  const save = async (v) => {
    setValue(v);
    const { error } = await supabase.from('settings').upsert({ key: name, value: v });
    if (error) console.error(error);
  };
  return [value, save];
}

export function useAuth() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    setProfile(data);
  }, []);
  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);
  // Applicants wait on the status screen: pick up the organisers' decision as soon as it is made.
  const id = profile?.id;
  const waiting = Boolean(profile) && profile.status !== 'approved';
  useEffect(() => {
    if (!waiting) return undefined;
    const ch = supabase.channel(`rt-me-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` }, (p) => setProfile(p.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, waiting]);
  const join = async ({ name, team, role, code, teamCode, email, phone, organisation, skills, motivation }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }
    const { data, error } = await supabase.rpc('join_hackathon', {
      p_name: name, p_team: team, p_role: role, p_code: code || '', p_team_code: teamCode || '',
      p_email: email || '', p_phone: phone || '', p_organisation: organisation || '', p_skills: skills || '', p_motivation: motivation || '',
    });
    if (error) throw error;
    setProfile(data);
  };
  const emailLink = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
    if (error) throw error;
  };
  const logout = async () => { await supabase.auth.signOut(); setProfile(null); };
  return { ready, profile, join, logout, emailLink, refresh };
}

export function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}
