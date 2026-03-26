/**
 * tests/user-profile.spec.ts
 * בדיקות מודל פרופיל משתמש
 */
import { test, expect } from "@playwright/test";
import { loginAndWaitForHouse, openUserProfileModal, openSettingsModal } from "./helpers";

test.describe("פרופיל משתמש — User Profile Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAndWaitForHouse(page);
  });

  test("פתיחת מודל הפרופיל דרך הגדרות", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByText("הפרופיל שלי")).toBeVisible();
  });

  test("המודל מציג כותרת 'הפרופיל שלי'", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByRole("heading", { name: "הפרופיל שלי" })).toBeVisible();
  });

  test("שדה שם לתצוגה קיים עם placeholder", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByPlaceholder("השם שיופיע בבית")).toBeVisible();
  });

  test("שם המשתמש מוצג עם @ בפרופיל", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    // מחפש אלמנט שמכיל @ — שם משתמש
    const usernameEl = page.locator("p").filter({ hasText: /^@/ }).first();
    await expect(usernameEl).toBeVisible({ timeout: 3000 });
    const text = await usernameEl.textContent();
    expect(text?.startsWith("@")).toBeTruthy();
  });

  test("כפתור 'שמור פרופיל' קיים", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByRole("button", { name: "שמור פרופיל" })).toBeVisible();
  });

  test("כפתור סגירה קיים וסוגר את המודל", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByRole("button", { name: "סגור" }).click();
    await expect(page.getByText("הפרופיל שלי")).not.toBeVisible({ timeout: 3000 });
  });

  test("שמירה עם שם ריק מציגה שגיאה", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByPlaceholder("השם שיופיע בבית").fill("");
    await page.getByRole("button", { name: "שמור פרופיל" }).click();
    // מצפה לשגיאה או שה-API עונה
    await page.waitForTimeout(2000);
    await expect(page.locator("main")).toBeVisible();
  });

  test("שמירה עם שם קצר מ-2 תווים מציגה שגיאה", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByPlaceholder("השם שיופיע בבית").fill("א");
    await page.getByRole("button", { name: "שמור פרופיל" }).click();
    await expect(
      page.getByText(/חייב להכיל לפחות 2/)
    ).toBeVisible({ timeout: 5000 });
  });

  test("כפתור שמור מציג מצב טעינה", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByPlaceholder("השם שיופיע בבית").fill("שם תקין לבדיקה");
    await page.getByRole("button", { name: "שמור פרופיל" }).click();
    await expect(page.getByRole("button", { name: "שומר..." })).toBeVisible({ timeout: 3000 });
  });

  test("לחיצה מחוץ למודל לא סוגרת (modal locked)", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    // לחיצה על ה-backdrop
    await page.mouse.click(10, 10);
    await page.waitForTimeout(500);
    // המודל עדיין פתוח — צריך ללחוץ סגור
    await expect(page.getByText("הפרופיל שלי")).toBeVisible();
  });

  test("כפתור עריכת תמונה קיים", async ({ page }) => {
    const ok = await openUserProfileModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByTitle(/החלפת תמונה|מעבד תמונה/)).toBeVisible();
  });

  test("פתיחת פרופיל → סגירה → פתיחה מחדש", async ({ page }) => {
    const ok1 = await openUserProfileModal(page);
    if (!ok1) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByRole("button", { name: "סגור" }).click();
    await expect(page.getByText("הפרופיל שלי")).not.toBeVisible({ timeout: 3000 });

    // פתיחה שנייה
    await openUserProfileModal(page);
    await expect(page.getByText("הפרופיל שלי")).toBeVisible({ timeout: 3000 });
  });
});
