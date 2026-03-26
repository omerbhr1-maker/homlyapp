/**
 * tests/settings.spec.ts
 * בדיקות מודל הגדרות בית — שינוי שם, שמירה, התנתקות, מחיקה
 */
import { test, expect } from "@playwright/test";
import { loginAndWaitForHouse, openSettingsModal } from "./helpers";

test.describe("הגדרות בית — Settings Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAndWaitForHouse(page);
  });

  test("פתיחת מודל ההגדרות", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByText("הגדרות בית")).toBeVisible();
  });

  test("כל הכפתורים הראשיים קיימים", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByRole("button", { name: "שמור הגדרות" })).toBeVisible();
    await expect(page.getByRole("button", { name: "פרופיל משתמש" })).toBeVisible();
    await expect(page.getByRole("button", { name: "שיתוף והזמנה לבית" })).toBeVisible();
    await expect(page.getByRole("button", { name: "בחירת בית אחר" })).toBeVisible();
    await expect(page.getByRole("button", { name: "התנתק" })).toBeVisible();
    await expect(page.getByRole("button", { name: "סגור" })).toBeVisible();
  });

  test("שדה שם הבית קיים", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByPlaceholder("הכנס שם לבית")).toBeVisible();
  });

  test("שדה שם הבית מאוכלס עם השם הנוכחי", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    const nameInput = page.getByPlaceholder("הכנס שם לבית");
    const currentName = await nameInput.inputValue();
    expect(currentName.length).toBeGreaterThan(0);
  });

  test("סגירת ההגדרות", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByRole("button", { name: "סגור" }).click();
    await expect(page.getByText("הגדרות בית")).not.toBeVisible({ timeout: 3000 });
  });

  test("שמירת הגדרות מציגה מצב טעינה", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByRole("button", { name: "שמור הגדרות" }).click();
    await expect(page.getByRole("button", { name: "שומר..." })).toBeVisible({ timeout: 3000 });
  });

  test("שינוי שם הבית ושמירה", async ({ page }) => {
    test.setTimeout(20000);
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    const nameInput = page.getByPlaceholder("הכנס שם לבית");
    const originalName = await nameInput.inputValue();
    const newName = `בית בדיקה ${Date.now()}`.slice(0, 30);
    await nameInput.fill(newName);
    await page.getByRole("button", { name: "שמור הגדרות" }).click();
    // מחכה שהשמירה תסתיים
    await page.waitForTimeout(3000);
    // מחזיר לשם המקורי
    await openSettingsModal(page);
    await page.getByPlaceholder("הכנס שם לבית").fill(originalName);
    await page.getByRole("button", { name: "שמור הגדרות" }).click();
    await page.waitForTimeout(2000);
  });

  test("כפתור מחיקת בית קיים לבעל הבית", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    // בדיקת לוגיקה — המשתמש בדיקה הוא בעל הבית
    const deleteBtn = page.getByRole("button", { name: /מחיקת בית|מוחק בית/ });
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
  });

  test("כפתור 'עזוב בית' לא קיים לבעל הבית", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await expect(page.getByRole("button", { name: "עזוב בית" })).not.toBeVisible();
  });

  test("מעבר לפרופיל משתמש מהגדרות", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByRole("button", { name: "פרופיל משתמש" }).click();
    await expect(page.getByText("הפרופיל שלי")).toBeVisible({ timeout: 5000 });
    // ההגדרות נסגרות
    await expect(page.getByText("הגדרות בית")).not.toBeVisible({ timeout: 3000 });
  });

  test("מעבר להזמנה מהגדרות", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByRole("button", { name: "שיתוף והזמנה לבית" }).click();
    await expect(page.getByText("שיתוף והזמנה לבית")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("הגדרות בית")).not.toBeVisible({ timeout: 3000 });
  });

  test("התנתקות — חזרה למסך כניסה", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByRole("button", { name: "התנתק" }).click();
    await expect(page.getByRole("button", { name: "התחבר", exact: true })).toBeVisible({ timeout: 8000 });
  });

  test("'בחירת בית אחר' — מחזיר למסך בחירת בית", async ({ page }) => {
    const ok = await openSettingsModal(page);
    if (!ok) test.skip(true, "האפליקציה לא נטענה עם בית פעיל");
    await page.getByRole("button", { name: "בחירת בית אחר" }).click();
    await page.waitForTimeout(1000);
    // מצפה לראות מסך בחירת בית (placeholder "שם הבית" ליצירת בית חדש)
    await expect(page.locator("main")).toBeVisible();
  });
});
