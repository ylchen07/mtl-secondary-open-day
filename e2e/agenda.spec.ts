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

test('mobile filters can be opened, applied, and cleared', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en');
  const toggle = page.getByRole('button', { name: 'Filters', exact: true });
  const search = page.getByRole('searchbox', { name: 'Search schools' });
  await expect(search).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await search.fill('no matching school');
  await expect(page.getByText('No events match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('article').first()).toBeVisible();
  await toggle.click();
  await expect(search).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('hydration stays consistent when the browser clock differs', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat|server rendered/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2100-01-01T00:00:00Z'));
  await page.goto('/en');
  await page.getByRole('button', { name: 'Girls', exact: true }).click();
  await expect(page).toHaveURL(/gender=girls/);
  expect(errors).toEqual([]);
});
