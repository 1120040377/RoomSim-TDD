import type { OcclusionBakeInput } from './ambient-occlusion';

export interface BakeResult { values:Float32Array; buildMs:number; bakeMs:number; rays:number }
export interface BakeWorker {
  onmessage:((event:MessageEvent)=>void)|null;
  onerror:((event:ErrorEvent)=>void)|null;
  onmessageerror:((event:MessageEvent)=>void)|null;
  postMessage:(message:OcclusionBakeInput)=>void;
  terminate:()=>void;
}

/** One job per view. Cancellation settles callers and terminates CPU work. */
export class OcclusionBakeJob {
  private active:{cancel:()=>void}|null=null;
  private disposed=false;
  constructor(private createWorker:()=>BakeWorker=()=>new Worker(
    new URL('./ambient-occlusion.worker.ts',import.meta.url),{type:'module'}),private timeoutMs=30000){}

  cancel():void { this.active?.cancel(); }
  dispose():void { this.disposed=true;this.cancel(); }

  start(input:OcclusionBakeInput):Promise<BakeResult|null> {
    this.cancel();
    if(this.disposed)return Promise.reject(new Error('Bake job is disposed'));
    return new Promise((resolve,reject)=>{
      const worker=this.createWorker();
      let settled=false;
      const finish=(result:BakeResult|null,error?:Error)=>{
        if(settled)return;settled=true;
        clearTimeout(timer);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;
        worker.terminate();if(this.active===active)this.active=null;
        if(error)reject(error);else resolve(result);
      };
      const active={cancel:()=>finish(null)};
      const timer=setTimeout(()=>finish(null,new Error('Ambient bake timed out')),this.timeoutMs);
      this.active=active;
      worker.onmessage=event=>{
        const data=event.data;
        if(data?.error){finish(null,new Error(String(data.error)));return;}
        if(!(data?.values instanceof Float32Array)||data.values.length!==input.positions.length/3||
          ![data.buildMs,data.bakeMs,data.rays].every(value=>Number.isFinite(value)&&value>=0)){
          finish(null,new Error('Invalid ambient bake response'));return;
        }
        finish(data);
      };
      worker.onerror=event=>finish(null,new Error(event.message||'Ambient bake worker failed'));
      worker.onmessageerror=()=>finish(null,new Error('Ambient bake message could not be decoded'));
      try{
        // Structured clone preserves ownership of scene snapshot/source arrays.
        // Worker results are transferred back, but caller arrays are never detached.
        worker.postMessage(input);
      }catch(error){finish(null,error instanceof Error?error:new Error(String(error)));}
    });
  }
}
