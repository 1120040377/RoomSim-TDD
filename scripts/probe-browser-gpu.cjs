const {chromium}=require('@playwright/test');
(async()=>{
  // Separate temporary headless profiles; never attach to the user's browser.
  for(const channel of [undefined,'chromium','msedge']){
    let browser;
    try{
      browser=await chromium.launch({headless:true,channel});
      const page=await browser.newPage();
      const result=await page.evaluate(()=>{
        const canvas=document.createElement('canvas');
        const gl=canvas.getContext('webgl2',{powerPreference:'high-performance'});
        if(!gl)return {webgl2:false};
        const debug=gl.getExtension('WEBGL_debug_renderer_info');
        return {webgl2:true,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
          gpuTimer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE)};
      });
      console.log(JSON.stringify({channel:channel||'headless-shell',...result}));
    }catch(error){console.log(JSON.stringify({channel:channel||'headless-shell',error:error.message.split('\n')[0]}));}
    finally{await browser?.close();}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
