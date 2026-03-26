import { Page, expect } from "@playwright/test";

export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "test@homly.app";
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "Test1234!";
export const TEST_USER_USERNAME = process.env.TEST_USER_USERNAME ?? "testuser";

/** מחכה שהאפליקציה תסיים לטעון (spinner נעלם, login form מופיע) */
export async function waitForApp(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
}

/** מתחבר עם אימייל+סיסמה */
export async function loginUser(page: Page, email = TEST_USER_EMAIL, password = TEST_USER_PASSWORD) {
  await waitForApp(page);
  await page.getByPlaceholder("מייל/שם משתמש").fill(email);
  await page.getByPlaceholder("סיסמה", { exact: true }).fill(password);
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  // מחכה שיכנס לאפליקציה — הכפתור "התחבר" נעלם
  await expect(page.getByRole("button", { name: "התחבר", exact: true })).not.toBeVisible({ timeout: 10000 });
}

/** מתחבר וממתין לטעינת בית מלאה */
export async function loginAndWaitForHouse(page: Page) {
  await loginUser(page);
  await page.waitForTimeout(2500);
}

/** מוודא שהודעת שגיאה מוצגת */
export async function expectError(page: Page, text: string) {
  await expect(page.locator(`p:has-text("${text}")`)).toBeVisible({ timeout: 5000 });
}

/** פותח את מודל ההגדרות — מחזיר false אם בית לא פעיל */
export async function openSettingsModal(page: Page): Promise<boolean> {
  const settingsBtn = page.getByRole("button", { name: /הגדרות|⚙|settings/i }).first();
  const visible = await settingsBtn.isVisible({ timeout: 8000 }).catch(() => false);
  if (!visible) return false;
  await settingsBtn.click();
  await expect(page.getByText("הגדרות בית")).toBeVisible({ timeout: 5000 });
  return true;
}

/** פותח את מודל ההזמנה דרך הגדרות */
export async function openInviteModal(page: Page): Promise<boolean> {
  const ok = await openSettingsModal(page);
  if (!ok) return false;
  await page.getByRole("button", { name: /שיתוף והזמנה/i }).click();
  await expect(page.getByText("שיתוף והזמנה לבית")).toBeVisible({ timeout: 5000 });
  return true;
}

/** פותח את פרופיל המשתמש דרך הגדרות */
export async function openUserProfileModal(page: Page): Promise<boolean> {
  const ok = await openSettingsModal(page);
  if (!ok) return false;
  await page.getByRole("button", { name: "פרופיל משתמש" }).click();
  await expect(page.getByText("הפרופיל שלי")).toBeVisible({ timeout: 5000 });
  return true;
}

/** מחזיר את כמות הפריטים בסעיף לפי ה-badge */
export async function getSectionItemCount(page: Page, sectionId: string): Promise<number> {
  const section = page.locator(`#${sectionId}`);
  const badge = section.locator(".rounded-full.bg-teal-50").first();
  const text = await badge.textContent().catch(() => "0");
  const match = text?.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/** מוסיף פריט לסעיף מסוים ע"י placeholder */
export async function addItemToSection(page: Page, placeholder: string, text: string) {
  const input = page.getByPlaceholder(placeholder);
  await input.fill(text);
  await input.press("Enter");
}

/** ממתין לכפתור "בטל" (undo) ומחזיר אותו */
export async function getUndoButton(page: Page) {
  return page.getByRole("button", { name: "בטל" });
}
