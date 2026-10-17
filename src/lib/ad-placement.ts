// The results grid has one column on mobile and two from md upwards.
export function adPlacement(index:number,total:number){
 const position=index+1;
 const mobile=position%2===0 || (position===total && total<2);
 const desktop=position%4===0 || (position===total && total<4);
 return mobile&&desktop?'col-span-full':mobile?'col-span-full md:hidden':desktop?'col-span-full hidden md:block':null;
}
