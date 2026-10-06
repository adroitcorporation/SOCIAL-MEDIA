import { test, expect } from '@playwright/test';

// Real local demo API and database; never run writes against a configured live app.
for (const width of [390, 768, 1440]) {
  test(`profile posts work end to end at ${width}px`, async ({ page, request }) => {
    expect((await (await request.get('/api/config')).json()).demo).toBe(true);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let postId: string | undefined;
    const text =
      `Profile posts browser check ${width}. <img src=x onerror="window.postXss=true">\n` +
      'Learning from our campus prototype. '.repeat(35);
    try {
      await page.goto('/profile');
      await page
        .getByRole('navigation', { name: 'Profile sections' })
        .getByRole('button', { name: 'Posts', exact: true })
        .click();
      await page.getByRole('button', { name: 'Create post', exact: true }).click();
      await page.getByLabel('Post content', { exact: true }).fill(text);
      await page.screenshot({ path: `.local/posts-${width}-editor.png`, fullPage: true });
      const saved = page.waitForResponse(
        (r) => r.url().endsWith('/api/posts') && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Post', exact: true }).click();
      const response = await saved;
      expect(response.ok()).toBe(true);
      postId = (await response.json()).id;
      const card = page
        .locator('.post-card')
        .filter({ has: page.locator(`a[href="/posts/${postId}"]`) });
      await expect(card).toBeVisible();
      await expect(card.locator('.post-content')).toHaveCSS('-webkit-line-clamp', '4');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        await page.evaluate(() => (window as unknown as Record<string, unknown>).postXss),
      ).toBeUndefined();
      await page.screenshot({ path: `.local/posts-${width}-profile.png`, fullPage: true });
      await card.locator('.post-author').click();
      await expect(page).toHaveURL(/\/u\/[a-z0-9-]+--[a-zA-Z0-9_-]+$/);
      await expect(page.locator('.post-card')).toContainText(
        `Profile posts browser check ${width}`,
      );
      await page.goto('/profile');
      await page
        .getByRole('navigation', { name: 'Profile sections' })
        .getByRole('button', { name: 'Posts', exact: true })
        .click();
      await card.getByRole('link', { name: 'Read more', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/posts/${postId}$`));
      await expect(page.locator('.post-card .post-content')).toHaveText(text);
      await page.getByRole('button', { name: 'Like', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Unlike', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.getByRole('button', { name: 'Unlike', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Like', exact: true })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await page.getByLabel('Comment', { exact: true }).fill('A browser-tested comment.');
      await page.getByRole('button', { name: 'Comment', exact: true }).click();
      await expect(page.locator('.post-comment')).toContainText('A browser-tested comment.');
      await page.screenshot({ path: `.local/posts-${width}-detail.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByRole('button', { name: 'Delete comment', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
      await expect(page.locator('.post-comment')).toHaveCount(0);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByLabel('Post content', { exact: true }).fill(`Edited browser check ${width}.`);
      await page.getByLabel('Who can see this?').selectOption('CONNECTIONS_ONLY');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.locator('.post-content')).toHaveText(`Edited browser check ${width}.`);
      await expect(page.locator('.post-privacy')).toHaveText('Connections only');
      await page.reload();
      await expect(page.locator('.post-content')).toHaveText(`Edited browser check ${width}.`);
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await page.getByRole('button', { name: 'Delete post', exact: true }).click();
      await expect(page).toHaveURL(/\/profile$/);
      expect((await request.get(`/api/posts/${postId}`)).status()).toBe(404);
      expect(errors).toEqual([]);
    } finally {
      if (postId) await request.delete(`/api/posts/${postId}`, { data: {} });
    }
  });
}

test('Discover profiles open their own posts page without creating a global feed', async ({
  page,
  request,
}) => {
  expect((await (await request.get('/api/config')).json()).demo).toBe(true);
  await page.goto('/discover');
  await page
    .getByRole('button', { name: /View .+profile/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/u\/[a-z0-9-]+--[a-zA-Z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: 'Profile posts' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Profile posts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create post', exact: true })).toHaveCount(0);
  await expect(page.getByText('No posts yet.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await expect(page.locator('.profile-details')).toBeVisible();
  await expect(page.locator('.profile-details .avatar')).toHaveCount(0);
  await expect(page.locator('.user-profile-header .avatar')).toHaveCount(1);
  expect(
    await page
      .locator('.user-profile-page')
      .evaluate((element) => getComputedStyle(element).getPropertyValue('--profile-accent').trim()),
  ).not.toBe('');
  await expect(page.locator('.profile-group-skills .tag').first()).toBeVisible();
  expect(
    await page
      .locator('.profile-group-skills .tag')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
  ).not.toBe(
    await page
      .locator('.profile-group-interests .tag')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
  );
});
