import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test.describe('Education workflow prototype', () => {
  test('shows every narrative page and exposes readable topic copy on mobile', async ({ page }) => {
    const prototype = pathToFileURL(path.resolve('admin-education-prototype.html')).href;
    await page.goto(`${prototype}?variant=editorial&topic=influenza`);

    await expect(page.locator('.workflow-option[data-variant="editorial"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#narrative-page-status')).toHaveText('敘事頁 1 / 2');
    await expect(page.locator('.editorial-point')).toHaveCount(3);
    await expect(page.locator('.editorial-point').first()).toContainText('傳染與免疫');

    await page.locator('#narrative-next').click();
    await expect(page).toHaveURL(/editorialPage=2/);
    await expect(page.locator('#narrative-page-status')).toHaveText('敘事頁 2 / 2');
    await expect(page.locator('.editorial-point')).toHaveCount(3);
    await expect(page.locator('.editorial-point').first()).toContainText('心血管疾病');
    await expect(page.locator('.editorial-point').last()).toContainText('消化、泌尿與其他');
    await expect(page.locator('.education-page-number')).toHaveText('03 / 05');

    await page.locator('.workflow-option[data-variant="modular"]').click();
    await expect(page).not.toHaveURL(/editorialPage=/);
    await expect(page.locator('#narrative-pager')).toBeHidden();
    await expect(page.locator('.module-card')).toHaveCount(6);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#preview-zoom-open').click();
    await expect(page.locator('#preview-dialog')).toBeVisible();
    const zoom = await page.evaluate(() => ({
      pageWidth: document.querySelector('#preview-dialog-content .education-page').getBoundingClientRect().width,
      scrollWidth: document.querySelector('.preview-dialog-scroll').scrollWidth,
      clientWidth: document.querySelector('.preview-dialog-scroll').clientWidth
    }));
    expect(zoom.pageWidth).toBeGreaterThan(500);
    expect(zoom.scrollWidth).toBeGreaterThan(zoom.clientWidth);
    await page.keyboard.press('Escape');
    await expect(page.locator('#preview-dialog')).toBeHidden();
    await page.locator('.topic-copy-details summary').click();
    await expect(page.locator('#topic-copy-list > li')).toHaveCount(6);
    await expect(page.locator('#state-announcement')).toContainText('模組模板');

    const layout = await page.evaluate(() => {
      const body = document.body;
      const nav = document.querySelector('.workflow-nav').getBoundingClientRect();
      const inspector = document.querySelector('.prototype-inspector').getBoundingClientRect();
      const buttonHeights = Array.from(document.querySelectorAll('.workflow-option'))
        .map((button) => button.getBoundingClientRect().height);
      return {
        scrollWidth: body.scrollWidth,
        clientWidth: body.clientWidth,
        workflowOverlapsInspector: nav.bottom > inspector.top && nav.top < inspector.bottom,
        buttonHeights
      };
    });
    expect(layout.scrollWidth).toBe(layout.clientWidth);
    expect(layout.workflowOverlapsInspector).toBe(false);
    expect(layout.buttonHeights.every((height) => height >= 44)).toBe(true);
  });
});
