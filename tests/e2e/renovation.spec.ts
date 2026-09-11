import { test, expect, type Page } from '@playwright/test';
import type { Plan } from '../../src/modules/model/types';

async function readPlan(page: Page): Promise<Plan> {
  return page.evaluate(async () => {
    const path = '/src/modules/store/plan.ts';
    return (await import(/* @vite-ignore */ path)).usePlanStore().plan;
  });
}
async function createPlan(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '新建方案' }).click();
  await expect(page.getByRole('button', { name: /^主卧\s/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^一室一厅\s/ }).click();
  await expect(page.locator('.editor-canvas canvas').first()).toBeVisible();
}
async function pausePlay(page:Page){await resumePlay(page);await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(false);await expect(page.getByRole('button',{name:'继续游玩',exact:true})).toBeVisible();}
async function resumePlay(page:Page){
  try{await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement),{timeout:1200}).toBe(true);return;}catch{}
  // Auto-lock can finish while Playwright is resolving the fallback button.
  try{await page.getByRole('button',{name:'继续游玩',exact:true}).click({timeout:2000});}catch{}
  await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
}
async function look(page:Page,x:number,y:number){await page.evaluate(({x,y})=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:x,movementY:y})),{x,y});}

test('六种预置入口、3D 精确装修、布线、撤销与刷新保存', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await createPlan(page);
  await expect(page.getByRole('heading', { name: '先把家画出来' })).toBeVisible();
  await page.getByRole('button', { name: /进入漫游/ }).click();
  await expect(page.getByRole('button', { name: '第三人称', exact: true })).toHaveClass(/active/);
  await expect(page.getByText('生活模式', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/life-mode.png' });
  await pausePlay(page);
  await page.getByRole('button', { name: '装修模式', exact: true }).click();
  await expect(page.getByText('装修工作台', { exact: true })).toBeVisible();
  await page.locator('.object-row').filter({ hasText: '冰箱' }).first().click();
  await page.getByLabel('家具X', { exact: true }).fill('750');
  await page.getByLabel('家具X', { exact: true }).press('Tab');
  await expect.poll(async () => Object.values((await readPlan(page)).furniture).find(f => f.type === 'fridge')!.position.x).toBe(750);
  await page.getByLabel('家具离地高度').fill('5');
  await page.getByLabel('家具离地高度').press('Tab');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await page.getByRole('button', { name: '重做', exact: true }).click();
  const oldCount = Object.keys((await readPlan(page)).furniture).length;
  await page.getByLabel('添加家具类型').selectOption('wall-cabinet');
  await page.getByRole('button', { name: '添加到场景', exact: true }).click();
  await expect.poll(async () => Object.keys((await readPlan(page)).furniture).length).toBe(oldCount + 1);
  await page.getByLabel('家具离地高度').fill('165');
  await page.getByLabel('家具离地高度').press('Tab');
  await page.getByLabel('网格精度').selectOption('1');
  await page.getByRole('button', { name: '水电', exact: true }).click();
  const utilityCount = Object.keys((await readPlan(page)).renovation!.utilities).length;
  await page.getByRole('button', { name: '冷水', exact: true }).click();
  // Empty lower-left canvas region intersects the ground plane, producing a valid 3D route.
  await page.mouse.click(250, 480);
  await page.mouse.click(390, 520);
  await page.getByRole('button', { name: '完成布线 (Enter)', exact: true }).click();
  await expect.poll(async () => Object.keys((await readPlan(page)).renovation!.utilities).length).toBe(utilityCount + 1);
  await page.getByRole('button', { name: '材质', exact: true }).click();
  await page.getByRole('button', { name: '现代瓷砖', exact: true }).click();
  await page.screenshot({ path: 'test-results/3d-studio.png' });
  const expected = (await readPlan(page)).renovation;
  await page.getByRole('button', { name: '← 返回编辑器', exact: true }).click();
  await page.reload();
  await expect(page.locator('.editor-canvas')).toBeVisible();
  const restored = await readPlan(page);
  expect(Object.values(restored.furniture).find(f => f.type === 'fridge')).toMatchObject({ position: { x: 750 }, elevation: 5 });
  expect(restored.renovation).toEqual(expected);
  expect(errors).toEqual([]);
});

test('人物靠近冰箱后开合，坐下与起身', async ({ page }) => {
  await createPlan(page);
  await page.evaluate(async () => {
    const path='/src/modules/store/plan.ts';
    const store=(await import(/* @vite-ignore */ path)).usePlanStore();
    // Isolated fixture on the center ray; real camera and geometry, no mocked picking.
    const fridge=Object.values(store.plan.furniture).find((f:any)=>f.type==='fridge') as any;
    store.loadPlan({ ...store.plan,nodes:{},walls:{},rooms:{},openings:{},furniture:{[fridge.id]:{...fridge,position:{x:55,y:-100},rotation:0}}, walkthrough: { ...store.plan.walkthrough, startPosition: { x: 0, y: 0 } } });
  });
  await page.getByRole('button', { name: /进入漫游/ }).click();
  await resumePlay(page);
  await expect(page.locator('.interaction-prompt')).toContainText('冰箱');
  await page.keyboard.press('e');
  await expect(page.getByText('冰箱已打开', { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/fridge-open.png' });
  await expect(page.locator('.interaction-prompt')).toContainText('关闭');
  await page.keyboard.press('e');
  await expect(page.getByText('冰箱已关闭', { exact: true })).toBeVisible();
  await pausePlay(page);
  await page.getByRole('button', { name: '← 返回编辑器', exact: true }).click();
  await page.evaluate(async () => {
    const path='/src/modules/store/plan.ts';const store=(await import(/* @vite-ignore */ path)).usePlanStore();
    store.loadPlan({ ...store.plan,furniture:{seat:{id:'seat',type:'sofa-2',position:{x:55,y:-100},rotation:0,size:{width:160,depth:90,height:80}}}, walkthrough: { ...store.plan.walkthrough, startPosition: { x: 0, y: 0 } } });
  });
  await page.getByRole('button', { name: /进入漫游/ }).click();
  // Aim down at the sofa seat rather than at standing eye level.
  await resumePlay(page);await look(page,0,750);
  await expect(page.locator('.interaction-prompt')).toContainText('坐下');
  await page.keyboard.press('e');
  await expect(page.getByText(/已坐下/)).toBeVisible();
  await pausePlay(page);
  await page.getByRole('button', { name: '起身 / 结束休息' }).click();
  await expect(page.getByText('已起身', { exact: true })).toBeVisible();
  await page.screenshot({path:'test-results/adult-avatar.png'});
  await page.getByLabel('体验人物').selectOption('child');
  await expect(page.getByText('身高 120cm',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/child-avatar.png'});
  await resumePlay(page);
  // Looking away must clear the target, regardless of proximity.
  for(let i=0;i<5;i++){
    await look(page,500,0);
    // Let orbit damping settle before checking the final ray direction.
    await page.waitForTimeout(900);
    if(!(await page.locator('.aim-crosshair').getAttribute('class'))?.includes('can-interact'))break;
  }
  await page.screenshot({path:'test-results/aim-away.png'});
  await expect(page.locator('.aim-crosshair')).not.toHaveClass(/can-interact/);
  await page.keyboard.press('e');
  await expect(page.getByText('已起身', { exact: true })).toBeVisible();
});

test('第一人称准星开关冰箱，远离后不可操作，Esc释放鼠标',async({page})=>{
  await createPlan(page);
  await page.evaluate(async()=>{
    const path='/src/modules/store/plan.ts',store=(await import(/* @vite-ignore */ path)).usePlanStore();
    const fridge=Object.values(store.plan.furniture).find((f:any)=>f.type==='fridge') as any;
    store.loadPlan({...store.plan,nodes:{},walls:{},rooms:{},openings:{},furniture:{[fridge.id]:{...fridge,position:{x:0,y:-100},rotation:0}},walkthrough:{...store.plan.walkthrough,startPosition:{x:0,y:0},startYaw:0}});
  });
  await page.getByRole('button',{name:/进入漫游/}).click();
  await pausePlay(page);
  await page.getByRole('button',{name:'第一人称',exact:true}).click();
  await resumePlay(page);
  await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
  await expect(page.locator('.interaction-prompt')).toContainText('冰箱');
  await page.keyboard.press('e');await expect(page.getByText('冰箱已打开',{exact:true})).toBeVisible();
  await expect(page.locator('.interaction-prompt')).toContainText('关闭');
  await page.keyboard.press('e');await expect(page.getByText('冰箱已关闭',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/first-person-interaction.png'});
  await page.keyboard.down('s');await page.waitForTimeout(1600);await page.keyboard.up('s');
  await expect(page.locator('.aim-crosshair')).not.toHaveClass(/can-interact/);
  await page.keyboard.press('e');await expect(page.getByText('冰箱已关闭',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(false);
  await expect(page.getByRole('button',{name:'第一人称',exact:true})).toHaveClass(/active/);
});

test('住宅三室两厅布局预览及第三人称鼠标锁定、暂停、继续',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'新建方案'}).click();
  await page.getByRole('button',{name:/^三室两厅\s/}).click();
  await expect(page.getByText('主卧套房',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'展开平面参考',exact:true}).click();
  await page.evaluate(async()=>{const path='/src/modules/store/editor.ts';const store=(await import(/* @vite-ignore */ path)).useEditorStore();store.showUtilities=false;store.showErgonomics=false;});
  await page.screenshot({path:'test-results/residential-three-bedroom.png'});
  await page.getByRole('button',{name:/进入漫游/}).click();await resumePlay(page);
  await expect(page.locator('.aim-crosshair')).toBeVisible();
  await look(page,1800,0);await look(page,1800,0);await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
  await pausePlay(page);await expect(page.getByRole('button',{name:'继续游玩',exact:true})).toBeVisible();
  await expect(page.locator('.aim-crosshair')).toHaveCount(0);
  await page.keyboard.press('e');await resumePlay(page);await expect(page.locator('.aim-crosshair')).toBeVisible();
  await pausePlay(page);await page.getByRole('button',{name:'俯瞰',exact:true}).click();
  await page.screenshot({path:'test-results/residential-three-bedroom-3d.png'});
});

test('画墙模式平移不创建墙、切换工具取消旧预览、网格即时更新', async ({ page }) => {
  await createPlan(page);
  const canvas = page.locator('.editor-canvas');
  const box = (await canvas.boundingBox())!;
  const x = box.x + 150, y = box.y + 120;
  const initial = Object.keys((await readPlan(page)).walls).length;
  await page.getByRole('button', { name: '画墙', exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x + 50, y + 50);
  await page.mouse.up({ button: 'middle' });
  await page.mouse.click(x, y);
  expect(Object.keys((await readPlan(page)).walls)).toHaveLength(initial);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '画墙', exact: true }).click();
  await page.mouse.click(x + 80, y + 80);
  expect(Object.keys((await readPlan(page)).walls)).toHaveLength(initial);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '网格', exact: true }).click();
  await expect(page.getByRole('button', { name: '网格', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '适应画布', exact: true }).click();
});
