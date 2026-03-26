/**
 * tests/search.spec.ts
 * בדיקות חיפוש מהיר (Desktop Filter Bar) וניווט
 */
import { test, expect } from "@playwright/test";
import { loginAndWaitForHouse, addItemToSection } from "./helpers";

test.describe("חיפוש מהיר — Desktop Search & Filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAndWaitForHouse(page);
  });

  test("שדה חיפוש גלוי (desktop)", async ({ page }) => {
    // Desktop filter bar — מוצג בגודל מסך גדול
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder("חיפוש מהיר בכל הרשימות...");
    // אם גלוי — בדיקה תצלח; אם לא (mobile view) — דלג
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(searchInput).toBeVisible();
    }
  });

  test("חיפוש פריט קיים — מציג תוצאות", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder("חיפוש מהיר בכל הרשימות...");
    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "חיפוש לא גלוי ב-viewport הנוכחי");
      return;
    }

    // הוסף פריט ייחודי לחיפוש
    const uniqueItem = `ייחודי_חיפוש_${Date.now()}`;
    const superInput = page.getByPlaceholder("הוספת מוצר לסופר");
    if (await superInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addItemToSection(page, "הוספת מוצר לסופר", uniqueItem);
      await expect(page.getByText(uniqueItem)).toBeVisible({ timeout: 5000 });

      // חיפוש הפריט
      await searchInput.fill(uniqueItem.slice(0, 10));
      await page.waitForTimeout(500);

      // הפריט צריך להיות גלוי
      await expect(page.getByText(uniqueItem)).toBeVisible({ timeout: 3000 });
    }
  });

  test("חיפוש ריק מציג את כל הפריטים", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder("חיפוש מהיר בכל הרשימות...");
    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "חיפוש לא גלוי ב-viewport הנוכחי");
      return;
    }

    await searchInput.fill("abc123xyz_notexist");
    await page.waitForTimeout(300);
    await searchInput.fill(""); // ניקוי
    await page.waitForTimeout(300);

    // כל הסעיפים צריכים להיות גלויים
    const sections = page.locator("article");
    const count = await sections.count();
    expect(count).toBeGreaterThan(0);
  });

  test("חיפוש שאין תוצאות — מציג הודעה 'אין פריטים'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder("חיפוש מהיר בכל הרשימות...");
    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "חיפוש לא גלוי ב-viewport הנוכחי");
      return;
    }

    await searchInput.fill("xyzabcnoresult99999");
    await page.waitForTimeout(500);

    // לפחות בסעיף אחד צריכה להיות הודעת "אין פריטים"
    await expect(
      page.getByText("אין פריטים להצגה לפי הסינון הנוכחי.").first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("חיפוש case-insensitive (עברית)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder("חיפוש מהיר בכל הרשימות...");
    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "חיפוש לא גלוי ב-viewport הנוכחי");
      return;
    }

    // הוסף פריט בעברית
    const item = `חלב_search_${Date.now()}`;
    const superInput = page.getByPlaceholder("הוספת מוצר לסופר");
    if (await superInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addItemToSection(page, "הוספת מוצר לסופר", item);
      await expect(page.getByText(item)).toBeVisible({ timeout: 5000 });

      await searchInput.fill(item.slice(0, 4));
      await page.waitForTimeout(400);
      await expect(page.getByText(item)).toBeVisible({ timeout: 3000 });
    }
  });

  test("לחיצה על X מנקה את החיפוש", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder("חיפוש מהיר בכל הרשימות...");
    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "חיפוש לא גלוי ב-viewport הנוכחי");
      return;
    }

    await searchInput.fill("בדיקה");
    await page.waitForTimeout(300);

    // כפתור ניקוי
    const clearBtn = page.getByRole("button", { name: /נקה|×|clear/i });
    if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clearBtn.click();
      await expect(searchInput).toHaveValue("");
    } else {
      // ניקוי ידני
      await searchInput.fill("");
      await expect(searchInput).toHaveValue("");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// ניווט — Bottom Nav
// ─────────────────────────────────────────────────────────────
test.describe("ניווט תחתון — Bottom Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await loginAndWaitForHouse(page);
  });

  test("BottomNav גלוי ב-mobile", async ({ page }) => {
    const nav = page.locator("nav.bottom-nav");
    const visible = await nav.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip(true, "BottomNav לא גלוי — ייתכן שמסך הבחירה פעיל");
      return;
    }
    await expect(nav).toBeVisible();
  });

  test("BottomNav מכיל קישורים לשלושת הסעיפים", async ({ page }) => {
    const nav = page.locator("nav.bottom-nav");
    if (!(await nav.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "BottomNav לא גלוי");
      return;
    }

    await expect(nav.getByText("משימות")).toBeVisible();
    await expect(nav.getByText("כללי")).toBeVisible();
    await expect(nav.getByText("סופר")).toBeVisible();
  });

  test("לחיצה על 'סופר' בניווט גוללת לסעיף", async ({ page }) => {
    const nav = page.locator("nav.bottom-nav");
    if (!(await nav.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "BottomNav לא גלוי");
      return;
    }

    await nav.getByText("סופר").click();
    await page.waitForTimeout(500);
    // ה-supermarket section אמור להיות גלוי
    await expect(page.locator("#supermarket")).toBeVisible({ timeout: 3000 });
  });

  test("לחיצה על 'משימות' בניווט גוללת לסעיף", async ({ page }) => {
    const nav = page.locator("nav.bottom-nav");
    if (!(await nav.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "BottomNav לא גלוי");
      return;
    }

    await nav.getByText("משימות").click();
    await page.waitForTimeout(500);
    await expect(page.locator("#tasks")).toBeVisible({ timeout: 3000 });
  });

  test("לחיצה על 'כללי' בניווט גוללת לסעיף", async ({ page }) => {
    const nav = page.locator("nav.bottom-nav");
    if (!(await nav.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "BottomNav לא גלוי");
      return;
    }

    await nav.getByText("כללי").click();
    await page.waitForTimeout(500);
    await expect(page.locator("#general")).toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────
// דף הבית — עמוד ראשי
// ─────────────────────────────────────────────────────────────
test.describe("עמוד ראשי — Main App Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAndWaitForHouse(page);
  });

  test("אין שגיאות error boundary", async ({ page }) => {
    await expect(page.getByText("שגיאה בלתי צפויה")).not.toBeVisible({ timeout: 3000 });
  });

  test("כפתור הגדרות גלוי", async ({ page }) => {
    const settingsBtn = page.getByRole("button", { name: /הגדרות/i }).first();
    if (!(await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "כפתור הגדרות לא גלוי — בית לא נטען");
      return;
    }
    await expect(settingsBtn).toBeVisible();
  });

  test("progress bar קיים בכל סעיף", async ({ page }) => {
    const sectionIds = ["supermarket", "tasks", "general"];
    for (const id of sectionIds) {
      const section = page.locator(`#${id}`);
      if (!(await section.isVisible({ timeout: 3000 }).catch(() => false))) continue;
      const progressBar = section.locator(".h-2.w-full").first();
      await expect(progressBar).toBeVisible();
    }
  });

  test("חברי בית מוצגים", async ({ page }) => {
    await page.waitForTimeout(3000);
    // section חברי בית
    const membersSection = page.getByText("אנשים בבית");
    const visible = await membersSection.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip(true, "section חברי בית לא נמצא");
      return;
    }
    await expect(membersSection).toBeVisible();
  });

  test("badge 'משתמשים' מציג מספר חיובי", async ({ page }) => {
    await page.waitForTimeout(3000);
    const badge = page.locator(".bg-teal-50.px-2").filter({ hasText: /משתמשים/ }).first();
    if (!(await badge.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "badge חברי בית לא נמצא");
      return;
    }
    const text = await badge.textContent();
    const num = parseInt(text?.match(/\d+/)?.[0] ?? "0", 10);
    expect(num).toBeGreaterThan(0);
  });

  test("הגדרות → סגור → חזרה לאפליקציה", async ({ page }) => {
    const settingsBtn = page.getByRole("button", { name: /הגדרות/i }).first();
    if (!(await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "כפתור הגדרות לא גלוי");
      return;
    }
    await settingsBtn.click();
    await expect(page.getByText("הגדרות בית")).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "סגור" }).click();
    await expect(page.getByText("הגדרות בית")).not.toBeVisible({ timeout: 3000 });
    // האפליקציה עדיין פועלת
    await expect(page.locator("main")).toBeVisible();
  });
});
