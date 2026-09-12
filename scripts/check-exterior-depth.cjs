const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:'chromium'});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|GL_INVALID/i.test(m.text()))errors.push(m.text());});
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const cases=await page.evaluate(async()=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {createExteriorBackdrop}=await import('/src/modules/walkthrough/exterior-backdrop.ts');
      const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(128,128);
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(70,1,.02,200);
      let ready;const loaded=new Promise(resolve=>{ready=resolve;});const background=createExteriorBackdrop(ready);await loaded;
      scene.add(background.mesh);
      const box=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:0xb94935}));scene.add(box);
      const glass=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0x8ec8d4,transparent:true,opacity:.35,depthWrite:false}));scene.add(glass);
      let order=[];
      for(const [object,name] of [[background.mesh,'background'],[box,'opaque'],[glass,'glass']])object.onBeforeRender=()=>order.push(name);
      const rows=[];
      try{
        for(const [distance,far] of [[4,200],[120,200],[20,70]]){
          camera.far=far;camera.updateProjectionMatrix();background.update(camera);
          box.position.z=-distance;box.scale.setScalar(distance*.5);
          glass.position.set(distance*.12,0,-distance*.7);glass.scale.setScalar(distance*.25);
          const variants=[];
          for(const renderOrder of [-100,10000]){
            background.mesh.renderOrder=renderOrder;order=[];renderer.render(scene,camera);
            const gl=renderer.getContext(),pixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            variants.push({pixels,order:[...order],calls:renderer.info.render.calls});
          }
          let maxDifference=0;for(let i=0;i<variants[0].pixels.length;i++)maxDifference=Math.max(maxDifference,Math.abs(variants[0].pixels[i]-variants[1].pixels[i]));
          const center=(64*128+64)*4,corner=0;
          rows.push({distance,far,maxDifference,orders:variants.map(v=>v.order),calls:variants.map(v=>v.calls),center:Array.from(variants[1].pixels.slice(center,center+3)),corner:Array.from(variants[1].pixels.slice(corner,corner+3))});
        }
        return rows;
      }finally{background.dispose();box.geometry.dispose();box.material.dispose();glass.geometry.dispose();glass.material.dispose();renderer.dispose();}
    });
    for(const row of cases){
      expect(row.maxDifference).toBe(0);expect(row.orders).toEqual([['background','opaque','glass'],['opaque','background','glass']]);
      expect(row.calls).toEqual([3,3]);expect(row.center).not.toEqual(row.corner);expect(row.corner.some(value=>value>0)).toBe(true);
    }
    expect(errors).toEqual([]);console.log(JSON.stringify({cases,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
