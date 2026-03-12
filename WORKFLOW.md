# Homly Workflow

## מה קיים

- `home-management`:
  פרויקט הווב הראשי.
- `home-management-appstore`:
  פרויקט iOS (Capacitor + Xcode) שמבוסס על הווב.

## תהליך עבודה מומלץ

1. מפתחים תמיד בתוך:
   `home-management`
2. מסנכרנים את קבצי הווב ל־App Store:
   `./scripts/sync-web-to-appstore.sh`
3. אם צריך גם לעדכן dependencies ו־iOS native:
   `./scripts/sync-web-to-appstore.sh --install --ios-sync`
4. מריצים בדיקות לשני הפרויקטים:
   `./scripts/verify-all.sh`

## מה הסנכרון מעדכן

- מסנכרן מ־ווב ל־App Store:
  `src`, `public`, `supabase`, וקבצי קונפיג נפוצים.
- ממזג `package.json` לפי הווב,
  ושומר ב־App Store את הסקריפטים של iOS:
  `build:ios`, `ios:sync`, `ios:open`.
- `eslint.config.mjs` של App Store נשאר ייעודי (כדי להתעלם מתיקיות `ios/`).

## מה לא משתנה בסנכרון

- `ios/` לא נדרס.
- `capacitor.config.ts` נשאר של פרויקט ה־App Store.
- `.env.local` לא נדרס.
