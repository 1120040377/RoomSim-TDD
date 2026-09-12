const { chromium, expect } = require('@playwright/test');
const { summarizeFrames } = require('./profile-summary.cjs');
(async () => {
  const browser = await chromium.launch({
    // Full Chromium uses the platform GPU here; headless-shell fell back to SwiftShader.
    channel: process.env.ROOMSIM_BROWSER_CHANNEL || 'chromium',
    headless: process.env.ROOMSIM_HEADED !== '1',
  });
  try {
    const page = await browser.newPage({ viewport: { width: Number(process.env.ROOMSIM_WIDTH || 1440), height: Number(process.env.ROOMSIM_HEIGHT || 960) },
      deviceScaleFactor: Number(process.env.ROOMSIM_DPR || 1) });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    const url = new URL(process.env.ROOMSIM_URL || 'http://localhost:5174/');
    url.searchParams.set('profile', '1');
    await page.goto(url.href);
    await page.getByRole('button', { name: '新建方案' }).click();
    const showroom=process.env.ROOMSIM_PROFILE_SHOWROOM==='1';
    await page.getByRole('button', { name: showroom ? /^材质样板间/ : /^三室两厅/ }).click();
    if (process.env.ROOMSIM_PROFILE_LIGHTS_OFF === '1') {
      await page.getByRole('button', { name: /进入漫游/ }).waitFor({ state: 'visible' });
      // Isolated test-browser plan only; no changes to the user's saved plans.
      await page.evaluate(async () => {
        const { usePlanStore } = await import('/src/modules/store/plan.ts');
        const { FURNITURE_CATALOG } = await import('/src/modules/templates/furniture-catalog.ts');
        const store = usePlanStore();
        const plan = store.plan;
        store.loadPlan({ ...plan, furniture: Object.fromEntries(Object.entries(plan.furniture).map(([id, f]) =>
          [id, FURNITURE_CATALOG[f.type]?.interactive === 'light'
            ? { ...f, runtimeState: { ...f.runtimeState, on: false } } : f])) });
      });
    }
    await page.getByRole('button', { name: /进入漫游/ }).click();
    await page.waitForFunction(() => window.roomSimProfile?.length >= 8, undefined, { timeout: 90000 });
    if(process.env.ROOMSIM_RESOLUTION){
      await page.getByLabel('渲染清晰度').selectOption(process.env.ROOMSIM_RESOLUTION);
      await page.evaluate(()=>{window.roomSimProfile.length=0;});
      await page.waitForFunction(()=>window.roomSimProfile?.length>=8);
    }
    console.log('graphics', await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      if (!gl) return { renderer: 'unavailable' };
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        pixelRatio: devicePixelRatio, width: canvas.width, height: canvas.height };
    }));
    console.log('third', await page.evaluate(() => window.roomSimProfile.slice(-5)));
    if(showroom)expect(await page.evaluate(()=>window.roomSimProfile.slice(-3).every(frame=>frame.importedModels===2))).toBe(true);
    if (process.env.ROOMSIM_PROFILE_LIGHTS_OFF === '1') {
      expect(await page.evaluate(() => window.roomSimProfile.slice(-3).every(f => f.pointLights === 0))).toBe(true);
    }
    expect(await page.evaluate(() => window.roomSimProfile.slice(-3).every(f => f.shadowUpdated === 0))).toBe(true);
    await page.evaluate(() => { window.roomSimProfile.length = 0; });
    await page.keyboard.down('KeyW');
    try {
      await page.waitForFunction(() => window.roomSimProfile?.some(f => f.shadowUpdated === 1), undefined, { timeout: 30000 });
      // Sustained input, not just the first invalidation frame. The character can
      // reach an obstacle; report cached frames separately instead of calling them fast renders.
      await page.waitForFunction(() => window.roomSimProfile?.length >= 30, undefined, { timeout: 90000 });
    } finally { await page.keyboard.up('KeyW'); }
    console.log('movement-summary', summarizeFrames(await page.evaluate(() => window.roomSimProfile.slice())));
    console.log('Character movement invalidated the cached shadow map.');
    await page.keyboard.press('Escape');
    await page.getByLabel('房间特写').selectOption('living');
    await page.waitForFunction(() => window.roomSimProfile?.filter(f => f.mode === 'orbit').length >= 8, undefined, { timeout: 90000 });
    console.log('orbit', await page.evaluate(() => window.roomSimProfile.slice(-5)));
    await page.waitForFunction(() => window.roomSimProfile?.slice(-3).every(f => f.mode === 'orbit' && f.rendered === 0 && f.calls === 0), undefined, { timeout: 30000 });
    console.log('Static orbit reused the displayed image without draw calls.');
    if (process.env.ROOMSIM_PROFILE_EDITS === '1') {
      // Vite-only integration check, using commands in this isolated browser plan.
      for (const kind of ['position','color','size']) {
        await page.evaluate(async kind => {
          const { usePlanStore } = await import('/src/modules/store/plan.ts');
          const { useHistoryStore } = await import('/src/modules/store/history.ts');
          const { UpdateFurnitureCommand } = await import('/src/modules/commands/furniture/update.ts');
          const furniture=Object.values(usePlanStore().plan.furniture).find(f=>f.type==='coffee-table');
          const patch=kind==='position'?{position:{...furniture.position,x:furniture.position.x+15}}
            :kind==='color'?{color:'#85745d'}:{size:{...furniture.size,width:furniture.size.width+10}};
          window.roomSimProfile.length=0;
          useHistoryStore().execute(new UpdateFurnitureCommand(furniture.id,patch));
        },kind);
        await page.waitForFunction(()=>window.roomSimProfile?.some(f=>f.rendered===1),undefined,{timeout:30000});
        await page.waitForFunction(()=>window.roomSimProfile?.slice(-3).every(f=>f.rendered===0),undefined,{timeout:30000});
        await page.evaluate(async()=>{
          window.roomSimProfile.length=0;
          const {useHistoryStore}=await import('/src/modules/store/history.ts');useHistoryStore().undo();
        });
        await page.waitForFunction(()=>window.roomSimProfile?.some(f=>f.rendered===1),undefined,{timeout:30000});
        await page.waitForFunction(()=>window.roomSimProfile?.slice(-3).every(f=>f.rendered===0),undefined,{timeout:30000});
        console.log(`Edit and undo refreshed cached frame: ${kind}`);
      }
    }
    await page.evaluate(() => { window.roomSimProfile.length = 0; });
    await page.getByRole('button', { name: '切换夜景', exact: true }).click();
    await page.waitForFunction(() => window.roomSimProfile?.some(f => f.rendered === 1), undefined, { timeout: 30000 });
    await page.getByRole('button', { name: '切换日景', exact: true }).click();
    expect(await page.evaluate(() => window.roomSimProfile.slice(-3).every(f => f.shadowUpdated === 0))).toBe(true);
    await page.evaluate(() => { window.roomSimProfile.length = 0; });
    await page.getByRole('button', { name: '剖切墙体', exact: true }).click();
    await page.waitForFunction(() => window.roomSimProfile?.some(f => f.shadowUpdated === 1), undefined, { timeout: 30000 });
    console.log('Cutaway change invalidated the cached shadow map.');
    if (process.env.ROOMSIM_PROFILE_AO === '1') {
      await page.evaluate(() => { window.roomSimProfile.length = 0; });
      await page.getByRole('button', { name: '精细阴影', exact: true }).click();
      await page.waitForFunction(() => window.roomSimProfile?.filter(f => f.ao === 1).length >= 8, undefined, { timeout: 90000 });
      expect(await page.evaluate(() => window.roomSimProfile.slice(-3).every(f => f.ao === 1 && f.aoUpdated === 0))).toBe(true);
      console.log('Cached AO', await page.evaluate(() => window.roomSimProfile.slice(-3)));
      await page.evaluate(()=>{window.roomSimProfile.length=0;});
      await page.mouse.move(1100,700);
      await page.mouse.wheel(0,-120);
      await page.waitForFunction(()=>window.roomSimProfile?.some(frame=>frame.aoUpdated===1&&frame.rendered===1),undefined,{timeout:30000});
      await page.waitForFunction(()=>window.roomSimProfile?.slice(-3).every(frame=>frame.ao===1&&frame.rendered===0),undefined,{timeout:30000});
      console.log('AO camera-change summary',summarizeFrames(await page.evaluate(()=>window.roomSimProfile.slice())));
    }
    await page.getByRole('button', { name: '第三人称', exact: true }).click();
    try {
      await page.waitForFunction(() => window.roomSimProfile?.slice(-3).every(f => f.mode === 'third' && f.rendered === 0), undefined, { timeout: 90000 });
    } catch(error) {
      console.log('Unsettled third-person frames',await page.evaluate(()=>window.roomSimProfile.slice(-5)));
      throw error;
    }
    console.log('Stationary third-person camera settled and reused the displayed image.');
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
