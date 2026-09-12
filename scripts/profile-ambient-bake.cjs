const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&/Shader Error|VALIDATE_STATUS/i.test(message.text()))errors.push(message.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const visual=process.env.ROOMSIM_BAKE_VISUAL==='1';
    const bounce=process.env.ROOMSIM_BAKE_BOUNCE==='1';
    const softSun=process.env.ROOMSIM_BAKE_SOFT_SUN==='1';
    const fineSun=softSun&&process.env.ROOMSIM_BAKE_FINE_SUN==='1';
    const combinedLighting=bounce&&process.env.ROOMSIM_BAKE_COMBINED==='1';
    const walls=bounce||process.env.ROOMSIM_BAKE_WALLS==='1';
    const report=await page.evaluate(async({visual,walls,bounce,combinedLighting,softSun,fineSun})=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {materialShowroom}=await import('/src/modules/templates/apartments/material-showroom.ts');
      const {buildWalls}=await import('/src/modules/walkthrough/builders/wall-builder.ts');
      const {buildFurniture}=await import('/src/modules/walkthrough/builders/furniture-builder.ts');
      // Resolve the same module instances as the builders, including Vite HMR timestamps.
      async function modelDependency(builder,file){
        const source=await (await fetch(`/src/modules/walkthrough/builders/furniture/${builder}.ts`)).text();
        const dependency=source.match(new RegExp(`from\\s+["']([^"']*${file}\\.ts[^"']*)["']`));
        if(!dependency)throw new Error(`Missing ${file} dependency`);
        return import(dependency[1]);
      }
      const {prepareArmchairModel}=await modelDependency('upholstery','model-armchair');
      const {prepareDrapedThrow}=await modelDependency('bedroom','model-throw');
      const loaded=await Promise.all([prepareArmchairModel(),prepareDrapedThrow()]);
      if(loaded.some(ready=>!ready))throw new Error('Production showroom asset load failed');
      const plan=materialShowroom.build('Bake study'),root=new T.Group();
      root.add(buildWalls(plan).group,buildFurniture(plan));
      if(!root.getObjectByName('simulated-bed-throw'))throw new Error('Study did not build the production throw');
      const {snapshotOccluders}=await import('/src/modules/walkthrough/baking/scene-snapshot.ts');
      const snapshotStart=performance.now();let sliceStart=snapshotStart,maxSliceMs=0,snapshotYields=0;
      const triangles=await snapshotOccluders(root,{yieldTask:async()=>{
        maxSliceMs=Math.max(maxSliceMs,performance.now()-sliceStart);snapshotYields++;
        await new Promise(resolve=>setTimeout(resolve,0));sliceStart=performance.now();
      }});
      maxSliceMs=Math.max(maxSliceMs,performance.now()-sliceStart);
      const snapshotMs=performance.now()-snapshotStart;
      if(!triangles)throw new Error('Snapshot canceled');
      const width=fineSun?512:visual?256:64,height=fineSun?384:visual?192:48;
      const positions=new Float32Array(width*height*3),normals=new Float32Array(positions.length);
      for(let z=0;z<height;z++)for(let x=0;x<width;x++){
        const i=(z*width+x)*3;positions.set([(x+.5)/width*11.4,0,(z+.5)/height*8],i);normals[i+1]=1;
      }
      const triangleCount=triangles.length/9;let heartbeats=0;
      const heartbeat=setInterval(()=>heartbeats++,10);
      const {OcclusionBakeJob}=await import('/src/modules/walkthrough/baking/bake-job.ts');
      const job=new OcclusionBakeJob();
      try{
        const result=await job.start({triangles,positions,normals,samples:32,radius:.6});
        if(!result)throw new Error('Study bake canceled');
        const values=Array.from(result.values);
        let wallReport=null,sunReport=null;
        if(visual){
          const {buildFloor}=await import('/src/modules/walkthrough/builders/floor-builder.ts');
          const {floorOcclusionTexture,attachFloorOcclusion}=await import('/src/modules/walkthrough/baking/floor-occlusion.ts');
          const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
          const {fitSunShadow}=await import('/src/modules/walkthrough/fit-sun-shadow.ts');
          const {DAYLIGHT_LOOK:look}=await import('/src/modules/walkthrough/lighting-look.ts');
          const floor=buildFloor(plan);root.add(floor);
          if(walls){
            const {prepareWallAtlas}=await import('/src/modules/walkthrough/baking/wall-atlas.ts');
            const start=performance.now(),atlas=prepareWallAtlas(root.children[0]);
            const prepareMs=performance.now()-start;
            const floorTriangles=await snapshotOccluders(floor);
            const combined=new Float32Array(triangles.length+floorTriangles.length);combined.set(triangles);combined.set(floorTriangles,triangles.length);
            let baked,reflectorSnapshotMs=null,reflectorMaxSliceMs=null,colorConversionMaxMs=null;
            if(bounce){
              const {snapshotReflectors}=await import('/src/modules/walkthrough/baking/reflector-snapshot.ts');
              const begin=performance.now();let slice=begin;reflectorMaxSliceMs=0;
              const reflectors=await snapshotReflectors(root,{yieldTask:async()=>{
                reflectorMaxSliceMs=Math.max(reflectorMaxSliceMs,performance.now()-slice);
                await new Promise(resolve=>setTimeout(resolve,0));slice=performance.now();
              }}),sunColor=new T.Color(look.sun).multiplyScalar(look.sunIntensity);
              reflectorMaxSliceMs=Math.max(reflectorMaxSliceMs,performance.now()-slice);reflectorSnapshotMs=performance.now()-begin;
              colorConversionMaxMs=reflectors.colorConversionMaxMs;
              const worker=new Worker('/src/modules/walkthrough/baking/diffuse-bounce.worker.ts',{type:'module'});let timer;
              try{baked=await new Promise((resolve,reject)=>{
                timer=setTimeout(()=>reject(new Error('Bounce timeout')),30000);
                worker.onerror=event=>reject(new Error(event.message));
                worker.onmessage=event=>event.data.error?reject(new Error(event.data.error)):resolve(event.data);
                worker.postMessage({...reflectors,positions:atlas.positions,normals:atlas.normals,samples:64,
                  sunDirection:[4,13,6],sunIrradiance:[sunColor.r,sunColor.g,sunColor.b]});
              });}finally{clearTimeout(timer);worker.terminate();}
            }else baked=await job.start({triangles:combined,positions:atlas.positions,normals:atlas.normals,samples:32,radius:.8});
            const visibility=combinedLighting?await job.start({triangles:combined,positions:atlas.positions,normals:atlas.normals,samples:32,radius:.8}):null;
            const binding=atlas.apply(bounce?baked.irradiance:baked.values,bounce?'irradiance':'occlusion',visibility?.values);
            wallReport={charts:atlas.chartCount,points:atlas.positions.length/3,prepareMs,reflectorSnapshotMs,reflectorMaxYieldGapMs:reflectorMaxSliceMs,colorConversionMaxMs,bakeMs:baked.bakeMs,aoBakeMs:visibility?.bakeMs,textureBytes:binding.texture.image.data.byteLength+(binding.aoTexture?.image.data.byteLength??0)};
          }
          let sunBake=null;
          if(softSun){
            const worker=new Worker('/src/modules/walkthrough/baking/soft-sun.worker.ts',{type:'module'});let timer;
            try{sunBake=await new Promise((resolve,reject)=>{
              timer=setTimeout(()=>reject(new Error('Sun bake timeout')),30000);
              worker.onerror=event=>reject(new Error(event.message));
              worker.onmessage=event=>event.data.error?reject(new Error(event.data.error)):resolve(event.data);
              worker.postMessage({triangles,positions,normals,direction:[4,13,6],samples:64,angularRadius:.025,adaptive:fineSun});
            });}finally{clearTimeout(timer);worker.terminate();}
            sunReport={bakeMs:sunBake.bakeMs,rays:sunBake.rays,refinedPoints:sunBake.refinedPoints,textureBytes:width*height*4};
          }
          const texture=floorOcclusionTexture(result.values,width,height,sunBake?.values);
          attachFloorOcclusion(floor,texture,{minX:0,minZ:0,width:11.4,depth:8},.7);
          let detachSun=null;const sunModule=softSun?await import('/src/modules/walkthrough/baking/soft-sun-material.ts'):null;
          const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,900);
          renderer.localClippingEnabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=look.exposure;
          renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
          const scene=new T.Scene();scene.background=new T.Color(look.background);scene.add(root);
          const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.04);
          scene.environment=environment.texture;studio.dispose();pmrem.dispose();
          const light=new T.DirectionalLight(look.sun,look.sunIntensity);light.position.set(9,13,10);light.target.position.set(5,0,4);
          light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.normalBias=.006;
          scene.add(light,light.target,new T.HemisphereLight(look.sky,look.ground,look.fillIntensity));
          fitSunShadow(light,[root]);
          root.children[0].traverse(object=>{if(object.isMesh){
            for(const material of Array.isArray(object.material)?object.material:[object.material])
              material.clippingPlanes=[new T.Plane(new T.Vector3(0,-1,0),1.05)];
          }});
          const camera=new T.PerspectiveCamera(40,1200/900,.1,100);camera.position.set(5.9,4.8,9.5);camera.lookAt(2.9,.5,5.1);
          document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';
          const floorMaterials=new Set(floor.children.filter(o=>o.userData.roomId).map(o=>o.material));
          if(walls){floorMaterials.clear();root.children[0].traverse(object=>{if(object.isMesh&&(bounce?object.material.lightMap:object.material.aoMap))floorMaterials.add(object.material);});}
          window.showBake=enabled=>{
            if(softSun){detachSun?.();detachSun=enabled?sunModule.attachSoftSun(floor):null;}
            else for(const material of floorMaterials){if(bounce){material.lightMapIntensity=enabled?1:0;if(combinedLighting)material.aoMapIntensity=enabled?.7:0;}else material.aoMapIntensity=enabled?.7:0;}
            renderer.render(scene,camera);return renderer.info.render.calls;
          };
          window.showBake(true);
        }
        return {wallReport,sunReport,triangleCount,snapshotMs,maxSliceMs,snapshotYields,points:values.length,rays:result.rays,buildMs:result.buildMs,bakeMs:result.bakeMs,
          min:values.reduce((a,b)=>Math.min(a,b),1),max:values.reduce((a,b)=>Math.max(a,b),0),mean:values.reduce((a,b)=>a+b,0)/values.length,heartbeats};
      }finally{clearInterval(heartbeat);job.dispose();}
    },{visual,walls,bounce,combinedLighting,softSun,fineSun});
    if(visual){
      await page.waitForTimeout(1500);
      const enabled=await page.evaluate(()=>window.showBake(true));
      await page.screenshot({path:`docs/images/${fineSun?'fine-sun':softSun?'soft-sun':combinedLighting?'combined':bounce?'bounce':walls?'wall':'floor'}-bake-on-study.png`});
      const disabled=await page.evaluate(()=>window.showBake(false));
      await page.screenshot({path:`docs/images/${fineSun?'fine-sun':softSun?'soft-sun':combinedLighting?'combined':bounce?'bounce':walls?'wall':'floor'}-bake-off-study.png`});
      if(enabled!==disabled)throw new Error('AO added draw calls');
      console.log('On/off draw calls:',{enabled,disabled});
    }
    if(report.min>=.95||report.max<.99||report.heartbeats<1)throw new Error(JSON.stringify(report));
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('Isolated worker bake, not render FPS:',report);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
