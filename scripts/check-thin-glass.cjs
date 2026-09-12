const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const result=await page.evaluate(async()=>{
      const T=await import('/node_modules/three/build/three.module.js');
      const {applyThinGlassReflection}=await import('/src/modules/walkthrough/builders/thin-glass.ts');
      const renderer=new T.WebGLRenderer();renderer.setSize(32,32);
      const target=new T.WebGLRenderTarget(32,32),scene=new T.Scene();scene.background=new T.Color(0);
      const material=new T.MeshPhysicalMaterial({color:0,roughness:.65,transparent:true,opacity:.16,depthWrite:false});
      const enhanced=material.clone();applyThinGlassReflection(enhanced);
      const mesh=new T.Mesh(new T.PlaneGeometry(2,2),material);scene.add(mesh);
      const light=new T.DirectionalLight(0xffffff,2);light.position.z=2;scene.add(light);
      const camera=new T.PerspectiveCamera(45,1,.1,10);camera.position.z=2;
      const sample=mat=>{
        mesh.material=mat;renderer.setRenderTarget(target);renderer.render(scene,camera);
        const pixels=new Uint8Array(4);renderer.readRenderTargetPixels(target,16,16,1,1,pixels);
        return {red:pixels[0],calls:renderer.info.render.calls};
      };
      const baseline=sample(material),reflection=sample(enhanced);
      mesh.geometry.dispose();material.dispose();enhanced.dispose();target.dispose();renderer.dispose();
      return {baseline,reflection};
    });
    if(result.reflection.red<=result.baseline.red*2||result.reflection.calls!==1||result.baseline.calls!==1)
      throw new Error(JSON.stringify(result));
    console.log('Reflection survives low alpha without another draw:',result);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
