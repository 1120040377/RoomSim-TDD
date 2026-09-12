import {bakeDiffuseBounce,type DiffuseBounceInput} from './diffuse-bounce';
const scope=self as unknown as {onmessage:((event:MessageEvent<DiffuseBounceInput>)=>void)|null;postMessage:(value:unknown,transfer?:Transferable[])=>void};
scope.onmessage=event=>{
  try{const result=bakeDiffuseBounce(event.data);scope.postMessage(result,[result.irradiance.buffer]);}
  catch(error){scope.postMessage({error:error instanceof Error?error.message:String(error)});}
};
