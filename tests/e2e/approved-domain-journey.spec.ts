import { test, expect } from '@playwright/test';
import { mockMobileApp } from './support/mobile-fixture';

for (const width of [390, 1440]) {
  test(`approved-domain student completes profile without manual verification at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const { state, actions, calls } = await mockMobileApp(page);
    state.connections = [];
    state.me.collegeVerificationSource = 'APPROVED_EMAIL_DOMAIN';
    Object.assign(state.me, {
      bio: '',
      skills: ['React'],
      interests: ['Technology'],
      domains: ['Education'],
      lookingFor: ['Project partners'],
    });
    await page.route('**/api/profile', async (route) => {
      state.me = { ...state.me, ...route.request().postDataJSON() };
      await route.fulfill({ json: state.me });
    });
    await page.goto('/profile');
    await expect(page.getByText('College verified through your college email.')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Verification method' })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await page.goto('/discover');
    const active = page.locator('.discover-profile-card:not(.is-preview)');
    await active.getByRole('button', { name: 'Connect', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Bio');
    expect(actions).toEqual([]);
    await dialog.getByRole('button', { name: 'Not now' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/discover/);
    await active.getByRole('button', { name: 'Connect', exact: true }).click();
    await dialog.getByRole('button', { name: 'Complete Profile', exact: true }).click();
    await expect(page).toHaveURL(/profile\?edit=1/);
    await expect(page.getByRole('group', { name: 'Verification method' })).toHaveCount(0);
    await page
      .getByLabel('Bio (required)', { exact: true })
      .fill('I enjoy collaborating with other students on useful projects.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible();
    await page.goto('/discover');
    await active.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(active.getByRole('button', { name: 'Pending', exact: true })).toBeDisabled();
    expect(actions).toEqual(['connect:A']);
    expect(calls.some((call) => call.includes('/api/verification'))).toBe(false);
  });
}

test('approved-domain new account can browse before completion; unapproved account retains manual verification', async ({
  page,
}) => {
  const { state, actions } = await mockMobileApp(page);
  state.connections = [];
  state.me.collegeVerificationSource = 'APPROVED_EMAIL_DOMAIN';
  state.me.onboarded = false;
  state.me.bio = '';
  for (const path of ['/', '/events', '/ideas', '/discover']) {
    await page.goto(path);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.topbar')).toBeVisible();
  }
  await page.goto('/profile');
  await expect(page.getByText('College verified through your college email.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Verification method' })).toHaveCount(0);
  expect(actions).toEqual([]);
  state.me.collegeVerified = false;
  state.me.collegeVerificationSource = undefined;
  await page.reload();
  await expect(page.getByRole('group', { name: 'Verification method' })).toBeVisible();
  await page.getByRole('button', { name: 'College ID', exact: true }).click();
  await expect(page.getByLabel('College ID image')).toBeVisible();
});
