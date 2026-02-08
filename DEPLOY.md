# HX Super Agent - دليل النشر 🚀

## 1. التشغيل المحلي (Local Development)

### الخطوات:
```bash
# 1. تثبيت المكتبات
npm install

# 2. إعداد البيئة
cp .env.example .env
# املأ: BOT_TOKEN, GEMINI_API_KEY, DATABASE_URL

# 3. إعداد قاعدة البيانات
npx prisma generate
npx prisma db push

# 4. تشغيل الوكيل
npm start
```

## 2. النشر المجاني على Render.com

### المتطلبات:
- حساب GitHub
- حساب Render.com (مجاني)

### الخطوات:
1. **ارفع الكود على GitHub**
2. **سجل في Render.com**
3. **أنشئ Web Service جديد**:
   - اربط الريبو
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start`
4. **Environment Variables**:
   ```
   BOT_TOKEN=your_telegram_bot_token
   GEMINI_API_KEY=your_api_key
   LLM_PROVIDER=gemini
   DATABASE_URL=file:/opt/render/project/src/dev.db
   NODE_VERSION=20
   ```

### ملاحظات:
- الخطة المجانية تنام بعد 15 دقيقة من عدم النشاط
- استخدم UptimeRobot لإبقاء البوت مستيقظًا
- للاستمرارية الكاملة: استخدم Supabase Postgres (مجاني أيضًا)

## 3. قاعدة البيانات

### SQLite (افتراضي):
- سهل وسريع
- يُمسح عند إعادة النشر على Render

### PostgreSQL (موصى به للإنتاج):
1. أنشئ مشروع Supabase مجاني
2. احصل على Connection String
3. عدّل `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. ضع `DATABASE_URL` في Render

## 4. إضافة مهارات جديدة

أنشئ ملف في `src/skills/definitions/`:
```typescript
export const spec = {
    name: 'skill_name',
    description: 'وصف المهارة',
    inputSchema: { /* ... */ }
};

export async function run(ctx, inputs) {
    // منطق المهارة
    return { result: 'نتيجة' };
}
```

## 5. الهوية على السلسلة (On-Chain Identity)

لربط الوكيل بهوية على السلسلة:
1. أنشئ محفظة للوكيل (استخدم `ethers` أو `viem`)
2. سجل الهوية في عقد ذكي (مثل ENS أو Verida)
3. وقّع الرسائل باستخدام المفتاح الخاص للوكيل

**تحذير**: لا تخزن المفتاح الخاص في الكود! استخدم متغيرات البيئة المشفرة.
