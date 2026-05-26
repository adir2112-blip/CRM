# הוראות העלאה — CRM System

## שלב 1: הכן את הקבצים במחשב שלך

1. צור תיקיה חדשה בשם `crm-system`
2. העתק את כל הקבצים מהפרויקט לתיקיה

## שלב 2: התקן תלויות

פתח Terminal / CMD בתוך תיקיית הפרויקט:

```bash
npm install
```

## שלב 3: הגדר משתני סביבה

1. שנה שם הקובץ `.env.local.example` ל-`.env.local`
2. פתח אותו ומלא:

```
NEXT_PUBLIC_SUPABASE_URL=https://khucibpmwfpcobfvlibw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_NEW_ANON_KEY_HERE
```

⚠️ החלף את `YOUR_NEW_ANON_KEY_HERE` עם המפתח החדש שיצרת לאחר ה-regenerate

## שלב 4: הגדר את Supabase

### א. הרץ את ה-SQL Schema

1. כנס ל-https://supabase.com → הפרויקט שלך
2. לחץ על **SQL Editor** בתפריט הצדדי
3. לחץ **New Query**
4. העתק את כל תוכן הקובץ `supabase_schema.sql` והדבק
5. לחץ **Run** (Ctrl+Enter)

### ב. הגדר Authentication

1. ב-Supabase → **Authentication** → **Providers**
2. ודא ש-**Email** מופעל
3. ב-**Authentication** → **Settings**:
   - כבה "Enable email confirmations" (לצורך דמו)
   - או השאר דלוק ואז מיילים ישלחו לאישור

### ג. צור משתמש מנהל ראשון

1. ב-Supabase → **Authentication** → **Users**
2. לחץ **Invite User** או **Add User**
3. הכנס מייל וסיסמא
4. אחרי שהמשתמש נוצר, עבור ל-**Table Editor** → טבלת `profiles`
5. מצא את המשתמש ושנה את `role` מ-`agent` ל-`admin`

## שלב 5: בדוק מקומית

```bash
npm run dev
```

פתח http://localhost:3000 ובדוק שהכל עובד.

## שלב 6: העלה ל-GitHub

```bash
git init
git add .
git commit -m "Initial CRM system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

⚠️ ודא שהקובץ `.env.local` **לא** עולה (הוא ב-.gitignore)

## שלב 7: פרוס ב-Vercel

1. כנס ל-https://vercel.com
2. לחץ **New Project**
3. בחר את ה-repo מ-GitHub
4. לחץ **Import**
5. תחת **Environment Variables** הוסף:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://khucibpmwfpcobfvlibw.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = [המפתח החדש שלך]
6. לחץ **Deploy**

Vercel יבנה את הפרויקט (כ-2 דקות) ויתן לך URL.

## שלב 8: הוסף נציגים

1. כנס ל-CRM עם חשבון המנהל
2. עבור ל-**ניהול** → **משתמשים**
3. הוסף כל נציג עם מייל וסיסמא

---

## בעיות נפוצות

### "Invalid API Key"
המפתח ב-.env.local לא תואם. ב-Supabase → Settings → API → העתק מחדש.

### "relation does not exist"
ה-SQL לא רץ. חזור לשלב 4א ורוץ שוב.

### הפרופיל לא נוצר אוטומטית
עבור ב-Supabase → SQL Editor והרץ:
```sql
insert into profiles (id, full_name, role)
select id, email, 'admin'
from auth.users
where id not in (select id from profiles);
```

---

## עדכון קוד בעתיד

כל push ל-GitHub יעדכן את Vercel אוטומטית:
```bash
git add .
git commit -m "תיאור השינוי"
git push
```
