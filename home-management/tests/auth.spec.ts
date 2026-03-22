import { test, expect } from "@playwright/test";
import { loginUser, expectError, waitForApp, TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./helpers";

test.describe("מסך כניסה — Login Screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("מציג את מסך ההתחברות בטעינה ראשונית", async ({ page }) => {
    await expect(page.getByPlaceholder("מייל/שם משתמש")).toBeVisible();
    await expect(page.getByPlaceholder("סיסמה")).toBeVisible();
    await expect(page.getByRole("button", { name: "התחבר", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "שכחתי סיסמה" })).toBeVisible();
  });

  test("כפתורי טאב — מעבר בין התחברות ליצירת משתמש", async ({ page }) => {
    // ברירת מחדל: מצב התחברות
    await expect(page.getByRole("button", { name: "התחבר", exact: true })).toBeVisible();

    // מעבר ליצירת משתמש
    await page.getByRole("button", { name: "יצירת משתמש" }).click();
    await expect(page.getByRole("button", { name: "צור משתמש" })).toBeVisible();
    await expect(page.getByPlaceholder("שם מלא להצגה")).toBeVisible();
    await expect(page.getByPlaceholder("אימייל (לכניסה ולאיפוס סיסמה)")).toBeVisible();

    // חזרה להתחברות
    await page.getByRole("button", { name: "התחברות משתמש" }).click();
    await expect(page.getByRole("button", { name: "התחבר", exact: true })).toBeVisible();
  });
});

test.describe("כניסה — Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("כניסה תקינה עם אימייל וסיסמה", async ({ page }) => {
    await loginUser(page);
    // לאחר כניסה — מסך הבית מופיע (אין כפתור התחבר)
    await expect(page.getByRole("button", { name: "התחבר", exact: true })).not.toBeVisible();
  });

  test("כניסה שגויה — אימייל ריק", async ({ page }) => {
    await page.getByRole("button", { name: "התחבר", exact: true }).click();
    await expectError(page, "יש להזין אימייל וסיסמה.");
  });

  test("כניסה שגויה — סיסמה ריקה", async ({ page }) => {
    await page.getByPlaceholder("מייל/שם משתמש").fill(TEST_USER_EMAIL);
    await page.getByRole("button", { name: "התחבר", exact: true }).click();
    await expectError(page, "יש להזין אימייל וסיסמה.");
  });

  test("כניסה שגויה — סיסמה לא נכונה", async ({ page }) => {
    await page.getByPlaceholder("מייל/שם משתמש").fill(TEST_USER_EMAIL);
    await page.getByPlaceholder("סיסמה", { exact: true }).fill("wrongpassword999");
    await page.getByRole("button", { name: "התחבר", exact: true }).click();
    await expectError(page, "אימייל או סיסמה לא נכונים.");
  });

  test("כניסה שגויה — אימייל לא קיים", async ({ page }) => {
    await page.getByPlaceholder("מייל/שם משתמש").fill("notexist@homly.app");
    await page.getByPlaceholder("סיסמה", { exact: true }).fill("SomePass123!");
    await page.getByRole("button", { name: "התחבר", exact: true }).click();
    await expectError(page, "אימייל או סיסמה לא נכונים.");
  });

  test("כפתור התחבר מציג מצב טעינה", async ({ page }) => {
    await page.getByPlaceholder("מייל/שם משתמש").fill(TEST_USER_EMAIL);
    await page.getByPlaceholder("סיסמה", { exact: true }).fill(TEST_USER_PASSWORD);
    await page.getByRole("button", { name: "התחבר", exact: true }).click();
    // מיד לאחר לחיצה — מציג "טוען..."
    await expect(page.getByRole("button", { name: "טוען..." })).toBeVisible({ timeout: 2000 });
  });
});

