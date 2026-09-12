const {chromium,expect}=require('@playwright/test');
(async()=>{
  const browser=await chromium.launch({channel:'chromium'});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url=new URL(process.env.ROOMSIM_URL||'http://127.0.0.1:5175/');url.searchParams.set('prepare',process.env.ROOMSIM_PREPARE||'staged');url.searchParams.set('profile','1');
    await page.goto(url.href);await page.getByRole('button',{name:'新建方案'}).click();
    await page.getByRole('button',{name:/^材质样板间/}).click();await page.getByRole('button',{name:/进入漫游/}).click();
    await page.waitForFunction(()=>window.roomSimProfile?.length>=8);await page.keyboard.press('Escape');
    await page.getByLabel('房间特写').selectOption('living');
    const status=page.getByRole('status').filter({hasText:'正在准备材质与阴影'});
    await expect(status).toContainText(/\d+\/\d+/,{timeout:30000});
    const progress=await status.textContent(),match=progress.match(/(\d+)\/(\d+)/);
    expect(Number(match[1])).toBeLessThan(Number(match[2]));
    await page.getByRole('button',{name:'← 返回编辑器'}).click();
    await expect(status).toHaveCount(0);await expect(page.getByRole('button',{name:/进入漫游/})).toBeVisible();
    await page.waitForTimeout(500);expect(errors).toEqual([]);
    console.log(JSON.stringify({cancelledDuring:progress,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
