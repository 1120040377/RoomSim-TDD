const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const result=await page.evaluate(async()=>{
      const worker=new Worker('/src/modules/walkthrough/baking/diffuse-bounce.worker.ts',{type:'module'});
      const triangles=new Float32Array([-100,0,-100,100,0,100,100,0,-100,-100,0,-100,-100,0,100,100,0,100]);
      const positions=new Float32Array(4096*3),normals=new Float32Array(positions.length);
      for(let i=0;i<4096;i++){positions[i*3+1]=1;normals[i*3+1]=-1;}
      let beats=0;const heartbeat=setInterval(()=>beats++,10);let timer;
      try{
        const data=await new Promise((resolve,reject)=>{
          timer=setTimeout(()=>reject(new Error('Bounce worker timeout')),30000);
          worker.onerror=event=>reject(new Error(event.message));
          worker.onmessage=event=>event.data.error?reject(new Error(event.data.error)):resolve(event.data);
          worker.postMessage({triangles,reflectance:new Float32Array([.8,.4,.2,.8,.4,.2]),positions,normals,
            sunDirection:[0,1,0],sunIrradiance:[2,2,2],samples:64});
        });
        return {rgb:Array.from(data.irradiance.slice(0,3)),rays:data.rays,bakeMs:data.bakeMs,beats,sourceBytes:triangles.byteLength};
      }finally{clearTimeout(timer);clearInterval(heartbeat);worker.terminate();}
    });
    if(result.rgb.some((v,i)=>Math.abs(v-[1.6,.8,.4][i])>.0001)||result.sourceBytes!==72||result.rays!==524288)
      throw new Error(JSON.stringify(result));
    console.log('Worker linear irradiance / input ownership:',result);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
