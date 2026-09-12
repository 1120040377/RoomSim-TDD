const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const report=await page.evaluate(async()=>{
      const {materialShowroom}=await import('/src/modules/templates/apartments/material-showroom.ts');
      const {buildWalls}=await import('/src/modules/walkthrough/builders/wall-builder.ts');
      const {buildFurniture}=await import('/src/modules/walkthrough/builders/furniture-builder.ts');
      const {prepareArmchairModel}=await import('/src/modules/walkthrough/builders/furniture/model-armchair.ts');
      const {snapshotOccluders}=await import('/src/modules/walkthrough/baking/scene-snapshot.ts');
      await prepareArmchairModel();const plan=materialShowroom.build('Shadow accuracy'),root=buildFurniture(plan);root.add(buildWalls(plan).group);
      const triangles=await snapshotOccluders(root),positions=new Float32Array(8192*3),normals=new Float32Array(positions.length);
      for(let i=0;i<8192;i++){positions[i*3]=((i*.754877666)%1)*11.4;positions[i*3+2]=((i*.569840296)%1)*8;normals[i*3+1]=1;}
      const worker=new Worker('/src/modules/walkthrough/baking/soft-sun.worker.ts',{type:'module'});
      async function run(adaptive){let timer;try{return await new Promise((resolve,reject)=>{
        timer=setTimeout(()=>reject(new Error('Accuracy bake timeout')),30000);worker.onerror=e=>reject(new Error(e.message));
        worker.onmessage=e=>e.data.error?reject(new Error(e.data.error)):resolve(e.data);
        worker.postMessage({triangles,positions,normals,direction:[4,13,6],samples:64,angularRadius:.025,adaptive});
      });}finally{clearTimeout(timer);}}
      try{
        const full=await run(false),adaptive=await run(true);let max=0,sum=0,changed=0;
        for(let i=0;i<full.values.length;i++){const error=Math.abs(full.values[i]-adaptive.values[i]);max=Math.max(max,error);sum+=error;if(error>0)changed++;}
        return {points:full.values.length,maxError:max,meanError:sum/full.values.length,changed,fullRays:full.rays,adaptiveRays:adaptive.rays};
      }finally{worker.terminate();}
    });
    console.log('Adaptive versus complete 64-ray visibility:',report);
    if(report.maxError>.125||report.meanError>.005)throw new Error('Adaptive shadow error exceeds experiment gate');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
