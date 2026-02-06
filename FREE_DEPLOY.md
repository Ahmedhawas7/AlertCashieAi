# دليل النشـر المجاني 24/7 (AlertCashie Deployment Guide) 🚀

الدليل ده هيشرحلك خطوة بخطوة إزاي تشغل **AlertCashie** على سيرفرات **Render** (الخطة المجانية) وتستخدم **Supabase** (قاعدة بيانات Postgres مجانية) عشان البيانات متضيعش لما السيرفر يعمل ريستارت. وكمان هنستخدم **UptimeRobot** عشان يفضل البوت شغال 24 ساعة ومينمش.

---

## ⚡ 1. تجهيز قاعدة البيانات (Supabase Setup)

عشان البيانات (Users, Settings, Memory) متتمسحش، هنستخدم Supabase.
1. ادخل على [supabase.com](https://supabase.com) واعمل حساب جديد.
2. اعمل **New Project**:
   - **Name**: AlertCashie
   - **Database Password**: اكتب باسورد قوية واحفظها كويس جداً (هنحتاجها).
   - **Region**: اختار أقرب مكان ليك (مثلاً Frankfurt).
3. بعد ما المشروع يجهز (بياخد دقيقتين):
   - روح على **Project Settings (الترس)** -> **Database**.
   - انسخ الـ **Connection String** (تأكد إنك مختار تبويب `URI` مش `JDBC`).
   - الشكل هيكون كده:
     `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
   - **مهم جداً**: ضيف `?sslmode=require` في آخر الرابط.

> **⚠️ تحذير بخصوص الباسورد (URL Encoding):**
> لو الباسورد بتاعتك فيها رموز خاصة زي `@`, `#`, `/` لازم تحولها لـ URL Encoded وإلا الاتصال هيفشل.
> - `@` تبقى `%40`
> - `:` تبقى `%3A`
> - `/` تبقى `%2F`
> - `#` تبقى `%23`
> - `?` تبقى `%3F`
>
> **مثال:** لو الباسورد `P@ssword#123` الرابط هيكون:
> `...:P%40ssword%23123@...`

---

## 🛠️ 2. تحديث الكود (Prisma)

عشان نستخدم Postgres بدل SQLite، لازم نعدل ملف `prisma/schema.prisma` في الكود عندك **قبل الرفع**:

1. افتح ملف `prisma/schema.prisma`.
2. غير السطر ده:
   ```prisma
   provider = "sqlite"
   ```
   خليه:
   ```prisma
   provider = "postgresql"
   ```
3. احفظ الملف.
4. **يفضل تعمل الخطوة دي محلياً (Locally) الأول:**
   - في الترمينال عندك، اكتب:
     ```bash
     export DATABASE_URL="الرابط_بتاع_supabase_كامل"
     npx prisma generate
     npx prisma db push
     ```
   - لو طلعلك `🚀 Your database is now in sync with your Prisma schema.` يبقى كله تمام!

---

## ☁️ 3. الرفع على Render (Deploy)

1. اعمل حساب على [render.com](https://render.com).
2. دوس **New** -> **Web Service**.
3. اربط حساب GitHub بتاعك واختار الريبو (Repo) بتاع البوت.
4. **الإعدادات (Settings):**
   - **Name**: `alert-cashie-bot` (أو أي اسم).
   - **Environment**: `Node`.
   - **Region**: Frankfurt (أو زي ما تحب).
   - **Branch**: `main`.
   - **Build Command**: (مهم جداً تكتبه صح)
     ```bash
     npm ci && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Instance Type**: `Free`.

5. **المتغيرات (Environment Variables):**
   انزل تحت لـ **Environment Variables** وضيف دول واحد واحد (أو استخدم Bulk Editor):

   ```env
   BOT_TOKEN=<Your_Telegram_Bot_Token>
   TELEGRAM_ADMIN_IDS=<Your_ID>
   DATABASE_URL=postgresql://postgres:[Ahmedhawas47]@db.onuiahsqoufqgcfbecoz.supabase.co:5432/postgres?sslmode=require
   GEMINI_API_KEY=<Optional_AI_Key>
   AI_MAX_CALLS_PER_DAY=10
   AI_COOLDOWN_SECONDS=30
   WATCHDOG_MINUTES=10
   RPC_CIRCUIT_BREAKER_ERRORS=5
   RPC_CIRCUIT_BREAKER_COOLDOWN_SECONDS=120
   BASE_RPC_URL=https://mainnet.base.org
   MEDIUM_RSS_URL=https://medium.com/feed/@carv_official
   ```
   *(ملاحظة: تأكد إنك غيرت `[Ahmedhawas47]` بالباسورد الحقيقية بتاعتك في `DATABASE_URL`)*

6. دوس **Create Web Service**.
7. استنى لحد ما الـ Deploy يخلص (بياخد حوالي 3-5 دقايق).
8. لما تشوف في الـ Logs كلمة `✅ Bot is online and proactive` يبقى البوت اشتغل!

---

## 💓 4. تشغيل 24/7 (UptimeRobot)

سيرفرات Render المجانية بتنام بعد 15 دقيقة لو مفيش حد كلمها. عشان نمنع ده:

1. ادخل على [uptimerobot.com](https://uptimerobot.com) وسجل دخول.
2. دوس **Add New Monitor**.
3. **Monitor Type**: `HTTP(s)`.
4. **Friendly Name**: `AlertCashie`.
5. **URL (or IP)**:
   - خد رابط موقعك من Render (بيكون شكله `https://alert-cashie.onrender.com`).
   - زود عليه `/health`.
   - الرابط النهائي: `https://alert-cashie.onrender.com/health`.
6. **Monitoring Interval**: `5 minutes`.
7. دوس **Create Monitor**.

بكده UptimeRobot هيبعت "ping" للبوت كل 5 دقايق عشان يفضل صاحي، واستخدمنا `/health` عشان دي خفيفة وسريعة ومش بتسحب موارد.

---

## ✅ 5. التأكد من التشغيل (Verification)

1. **Telegram**: ابعت `/start` للبوت وتأكد إنه بيرد.
2. **Health**: ادخل على رابط `/health` في المتصفح، المفروض تشوف `status: ok` وإحصائيات سريعة.
3. **Logs**: في Render Dashboard، تأكد مفيش أخطاء (Errors) خاصة بالـ Database.
4. **Persistence**:
   - اعمل `/ai on` للبوت.
   - اعمل ريستارت للسيرفر من Render (Manual Deploy -> Clear cache and deploy).
   - لما يرجع، اكتب `/ai status`، المفروض يفضل `ON`. لو رجع `OFF` يبقى الداتابيز مش مربوطة صح.

---

## 🔧 6. مشاكل وحلول (Troubleshooting)

- **خطأ في الاتصال بالداتابيز (Connection Error):**
  - تأكد إنك ضفت `?sslmode=require` في آخر الرابط.
  - تأكد إن الباسورد مكتوبة صح ومعمولة URL Encoded لو فيها رموز.
  - تأكد إنك عملت `npx prisma db push` لو بتجرب محلياً الأول.

- **البوت بينام:**
  - تأكد إن UptimeRobot شغال والـ Status = 200.
  - تأكد إنك بتعمل Ping على `/health` مش الصفحة الرئيسية (عشان `/health` أسرع).

- **خطأ Prisma Client:**
  - تأكد إن `Build Command` فيه `npx prisma generate`. ده اللي بيبني ملفات التواصل مع الداتابيز.

---

### 🚀 Quick Start (Copy-Paste Env Vars)

**Key** | **Value**
--- | ---
`BOT_TOKEN` | *[Your Token]*
`TELEGRAM_ADMIN_IDS` | *[Your Telegram ID]*
`DATABASE_URL` | `postgresql://postgres:[Ahmedhawas47]@db.onuiahsqoufqgcfbecoz.supabase.co:5432/postgres?sslmode=require`
`GEMINI_API_KEY` | *[Your Gemini Key]*
`AI_MAX_CALLS_PER_DAY` | `10`
`BASE_RPC_URL` | `https://mainnet.base.org`
`WATCHDOG_MINUTES` | `10`
