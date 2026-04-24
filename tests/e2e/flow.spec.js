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

test.describe('Reader mode (tap zones + scrubber + auto-hide)', () => {
  test('tap left zone goes to previous, tap right zone goes to next', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('a.card[href^="#/"]:not([href^="#/calc"])').first().click();
    await expect(page.locator('#slide-view')).toBeVisible();
    await expect(page.locator('#step-indicator')).toContainText('01 /');

    // Right zone → next
    await page.locator('#tap-next').click();
    await expect(page.locator('#step-indicator')).toContainText('02 /');

    // Left zone → prev
    await page.locator('#tap-prev').click();
    await expect(page.locator('#step-indicator')).toContainText('01 /');
  });

  test('center tap toggles immersive chrome class', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('a.card[href^="#/"]:not([href^="#/calc"])').first().click();
    await expect(page.locator('#slide-view')).toBeVisible();

    // First center tap → hide chrome (was visible on entry)
    await page.locator('#tap-toggle').click();
    await expect(page.locator('#slide-view')).toHaveClass(/is-immersive/);

    // Second center tap → show chrome
    await page.locator('#tap-toggle').click();
    await expect(page.locator('#slide-view')).not.toHaveClass(/is-immersive/);
  });

  test('tap zones disabled when a drawing tool is active', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('a.card[href^="#/"]:not([href^="#/calc"])').first().click();
    await expect(page.locator('#slide-view')).toBeVisible();

    // Activate laser → stage gets tool-laser class
    await page.keyboard.press('l');
    await expect(page.locator('#slide-stage')).toHaveClass(/tool-laser/);

    // Tap-next click should be blocked by pointer-events: none on zone
    const before = await page.locator('#step-indicator').textContent();
    await page.locator('#tap-next').click({ force: true }); // force past pointer-events check in test
    // Even with force, the handler itself returns early because state.activeTool is set
    const after = await page.locator('#step-indicator').textContent();
    expect(after).toBe(before);
  });

  test('scrubber drag jumps to a specific step', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('a.card[href^="#/"]:not([href^="#/calc"])').first().click();
    await expect(page.locator('#slide-view')).toBeVisible();

    // Set scrubber to index 2 via input event
    const scrubber = page.locator('#scrubber');
    await scrubber.evaluate((el) => {
      el.value = '2';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(page.locator('#step-indicator')).toContainText('03 /');
    await expect(page.locator('#scrubber-label')).toContainText('3 /');
  });

  test('chrome auto-hides 3 seconds after entering player', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('a.card[href^="#/"]:not([href^="#/calc"])').first().click();
    await expect(page.locator('#slide-view')).toBeVisible();

    // Chrome visible on entry
    await expect(page.locator('#slide-view')).not.toHaveClass(/is-immersive/);

    // After the 3s timer, it becomes immersive
    await expect(page.locator('#slide-view')).toHaveClass(/is-immersive/, { timeout: 5000 });
  });
});