test.describe("שכחתי סיסמה — Forgot Password", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await page.getByRole("button", { name: "שכחתי סיסמה" }).click();
  });

  test("מציג את חלון שחזור הסיסמה", async ({ page }) => {
    await expect(page.getByText("שחזור סיסמה")).toBeVisible();
    await expect(page.getByPlaceholder("אימייל")).toBeVisible();
    await expect(page.getByRole("button", { name: "שלח קישור איפוס" })).toBeVisible();
  });

  test("סגירת חלון שחזור הסיסמה", async ({ page }) => {
    await page.getByRole("button", { name: "סגור" }).click();
    await expect(page.getByText("שחזור סיסמה")).not.toBeVisible();
  });

  test("שגיאה — אימייל ריק", async ({ page }) => {
    await page.getByRole("button", { name: "שלח קישור איפוס" }).click();
    await expectError(page, "יש להזין אימייל.");
  });

  test("שגיאה — פורמט אימייל לא תקין", async ({ page }) => {
    await page.getByPlaceholder("אימייל").fill("notanemail");
    await page.getByRole("button", { name: "שלח קישור איפוס" }).click();
    await expectError(page, "לאיפוס סיסמה חייבים להזין אימייל תקין.");
  });

  test("שליחת קישור איפוס — API מגיב (אימייל קיים)", async ({ page }) => {
    test.setTimeout(30000);
    await page.getByPlaceholder("אימייל").fill(TEST_USER_EMAIL);
    await page.getByRole("button", { name: "שלח קישור איפוס" }).click();
    // מחכה לתגובה — הצלחה או שגיאה (rate limit) — שניהם מעידים שה-API הגיב
    await expect(
      page.getByText(/אם המשתמש קיים|לא הצלחתי לשלוח/)
    ).toBeVisible({ timeout: 15000 });
  });

  test("שליחת קישור איפוס — הצלחה (אימייל לא קיים — הודעה כללית מסיבות אבטחה)", async ({ page }) => {
    test.setTimeout(30000);
    await page.getByPlaceholder("אימייל").fill("doesnotexist@homly.app");
    await page.getByRole("button", { name: "שלח קישור איפוס" }).click();
    // Supabase מחזיר הצלחה גם אם האימייל לא קיים (למניעת user enumeration)
    await expect(page.getByText(/אם המשתמש קיים/)).toBeVisible({ timeout: 15000 });
  });

  test("כפתור שלח מציג מצב טעינה", async ({ page }) => {
    await page.getByPlaceholder("אימייל").fill(TEST_USER_EMAIL);
    await page.getByRole("button", { name: "שלח קישור איפוס" }).click();
    await expect(page.getByRole("button", { name: "שולח..." })).toBeVisible({ timeout: 2000 });
  });
});

test.describe("יצירת משתמש — Signup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await page.getByRole("button", { name: "יצירת משתמש" }).click();
  });

  test("ולידציה — שם משתמש קצר מ-3 תווים", async ({ page }) => {
    await page.getByPlaceholder("שם מלא להצגה").fill("ישראל");
    await page.getByPlaceholder("אימייל (לכניסה ולאיפוס סיסמה)").fill("new@test.com");
    await page.getByPlaceholder("שם משתמש").fill("ab");
    await page.getByPlaceholder("סיסמה", { exact: true }).fill("Test123!");
    await page.getByRole("button", { name: "צור משתמש" }).click();
    await expectError(page, "שם משתמש חייב להכיל לפחות 3 תווים.");
  });

  test("ולידציה — אימייל לא תקין", async ({ page }) => {
    await page.getByPlaceholder("שם מלא להצגה").fill("ישראל ישראלי");
    await page.getByPlaceholder("אימייל (לכניסה ולאיפוס סיסמה)").fill("notanemail");
    await page.getByPlaceholder("שם משתמש").fill("israel123");
    await page.getByPlaceholder("סיסמה", { exact: true }).fill("Test123!");
    await page.getByRole("button", { name: "צור משתמש" }).click();
    await expectError(page, "יש להזין אימייל תקין.");
  });

  test("ולידציה — סיסמה קצרה מ-4 תווים", async ({ page }) => {
    await page.getByPlaceholder("שם מלא להצגה").fill("ישראל ישראלי");
    await page.getByPlaceholder("אימייל (לכניסה ולאיפוס סיסמה)").fill("newuser@test.com");
    await page.getByPlaceholder("שם משתמש").fill("israel123");
    await page.getByPlaceholder("סיסמה", { exact: true }).fill("ab");
    await page.getByRole("button", { name: "צור משתמש" }).click();
    await expectError(page, "סיסמה חייבת להיות לפחות 4 תווים.");
  });

  test("ולידציה — שם תצוגה קצר מ-2 תווים", async ({ page }) => {
    await page.getByPlaceholder("שם מלא להצגה").fill("א");
    await page.getByPlaceholder("אימייל (לכניסה ולאיפוס סיסמה)").fill("newuser@test.com");
    await page.getByPlaceholder("שם משתמש").fill("israel123");
    await page.getByPlaceholder("סיסמה", { exact: true }).fill("Test123!");
    await page.getByRole("button", { name: "צור משתמש" }).click();
    await expectError(page, "שם מלא חייב להכיל לפחות 2 תווים.");
  });

  test("ולידציה — אימייל כבר רשום", async ({ page }) => {
    await page.getByPlaceholder("שם מלא להצגה").fill("ישראל ישראלי");
    await page.getByPlaceholder("אימייל (לכניסה ולאיפוס סיסמה)").fill(TEST_USER_EMAIL);
    await page.getByPlaceholder("שם משתמש").fill("newuser999");
    await page.getByPlaceholder("סיסמה", { exact: true }).fill("Test123!");
    await page.getByRole("button", { name: "צור משתמש" }).click();
    await expectError(page, "האימייל כבר רשום במערכת.");
  });
});
