import { expect, test } from '@playwright/test';

for (const [locale, upcoming] of [['en', 'Upcoming'], ['fr', 'À venir']]) {
  test(`the school list leads and the calendar is one tab away in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.school-table tbody tr').first()).toBeVisible();
    await tabs.nth(1).click();
    await expect(page).toHaveURL(/view=calendar/);
    await expect(page.getByRole('heading', { name: upcoming }).or(page.locator('.past-archive')).first()).toBeVisible();
    await expect(page.locator('.school-table')).toBeHidden();
  });
}

test('a school with no published events is still listed', async ({ page }) => {
  await page.goto('/en?q=jean-eudes');
  const row = page.locator('.school-table tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Collège Jean-Eudes');
  await expect(row).toContainText('No upcoming event observed');
  await expect(row.getByRole('link', { name: /Admissions page/ })).toHaveAttribute('href', /^https:/);
});

test('a filter narrows results and updates the URL', async ({ page }) => {
  await page.goto('/en');
  const rows = page.locator('.school-table tbody tr');
  const totalCount = await rows.count();

  await page.getByRole('button', { name: 'Girls' }).click();

  await expect(page).toHaveURL(/gender=girls/);
  // Asserts the filter narrows the list, not an exact count: which schools
  // are confirmed girls-only changes as records are verified.
  await expect.poll(() => rows.count()).toBeLessThan(totalCount);
});

test('root redirects to the default locale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
});

test('each school year has its own page and unknown years are not found', async ({ page }) => {
  await page.goto('/en');
  const nav = page.getByRole('navigation', { name: 'School years' });
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  const label = await current.innerText();
  const year = label.replace('School year ', '').replace('–', '-');

  await page.goto(`/fr/${year}`);
  await expect(page.getByRole('navigation', { name: 'Années scolaires' }).locator('[aria-current="page"]'))
    .toHaveText(`Année scolaire ${year.replace('-', '–')}`);
  await expect(page.locator('.school-table tbody tr').first()).toBeVisible();

  const missing = await page.goto('/en/1999-2000');
  expect(missing?.status()).toBe(404);
});

test('admission interviews are a filterable event type', async ({ page }) => {
  await page.goto('/en?view=calendar');
  await page.getByRole('button', { name: 'Admission interview', exact: true }).click();
  await expect(page).toHaveURL(/type=interview/);
  for (const type of await page.locator('.agenda-event .event-type').allInnerTexts()) {
    expect(type).toBe('Admission interview');
  }
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
  await expect(page.getByText('No schools match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.school-table tbody tr').first()).toBeVisible();
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

for (const locale of ['en', 'fr']) {
  test(`past events use an accessible archive in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}?view=calendar`);
    const archive = page.getByRole('region', { name: locale === 'en' ? 'Past events' : 'Événements passés', exact: true });
    const toggle = archive.getByRole('button');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(archive.locator('article').first()).toBeHidden();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const event = archive.locator('article').first();
    await expect(event).toBeVisible();
    await expect(event.getByRole('link')).toHaveAttribute('href', /^https?:/);
    await expect(archive.locator('.button-primary')).toHaveCount(0);
    const evidence = event.locator('.event-evidence');
    await expect(evidence).toBeHidden();
    await event.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(evidence).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(evidence).toBeHidden();
    const school = await event.getByRole('heading').innerText();
    await page.getByRole('searchbox').fill(school);
    await expect(archive.locator('article').first().getByRole('heading')).toHaveText(school);
    await toggle.click();
    await expect(archive.locator('article').first()).toBeHidden();
  });
}
