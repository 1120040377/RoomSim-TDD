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
      const {createExteriorBackdrop}=await import('/src/modules/walkthrough/exterior-backdrop.ts');
      const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(128,128);
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(65,1,.02,200);
      let ready;const loaded=new Promise(resolve=>{ready=resolve;});const backdrop=createExteriorBackdrop(ready);await loaded;scene.add(backdrop.mesh);
      const capture=(yaw,pitch=0,translated=false)=>{
        camera.position.set(translated?12:0,translated?4:0,translated?-7:0);
        camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld();backdrop.update(camera);renderer.render(scene,camera);
        const gl=renderer.getContext(),pixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
      };
      const difference=(a,b)=>{let sum=0,max=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d;max=Math.max(max,d);}return {mean:sum/a.length,max};};
      try{
        const original=capture(.3),yaw=capture(1.1),pitch=capture(.3,.25),translated=capture(.3,0,true),restored=capture(.3),fullTurn=capture(.3+2*Math.PI);
        return {yaw:difference(original,yaw),pitch:difference(original,pitch),translated:difference(original,translated),restored:difference(original,restored),fullTurn:difference(original,fullTurn),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
      }finally{backdrop.dispose();renderer.dispose();}
    });
    expect(result.yaw.mean).toBeGreaterThan(5);expect(result.pitch.mean).toBeGreaterThan(5);
    expect(result.restored.max).toBe(0);expect(result.fullTurn.max).toBeLessThanOrEqual(1);
    expect(result.translated.max).toBeLessThanOrEqual(1);
    expect(result.calls).toBe(1);expect(result.triangles).toBe(2);expect(errors).toEqual([]);
    console.log(JSON.stringify({result,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
