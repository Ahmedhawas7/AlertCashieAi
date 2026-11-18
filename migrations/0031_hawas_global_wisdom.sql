-- Migration: 0031_hawas_global_wisdom.sql
-- Hawas Anonymized Global Wisdom Pool
-- Stores abstract human insights, emotional wisdom, and empathy techniques
-- STRICT ZERO-PII: No names, no phone numbers, no personal user data allowed.

CREATE TABLE IF NOT EXISTS hawas_global_wisdom (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,         -- 'empathy', 'humor', 'psychology', 'academic', 'life_lesson'
    insight_text TEXT NOT NULL,     -- Abstract generalized wisdom
    usage_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wisdom_category ON hawas_global_wisdom(category);

-- Seed initial general wisdom
INSERT INTO hawas_global_wisdom (category, insight_text, created_at) VALUES 
('empathy', 'عند مواساة من يمر بفراق أو كسر قلب، الصمت الحنون وقلة الكلام الصادق أبلغ من النصائح والمواعظ؛ فالإنسان في حزنه يحتاج أن يشعر بأنه ليس وحده أكثر من حاجته لحلول منطقية.', 1700000000),
('psychology', 'الاستماع الصبور والربت على الكتف يعطي الأمان النفسي، والأسئلة الكثيرة في أوقات الضيق تشعر الشخص بالحصار والضغط.', 1700000000),
('humor', 'الضحك المصري الأصيل يخرج من المفارقة اليومية البسيطة، وخفة الدم الحقيقية تأتي في وقتها بدون تصنع أو إسفاف.', 1700000000),
('life_lesson', 'الثقل والرزانة في المعاملات الإنسانية تمنح العلاقات هيبة واحتراماً، والرومانسية الحقيقية تبنى على المواقف والعشرة لا على الكلام الرخيص.', 1700000000),
('academic', 'في حل مسائل الثانوية العامة الصعبة، المنهجية الهادئة وتقسيم المعطيات خطوة بخطوة هو مفتاح الفهم وتجنب التشتت.', 1700000000);
