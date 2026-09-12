const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:process.env.ROOMSIM_BROWSER_CHANNEL||'chromium'});
  try{
    const page=await browser.newPage(),errors=[];
    await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const curved=process.env.ROOMSIM_CURVED_SHADOW==='1';
    const report=await page.evaluate(async(curved)=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {installReceiverPlaneShadow}=await import('/src/modules/walkthrough/receiver-plane-shadow.ts');
      const renderer=new T.WebGLRenderer();renderer.setSize(256,256);
      renderer.outputColorSpace=T.LinearSRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
      const target=new T.WebGLRenderTarget(256,256),scene=new T.Scene();scene.background=new T.Color(0);
      const material=new T.MeshStandardMaterial({color:0xffffff,roughness:1,side:T.DoubleSide});
      const geometry=new T.PlaneGeometry(4,4,curved?96:1,curved?96:1);
      if(curved){
        const p=geometry.getAttribute('position');
        // Smooth, shallow waves: bounded slopes cannot physically self-shadow
        // under this elevated sun, making the no-shadow frame a valid reference.
        for(let i=0;i<p.count;i++)p.setZ(i,.06*Math.sin(p.getX(i)*5)+.025*Math.cos(p.getY(i)*7));
        geometry.computeVertexNormals();
      }
      const plane=new T.Mesh(geometry,material);plane.rotation.x=-Math.PI/2+.3;
      plane.castShadow=plane.receiveShadow=true;scene.add(plane);
      // Invisible in the colour pass, present in the depth pass: measured dark
      // pixels must be its cast shadow, never the blocker itself covering pixels.
      const blocker=new T.Mesh(new T.BoxGeometry(.55,.7,.55),new T.MeshStandardMaterial({colorWrite:false,depthWrite:false}));
      blocker.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
      blocker.position.y=.8;blocker.castShadow=true;scene.add(blocker);
      const sun=new T.DirectionalLight(0xffffff,Math.PI);sun.position.set(-3,6,2);sun.castShadow=true;
      sun.shadow.mapSize.set(512,512);sun.shadow.radius=3;sun.shadow.normalBias=.006;
      Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:12});scene.add(sun);
      const camera=new T.PerspectiveCamera(45,1,.1,30);
      let patched=false,restore=()=>{};
      function draw(shadows){
        plane.receiveShadow=shadows;
        const key=patched?'receiver-plane':'original';material.customProgramCacheKey=()=>key;material.needsUpdate=true;
        renderer.setRenderTarget(target);renderer.render(scene,camera);
        const pixels=new Uint8Array(256*256*4);renderer.readRenderTargetPixels(target,0,0,256,256,pixels);return pixels;
      }
      const results=[];
      try{
        const positions=curved?Array.from({length:36},(_,i)=>[6*Math.sin(i*Math.PI/18),4,6*Math.cos(i*Math.PI/18)]):[[0,5,7],[4,4,4],[-4,4,4]];
        for(const position of positions){
          camera.position.set(...position);camera.lookAt(0,0,0);blocker.visible=false;
          const reference=draw(false),baseline=draw(true);
          restore=installReceiverPlaneShadow();patched=true;const corrected=draw(true);
          blocker.visible=true;const shadowed=draw(true);restore();patched=false;
          let count=0,oldLoss=0,newLoss=0,castShadowPixels=0;
          for(let i=0;i<reference.length;i+=4){
            if(reference[i]<100)continue;
            count++;oldLoss+=Math.max(0,reference[i]-baseline[i]);newLoss+=Math.max(0,reference[i]-corrected[i]);
            if(corrected[i]-shadowed[i]>80)castShadowPixels++;
          }
          results.push({position,pixels:count,baselineMeanLoss:oldLoss/count,correctedMeanLoss:newLoss/count,castShadowPixels});
        }
        return {curved,results,programs:renderer.info.programs.length,gpuTimer:!!renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2')};
      }finally{restore();plane.geometry.dispose();material.dispose();blocker.geometry.dispose();blocker.material.dispose();blocker.customDepthMaterial.dispose();sun.shadow.map?.dispose();target.dispose();renderer.dispose();}
    },curved);
    console.log(JSON.stringify({report,errors},null,2));
    if(errors.length||report.results.some(r=>r.pixels<1000||r.correctedMeanLoss>r.baselineMeanLoss*.3||r.castShadowPixels<30))throw new Error('Receiver-plane shadow regression');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
