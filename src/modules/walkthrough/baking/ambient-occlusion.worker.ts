import { bakeAmbientOcclusion, type OcclusionBakeInput } from './ambient-occlusion';

const scope=self as unknown as {
  onmessage:((event:MessageEvent<OcclusionBakeInput>)=>void)|null;
  postMessage:(value:unknown,transfer?:Transferable[])=>void;
};
scope.onmessage=event=>{
  try{
    const result=bakeAmbientOcclusion(event.data);
    scope.postMessage(result,[result.values.buffer]);
  }catch(error){scope.postMessage({error:error instanceof Error?error.message:String(error)});}
};
