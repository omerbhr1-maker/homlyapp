import { Page, expect } from "@playwright/test";

export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "test@homly.app";
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "Test1234!";
export const TEST_USER_USERNAME = process.env.TEST_USER_USERNAME ?? "testuser";

/** מחכה שהאפליקציה תסיים לטעון (spinner נעלם, login form מופיע) */
export async function waitForApp(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  // מחכה שלא יהיה loading overlay
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

/** מוודא שהודעת שגיאה מוצגת */
export async function expectError(page: Page, text: string) {
  await expect(page.locator(`p:has-text("${text}")`)).toBeVisible({ timeout: 5000 });
}
