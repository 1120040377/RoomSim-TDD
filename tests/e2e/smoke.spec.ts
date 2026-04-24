import { test, expect } from '@playwright/test';

/**
 * 冒烟：覆盖 PRD 的 3 条核心路径。Windows + WDAC 环境下可能需要
 * pnpm e2e:install 先下载 Chromium。
 */

// 每个 test 先清空 IndexedDB，避免互相污染
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    if (dbs) {
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    }
  });
  await page.reload();
});

test('新建方案 → 载入主卧模板 → 家具存在 → 刷新后仍在', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'RoomSim' })).toBeVisible();

  await page.getByRole('button', { name: '新建方案' }).click();
  // 模板选择对话框
  await expect(page.getByText('选择起点')).toBeVisible();
  await page.getByRole('button', { name: /^主卧\s/ }).click();

  // 进入编辑器
  await expect(page).toHaveURL(/#\/editor\//);
  await expect(page.getByRole('button', { name: /进入漫游/ })).toBeVisible();

  // 家具面板有床可点
  await page.getByRole('button', { name: /卧室/ }).first().click();

  // 回到方案列表 → 列表应有"主卧"
  await page.getByRole('button', { name: '← 返回' }).click();
  await expect(page.getByText('主卧')).toBeVisible();

  // 刷新再看
  await page.reload();
  await expect(page.getByText('主卧')).toBeVisible();
});

test('载入一室一厅 → 进入漫游 → canvas 渲染', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新建方案' }).click();
  await page.getByRole('button', { name: /^一室一厅\s/ }).click();

  await expect(page.getByRole('button', { name: /进入漫游/ })).toBeVisible();
  await page.getByRole('button', { name: /进入漫游/ }).click();

  // Walkthrough 页面出现身高调节
  await expect(page.getByText(/身高 \d+cm/)).toBeVisible();
  // canvas 存在
  await expect(page.locator('canvas')).toBeVisible();
});

test('导入损坏 JSON → 显示错误提示 → 列表不变', async ({ page }) => {
  await page.goto('/');

  // 先建一个方案让列表非空
  await page.getByRole('button', { name: '新建方案' }).click();
  await page.getByRole('button', { name: /^主卧\s/ }).click();
  await page.getByRole('button', { name: '← 返回' }).click();
  await expect(page.getByText('主卧')).toBeVisible();

  // 导入无效文件
  const fileInput = page.locator('input[type=file]');
  await fileInput.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"not":"a plan"}'),
  });
  await expect(page.getByText(/导入失败/)).toBeVisible();

  // 原方案仍在
  await expect(page.getByText('主卧')).toBeVisible();
});
