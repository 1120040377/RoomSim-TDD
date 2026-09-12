const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:'chromium'});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|GL_INVALID/i.test(m.text()))errors.push(m.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const results=await page.evaluate(async()=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {installPointLightBranch}=await import('/src/modules/walkthrough/point-light-branch.ts');
      const renderer=new T.WebGLRenderer();renderer.setSize(256,256);
      const target=new T.WebGLRenderTarget(256,256),scene=new T.Scene();
      const camera=new T.PerspectiveCamera(45,1,.1,30);camera.position.set(0,0,5);
      const material=new T.MeshPhysicalMaterial({color:0xc4ac8c,roughness:.6,sheen:.35,sheenColor:0xffffff,clearcoat:.2});
      const sphere=new T.Mesh(new T.SphereGeometry(1,48,32),material);scene.add(sphere);
      const light=new T.PointLight(0xffc080,12,3,2);scene.add(light);
      scene.add(new T.HemisphereLight(0xffffff,0x302010,.3));
      const rows=[];
      function draw(key){
        material.customProgramCacheKey=()=>key;material.needsUpdate=true;
        renderer.setRenderTarget(target);renderer.render(scene,camera);
        const pixels=new Uint8Array(256*256*4);renderer.readRenderTargetPixels(target,0,0,256,256,pixels);return pixels;
      }
      try{
        for(const distance of [0,2,3])for(const x of [0,1.5,3,6]){
          light.distance=distance;light.position.set(x,1,1.5);
          const original=draw('original'),release=installPointLightBranch();
          let changed;try{changed=draw('guarded');}finally{release();}
          let maximum=0,sum=0;
          for(let i=0;i<original.length;i++){const delta=Math.abs(original[i]-changed[i]);maximum=Math.max(maximum,delta);sum+=delta;}
          rows.push({distance,x,maximum,mean:sum/original.length});
        }
        return rows;
      }finally{sphere.geometry.dispose();material.dispose();target.dispose();renderer.dispose();}
    });
    console.log(JSON.stringify({results,errors},null,2));
    expect(results).toHaveLength(12);for(const row of results)expect(row.maximum).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
