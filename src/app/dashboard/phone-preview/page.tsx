import type {Metadata} from 'next';
import {PhoneAuthPreview} from '@/components/PhoneAuthPreview';
export const metadata:Metadata={title:'Phone sign-in preview | ToLet Odisha',robots:{index:false,follow:false}};
export default function Page(){return <PhoneAuthPreview/>;}
