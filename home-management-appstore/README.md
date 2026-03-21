# Homly

אפליקציית ניהול בית בעברית עם RTL מלא, תמיכה בנייד/מחשב, הקלטה קולית, ומתכון חכם.

## הרצה מקומית

```bash
npm install
npm run dev
```

## מצב ענן (ריבוי משתמשים/בתים)

כדי שכל בית יעבוד בין מכשירים, יש להגדיר Supabase.

1. ליצור פרויקט Supabase.
2. להריץ את הסכמה:
   `supabase/schema.sql`
3. להעתיק את `.env.example` ל-`.env.local` ולהגדיר:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=https://home-management-hebrew.pages.dev
OPENAI_API_KEY=...
```

4. להריץ מחדש `npm run dev`.

הערה חשובה:
- `OPENAI_API_KEY` נשמר בשרת בלבד.
- לא מגדירים `NEXT_PUBLIC_OPENAI_API_KEY`, כדי לא לחשוף מפתח למשתמשים.

אם ה־env לא מוגדרים, האפליקציה עובדת במצב מקומי (`localStorage`) בלבד.

## בנייה

```bash
npm run lint
npm run build
```
