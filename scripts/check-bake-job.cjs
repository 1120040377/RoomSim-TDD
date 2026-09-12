const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const result=await page.evaluate(async()=>{
      const {OcclusionBakeJob}=await import('/src/modules/walkthrough/baking/bake-job.ts');
      const Original=window.Worker,live=new Set();let created=0;
      window.Worker=class extends Original{
        constructor(...args){super(...args);live.add(this);created++;}
        terminate(){live.delete(this);super.terminate();}
      };
      const job=new OcclusionBakeJob();
      const input={triangles:new Float32Array([-5,.02,-5,5,.02,-5,5,.02,5,-5,.02,-5,5,.02,5,-5,.02,5]),
        positions:new Float32Array([0,0,0]),normals:new Float32Array([0,1,0]),samples:64,radius:.6};
      try{
        const abandoned=job.start(input);job.cancel();const canceled=await abandoned;
        const accepted=await job.start(input);job.dispose();
        return {canceled,visibility:accepted.values[0],sourceBytes:input.triangles.byteLength,created,live:live.size};
      }finally{job.dispose();window.Worker=Original;}
    });
    if(result.canceled!==null||result.visibility>=.1||result.sourceBytes!==72||result.created!==2||result.live!==0)
      throw new Error(JSON.stringify(result));
    console.log('Real worker cancellation/retry/ownership verified:',result);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
