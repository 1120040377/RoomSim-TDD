const { chromium, expect } = require('@playwright/test');

// Run against the local dev server. Uses a fresh browser context, leaving saved user plans intact.
(async () => {
  const browser = await chromium.launch({channel:process.env.ROOMSIM_BROWSER_CHANNEL||'chromium'});
  const sectional = process.env.ROOMSIM_STUDY === 'sectional';
  const bathroom = process.env.ROOMSIM_STUDY === 'bathroom';
  const showroom = process.env.ROOMSIM_STUDY === 'showroom';
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    const lightStudy=process.env.ROOMSIM_LIGHT_STUDY==='1';
    const stockFilter=process.env.ROOMSIM_STOCK_FILTER==='1';
    let softOverrides=0;
    if(stockFilter)await page.route('**/fit-sun-shadow.ts*',async route=>{
      const response=await route.fetch(),source=await response.text();
      const body=source.replace(/softened\s*\?\s*5\s*:\s*3.5/,'3.5').replace(/softened\s*\?\s*0.035\s*:\s*0.018/,'0.018');
      if(body===source)throw new Error('Soft-shadow override was not applied');
      softOverrides++;await route.fulfill({response,body});
    });
    const biasMm=Number(process.env.ROOMSIM_LIGHT_BIAS_MM||20);
    const depthBias=Number(process.env.ROOMSIM_LIGHT_DEPTH_BIAS||0);
    if(!Number.isFinite(depthBias)||Math.abs(depthBias)>.001)throw new Error('Invalid depth bias');
    if(!Number.isFinite(biasMm)||biasMm<0||biasMm>30)throw new Error('Bias must be 0–30 mm');
    let lightOverrides=0,sunOverrides=0;
    if(lightStudy)await page.route('**/lighting-look.ts*',async route=>{
      const response=await route.fetch(),source=await response.text();
      const body=source.replace(/sunIntensity:\s*2\.2/,'sunIntensity: 2.6').replace(/fillIntensity:\s*0\.38/,'fillIntensity: 0.22').replace(/exposure:\s*0\.9/,'exposure: 0.85');
      if(body===source)throw new Error('Lighting study did not change the source');
      lightOverrides++;
      await route.fulfill({response,body});
    });
    if(lightStudy)await page.route(/\/WalkthroughView\.vue(?:\?t=\d+)?$/,async route=>{
      const response=await route.fetch(),source=await response.text();
      let body=source.replace(/-modelSize \* 0\.4, modelSize, modelSize \* 0\.55/,'-modelSize * 0.65, modelSize * 0.8, modelSize * 0.55');
      if(process.env.ROOMSIM_LIGHT_BIAS==='1'){
        const before=body;body=body.replace(/sun.shadow.normalBias = (?:0\.006|6e-3)/,`sun.shadow.normalBias = ${biasMm/1000}`);
        if(body===before)throw new Error('Shadow bias override was not applied');
        body=body.replace('sun.castShadow = true;',`sun.castShadow = true; sun.shadow.bias = ${depthBias};`);
      }
      if(body===source)throw new Error('Lighting study did not change the sun direction');
      sunOverrides++;
      if(process.env.ROOMSIM_RECEIVER_PLANE==='1')body=`import {installReceiverPlaneShadow} from '/src/modules/walkthrough/receiver-plane-shadow.ts'; installReceiverPlaneShadow();\n${body}`;
      await route.fulfill({response,body});
    });
    const loadedMaps = new Set();
    let chairLoads=0;
    let cushionLoads=0;
    const chairTextures=new Set();
    const modelFailure=process.env.ROOMSIM_MODEL_FAILURE==='1';
    const throwFailure=process.env.ROOMSIM_THROW_FAILURE==='1';
    let throwRequests=0;
    page.on('request',request=>{if(request.url().endsWith('/models/draped-throw/draped-throw.glb'))throwRequests++;});
    if(throwFailure)await page.route('**/models/draped-throw/**',route=>route.abort());
    if(modelFailure)await page.route('**/models/modern-arm-chair-01/**',route=>route.abort());
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    page.on('console', message => {
      if (message.type() === 'error' && /Shader Error|VALIDATE_STATUS|shader.*compile/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    page.on('response', response => {
      if(response.url().includes('/models/modern-arm-chair-01/')&&response.url().endsWith('.jpg'))chairTextures.add(response.url());
      if(response.url().endsWith('/modern_arm_chair_01_1k.gltf')&&response.ok())chairLoads++;
      if(response.url().endsWith('/cushions.gltf')&&response.ok())cushionLoads++;
      if (response.url().includes('/materials/') && response.url().endsWith('.jpg')) {
        if (response.ok()) loadedMaps.add(response.url());
        else errors.push(`Texture request failed: ${response.status()} ${response.url()}`);
      }
    });
    await page.goto(process.env.ROOMSIM_URL || 'http://localhost:5174/');
    if (sectional || bathroom) {
      // This isolated asset-study template is not listed in the product picker.
      const id = await page.evaluate(async (bathroom) => {
        const template = bathroom
          ? (await import('/src/modules/templates/rooms/bathroom.ts')).bathroomTemplate
          : (await import('/src/modules/templates/rooms/living-room.ts')).livingRoomTemplate;
        const { planRepo } = await import('/src/modules/storage/plan-repo.ts');
        const plan = template.build(bathroom ? '卫浴材质检查' : '转角沙发材质检查');
        await planRepo.save(plan);
        return plan.id;
      }, bathroom);
      await page.goto(`${process.env.ROOMSIM_URL || 'http://localhost:5174/'}#/editor/${id}`);
    } else {
      await page.getByRole('button', { name: '新建方案' }).click();
      await page.getByRole('button', { name: showroom ? /^材质样板间/ : /^三室两厅/ }).click();
    }
    const bedOnly=showroom&&process.env.ROOMSIM_BED_ONLY==='1';
    if(bedOnly){
      await expect(page.getByRole('button', { name: /进入漫游/ })).toBeVisible();
      await page.evaluate(async()=>{
        const {usePlanStore}=await import('/src/modules/store/plan.ts');
        const store=usePlanStore();
        const furniture=Object.fromEntries(Object.entries(store.plan.furniture)
          .filter(([,item])=>item.type.startsWith('bed-')||!['armchair','sofa-l','sofa-2','sofa-3'].includes(item.type)));
        store.loadPlan({...store.plan,furniture});
      });
    }
    const clothStudy=process.env.ROOMSIM_CLOTH_STUDY==='1';
    if(clothStudy)await page.evaluate(async()=>{
      const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      // Match Vite's current dependency URL, including its HMR timestamp.
      const bedroomSource=await (await fetch('/src/modules/walkthrough/builders/furniture/bedroom.ts')).text();
      const dependency=bedroomSource.match(/from\s+["']([^"']*model-throw\.ts[^"']*)["']/);
      if(!dependency)throw new Error('Could not resolve current cloth registration module');
      const {installDrapedThrow}=await import(dependency[1]);
      const asset=await new GLTFLoader().loadAsync('/docs/asset-studies/draped-throw/draped-throw.glb');
      installDrapedThrow(asset.scene);
    });
    await page.getByRole('button', { name: /进入漫游/ }).click();
    await expect.poll(() => loadedMaps.size, { timeout: 60000 }).toBe(bathroom ? 3 : 9);
    if(showroom&&!modelFailure){
      expect(chairLoads).toBe(bedOnly?0:1);expect(cushionLoads).toBe(bedOnly?1:0);
      await expect.poll(()=>chairTextures.size).toBe(bedOnly?2:5);
      if(bedOnly)expect([...chairTextures].some(url=>url.includes('_legs_'))).toBe(false);
      expect([...chairTextures].some(url=>/pillow_(diff|arm)_/.test(url))).toBe(false);
    }
    await expect.poll(() => page.evaluate(() => !!document.pointerLockElement), { timeout: 10000 }).toBe(true);
    await page.keyboard.press('Escape');
    if(showroom)expect(throwRequests).toBe(clothStudy?0:1);
    if (showroom && process.env.ROOMSIM_FOCUS) {
      const focus=process.env.ROOMSIM_FOCUS;
      if(!['living','bedroom','bathroom','shower','kitchen','dining'].includes(focus))throw new Error('Unknown ROOMSIM_FOCUS');
      await page.getByLabel('房间特写').selectOption(focus);
      const focusAO=process.env.ROOMSIM_AO==='1';
      if(focusAO)await page.getByRole('button',{name:'精细阴影',exact:true}).click();
      await page.waitForTimeout(1800);
      if(lightStudy){expect(lightOverrides).toBeGreaterThan(0);expect(sunOverrides).toBeGreaterThan(0);}
      if(stockFilter)expect(softOverrides).toBeGreaterThan(0);
      await page.screenshot({path:`docs/images/showroom-${focus}-${stockFilter?'stock-filter-study':process.env.ROOMSIM_RECEIVER_PLANE==='1'?'receiver-plane-study':lightStudy?(process.env.ROOMSIM_LIGHT_BIAS==='1'?`light-bias-${biasMm}mm${depthBias?'-depth':''}-study`:'light-study'):throwFailure?'throw-fallback':clothStudy?'simulated-cloth':bedOnly?'bed-only':modelFailure?'fallback':focusAO?'ao-study':'study'}.png`});
      expect(errors).toEqual([]);
      console.log(`Captured ${focus}; ${loadedMaps.size} local PBR maps loaded; no page errors.`);
      return;
    }
    if (showroom) {
      await page.getByRole('button', { name: '俯瞰', exact: true }).click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'docs/images/showroom-overview.png' });
    }
    await page.getByLabel('房间特写').selectOption(bathroom ? 'bathroom' : 'living');
    // Let the real-time renderer settle after texture upload and camera movement.
    await page.waitForTimeout(1600);
    await page.screenshot({ path: bathroom ? 'docs/images/bathroom-day.png' : sectional ? 'docs/images/sectional-day.png' : 'docs/images/living-material-closeup.png' });
    if (process.env.ROOMSIM_AO === '1') {
      await page.getByRole('button', { name: '精细阴影', exact: true }).click();
      await page.waitForTimeout(1800);
      await page.screenshot({ path: bathroom ? 'docs/images/bathroom-ao.png' : sectional ? 'docs/images/sectional-ao.png' : 'docs/images/living-material-ao.png' });
      await page.getByRole('button', { name: '精细阴影', exact: true }).click();
    }
    await page.getByRole('button', { name: '切换夜景', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: bathroom ? 'docs/images/bathroom-night.png' : sectional ? 'docs/images/sectional-night.png' : 'docs/images/living-material-night.png' });
    if (showroom) {
      await page.getByRole('button', { name: '切换日景', exact: true }).click();
      await page.getByLabel('房间特写').selectOption('bedroom');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'docs/images/showroom-bedroom.png' });
      await page.getByRole('button', { name: '切换夜景', exact: true }).click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: 'docs/images/showroom-bedroom-night.png' });
      await page.getByRole('button', { name: '切换日景', exact: true }).click();
      await page.getByLabel('房间特写').selectOption('dining');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'docs/images/showroom-dining.png' });
      await page.getByLabel('房间特写').selectOption('kitchen');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'docs/images/showroom-kitchen.png' });
      await page.getByLabel('房间特写').selectOption('bathroom');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'docs/images/showroom-bathroom.png' });
      await page.getByLabel('房间特写').selectOption('shower');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'docs/images/showroom-shower.png' });
      await page.getByLabel('房间特写').selectOption('kitchen');
      if (process.env.ROOMSIM_AO === '1') {
        await page.getByRole('button', { name: '精细阴影', exact: true }).click();
        await page.waitForTimeout(1800);
        await page.screenshot({ path: 'docs/images/showroom-kitchen-ao.png' });
      }
    }
    expect(errors).toEqual([]);
    console.log(`Captured day/night closeups; ${loadedMaps.size} local PBR maps loaded; no page errors.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
