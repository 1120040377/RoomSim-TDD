import { afterEach,describe,expect,it,vi } from 'vitest';
import { OcclusionBakeJob,type BakeWorker } from '@/modules/walkthrough/baking/bake-job';
const input={triangles:new Float32Array(9),positions:new Float32Array(3),normals:new Float32Array([0,1,0])};
const result={values:new Float32Array([.7]),buildMs:1,bakeMs:2,rays:32};
function worker():BakeWorker{return {onmessage:null,onerror:null,onmessageerror:null,postMessage:vi.fn(),terminate:vi.fn()};}
afterEach(()=>{vi.useRealTimers();});

describe('cancellable background bake',()=>{
  it('settles replaced work and ignores late results without canceling the new job',async()=>{
    const a=worker(),b=worker(),factory=vi.fn().mockReturnValueOnce(a).mockReturnValueOnce(b),job=new OcclusionBakeJob(factory);
    const old=job.start(input),late=a.onmessage!;
    const current=job.start(input);expect(await old).toBeNull();expect(a.terminate).toHaveBeenCalledOnce();
    late({data:result} as MessageEvent);expect(b.terminate).not.toHaveBeenCalled();
    b.onmessage!({data:result} as MessageEvent);expect(await current).toBe(result);expect(b.terminate).toHaveBeenCalledOnce();
    expect(a.onmessage).toBeNull();expect(b.onmessage).toBeNull();job.dispose();
  });
  it('terminates and settles on view disposal, without accepting future work',async()=>{
    const w=worker(),job=new OcclusionBakeJob(()=>w),pending=job.start(input);
    job.dispose();expect(await pending).toBeNull();expect(w.terminate).toHaveBeenCalledOnce();
    await expect(job.start(input)).rejects.toThrow('disposed');
  });
  it('bounds waiting and releases the worker on timeout',async()=>{
    vi.useFakeTimers();const w=worker(),job=new OcclusionBakeJob(()=>w,50);
    const assertion=expect(job.start(input)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(50);await assertion;expect(w.terminate).toHaveBeenCalledOnce();job.dispose();
  });
  it('releases failed posts and malformed replies, then permits a retry',async()=>{
    const a=worker(),b=worker();a.postMessage=()=>{throw new Error('clone failed');};
    const job=new OcclusionBakeJob(vi.fn().mockReturnValueOnce(a).mockReturnValueOnce(b));
    await expect(job.start(input)).rejects.toThrow('clone failed');expect(a.terminate).toHaveBeenCalledOnce();
    const pending=job.start(input);b.onmessage!({data:{...result,values:new Float32Array(2)}} as MessageEvent);
    await expect(pending).rejects.toThrow('Invalid');expect(b.terminate).toHaveBeenCalledOnce();job.dispose();
  });
});
