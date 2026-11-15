import { test, expect } from '@playwright/test';

async function register(page, email) {
  await page.goto('/register');
  await page.getByLabel('Full Name', { exact: true }).fill('Assistant Tester');
  await page.getByLabel('Shop Name', { exact: true }).fill('Assistant Kirana');
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('AssistantPassword42');
  await page.getByLabel('Confirm Password', { exact: true }).fill('AssistantPassword42');
  await page.getByRole('button', { name: 'Register & Open Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to DukaanSaathi AI' })).toBeVisible();
}
async function interpret(page, command) {
  await page.getByRole('textbox', { name: 'Shop command', exact: true }).fill(command);
  await page.getByRole('button', { name: 'Interpret', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm shop action' });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function confirm(page) {
  const dialog = page.getByRole('dialog', { name: 'Confirm shop action' });
  await dialog.getByRole('button', { name: /Confirm & Save/ }).click();
  await expect(dialog).not.toBeVisible();
}
async function ledger(page) {
  await page.getByRole('link', { name: /Udhaar Ledger/ }).click();
  await expect(page.getByRole('heading', { name: /Udhaar Ledger/ })).toBeVisible();
}
const maheshRow = (page) => page.getByRole('row').filter({ hasText: 'Mahesh' });

test('text-only standalone creation, existing-customer credit, repayment, history and refresh', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await register(page, 'standalone-assistant@example.com');
  const create = await interpret(page, 'Create a new customer named Mahesh.');
  await expect(create).toContainText('Create Mahesh as a new customer with ₹0 outstanding balance?');
  // Cancel has no side effects.
  await create.getByRole('button', { name: /Cancel/ }).click();
  await ledger(page);
  await expect(maheshRow(page)).toHaveCount(0);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await interpret(page, 'Create a new customer named Mahesh.');
  await confirm(page);
  await ledger(page);
  await expect(maheshRow(page)).toContainText('₹0');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Active Customers (1)', exact: true })).toBeVisible();
  await expect(maheshRow(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Voice Assistant', exact: true }).click();
  await interpret(page, 'Mahesh ko 100 rupaye udhaar do');
  await confirm(page);
  await expect(maheshRow(page)).toContainText('₹100');
  // The global assistant may still be closing after the successful refresh.
  const close = page.getByRole('button', { name: 'Close assistant' });
  if (await close.isVisible()) await close.click();
  await page.getByRole('button', { name: 'Voice Assistant', exact: true }).click();
  await interpret(page, 'Mahesh ne 40 rupaye wapas diye');
  await confirm(page);
  await expect(maheshRow(page)).toContainText('₹60');
  if (await close.isVisible()) await close.click();
  await page.reload();
  await expect(maheshRow(page)).toContainText('₹60');
  await expect(maheshRow(page)).toHaveCount(1);
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByText('Page 1: 2 entries', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('one confirmation creates a missing customer plus credit, then restores rather than duplicates', async ({ page }) => {
  await register(page, 'combined-assistant@example.com');
  const dialog = await interpret(page, 'Mahesh ko 100 rupaye udhaar do');
  await expect(dialog).toContainText('Mahesh is a new customer. Create Mahesh and add ₹100 udhaar?');
  // Editing the intended name must refresh the plan before execution is available.
  await dialog.getByRole('textbox', { name: 'Customer name', exact: true }).fill('New Name');
  await expect(dialog).toContainText('New Name is a new customer. Create New Name and add ₹100 udhaar?');
  await dialog.getByRole('textbox', { name: 'Customer name', exact: true }).fill('Mahesh');
  await expect(dialog).toContainText('Mahesh is a new customer. Create Mahesh and add ₹100 udhaar?');
  await confirm(page);
  await ledger(page);
  await expect(maheshRow(page)).toContainText('₹100');
  await page.reload();
  await expect(maheshRow(page)).toHaveCount(1);
  await maheshRow(page).getByTitle('Delete or Archive Customer').click();
  await page.getByRole('button', { name: 'Archive Customer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Active Customers (0)', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  const restore = await interpret(page, 'Mahesh ko 10 rupaye udhaar do');
  await expect(restore).toContainText('Mahesh is archived. Restore Mahesh and add ₹10 udhaar?');
  await confirm(page);
  await ledger(page);
  await expect(maheshRow(page)).toHaveCount(1);
  await expect(maheshRow(page)).toContainText('₹110');
  await expect(page.getByRole('button', { name: 'Archived Customers (0)', exact: true })).toBeVisible();
});

test('similar customers require selecting the intended account before credit can be confirmed', async ({ page }) => {
  await register(page, 'selection-assistant@example.com');
  for (const name of ['Mahesh Kumar', 'Mahesh Sharma']) {
    await interpret(page, `Create a new customer named ${name}.`);
    await confirm(page);
  }
  const dialog = await interpret(page, 'Mahesh ko 100 rupaye udhaar do');
  await expect(dialog).toContainText('Similar customers exist.');
  await expect(dialog.getByRole('button', { name: /Confirm & Save/ })).toBeDisabled();
  await dialog.getByRole('radio', { name: /Mahesh Sharma/ }).check();
  await expect(dialog).toContainText('Add ₹100 udhaar to Mahesh Sharma?');
  await confirm(page);
  await ledger(page);
  await expect(page.getByRole('row').filter({ hasText: 'Mahesh Kumar' })).toContainText('₹0');
  await expect(page.getByRole('row').filter({ hasText: 'Mahesh Sharma' })).toContainText('₹100');
  await expect(page.getByRole('button', { name: 'Active Customers (2)', exact: true })).toBeVisible();
});
