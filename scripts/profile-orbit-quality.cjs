const {chromium,expect}=require('@playwright/test');
const {summarizeFrames}=require('./profile-summary.cjs');
(async()=>{
  const browser=await chromium.launch({channel:'chromium'});
  try{
    const dpr=Number(process.env.ROOMSIM_DPR||2);
    if(!Number.isFinite(dpr)||dpr<=0)throw new Error('ROOMSIM_DPR must be positive');
    const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:dpr});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('console',message=>{if(message.type()==='error'&&/shader|WebGL|GL_INVALID/i.test(message.text()))errors.push(message.text());});
    const stockPCF=process.env.ROOMSIM_STOCK_PCF==='1';
    // Diagnostic only: freezing a cutaway shadow makes it stale, not a valid optimization.
    const freezeShadow=process.env.ROOMSIM_FREEZE_SHADOW==='1';
    const flatDetail=process.env.ROOMSIM_FLAT_DETAIL==='1';
    const noPointLights=process.env.ROOMSIM_NO_POINT_LIGHTS==='1';
    const warmPrograms=process.env.ROOMSIM_WARM_PROGRAMS==='1';
    const traceDraws=process.env.ROOMSIM_TRACE_DRAWS==='1';
    const warmDraw=process.env.ROOMSIM_WARM_DRAW==='1';
    const pointBranch=process.env.ROOMSIM_POINT_BRANCH==='1';
    const legacyOutputSwap=process.env.ROOMSIM_LEGACY_OUTPUT_SWAP==='1';
    const skipPreparation=process.env.ROOMSIM_SKIP_PREPARATION==='1';
    let outputOverrides=0;
    if(legacyOutputSwap)await page.route('**/interior-output.ts*',async route=>{
      const response=await route.fetch(),source=await response.text();
      const body=source.replace(/this\.needsSwap\s*=\s*!this\.renderToScreen/,'this.needsSwap = true');
      if(body===source)throw new Error('Legacy output swap override failed');
      outputOverrides++;await route.fulfill({response,body});
    });
    let shadowOverrides=0;
    let detailOverrides=0;
    if(freezeShadow||flatDetail||noPointLights||warmPrograms||traceDraws||warmDraw||pointBranch)await page.route('**/WalkthroughView.vue*',async route=>{
      const response=await route.fetch(),source=await response.text();
      const needle='renderer.shadowMap.needsUpdate = shadowCache.needsUpdate(scene, sun)';
      let body=source;
      if(pointBranch&&source.includes('const logicEnd = performance.now();'))body="import {installPointLightBranch} from '/src/modules/walkthrough/point-light-branch.ts'; installPointLightBranch();\n"+body;
      if(freezeShadow){
        body=body.replace(needle,'renderer.shadowMap.needsUpdate = window.roomSimFreezeShadow ? false : shadowCache.needsUpdate(scene, sun)');
        if(body!==source)shadowOverrides++;
      }
      if(flatDetail){
        const marker='const logicEnd = performance.now();';
        if(body.includes(marker)){
          detailOverrides++;
          body=body.replace(marker,`scene.traverse(object => {
            for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
              if (!material || material.userData.diagnosticFlatDetail) continue;
              material.userData.diagnosticFlatDetail = true;
              if (material.normalMap || material.roughnessMap) {
                material.normalMap = null; material.roughnessMap = null; material.needsUpdate = true;
                window.roomSimFlatDetailCount = (window.roomSimFlatDetailCount || 0) + 1;
              }
            }
          }); ${marker}`);
        }
      }
      if(noPointLights)body=body.replace('const logicEnd = performance.now();','allLights.forEach(light => { light.visible = false; }); const logicEnd = performance.now();');
      if(warmPrograms)body=body.replace('const logicEnd = performance.now();','window.roomSimWarmPrograms = () => renderer.compileAsync(scene, camera); const logicEnd = performance.now();');
      if(warmDraw)body=body.replace('const logicEnd = performance.now();',`window.roomSimWarmDraw = () => {
        const size=renderer.getSize(new Vector3()),saved=[];
        scene.traverse(object=>{saved.push([object,object.frustumCulled]);object.frustumCulled=false;});
        try { renderer.setSize(1,1,false); if(detailedShadows.value && composer){composer.setSize(1,1);composer.render();}else renderer.render(scene,camera); }
        finally { for(const [object,culled] of saved)object.frustumCulled=culled;renderer.setSize(size.x,size.y,false);if(composer)composer.setSize(size.x,size.y);frameCache.invalidate(); }
      }; const logicEnd = performance.now();`);
      if(traceDraws)body=body.replace('const logicEnd = performance.now();',`if (!window.roomSimDrawTrace) {
        window.roomSimDrawTrace = [];
        const originalDraw = renderer.renderBufferDirect;
        renderer.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
          const started = performance.now(), before = renderer.info.programs.length;
          originalDraw.call(this, camera, scene, geometry, material, object, group);
          const ms = performance.now() - started;
          if (ms > 20 || renderer.info.programs.length > before) {
            const ancestry = []; for (let parent = object; parent; parent = parent.parent) ancestry.push({name:parent.name,type:parent.type,furnitureType:planStore.plan?.furniture[parent.userData.furnitureId]?.type});
            window.roomSimDrawTrace.push({ms,ancestry,material:material.type,name:material.name,side:material.side,transparent:material.transparent,clipping:material.clippingPlanes?.length||0,clipIntersection:material.clipIntersection,map:!!material.map,normalMap:!!material.normalMap,before,after:renderer.info.programs.length,programNames:renderer.info.programs.slice(before).map(p=>p.name)});
          }
        };
      } const logicEnd = performance.now();`);
      await route.fulfill({response,body});
    });
    let overrides=0;
    if(stockPCF)await page.route('**/receiver-plane-shadow.ts*',async route=>{
      const response=await route.fetch(),source=await response.text();
      const body=source.replace(/function installReceiverPlaneShadow\(\)\s*\{/,'function installReceiverPlaneShadow() { return () => {};');
      if(source===body)throw new Error('Stock PCF override failed');
      overrides++;await route.fulfill({response,body});
    });
    const url=new URL(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');url.searchParams.set('profile','1');
    if(['1','staged','async'].includes(process.env.ROOMSIM_PREPARE)&&!skipPreparation)url.searchParams.set('prepare',process.env.ROOMSIM_PREPARE);
    await page.goto(url.href);await page.getByRole('button',{name:'新建方案'}).click();
    await page.getByRole('button',{name:/^材质样板间/}).click();await page.getByRole('button',{name:/进入漫游/}).click();
    await page.waitForFunction(()=>window.roomSimProfile?.length>=8);await page.keyboard.press('Escape');
    const graphics=await page.locator('canvas').evaluate(c=>{
      const gl=c.getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
      return {renderer:gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),width:c.width,height:c.height};
    });
    const results=[];
    for(const detailed of [false,true]){
      await page.evaluate(()=>{window.roomSimFreezeShadow=false;});
      await page.getByLabel('房间特写').selectOption('living');
      if(detailed)await page.getByRole('button',{name:'精细阴影',exact:true}).click();
      await page.waitForTimeout(1200);
      if(url.searchParams.has('prepare'))await expect(page.getByRole('status').filter({hasText:'正在准备材质与阴影'})).toHaveCount(0,{timeout:60000});
      let warmMs=null;
      if(warmPrograms)warmMs=await page.evaluate(async()=>{
        if(typeof window.roomSimWarmPrograms!=='function')throw new Error('Program warmup injection failed');
        const started=performance.now();await window.roomSimWarmPrograms();return performance.now()-started;
      });
      if(warmDraw)warmMs=await page.evaluate(()=>{
        if(typeof window.roomSimWarmDraw!=='function')throw new Error('Draw warmup injection failed');
        const started=performance.now();window.roomSimWarmDraw();return performance.now()-started;
      });
      await page.evaluate(freeze=>{window.roomSimProfile.length=0;window.roomSimFreezeShadow=freeze;if(window.roomSimDrawTrace)window.roomSimDrawTrace.length=0;},freezeShadow);
      await page.mouse.move(700,500);await page.mouse.down();
      try{
        for(let i=1;i<=120;i++){
          await page.mouse.move(700+170*Math.sin(i*Math.PI/60),500+30*Math.sin(i*Math.PI/30));
          await page.waitForTimeout(16);
        }
      }finally{await page.mouse.up();}
      // Allow asynchronous GPU queries to settle; summaries separate cached frames.
      await page.waitForTimeout(300);
      const frames=await page.evaluate(()=>window.roomSimProfile.slice());
      const drawTrace=traceDraws?await page.evaluate(()=>window.roomSimDrawTrace):undefined;
      expect(frames.filter(f=>f.rendered===1).length).toBeGreaterThan(60);
      const rendered=frames.filter(f=>f.rendered===1);
      const range=key=>({min:Math.min(...rendered.map(f=>f[key])),max:Math.max(...rendered.map(f=>f[key]))});
      const shadowUpdates=rendered.filter(f=>f.shadowUpdated===1).length;
      if(url.searchParams.has('prepare'))expect(range('preparationMs').min).toBeGreaterThan(0);
      else expect(range('preparationMs').max).toBe(0);
      if(freezeShadow)expect(shadowUpdates).toBe(0);
      if(noPointLights)expect(range('pointLights').max).toBe(0);
      const submissionSpikes=frames.flatMap((frame,index)=>frame.rendered===1&&frame.renderSubmitMs>50?[{
        index,submitMs:frame.renderSubmitMs,programs:frame.programs,previousPrograms:frames[index-1]?.programs??null,
      }]:[]);
      results.push({detailed,warmMs,preparationMs:range('preparationMs'),preparationMaxSliceMs:range('preparationMaxSliceMs'),drawTrace,shadowUpdates,submissionSpikes,textures:range('textures'),calls:range('calls'),triangles:range('triangles'),programs:range('programs'),pointLights:range('pointLights'),...summarizeFrames(frames)});
    }
    if(stockPCF)expect(overrides).toBeGreaterThan(0);
    if(legacyOutputSwap)expect(outputOverrides).toBeGreaterThan(0);
    if(freezeShadow)expect(shadowOverrides).toBeGreaterThan(0);
    const flatDetailCount=await page.evaluate(()=>window.roomSimFlatDetailCount||0);
    if(flatDetail){expect(detailOverrides).toBeGreaterThan(0);expect(flatDetailCount).toBeGreaterThan(0);}
    expect(errors).toEqual([]);console.log(JSON.stringify({preparationMode:url.searchParams.get('prepare'),stockPCF,freezeShadow,flatDetail,flatDetailCount,noPointLights,warmPrograms,warmDraw,traceDraws,pointBranch,legacyOutputSwap,graphics,results},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
