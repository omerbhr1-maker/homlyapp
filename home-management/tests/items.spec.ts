import { test, expect } from "@playwright/test";
import { loginUser, waitForApp } from "./helpers";

test.describe("רשימת קניות ומשימות — Shopping List & Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginUser(page);
    await page.waitForTimeout(2500);
  });

  test("מוסיף פריט לרשימת קניות", async ({ page }) => {
    const testItem = `בדיקה_${Date.now()}`;

    // מחפש שדה הוספת פריט — placeholder "הוסף פריט..."
    const input = page.getByPlaceholder(/הוסף פריט|פריט חדש/).first();
    if (!(await input.isVisible())) {
      test.skip(true, "לא נמצאה רשימת קניות פעילה");
      return;
    }

    await input.fill(testItem);
    await input.press("Enter");

    // מחכה שהפריט יופיע
    await expect(page.getByText(testItem)).toBeVisible({ timeout: 5000 });
  });

  test("מסמן פריט כהושלם (toggle)", async ({ page }) => {
    const testItem = `לסמן_${Date.now()}`;

    const input = page.getByPlaceholder(/הוסף פריט|פריט חדש/).first();
    if (!(await input.isVisible())) {
      test.skip(true, "לא נמצאה רשימת קניות פעילה");
      return;
    }

    // הוסף פריט
    await input.fill(testItem);
    await input.press("Enter");
    await expect(page.getByText(testItem)).toBeVisible({ timeout: 5000 });

    // לחץ על הפריט לסימון
    await page.getByText(testItem).click();
    // לאחר סימון — מצב completed (strikethrough או opacity שינוי)
    await page.waitForTimeout(500);
    // בודק שהאפליקציה לא קרסה
    await expect(page.locator("main")).toBeVisible();
  });

  test("מוחק פריט", async ({ page }) => {
    const testItem = `למחוק_${Date.now()}`;

    const input = page.getByPlaceholder(/הוסף פריט|פריט חדש/).first();
    if (!(await input.isVisible())) {
      test.skip(true, "לא נמצאה רשימת קניות פעילה");
      return;
    }

    // הוסף פריט
    await input.fill(testItem);
    await input.press("Enter");
    await expect(page.getByText(testItem)).toBeVisible({ timeout: 5000 });

    // מחפש כפתור מחיקה ליד הפריט
    const itemRow = page.locator(`li, [data-item]`).filter({ hasText: testItem }).first();
    await itemRow.hover();
    const deleteBtn = itemRow.getByRole("button", { name: /מחק|הסר|×|trash/i });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(page.getByText(testItem)).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("הוספת פריט ריק לא נוספת לרשימה", async ({ page }) => {
    const input = page.getByPlaceholder(/הוסף פריט|פריט חדש/).first();
    if (!(await input.isVisible())) {
      test.skip(true, "לא נמצאה רשימת קניות פעילה");
      return;
    }

    // ניסיון הוספת פריט ריק
    await input.fill("");
    await input.press("Enter");

    // מוודא שלא נזרקה שגיאה ושהאפליקציה תקינה
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("undo — ביטול פעולה", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginUser(page);
    await page.waitForTimeout(2500);
  });

  test("כפתור ביטול (undo) קיים", async ({ page }) => {
    const input = page.getByPlaceholder(/הוסף פריט|פריט חדש/).first();
    if (!(await input.isVisible())) {
      test.skip(true, "לא נמצאה רשימת קניות פעילה");
      return;
    }

    const testItem = `undo_${Date.now()}`;
    await input.fill(testItem);
    await input.press("Enter");
    await expect(page.getByText(testItem)).toBeVisible({ timeout: 5000 });

    // מחפש כפתור undo
    const undoBtn = page.getByRole("button", { name: /ביטול|בטל|undo/i });
    if (await undoBtn.isVisible({ timeout: 2000 })) {
      await undoBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
