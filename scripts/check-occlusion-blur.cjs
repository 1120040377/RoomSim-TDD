const { chromium } = require('@playwright/test');

// Isolated synthetic depth discontinuity: measure the actual compiled shader.
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(process.env.ROOMSIM_URL || 'http://127.0.0.1:5175/');
    const result = await page.evaluate(async () => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { OCCLUSION_BLUR_FRAGMENT } = await import('/src/modules/walkthrough/occlusion-blur.ts');
      const width=16, height=8, near=.1, far=100;
      const ao=new Float32Array(width*height*4), depth=new Float32Array(ao.length);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const i=(y*width+x)*4, shade=x<8?1:.3;
        ao.set([shade,shade,shade,1],i);
        const z=x<8?2:8, d=far/(far-near)*(1-near/z);
        depth.set([d,d,d,1],i);
      }
      const make=(data,filter)=>{
        const texture=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);
        texture.minFilter=texture.magFilter=filter;texture.needsUpdate=true;return texture;
      };
      const diffuse=make(ao,T.LinearFilter), depths=make(depth,T.NearestFilter);
      const renderer=new T.WebGLRenderer();renderer.setSize(width,height);
      const target=new T.WebGLRenderTarget(width,height);
      const material=new T.ShaderMaterial({
        uniforms:{tDiffuse:{value:diffuse},tDepth:{value:depths},resolution:{value:new T.Vector2(width,height)},
          cameraNear:{value:near},cameraFar:{value:far}},
        vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}',
        fragmentShader:OCCLUSION_BLUR_FRAGMENT,
      });
      const scene=new T.Scene(),geometry=new T.PlaneGeometry(2,2);scene.add(new T.Mesh(geometry,material));
      renderer.setRenderTarget(target);renderer.render(scene,new T.Camera());
      const pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
      const lit=pixels[(4*width+7)*4]/255, shaded=pixels[(4*width+8)*4]/255;
      depth.fill(1);depths.needsUpdate=true;renderer.render(scene,new T.Camera());
      renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
      const background=pixels[(4*width+8)*4]/255;
      geometry.dispose();material.dispose();target.dispose();diffuse.dispose();depths.dispose();renderer.dispose();
      return {lit,shaded,background};
    });
    if(result.lit<.98 || Math.abs(result.shaded-.3)>.02 || result.background!==1) {
      throw new Error(`Depth-aware blur failed: ${JSON.stringify(result)}`);
    }
    console.log('Depth discontinuity and background verified:',result);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
