export type ShaderReadiness='ready'|'cancelled'|'unsupported'|'timeout'|'context-lost';

/** Nonblocking KHR polling. The owner must abort BEFORE disposing its programs. */
export function waitForShaderPrograms(gl:WebGLRenderingContext|WebGL2RenderingContext,programs:readonly WebGLProgram[],signal:AbortSignal,timeoutMs=10000):Promise<ShaderReadiness> {
  if(signal.aborted)return Promise.resolve('cancelled');
  if(gl.isContextLost())return Promise.resolve('context-lost');
  const extension=gl.getExtension('KHR_parallel_shader_compile');
  // Never fall back to LINK_STATUS: querying it may synchronously wait for compilation.
  if(!extension)return Promise.resolve('unsupported');
  const pending=new Set(programs);
  return new Promise((resolve,reject)=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    let settled=false;
    const deadline=performance.now()+Math.max(0,timeoutMs);
    const cleanup=()=>{
      if(timer!==undefined)clearTimeout(timer);
      signal.removeEventListener('abort',cancel);pending.clear();
    };
    const finish=(result:ShaderReadiness)=>{
      if(settled)return;settled=true;cleanup();resolve(result);
    };
    const cancel=()=>finish('cancelled');
    const poll=()=>{
      if(settled)return;
      if(signal.aborted){finish('cancelled');return;}
      try{
        if(gl.isContextLost()){finish('context-lost');return;}
        for(const program of pending){
          if(gl.getProgramParameter(program,extension.COMPLETION_STATUS_KHR))pending.delete(program);
        }
        if(pending.size===0){finish('ready');return;}
        if(performance.now()>=deadline){finish('timeout');return;}
        timer=setTimeout(poll,10);
      }catch(error){settled=true;cleanup();reject(error);}
    };
    signal.addEventListener('abort',cancel,{once:true});
    poll();
  });
}
