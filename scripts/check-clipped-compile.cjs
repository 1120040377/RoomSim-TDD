// r160 compileAsync does not call clipping.setState per material. Verify whether
// priming that state with a cheap draw avoids compiling a different variant later.
const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:'chromium'});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|GL_INVALID/i.test(m.text()))errors.push(m.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const environmentShadow=process.env.ROOMSIM_ENV_SHADOW==='1';
    const cancellable=process.env.ROOMSIM_CANCELLABLE_COMPILE==='1';
    const results=await page.evaluate(async({environmentShadow,cancellable})=>{
      const T=await import('/node_modules/.vite/deps/three.js'),rows=[];
      const {waitForShaderPrograms}=await import('/src/modules/walkthrough/shader-readiness.ts');
      const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
      for(const offscreen of [false,true])for(const intersection of [false,true])for(const transparent of [false,true]){
        const variants=[];
        // Counterbalance context order; GPU driver caches can outlive a context.
        for(const prime of transparent?[true,false]:[false,true]){
          const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});
          renderer.setSize(64,64);renderer.localClippingEnabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;
          const target=new T.WebGLRenderTarget(64,64),scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,20);
          camera.position.z=4;
          const planes=[new T.Plane(new T.Vector3(-1,0,0),.3),new T.Plane(new T.Vector3(0,-1,0),.3)];
          const normal=new T.DataTexture(new Uint8Array([128,128,255,255]),1,1);normal.needsUpdate=true;
          const material=new T.MeshPhysicalMaterial({color:0xc8ac87,roughness:transparent?.12:.6,clearcoat:.2,
            sheen:transparent?0:.3,normalMap:transparent?null:normal,transparent,opacity:transparent?.25:1,
            side:transparent?T.DoubleSide:T.FrontSide,clippingPlanes:planes,clipIntersection:intersection});
          const mesh=new T.Mesh(new T.SphereGeometry(1,24,16),material);scene.add(mesh,new T.HemisphereLight(0xffffff,0x302010,2));
          let environmentTarget=null,sun=null;
          if(environmentShadow){
            const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);
            try{environmentTarget=pmrem.fromScene(studio,.04);scene.environment=environmentTarget.texture;}
            finally{studio.dispose();pmrem.dispose();}
            renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
            mesh.castShadow=mesh.receiveShadow=true;
            sun=new T.DirectionalLight(0xffffff,2);sun.position.set(3,3,3);sun.castShadow=true;
            sun.shadow.mapSize.set(128,128);scene.add(sun);
          }
          for(let i=0;i<6;i++){const light=new T.PointLight(0xfff4dc,3,8);light.position.set(Math.sin(i)*2,Math.cos(i)*2,2);scene.add(light);}
          const primer=new T.Scene(),basic=new T.MeshBasicMaterial({clippingPlanes:planes,clipIntersection:intersection});
          const probe=new T.Mesh(new T.PlaneGeometry(1,1),basic);probe.frustumCulled=false;primer.add(probe);
          const supported=renderer.getContext().getExtension('KHR_parallel_shader_compile')!==null;
          try{
            renderer.setRenderTarget(offscreen?target:null);
            if(environmentShadow){
              // Build the real shadow map/depth program without compiling the
              // Physical beauty material. Both variants pay this setup cost.
              const plain=new T.MeshBasicMaterial();scene.overrideMaterial=plain;
              try{renderer.render(scene,camera);}finally{scene.overrideMaterial=null;plain.dispose();}
            }
            const start=performance.now();
            if(prime)renderer.render(primer,camera);
            const preparationSubmitMs=performance.now()-start;
            let heartbeatCount=0,heartbeatFrame=0;
            const heartbeat=()=>{heartbeatCount++;heartbeatFrame=requestAnimationFrame(heartbeat);};
            heartbeatFrame=requestAnimationFrame(heartbeat);
            const compileStart=performance.now();
            let pending;
            if(cancellable){
              renderer.compile(mesh,camera,scene);
              pending=waitForShaderPrograms(renderer.getContext(),renderer.info.programs.map(program=>program.program),new AbortController().signal);
            }else pending=renderer.compileAsync(mesh,camera,scene);
            const compileSubmitMs=performance.now()-compileStart;
            let readiness='native';
            try{const result=await pending;if(cancellable)readiness=result;}finally{cancelAnimationFrame(heartbeatFrame);}
            const compileWaitMs=performance.now()-compileStart,before=renderer.info.programs.length;
            const drawStart=performance.now();renderer.render(scene,camera);const drawMs=performance.now()-drawStart;
            const pixels=new Uint8Array(64*64*4);
            if(offscreen)renderer.readRenderTargetPixels(target,0,0,64,64,pixels);
            else{const gl=renderer.getContext();gl.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);}
            variants.push({prime,supported,environmentReady:!!scene.environment,shadowReady:!!sun?.shadow.map,
              readiness,preparationSubmitMs,compileSubmitMs,compileWaitMs,heartbeatCount,drawMs,newPrograms:renderer.info.programs.length-before,
              litChannels:pixels.reduce((n,value,i)=>n+Number(i%4!==3&&value>0),0),pixels:Array.from(pixels)});
          }finally{
            mesh.geometry.dispose();material.dispose();normal.dispose();probe.geometry.dispose();basic.dispose();sun?.shadow.dispose();environmentTarget?.dispose();target.dispose();renderer.dispose();renderer.forceContextLoss();
          }
        }
        variants.sort((a,b)=>Number(a.prime)-Number(b.prime));
        let maxPixelDifference=0;
        for(let i=0;i<variants[0].pixels.length;i++)maxPixelDifference=Math.max(maxPixelDifference,Math.abs(variants[0].pixels[i]-variants[1].pixels[i]));
        rows.push({offscreen,intersection,transparent,maxPixelDifference,variants:variants.map(({pixels,...rest})=>rest)});
      }
      return rows;
    },{environmentShadow,cancellable});
    for(const row of results){
      expect(row.maxPixelDifference).toBe(0);
      expect(row.variants[0].newPrograms).toBeGreaterThan(0);
      expect(row.variants[1].newPrograms).toBe(0);
      for(const variant of row.variants)expect(variant.litChannels).toBeGreaterThan(100);
      if(environmentShadow)for(const variant of row.variants){expect(variant.environmentReady).toBe(true);expect(variant.shadowReady).toBe(true);}
      if(cancellable)for(const variant of row.variants)expect(variant.readiness).toBe('ready');
    }
    expect(errors).toEqual([]);console.log(JSON.stringify({environmentShadow,cancellable,results,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
