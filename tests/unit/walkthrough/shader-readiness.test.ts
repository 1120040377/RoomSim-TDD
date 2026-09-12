import {afterEach,expect,it,vi} from 'vitest';
import {waitForShaderPrograms} from '@/modules/walkthrough/shader-readiness';
afterEach(()=>{vi.useRealTimers();});
function fixture(){
  const program={} as WebGLProgram,controller=new AbortController();
  const gl={isContextLost:vi.fn(()=>false),getExtension:vi.fn(()=>({COMPLETION_STATUS_KHR:37297})),getProgramParameter:vi.fn((_program:WebGLProgram,_parameter:number)=>false)};
  const wait=(timeout=100)=>waitForShaderPrograms(gl as unknown as WebGLRenderingContext,[program,program],controller.signal,timeout);
  return {program,controller,gl,wait};
}
it('polls completion only and deduplicates programs',async()=>{
  vi.useFakeTimers();const {gl,wait}=fixture(),result=wait();
  expect(gl.getProgramParameter).toHaveBeenCalledTimes(1);
  gl.getProgramParameter.mockReturnValue(true);await vi.advanceTimersByTimeAsync(10);
  expect(await result).toBe('ready');expect(vi.getTimerCount()).toBe(0);
  for(const call of gl.getProgramParameter.mock.calls)expect(call[1]).toBe(37297);
});
it('aborts before disposal without any later GPU queries',async()=>{
  vi.useFakeTimers();const {controller,gl,wait}=fixture(),result=wait();controller.abort();
  const queries=gl.getProgramParameter.mock.calls.length;
  gl.getProgramParameter.mockImplementation(()=>{throw new Error('disposed GPU');});
  await vi.advanceTimersByTimeAsync(1000);
  expect(await result).toBe('cancelled');expect(gl.getProgramParameter).toHaveBeenCalledTimes(queries);expect(vi.getTimerCount()).toBe(0);
});
it('does not touch GPU for an already cancelled owner',async()=>{
  const {controller,gl,wait}=fixture();controller.abort();expect(await wait()).toBe('cancelled');expect(gl.isContextLost).not.toHaveBeenCalled();
});
it('bounds waiting and handles context loss',async()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']});const first=fixture(),timeout=first.wait(20);await vi.advanceTimersByTimeAsync(20);
  expect(await timeout).toBe('timeout');expect(vi.getTimerCount()).toBe(0);
  const second=fixture(),lost=second.wait();second.gl.isContextLost.mockReturnValue(true);await vi.advanceTimersByTimeAsync(10);
  expect(await lost).toBe('context-lost');expect(second.gl.getProgramParameter).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('does not use blocking fallback when extension is absent',async()=>{
  const {gl,wait}=fixture();gl.getExtension.mockReturnValue(null as never);
  expect(await wait()).toBe('unsupported');expect(gl.getProgramParameter).not.toHaveBeenCalled();
});
it('cleans up after query failure',async()=>{
  vi.useFakeTimers();const {gl,wait}=fixture();gl.getProgramParameter.mockImplementation(()=>{throw new Error('query failed');});
  await expect(wait()).rejects.toThrow('query failed');expect(vi.getTimerCount()).toBe(0);
});
