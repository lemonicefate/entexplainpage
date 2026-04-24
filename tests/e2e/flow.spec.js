import { test, expect } from '@playwright/test';

test.describe('Complete consultation flow', () => {
  test('loads home, enters player, navigates steps, and returns', async ({ page }) => {
    await page.goto('/');

    // Home is visible
    await expect(page.locator('#home-view')).toBeVisible();

    // Wait for procedures to load (skeleton cards replaced by real cards)
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });

    // Click first project card (skip calculator cards by href)
    await page.locator('a.card[href^="#/"]:not([href^="#/calc"])').first().click();

    // Player visible
    await expect(page.locator('#slide-view')).toBeVisible();
    await expect(page.locator('#step-indicator')).toContainText('01 /');

    // Next / Prev
    await page.locator('#next-btn').click();
    await expect(page.locator('#step-indicator')).toContainText('02 /');
    await page.locator('#prev-btn').click();
    await expect(page.locator('#step-indicator')).toContainText('01 /');

    // Back to home
    await page.locator('#back-btn').click();
    await expect(page.locator('#home-view')).toBeVisible();
  });

  test('keyboard navigation works in player', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('a.card[href^="#/"]:not([href^="#/calc"])').first().click();
    await expect(page.locator('#slide-view')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#step-indicator')).toContainText('02 /');

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#step-indicator')).toContainText('01 /');

    await page.keyboard.press('Escape');
    await expect(page.locator('#home-view')).toBeVisible();
  });
});

test.describe('Calculator', () => {
  test('opens calculator via direct hash and switches tabs', async ({ page }) => {
    await page.goto('/#/calc/bmi');
    await expect(page.locator('#calc-view')).toBeVisible();
    await expect(page.locator('.calc-card h3')).toContainText('BMI');

    // Result card renders
    await expect(page.locator('.result-value').first()).toBeVisible();

    // Switch to lipid tab
    await page.locator('.calc-tab[data-calc="lipid"]').click();
    await expect(page.locator('.calc-card h3')).toContainText('血脂');
  });
});

test.describe('Edge cases', () => {
  test('invalid hash redirects to home', async ({ page }) => {
    await page.goto('/#/nonexistent-procedure');
    await expect(page.locator('#home-view')).toBeVisible({ timeout: 5000 });
  });

  test('home shown on empty hash', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-view')).toBeVisible();
  });
});
