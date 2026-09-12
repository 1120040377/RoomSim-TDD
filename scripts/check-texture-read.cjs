const {chromium}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const result=await page.evaluate(async()=>{
      const T=await import('/node_modules/three/build/three.module.js');
      const {prepareColorSampler}=await import('/src/modules/walkthrough/baking/prepare-color-sampler.ts');
      const {ReflectorColorSampler}=await import('/src/modules/walkthrough/baking/color-sampler.ts');
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
      const context=canvas.getContext('2d');context.fillStyle='#c89c72';context.fillRect(0,0,256,256);
      const bitmap=await createImageBitmap(canvas),texture=new T.Texture(bitmap);texture.colorSpace=T.SRGBColorSpace;
      const Original=window.Worker;let live=0,created=0;
      window.Worker=class extends Original{
        constructor(...args){super(...args);created++;live++;this.ended=false;}
        terminate(){if(!this.ended){this.ended=true;live--;}super.terminate();}
      };
      try{
        const abort=new AbortController(),pending=prepareColorSampler([texture],abort.signal);abort.abort();
        const canceled=await pending;
        const sampler=await prepareColorSampler([texture,texture.clone()]);
        const uv=new T.Vector2(.5,.5),rgb=sampler.forTexture(texture)(uv,new T.Color()).toArray();
        const reference=new ReflectorColorSampler().forTexture(texture)(uv,new T.Color()).toArray();
        return {canceled:canceled===null,rgb,reference,sourceWidth:bitmap.width,live,created};
      }finally{window.Worker=Original;bitmap.close();}
    });
    if(!result.canceled||result.live!==0||result.created!==2||result.sourceWidth!==256||result.rgb.some((v,i)=>Math.abs(v-result.reference[i])>1e-6))
      throw new Error(JSON.stringify(result));
    console.log('Background read equivalence, cancellation, source ownership:',result);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
