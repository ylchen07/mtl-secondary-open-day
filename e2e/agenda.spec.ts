import { expect, test } from '@playwright/test';

test('agenda renders in English', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();
});

test('agenda renders in French', async ({ page }) => {
  await page.goto('/fr');
  await expect(page.getByRole('heading', { name: 'À venir' })).toBeVisible();
});

test('a filter narrows results and updates the URL', async ({ page }) => {
  await page.goto('/en');
  const before = await page.getByRole('article').count();

  await page.getByRole('button', { name: 'Girls' }).click();

  await expect(page).toHaveURL(/gender=girls/);
  expect(await page.getByRole('article').count()).toBeLessThanOrEqual(before);
});

test('root redirects to the default locale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
});
