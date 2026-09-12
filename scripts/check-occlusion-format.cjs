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
      const {InteriorOcclusionPass}=await import('/src/modules/walkthrough/interior-occlusion.ts');
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,20);
      const material=new T.MeshStandardMaterial({color:0xc8ac87,roughness:.6});
      const box=new T.Mesh(new T.BoxGeometry(1,1,1),material);box.position.y=.5;
      const floor=new T.Mesh(new T.BoxGeometry(6,.1,6),material);floor.position.y=-.05;
      scene.add(box,floor,new T.HemisphereLight(0xffffff,0x808080,2));
      const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;
      const composer=new EffectComposer(renderer),beauty=new RenderPass(scene,camera);
      const ao=new InteriorOcclusionPass(scene,camera,256,256,16);
      const output=new InteriorOutputPass(ao.useOutputComposite(false));
      composer.addPass(beauty);composer.addPass(ao);composer.addPass(output);
      const draw=i=>{
        camera.position.set(2+i*.2,2,3);camera.lookAt(0,.2,0);composer.render();
        const gl=renderer.getContext(),pixels=new Uint8Array(256*256*4);
        gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
      };
      try{
        // Both variants share kernel/noise and scene: no random sampling mismatch.
        ao.ssaoRenderTarget.depthBuffer=ao.blurRenderTarget.depthBuffer=true;
        const before=[0,1,2].map(draw);
        ao.useOutputComposite(true);
        ao.ssaoRenderTarget.depthBuffer=ao.blurRenderTarget.depthBuffer=false;
        const after=[0,1,2].map(draw);
        let maxDifference=0;
        for(let f=0;f<3;f++)for(let i=0;i<before[f].length;i++)maxDifference=Math.max(maxDifference,Math.abs(before[f][i]-after[f][i]));
        const enabled=draw(0);
        output.material.uniforms.hasOcclusion.value=0;
        const disabled=draw(0);
        let affectedChannels=0;
        for(let i=0;i<enabled.length;i++)if(enabled[i]!==disabled[i])affectedChannels++;
        return {maxDifference,affectedChannels,webgl2:renderer.capabilities.isWebGL2,glError:renderer.getContext().getError()};
      }finally{output.dispose();ao.dispose();beauty.dispose();composer.dispose();renderer.dispose();box.geometry.dispose();floor.geometry.dispose();material.dispose();}
    });
    expect(result.webgl2).toBe(true);expect(result.maxDifference).toBe(0);expect(result.affectedChannels).toBeGreaterThan(100);expect(result.glError).toBe(0);expect(errors).toEqual([]);
    console.log(JSON.stringify({result,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
