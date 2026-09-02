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

  await page.getByRole('button', { name: 'Girls' }).click();

  await expect(page).toHaveURL(/gender=girls/);
  // All seeded schools are co-ed, so filtering by "Girls" deterministically yields zero results.
  // If a girls-only school is ever added to the seed data, this assertion will fail as a signal.
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('root redirects to the default locale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
});
