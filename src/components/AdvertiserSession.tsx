"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
type AuthState = { session: Session | null; ready: boolean };
const Context = createContext<AuthState>({ session: null, ready: false });
export function isAdvertiserSession(session: Session | null) { return !!session && !session.user.is_anonymous && !!session.user.email_confirmed_at; }
export function AdvertiserSession({children}: {children: React.ReactNode}) {
 const [state,setState]=useState<AuthState>({session:null,ready:false});
 useEffect(()=>{
  let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(active)setState({session,ready:true});});
  supabase.auth.getSession().then(({data})=>{if(active)setState({session:data.session,ready:true});}).catch(()=>{if(active)setState({session:null,ready:true});});
  return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useAdvertiserSession(){return useContext(Context);}
