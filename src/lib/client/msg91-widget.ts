type Callback=(data:unknown)=>void;
type ProviderWindow=Window & {
 getWidgetData?:()=>Record<string,unknown>|null;
 initSendOTP?:(configuration:Record<string,unknown>)=>void;
 sendOtp?:(identifier:string,success:Callback,failure:Callback)=>void;
 retryOtp?:(channel:string|null,success:Callback,failure:Callback,requestId?:string)=>void;
 verifyOtp?:(otp:string,success:Callback,failure:Callback,requestId?:string)=>void;
};
let scriptPromise:Promise<void>|null=null;
export function loadPhoneWidget(captchaId:string){
 const provider=window as ProviderWindow;
 if(!scriptPromise)scriptPromise=new Promise<void>((resolve,reject)=>{
  if(provider.initSendOTP){resolve();return;}
  const script=document.createElement('script');script.src='https://verify.msg91.com/otp-provider.js';script.async=true;
  script.onload=()=>provider.initSendOTP?resolve():reject(new Error('Unable to load phone verification.'));
  script.onerror=()=>{script.remove();scriptPromise=null;reject(new Error('Unable to load phone verification. Check your connection.'));};document.head.appendChild(script);
 });
 return scriptPromise.then(()=>{
  return new Promise<void>((resolve,reject)=>{
   // The SDK validates this callback even when per-method callbacks handle verification.
   // Never log or trust a token received here; the server validates method proofs.
   provider.initSendOTP!({widgetId:process.env.NEXT_PUBLIC_MSG91_WIDGET_ID,tokenAuth:process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN,exposeMethods:true,captchaRenderId:captchaId,success:()=>{},failure:()=>{}});
   const started=Date.now();
   const timer=setInterval(()=>{
    if(provider.sendOtp&&provider.verifyOtp&&provider.getWidgetData?.()){clearInterval(timer);resolve();}
    else if(Date.now()-started>15000){clearInterval(timer);reject(new Error('Unable to initialize SMS verification. Reload verification and try again.'));}
   },100);
  });
 });
}
export function widgetAction(action:'send'|'retry'|'verify',value:string,requestId?:string){
 const provider=window as ProviderWindow;
 return new Promise<Record<string,unknown>>((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Phone verification timed out. Please retry.')),30000);
  const failure=()=>{clearTimeout(timeout);reject(new Error('Unable to continue. Check the number, code and CAPTCHA, then retry.'));};
  const success:Callback=result=>{clearTimeout(timeout);if(!result||typeof result!=='object'||(result as Record<string,unknown>).type!=='success'){failure();return;}resolve(result as Record<string,unknown>);};
  try{
   if(action==='send'&&provider.sendOtp)provider.sendOtp(value,success,failure);
   else if(action==='retry'&&provider.retryOtp)provider.retryOtp(null,success,failure,requestId);
   else if(action==='verify'&&provider.verifyOtp)provider.verifyOtp(value,success,failure,requestId);
   else failure();
  }catch{failure();}
 });
}
