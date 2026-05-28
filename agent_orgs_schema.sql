-- טבלת מחלקות לנציגים
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_orgs text[] DEFAULT NULL;
-- NULL = גישה לכל הארגונים (מנהל)
-- מערך ריק = אין גישה
-- מערך עם IDs = גישה לארגונים הספציפיים
