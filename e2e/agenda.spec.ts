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

  const totalCount = await page.getByRole('article').count();

  await page.getByRole('button', { name: 'Girls' }).click();

  await expect(page).toHaveURL(/gender=girls/);
  // Asserts the filter narrows the result set, not an exact count — the
  // published corpus composition (which schools are girls-only) changes
  // over time and should not make this test brittle.
  const filteredCount = await page.getByRole('article').count();
  expect(filteredCount).toBeLessThan(totalCount);
});

test('root redirects to the default locale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
});
