const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const result=await page.evaluate(async()=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {prepareWallAtlas}=await import('/src/modules/walkthrough/baking/wall-atlas.ts');
      const mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0xffffff}));mesh.userData.wallId='wall';
      const atlas=prepareWallAtlas(mesh),binding=atlas.apply(new Float32Array(atlas.positions.length).fill(Math.PI),'irradiance',new Float32Array(atlas.positions.length/3));
      if(atlas.chartCount!==6)throw new Error('Test mesh did not enter wall atlas');
      const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(32,32);renderer.outputColorSpace=T.LinearSRGBColorSpace;
      const scene=new T.Scene();scene.add(mesh);const camera=new T.PerspectiveCamera(40,1,.1,10);camera.position.z=3;
      const pixel=new Uint8Array(4),target=new T.WebGLRenderTarget(32,32);
      const draw=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,16,16,1,1,pixel);return pixel[0];};
      try{
        const preserved=draw();mesh.material.onBeforeCompile=()=>{};mesh.material.customProgramCacheKey=()=> 'baseline-double-ao';mesh.material.needsUpdate=true;
        const doubleAttenuated=draw();mesh.material.aoMap=null;mesh.material.needsUpdate=true;const noAO=draw();
        return {preserved,doubleAttenuated,noAO,calls:renderer.info.render.calls};
      }finally{binding.dispose();mesh.geometry.dispose();mesh.material.dispose();target.dispose();renderer.dispose();}
    });
    if(result.preserved<250||result.doubleAttenuated<73||result.doubleAttenuated>79||result.calls!==1||errors.length)
      throw new Error(JSON.stringify({result,errors}));
    console.log('Traced bounce is not occluded twice:',result);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
