const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:'chromium'});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|GL_INVALID/i.test(m.text()))errors.push(m.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const result=await page.evaluate(async()=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {EffectComposer}=await import('/node_modules/three/examples/jsm/postprocessing/EffectComposer.js');
      const {RenderPass}=await import('/node_modules/three/examples/jsm/postprocessing/RenderPass.js');
      const {InteriorOutputPass}=await import('/src/modules/walkthrough/interior-output.ts');
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,20);camera.position.z=4;
      const mesh=new T.Mesh(new T.SphereGeometry(1,32,24),new T.MeshStandardMaterial({color:0xc8ac87,roughness:.6}));scene.add(mesh);
      const light=new T.DirectionalLight(0xffffff,2);light.position.set(2,3,4);scene.add(light,new T.HemisphereLight(0xffffff,0x302010,.4));
      const cases=[];
      for(const legacy of [true,false]){
        const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(128,128);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;
        const composer=new EffectComposer(renderer);composer.renderTarget1.samples=composer.renderTarget2.samples=4;
        const output=new InteriorOutputPass();output.setBackground(new T.Color('#e7ded0'));
        if(legacy){const render=output.render;output.render=function(...args){render.apply(this,args);this.needsSwap=true;};}
        const beauty=new RenderPass(scene,camera);composer.addPass(beauty);composer.addPass(output);
        const frames=[];
        try{
          for(let i=0;i<4;i++){
            mesh.rotation.y=i*.2;composer.render();
            const gl=renderer.getContext(),pixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);frames.push(Array.from(pixels));
          }
          cases.push({textures:renderer.info.memory.textures,frames});
        }finally{output.dispose();beauty.dispose();composer.dispose();renderer.dispose();}
      }
      mesh.geometry.dispose();mesh.material.dispose();
      let maxDifference=0;
      for(let f=0;f<4;f++)for(let i=0;i<cases[0].frames[f].length;i++)maxDifference=Math.max(maxDifference,Math.abs(cases[0].frames[f][i]-cases[1].frames[f][i]));
      return {maxDifference,textures:cases.map(c=>c.textures)};
    });
    expect(result.maxDifference).toBe(0);expect(result.textures[1]).toBe(result.textures[0]-1);expect(errors).toEqual([]);
    console.log(JSON.stringify({result,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
