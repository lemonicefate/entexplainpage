import { test, expect } from '@playwright/test';

test.describe('Admin persistence lifecycle', () => {
  test('creates with images, edits metadata and order, opens in Reader, then deletes', async ({ page, request }) => {
    const id = `e2e-guide-${Date.now()}`;
    const image = { name: 'step.png', mimeType: 'image/png', buffer: Buffer.from('e2e-image') };

    try {
      await page.goto('/admin.html');
      await expect(page.locator('#procForm')).toBeVisible();
      await page.locator('#procId').fill(id);
      await page.locator('#procTitle').fill('E2E guide');
      await page.locator('#procSubtitle').fill('E2E subtitle');
      await page.locator('#procType').selectOption('explain');
      await page.locator('#procCategory').selectOption('ent');
      await page.locator('#stepsContainer .step-card').first().locator('.step-title').fill('First');
      await page.locator('#stepsContainer .step-card').first().locator('.step-alt').fill('First image');
      await page.locator('#stepsContainer .step-card').first().locator('.step-image').setInputFiles(image);
      await page.locator('#btnAddStep').click();
      await page.locator('#stepsContainer .step-card').nth(1).locator('.step-title').fill('Second');
      await page.locator('#stepsContainer .step-card').nth(1).locator('.step-alt').fill('Second image');
      await page.locator('#stepsContainer .step-card').nth(1).locator('.step-image').setInputFiles(image);
      await page.locator('#btnSubmit').click();
      await expect(page.locator('#statusArea')).toContainText('建立完成', { timeout: 10000 });

      await page.locator('.proc-row').filter({ hasText: 'E2E guide' }).getByRole('button', { name: '編輯' }).click();
      await expect(page.locator('#formTitle')).toContainText('編輯');
      await page.locator('#procSubtitle').fill('Edited subtitle');
      await page.locator('#stepsContainer .step-card').nth(0).dragTo(page.locator('#stepsContainer .step-card').nth(1));
      await page.locator('#btnSubmit').click();
      await expect(page.locator('#statusArea')).toContainText('已儲存變更', { timeout: 10000 });

      await page.goto(`/#/${id}`);
      await expect(page.locator('#slide-view')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#step-indicator')).toContainText('01 /');

      await page.goto('/admin.html');
      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.proc-row').filter({ hasText: 'E2E guide' }).getByRole('button', { name: '刪除' }).click();
      await expect(page.locator('#statusArea')).toContainText('已刪除', { timeout: 10000 });
    } finally {
      const read = await request.get(`/api/procedures/${id}`);
      if (read.ok()) {
        const current = await read.json();
        await request.delete(`/api/procedures/${id}`, { data: { revision: current.revision } });
      }
    }
  });
});
