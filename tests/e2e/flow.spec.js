import { test, expect } from '@playwright/test';

test.describe('Complete consultation flow', () => {
  test('should load grid, enter slideshow, navigate steps, and return', async ({ page }) => {
    await page.goto('/');

    // Grid should be visible
    await expect(page.locator('#grid-view')).toBeVisible();

    // Wait for procedures to load (skeleton cards should be replaced)
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });

    // Click first procedure card
    await page.locator('.card:not(.skeleton)').first().click();

    // Slideshow should be visible
    await expect(page.locator('#slide-view')).toBeVisible();

    // Step indicator should show 1/N
    await expect(page.locator('#step-indicator')).toContainText('1 /');

    // Click next arrow
    await page.locator('#next-btn').click();
    await expect(page.locator('#step-indicator')).toContainText('2 /');

    // Click prev arrow
    await page.locator('#prev-btn').click();
    await expect(page.locator('#step-indicator')).toContainText('1 /');

    // Click back button
    await page.locator('#back-btn').click();

    // Grid should be visible again
    await expect(page.locator('#grid-view')).toBeVisible();
  });

  test('should navigate with keyboard arrows', async ({ page }) => {
    await page.goto('/');

    // Wait for grid
    await expect(page.locator('.card:not(.skeleton)').first()).toBeVisible({ timeout: 5000 });

    // Enter slideshow
    await page.locator('.card:not(.skeleton)').first().click();
    await expect(page.locator('#slide-view')).toBeVisible();

    // Press right arrow
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#step-indicator')).toContainText('2 /');

    // Press left arrow
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#step-indicator')).toContainText('1 /');

    // Press Escape to go back
    await page.keyboard.press('Escape');
    await expect(page.locator('#grid-view')).toBeVisible();
  });
});

test.describe('Edge cases', () => {
  test('should handle invalid hash gracefully', async ({ page }) => {
    await page.goto('/#/nonexistent-surgery');

    // Should redirect back to grid
    await expect(page.locator('#grid-view')).toBeVisible({ timeout: 5000 });
  });

  test('should show grid-view on empty hash', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#grid-view')).toBeVisible();
  });
});
