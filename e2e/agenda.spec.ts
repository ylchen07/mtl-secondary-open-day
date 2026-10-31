import { expect, test } from '@playwright/test';

for (const [locale, schools, events] of [['en', 'Schools', 'Events'], ['fr', 'Écoles', 'Événements']]) {
  test(`the directory leads and events are one link away in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const nav = page.getByRole('navigation', { name: locale === 'en' ? 'Main' : 'Principal' });
    await expect(nav.getByRole('link', { name: schools })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.school-row').first()).toBeVisible();
    await nav.getByRole('link', { name: events }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/events$`));
    await expect(nav.getByRole('link', { name: events })).toHaveAttribute('aria-current', 'page');
  });
}

test('a region on the map filters the directory and is shareable', async ({ page }) => {
  await page.goto('/en');
  const rows = page.locator('.school-row');
  const total = await rows.count();
  const laval = page.getByRole('button', { name: /^Laval/ });
  await laval.click();
  await expect(laval).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/region=laval/);
  await expect.poll(() => rows.count()).toBeLessThan(total);
  for (const region of await page.locator('.row-region').allInnerTexts()) expect(region).toBe('Laval');

  await page.reload();
  await expect(page.getByRole('button', { name: /^Laval/ })).toHaveAttribute('aria-pressed', 'true');
});

test('a school page shows its description, address and sourced events', async ({ page }) => {
  await page.goto('/en?q=brebeuf');
  await page.locator('.school-row').getByRole('link', { name: 'Collège Jean-de-Brébeuf' }).click();
  await expect(page).toHaveURL(/\/en\/schools\/college-jean-de-brebeuf$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Collège Jean-de-Brébeuf');
  await expect(page.locator('.school-description')).toContainText('Côte-des-Neiges');
  await expect(page.locator('.address')).toContainText('H3T 1C1');
  const event = page.locator('.school-event').first();
  await expect(event.getByRole('link', { name: 'source' })).toHaveAttribute('href', /^https:/);
  await expect(page.getByRole('link', { name: /Admissions page/ })).toHaveAttribute('href', /^https:/);
});

test('a draft school is listed but shows only confirmed facts', async ({ page }) => {
  await page.goto('/en?q=jean-eudes');
  const row = page.locator('.school-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('No upcoming event observed');
  await row.getByRole('link', { name: 'Collège Jean-Eudes' }).click();
  await expect(page.getByText('Not yet checked against the school’s own website')).toBeVisible();
  await expect(page.getByText('No description yet.')).toBeVisible();
  await expect(page.getByText('Street address not yet confirmed.')).toBeVisible();
  await expect(page.locator('.map-pin')).toHaveCount(0);
});

test('unknown schools are not found', async ({ page }) => {
  const missing = await page.goto('/en/schools/no-such-school');
  expect(missing?.status()).toBe(404);
});

test('a filter narrows results and updates the URL', async ({ page }) => {
  await page.goto('/en');
  const rows = page.locator('.school-row');
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

test('each school year has its own events page and unknown years are not found', async ({ page }) => {
  await page.goto('/en/events');
  const nav = page.getByRole('navigation', { name: 'School years' });
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  const label = await current.innerText();
  const year = label.replace('School year ', '').replace('–', '-');

  await page.goto(`/fr/events/${year}`);
  await expect(page.getByRole('navigation', { name: 'Années scolaires' }).locator('[aria-current="page"]'))
    .toHaveText(`Année scolaire ${year.replace('-', '–')}`);

  const missing = await page.goto('/en/events/1999-2000');
  expect(missing?.status()).toBe(404);
});

test('old school-year and calendar links land on the events page', async ({ page }) => {
  await page.goto('/en/events');
  const label = await page.getByRole('navigation', { name: 'School years' }).locator('[aria-current="page"]').innerText();
  const year = label.replace('School year ', '').replace('–', '-');
  await page.goto(`/fr/${year}`);
  await expect(page).toHaveURL(new RegExp(`/fr/events/${year}$`));
  await page.goto('/en?view=calendar&type=interview');
  await expect(page).toHaveURL(/\/en\/events\?type=interview$/);
});

test('admission interviews are a filterable event type', async ({ page }) => {
  await page.goto('/en/events');
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
  await expect(page.locator('.school-row').first()).toBeVisible();
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
    await page.goto(`/${locale}/events`);
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
