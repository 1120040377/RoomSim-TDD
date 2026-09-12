const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:'chromium'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=new URL(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');url.searchParams.set('profile','1');
    await page.goto(url.href);await page.getByRole('button',{name:'新建方案'}).click();
    await page.getByRole('button',{name:/^材质样板间/}).click();await page.getByRole('button',{name:/进入漫游/}).click();
    await page.waitForFunction(()=>window.roomSimProfile?.length>=8);await page.keyboard.press('Escape');
    const dimensions=()=>page.locator('canvas').evaluate(c=>[c.width,c.height]);
    expect(await dimensions()).toEqual([1897,1264]);
    await page.getByRole('button',{name:'渲染诊断',exact:true}).click();
    const diagnostics=page.getByRole('region',{name:'渲染诊断'});
    await expect(diagnostics).toContainText('1897 × 1264');
    const adapter=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);});
    await expect(diagnostics).toContainText(adapter);
    await page.getByRole('button',{name:'精细阴影',exact:true}).click();
    await page.getByLabel('渲染清晰度').selectOption('native');
    await expect.poll(dimensions).toEqual([2880,1920]);
    await expect(diagnostics).toContainText('2880 × 1920');
    await page.getByLabel('渲染清晰度').selectOption('balanced');
    await expect.poll(dimensions).toEqual([1897,1264]);
    await page.setViewportSize({width:1000,height:700});
    await expect.poll(dimensions).toEqual([1851,1296]);
    await expect(diagnostics).toContainText('1851 × 1296');
    await page.getByRole('button',{name:'关闭渲染诊断',exact:true}).click();
    await expect(diagnostics).not.toBeVisible();
    await expect.poll(()=>page.evaluate(()=>window.roomSimProfile?.slice(-3).every(f=>f.rendered===0))).toBe(true);
    expect(errors).toEqual([]);console.log('DPR2 quality switching, AO resize and settled frame caching passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
