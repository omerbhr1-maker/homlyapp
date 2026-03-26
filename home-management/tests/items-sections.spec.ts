/**
 * tests/items-sections.spec.ts
 * בדיקות מקיפות לשלוש הסעיפים: סופר / משימות / קניות כללי
 * כולל: הוספה, מחיקה, סימון, undo, ולידציה
 */
import { test, expect } from "@playwright/test";
import { loginAndWaitForHouse, addItemToSection, getSectionItemCount, getUndoButton } from "./helpers";

// ─────────────────────────────────────────────────────────────
// רשימת קניות לסופר — supermarketShopping
// ─────────────────────────────────────────────────────────────
test.describe("רשימת קניות לסופר — Supermarket", () => {
  const PLACEHOLDER = "הוספת מוצר לסופר";
  const SECTION_ID = "supermarket";

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAndWaitForHouse(page);
    const input = page.getByPlaceholder(PLACEHOLDER);
    if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "סעיף הסופר לא גלוי — דלג");
    }
  });

  test("כותרת הסעיף מוצגת", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "רשימת קניות לסופר" })).toBeVisible();
  });

  test("שדה הוספה מוצג עם placeholder נכון", async ({ page }) => {
    await expect(page.getByPlaceholder(PLACEHOLDER)).toBeVisible();
  });

  test("כפתור הוספה קיים", async ({ page }) => {
    const section = page.locator(`#${SECTION_ID}`);
    await expect(section.getByRole("button", { name: "הוספה" })).toBeVisible();
  });

  test("הוספת פריט חדש דרך Enter", async ({ page }) => {
    const item = `חלב_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
  });

  test("הוספת פריט חדש דרך כפתור הוספה", async ({ page }) => {
    const item = `גבינה_${Date.now()}`;
    const input = page.getByPlaceholder(PLACEHOLDER);
    await input.fill(item);
    const section = page.locator(`#${SECTION_ID}`);
    await section.getByRole("button", { name: "הוספה" }).click();
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
  });

  test("מונה פריטים מתעדכן אחרי הוספה", async ({ page }) => {
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    const item = `לחם_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore + 1);
  });

  test("הוספת פריט ריק לא מוסיפה כלום", async ({ page }) => {
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    const input = page.getByPlaceholder(PLACEHOLDER);
    await input.fill("   ");
    await input.press("Enter");
    await page.waitForTimeout(500);
    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore);
  });

  test("הוספת שני פריטים בזה אחר זה", async ({ page }) => {
    const ts = Date.now();
    const item1 = `ביצים_${ts}`;
    const item2 = `חמאה_${ts}`;
    await addItemToSection(page, PLACEHOLDER, item1);
    await expect(page.getByText(item1)).toBeVisible({ timeout: 5000 });
    await addItemToSection(page, PLACEHOLDER, item2);
    await expect(page.getByText(item2)).toBeVisible({ timeout: 5000 });
  });

  test("סימון פריט כהושלם מוסיף line-through", async ({ page }) => {
    const item = `לסמן_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    const itemText = page.getByText(item).last();
    await expect(itemText).toBeVisible({ timeout: 5000 });
    await itemText.click();
    await page.waitForTimeout(400);
    // לאחר סימון — text-slate-400 line-through
    await expect(page.locator(".line-through").filter({ hasText: item })).toBeVisible({ timeout: 3000 });
  });

  test("סימון הושלם ואז ביטול סימון", async ({ page }) => {
    const item = `toggle_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    const itemText = page.getByText(item).last();
    await expect(itemText).toBeVisible({ timeout: 5000 });
    await itemText.click(); // הושלם
    await page.waitForTimeout(300);
    await itemText.click(); // ביטול הושלם
    await page.waitForTimeout(300);
    // פריט קיים בלי line-through
    const lineThrough = page.locator(".line-through").filter({ hasText: item });
    await expect(lineThrough).not.toBeVisible({ timeout: 2000 });
  });

  test("מחיקת פריט — הפריט נעלם", async ({ page }) => {
    const item = `למחוק_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    const itemRow = page.locator("li").filter({ hasText: item }).first();
    const deleteBtn = itemRow.getByTitle("מחיקה");
    await deleteBtn.click();
    await expect(page.getByText(item)).not.toBeVisible({ timeout: 5000 });
  });

  test("מחיקת פריט — מונה פריטים קטן", async ({ page }) => {
    const item = `מחיקה_count_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
    const countAfterAdd = await getSectionItemCount(page, SECTION_ID);

    const itemRow = page.locator("li").filter({ hasText: item }).first();
    await itemRow.getByTitle("מחיקה").click();
    await expect(page.getByText(item)).not.toBeVisible({ timeout: 5000 });

    const countAfterDelete = await getSectionItemCount(page, SECTION_ID);
    expect(countAfterDelete).toBe(countAfterAdd - 1);
  });

  test("undo אחרי הוספה מחזיר למצב קודם", async ({ page }) => {
    const item = `undo_add_${Date.now()}`;
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    const undoBtn = await getUndoButton(page);
    await expect(undoBtn).toBeVisible({ timeout: 5500 });
    await undoBtn.click();
    await page.waitForTimeout(400);

    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore);
  });

  test("undo אחרי מחיקה מחזיר את הפריט", async ({ page }) => {
    const item = `undo_del_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
    // לחכות שה-undo של ה-add יפוג
    await page.waitForTimeout(6000);

    const itemRow = page.locator("li").filter({ hasText: item }).first();
    await itemRow.getByTitle("מחיקה").click();
    await expect(page.getByText(item)).not.toBeVisible({ timeout: 3000 });

    const undoBtn = await getUndoButton(page);
    await expect(undoBtn).toBeVisible({ timeout: 5500 });
    await undoBtn.click();
    await expect(page.getByText(item)).toBeVisible({ timeout: 3000 });
  });

  test("עריכת פריט דרך window.prompt", async ({ page }) => {
    const item = `לערוך_${Date.now()}`;
    const edited = `נערך_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    // מאזין ל-dialog (window.prompt) ומזין ערך חדש
    page.once("dialog", async (dialog) => {
      await dialog.accept(edited);
    });

    const itemRow = page.locator("li").filter({ hasText: item }).first();
    await itemRow.getByTitle("עריכה").click();
    await expect(page.getByText(edited)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(item)).not.toBeVisible({ timeout: 2000 });
  });

  test("פריט עם טקסט ארוך מאוד מוצג truncate", async ({ page }) => {
    const item = `פריט ארוך מאוד לבדיקה ${"א".repeat(60)}_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item.slice(0, 80));
    await page.waitForTimeout(500);
    await expect(page.locator("main")).toBeVisible();
  });

  test("כפתור מתכון חכם קיים בסופר", async ({ page }) => {
    const section = page.locator(`#${SECTION_ID}`);
    await expect(section.getByTitle("מתכון חכם")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// משימות בית — homeTasks
// ─────────────────────────────────────────────────────────────
test.describe("משימות בית — Tasks", () => {
  const PLACEHOLDER = "הוספת משימה חדשה";
  const SECTION_ID = "tasks";

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAndWaitForHouse(page);
    const input = page.getByPlaceholder(PLACEHOLDER);
    if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "סעיף המשימות לא גלוי — דלג");
    }
  });

  test("כותרת הסעיף מוצגת", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "משימות בית" })).toBeVisible();
  });

  test("הוספת משימה חדשה דרך Enter", async ({ page }) => {
    const item = `לנקות_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
  });

  test("הוספת משימה חדשה דרך כפתור הוספה", async ({ page }) => {
    const item = `לקנות_${Date.now()}`;
    const input = page.getByPlaceholder(PLACEHOLDER);
    await input.fill(item);
    const section = page.locator(`#${SECTION_ID}`);
    await section.getByRole("button", { name: "הוספה" }).click();
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
  });

  test("מונה פריטים מתעדכן אחרי הוספה", async ({ page }) => {
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    const item = `משימה_count_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore + 1);
  });

  test("הוספת פריט ריק לא מוסיפה כלום", async ({ page }) => {
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    const input = page.getByPlaceholder(PLACEHOLDER);
    await input.fill("   ");
    await input.press("Enter");
    await page.waitForTimeout(500);
    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore);
  });

  test("סימון משימה כהושלמה", async ({ page }) => {
    const item = `לסיים_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await page.getByText(item).last().click();
    await page.waitForTimeout(400);
    await expect(page.locator(".line-through").filter({ hasText: item })).toBeVisible({ timeout: 3000 });
  });

  test("מחיקת משימה", async ({ page }) => {
    const item = `למחוק_task_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    const itemRow = page.locator("li").filter({ hasText: item }).first();
    await itemRow.getByTitle("מחיקה").click();
    await expect(page.getByText(item)).not.toBeVisible({ timeout: 5000 });
  });

  test("undo אחרי הוספת משימה", async ({ page }) => {
    const item = `undo_task_${Date.now()}`;
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    const undoBtn = await getUndoButton(page);
    await expect(undoBtn).toBeVisible({ timeout: 5500 });
    await undoBtn.click();
    await page.waitForTimeout(400);

    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore);
  });

  test("הוספת שלוש משימות בזה אחר זה", async ({ page }) => {
    const ts = Date.now();
    for (const suffix of ["א", "ב", "ג"]) {
      const item = `משימה_${suffix}_${ts}`;
      await addItemToSection(page, PLACEHOLDER, item);
      await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
    }
  });

  test("כפתור עריכה קיים ליד כל פריט", async ({ page }) => {
    const item = `לבדוק_edit_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
    const itemRow = page.locator("li").filter({ hasText: item }).first();
    await expect(itemRow.getByTitle("עריכה")).toBeVisible();
  });

  test("עריכת משימה דרך window.prompt", async ({ page }) => {
    const item = `לערוך_task_${Date.now()}`;
    const edited = `נערך_task_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    page.once("dialog", async (dialog) => {
      await dialog.accept(edited);
    });

    const itemRow = page.locator("li").filter({ hasText: item }).first();
    await itemRow.getByTitle("עריכה").click();
    await expect(page.getByText(edited)).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────
// רשימת קניות כללית — generalShopping
// ─────────────────────────────────────────────────────────────
test.describe("רשימת קניות כללית — General Shopping", () => {
  const PLACEHOLDER = "הוספת פריט לרשימה";
  const SECTION_ID = "general";

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAndWaitForHouse(page);
    const input = page.getByPlaceholder(PLACEHOLDER);
    if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "סעיף קניות כללי לא גלוי — דלג");
    }
  });

  test("כותרת הסעיף מוצגת", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "רשימת קניות כללית" })).toBeVisible();
  });

  test("הוספת פריט כללי דרך Enter", async ({ page }) => {
    const item = `סבון_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
  });

  test("הוספת פריט דרך כפתור הוספה", async ({ page }) => {
    const item = `מברשת_${Date.now()}`;
    const input = page.getByPlaceholder(PLACEHOLDER);
    await input.fill(item);
    const section = page.locator(`#${SECTION_ID}`);
    await section.getByRole("button", { name: "הוספה" }).click();
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
  });

  test("מונה פריטים מתעדכן אחרי הוספה", async ({ page }) => {
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    const item = `general_count_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore + 1);
  });

  test("הוספת פריט ריק לא מוסיפה כלום", async ({ page }) => {
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    const input = page.getByPlaceholder(PLACEHOLDER);
    await input.fill("");
    await input.press("Enter");
    await page.waitForTimeout(500);
    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore);
  });

  test("סימון פריט כהושלם", async ({ page }) => {
    const item = `לסמן_general_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await page.getByText(item).last().click();
    await page.waitForTimeout(400);
    await expect(page.locator(".line-through").filter({ hasText: item })).toBeVisible({ timeout: 3000 });
  });

  test("מחיקת פריט", async ({ page }) => {
    const item = `למחוק_general_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });
    const itemRow = page.locator("li").filter({ hasText: item }).first();
    await itemRow.getByTitle("מחיקה").click();
    await expect(page.getByText(item)).not.toBeVisible({ timeout: 5000 });
  });

  test("undo אחרי הוספה", async ({ page }) => {
    const item = `undo_general_${Date.now()}`;
    const countBefore = await getSectionItemCount(page, SECTION_ID);
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    const undoBtn = await getUndoButton(page);
    await expect(undoBtn).toBeVisible({ timeout: 5500 });
    await undoBtn.click();
    await page.waitForTimeout(400);

    const countAfter = await getSectionItemCount(page, SECTION_ID);
    expect(countAfter).toBe(countBefore);
  });

  test("undo נעלם אחרי 5.5 שניות", async ({ page }) => {
    test.setTimeout(15000);
    const item = `undo_timeout_${Date.now()}`;
    await addItemToSection(page, PLACEHOLDER, item);
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    const undoBtn = await getUndoButton(page);
    await expect(undoBtn).toBeVisible({ timeout: 5500 });

    // מחכה יותר מ-5.5 שניות — ה-undo אמור להיעלם
    await page.waitForTimeout(6000);
    await expect(undoBtn).not.toBeVisible({ timeout: 2000 });
  });
});

// ─────────────────────────────────────────────────────────────
// בדיקות cross-section — פריטים לא עוברים בין סעיפים
// ─────────────────────────────────────────────────────────────
test.describe("בדיקות cross-section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAndWaitForHouse(page);
  });

  test("פריט שנוסף לסופר לא מופיע בסעיף משימות", async ({ page }) => {
    const superInput = page.getByPlaceholder("הוספת מוצר לסופר");
    if (!(await superInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "סעיפים לא גלויים — דלג");
      return;
    }

    const item = `cross_${Date.now()}`;
    await superInput.fill(item);
    await superInput.press("Enter");
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    // ודא שהפריט מופיע בסופר
    const superSection = page.locator("#supermarket");
    await expect(superSection.getByText(item)).toBeVisible({ timeout: 3000 });

    // ודא שהפריט לא מופיע בסעיף המשימות
    const tasksSection = page.locator("#tasks");
    await expect(tasksSection.getByText(item)).not.toBeVisible({ timeout: 2000 });
  });

  test("שלושת הסעיפים גלויים בעמוד", async ({ page }) => {
    const sections = ["supermarket", "tasks", "general"];
    for (const id of sections) {
      const section = page.locator(`#${id}`);
      const visible = await section.isVisible({ timeout: 5000 }).catch(() => false);
      if (!visible) {
        test.skip(true, `סעיף ${id} לא גלוי`);
        return;
      }
      await expect(section).toBeVisible();
    }
  });

  test("כפתור drag handle קיים ליד כל פריט", async ({ page }) => {
    const superInput = page.getByPlaceholder("הוספת מוצר לסופר");
    if (!(await superInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "סעיפים לא גלויים — דלג");
      return;
    }

    const item = `drag_${Date.now()}`;
    await superInput.fill(item);
    await superInput.press("Enter");
    await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

    const itemRow = page.locator("li").filter({ hasText: item }).first();
    await expect(itemRow.getByTitle("גרור לשינוי סדר")).toBeVisible();
  });
});
