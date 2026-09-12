const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const result=await page.evaluate(async()=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {materialShowroom}=await import('/src/modules/templates/apartments/material-showroom.ts');
      const {buildFurniture}=await import('/src/modules/walkthrough/builders/furniture-builder.ts');
      const {buildWalls}=await import('/src/modules/walkthrough/builders/wall-builder.ts');
      const {buildFloor}=await import('/src/modules/walkthrough/builders/floor-builder.ts');
      const {FrameCache}=await import('/src/modules/walkthrough/frame-cache.ts');
      const {ShadowCache}=await import('/src/modules/walkthrough/shadow-cache.ts');
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(),sun=new T.DirectionalLight();
      const plan=materialShowroom.build('CPU cache benchmark');
      scene.add(buildFurniture(plan),buildWalls(plan).group,buildFloor(plan),sun,sun.target);
      await new Promise(r=>setTimeout(r,1500));
      const frame=new FrameCache(),shadow=new ShadowCache(),settings=[1440,960,.9];
      const run=()=>{const begin=performance.now();const changed=frame.needsRender(scene,camera,settings);const mid=performance.now();const updated=shadow.needsUpdate(scene,sun);return {frame:mid-begin,shadow:performance.now()-mid,changed,updated};};
      for(let i=0;i<15;i++)run();
      const samples=[];for(let i=0;i<150;i++){samples.push(run());if(i%15===0)await new Promise(r=>setTimeout(r,0));}
      const stats=key=>{const values=samples.map(s=>s[key]).sort((a,b)=>a-b);return {median:values[75],p95:values[142],max:values[149]};};
      let objects=0;scene.traverse(()=>objects++);
      if(samples.some(s=>s.changed||s.updated))throw new Error('Static scene cache invalidated');
      return {objects,samples:samples.length,frameMs:stats('frame'),shadowMs:stats('shadow'),note:'CPU-only isolated procedural showroom, no GPU rendering or imported model preload'};
    });
    console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
