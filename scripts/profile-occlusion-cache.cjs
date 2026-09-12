// Isolates CPU cache bookkeeping; mock draws intentionally exclude GPU work.
const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:'chromium'});
  try{
    const page=await browser.newPage();
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const results=await page.evaluate(async()=>{
      const T=await import('/node_modules/.vite/deps/three.js');
      const {InteriorOcclusionPass}=await import('/src/modules/walkthrough/interior-occlusion.ts');
      const {ValueSnapshot}=await import('/src/modules/walkthrough/value-snapshot.ts');
      const original=ValueSnapshot.prototype.commit,rows=[];
      const renderer={capabilities:{isWebGL2:true},getClearColor:c=>c,getClearAlpha:()=>1,autoClear:true,shadowMap:{autoUpdate:false},
        setRenderTarget(){},setClearColor(){},setClearAlpha(){},clear(){},render(){}};
      // Same reusable input arrays in both cases: this isolates serialization cost,
      // not the additional old per-frame array allocation or actual graphics work.
      const serialized=function(){
        const next=this.scratch.join(',');
        const changed=!this.valid||next!==this.legacySignature;
        this.legacySignature=next;this.valid=true;return changed;
      };
      try{
        for(const count of [100,500,1000]){
          const scene=new T.Scene(),camera=new T.PerspectiveCamera();
          const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial({clippingPlanes:[new T.Plane(new T.Vector3(0,-1,0),1)]});
          for(let i=0;i<count;i++){const mesh=new T.Mesh(geometry,material);mesh.position.set(i%30,0,Math.floor(i/30));scene.add(mesh);}
          const samples={serialized:[],numeric:[]};
          // Alternate order to reduce warmup/order bias.
          for(let round=0;round<6;round++)for(const mode of round%2?['numeric','serialized']:['serialized','numeric']){
            ValueSnapshot.prototype.commit=mode==='numeric'?original:serialized;
            const pass=new InteriorOcclusionPass(scene,camera,128,128,4),target=new T.WebGLRenderTarget(16,16);
            pass.useOutputComposite();
            try{
              for(let i=0;i<150;i++){
                camera.position.x=Math.sin(i*.02);
                const started=performance.now();pass.render(renderer,target,target);
                if(i>=30)samples[mode].push(performance.now()-started);
              }
            }finally{pass.dispose();target.dispose();}
          }
          const distribution=values=>{values.sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)],samples:values.length};};
          rows.push({meshes:count,serialized:distribution(samples.serialized),numeric:distribution(samples.numeric)});
          geometry.dispose();material.dispose();
        }
        return rows;
      }finally{ValueSnapshot.prototype.commit=original;}
    });
    expect(results).toHaveLength(3);console.log(JSON.stringify({scope:'CPU AO pass with mock draws; not frame rate or GPU timing',results},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
