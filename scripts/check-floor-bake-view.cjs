const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:process.env.ROOMSIM_BROWSER_CHANNEL||'chromium'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&/Shader Error|VALIDATE_STATUS/.test(message.text()))errors.push(message.text());});
    await page.addInitScript(()=>{
      const Original=window.Worker;window.bakeWorkers={created:0,live:0};
      window.Worker=class extends Original{
        constructor(...args){super(...args);window.bakeWorkers.created++;window.bakeWorkers.live++;this.ended=false;}
        terminate(){if(!this.ended){this.ended=true;window.bakeWorkers.live--;}super.terminate();}
      };
    });
    await page.goto(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');
    const shadowSource=await page.evaluate(async()=> (await import('/node_modules/.vite/deps/three.js')).ShaderChunk.shadowmap_pars_fragment);
    await page.getByRole('button',{name:'新建方案'}).click();
    await page.getByRole('button',{name:/^材质样板间/}).click();
    await page.getByRole('button',{name:/进入漫游/}).click();
    await expect(page.getByRole('button',{name:'俯瞰',exact:true})).toBeVisible();
    // Toolbar mounts before asynchronous model preload and scene initialization.
    // Escaping earlier can be overwritten by the initial play-mode setup.
    await expect(page.locator('canvas')).toBeVisible({timeout:15000});
    await expect.poll(()=>page.evaluate(async()=> (await import('/node_modules/.vite/deps/three.js')).ShaderChunk.shadowmap_pars_fragment.includes('receiverPlaneCompare')),{timeout:15000}).toBe(true);
    await page.keyboard.press('Escape');
    await page.getByLabel('房间特写').selectOption(process.env.ROOMSIM_FOCUS||'dining');
    const start=page.getByRole('button',{name:'计算房间接触阴影',exact:true});
    await expect(start).toBeVisible();
    expect((await page.evaluate(()=>window.bakeWorkers)).created).toBe(0);
    await page.waitForTimeout(1200);
    await page.screenshot({path:'docs/images/showroom-room-contact-off.png'});
    await start.click();
    await page.getByRole('button',{name:'取消接触阴影计算',exact:true}).click();
    await expect(start).toBeVisible();
    await start.click();
    await expect(page.getByRole('button',{name:'关闭房间接触阴影',exact:true})).toBeVisible({timeout:30000});
    await page.screenshot({path:'docs/images/showroom-floor-bake-view.png'});
    await page.screenshot({path:'docs/images/showroom-room-contact-on.png'});
    await page.mouse.move(700,480);await page.mouse.down();
    await page.mouse.move(1100,480,{steps:16});await page.mouse.up();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button',{name:'关闭房间接触阴影',exact:true})).toBeVisible();
    await page.screenshot({path:'docs/images/showroom-room-contact-rotated.png'});
    const workersAfterBake=await page.evaluate(()=>window.bakeWorkers.created);
    await page.getByLabel('房间特写').selectOption('living');
    await expect(page.getByRole('button',{name:'关闭房间接触阴影',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'重置视角',exact:true}).click();
    await expect(page.getByRole('button',{name:'关闭房间接触阴影',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>window.bakeWorkers.created)).toBe(workersAfterBake);
    await page.evaluate(async()=>{
      const {usePlanStore}=await import('/src/modules/store/plan.ts');
      const store=usePlanStore();store.loadPlan({...store.plan,name:store.plan.name+' edited'});
    });
    await expect(start).toBeVisible();
    await start.click();
    await page.getByRole('button',{name:/返回编辑器/}).click();
    await expect(page.getByRole('button',{name:/进入漫游/})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>window.bakeWorkers.live)).toBe(0);
    expect(await page.evaluate(async()=> (await import('/node_modules/.vite/deps/three.js')).ShaderChunk.shadowmap_pars_fragment)).toBe(shadowSource);
    expect(errors).toEqual([]);
    console.log('View lazy load, cancel, apply, edit invalidation, exit cleanup passed:',await page.evaluate(()=>window.bakeWorkers));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
