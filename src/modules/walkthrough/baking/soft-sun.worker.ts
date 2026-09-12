import {bakeSoftSun,type SoftSunInput} from './soft-sun';
const scope=self as unknown as {onmessage:((e:MessageEvent<SoftSunInput>)=>void)|null;postMessage:(value:unknown,transfer?:Transferable[])=>void};
scope.onmessage=e=>{try{const result=bakeSoftSun(e.data);scope.postMessage(result,[result.values.buffer]);}catch(error){scope.postMessage({error:String(error)});}};
