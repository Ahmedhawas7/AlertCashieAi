# WhatsApp Business Tools MCP Guide (Official Meta Server)

لقد تم إضافة وتفعيل خادم **WhatsApp Business Tools MCP** الرسمي من شركة Meta إلى إعدادات Antigravity العامة (`~/.gemini/config/mcp_config.json`).

---

## 1. بيانات خادم الـ MCP المعتمد من Meta

- **اسم الخادم:** `whatsapp-business-tools`
- **نوع الاتصال (Transport):** `Streamable HTTP`
- **عنوان الخادم (Endpoint):** `https://mcp.facebook.com/whatsapp_business_tools`
- **التوثيق (Authentication):** Meta Developer Account / Facebook Login for Business عبر بروتوكول OAuth الآمن.

---

## 2. القدرات والأدوات المتاحة عبر هذا الـ MCP

بدلاً من الدخول اليدوي المعقد للوحة تحكم فيسبوك (Meta Developer Console):

1. **فحص شروط الخدمة وتراخيص الحساب (Terms of Service & WABA Status):**
   - التحقق من حالة حساب واتساب التجاري وموافقة الشروط.
2. **إدارة وتسجيل الأرقام (Phone Number Registration):**
   - إضافة رقم هاتف جديد للبوت.
   - إرسال كود التحقق OTP (رسالة نصية أو مكالمة صوتية) وتفعيله مباشرة.
3. **ضبط الـ Webhook تلقائياً (Webhook Automation):**
   - ربط رابط الـ Worker الخاص بنا:
     `https://hawas-worker.hawas-alertai.workers.dev/whatsapp`
   - إدخال الـ Verify Token (`hawas_wa_secret`).
   - الاشتراك التلقائي في استقبال أحداث الرسائل (`messages`).
4. **إنشاء وإدارة قوالب الرسائل (Templates):**
   - صياغة قوالب الرسائل الرسمية وتقديمها للموافقة الفورية من ميتا.
5. **إرسال رسائل اختبار وتأكيد الاتصال (Live Testing):**
   - إرسال رسائل تجريبية لرقمك للتأكد من وصول رسائل حواس بنجاح.

---

## 3. كيفية إدارة الخادم في البيئة

يمكنك مراجعة وتعديل خوادم الـ MCP في أي وقت من خلال:
- المسار: `~/.gemini/config/mcp_config.json`
- أو من واجهة Antigravity: **Additional Options (...) > MCP Servers**.
