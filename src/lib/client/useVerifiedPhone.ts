"use client";
import {useEffect,useState} from 'react';
import {useAdvertiserSession} from '@/components/AdvertiserSession';
export function useVerifiedPhone(disabled=false){
 const {session}=useAdvertiserSession();const [state,setState]=useState<{actor:string;phone:string}|null>(null);
 useEffect(()=>{if(disabled||!session)return;const controller=new AbortController();fetch('/api/auth/phone',{cache:'no-store',signal:controller.signal,headers:{Authorization:`Bearer ${session.access_token}`}}).then(response=>response.ok?response.json():null).then(result=>{if(!controller.signal.aborted&&result)setState({actor:session.user.id,phone:result.verified?String(result.phone_number).replace(/^\+?91/,''):''});}).catch(()=>{});return()=>controller.abort();},[disabled,session]);
 return !disabled&&session&&state?.actor===session.user.id?state.phone:'';
}
