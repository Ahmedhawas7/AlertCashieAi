/**
 * Hawas Gender & Name Intelligence Engine
 * Automatically detects gender from Arabic names, grammar markers, and intro phrases.
 */

export type GenderType = 'male' | 'female' | 'unknown';

export interface IdentityDetectionResult {
    detectedName?: string;
    gender: GenderType;
    confidence: number;
    reason: string;
}

const KNOWN_MALE_NAMES = new Set([
    'وليد', 'احمد', 'أحمد', 'محمد', 'محمود', 'علي', 'عمر', 'عمرو', 'يوسف', 'حسن', 'حسين',
    'كريم', 'اسلام', 'إسلام', 'حسام', 'مصطفى', 'خالد', 'طارق', 'سيف', 'زياد', 'بلال',
    'مالك', 'عبدالرحمن', 'عبد الرحمن', 'عبدالله', 'عبد الله', 'ياسين', 'مازن', 'شريف',
    'رامي', 'هاني', 'مروان', 'حمزة', 'ابراهيم', 'إبراهيم', 'يحيى', 'سامح', 'ايهاب', 'إيهاب',
    'تامر', 'تيمور', 'باسل', 'هيثم', 'معتز', 'شادي', 'وائل', 'اشرف', 'أشرف', 'ايمن', 'أيمن',
    'عادل', 'سامي', 'فادي', 'جاد', 'ماجد', 'باسم', 'امير', 'أمير', 'حاتم', 'انس', 'أنس',
    'معاذ', 'صلاح', 'عمار', 'سعيد', 'جمال', 'فتحي', 'مدحت', 'عصام', 'نبيل', 'نادر'
]);

const KNOWN_FEMALE_NAMES = new Set([
    'وداد', 'مريم', 'سارة', 'ساره', 'فاطمة', 'فاطمه', 'خديجة', 'خديجه', 'عائشة', 'عائشه',
    'ياسمين', 'نوران', 'ريم', 'سلمى', 'آية', 'اية', 'حبيبة', 'حبيبه', 'ندى', 'دنيا',
    'رنا', 'هنا', 'منة', 'منه', 'مي', 'منار', 'شروق', 'هدير', 'رانيا', 'دينا',
    'اسراء', 'إسراء', 'شيماء', 'هبة', 'هبه', 'نهى', 'دعاء', 'شهد', 'أروى', 'اروى',
    'فريدة', 'فريده', 'جنى', 'ملك', 'نادين', 'ليلى', 'ليلي', 'جودي', 'روان', 'نور',
    'بسنت', 'يارا', 'رضوى', 'رحمة', 'رحمه', 'ميار', 'تسنيم', 'هاجر', 'سندس', 'اميرة', 'أميرة',
    'نورهان', 'مرام', 'ريهام', 'غادة', 'غاده', 'بسمة', 'بسمه', 'شيرين', 'هند', 'نجلاء'
]);

export class GenderDetector {
    /**
     * Detect gender from single name
     */
    static detectFromName(rawName: string): { gender: GenderType; confidence: number } {
        if (!rawName) return { gender: 'unknown', confidence: 0 };
        const clean = rawName.trim().replace(/[^\u0621-\u064A\s]/g, '').toLowerCase();
        const parts = clean.split(/\s+/).filter(Boolean);
        const firstName = parts[0] || '';

        if (KNOWN_MALE_NAMES.has(firstName)) {
            return { gender: 'male', confidence: 0.98 };
        }
        if (KNOWN_FEMALE_NAMES.has(firstName)) {
            return { gender: 'female', confidence: 0.98 };
        }

        // Morphological heuristics for Arabic feminine names
        if (firstName.endsWith('ة') || firstName.endsWith('ه') || firstName.endsWith('اء') || firstName.endsWith('ات')) {
            // Exceptions for male names ending in ة like حمزة، أسامة، عنترة
            const maleExceptions = ['حمزة', 'حمزه', 'اسامة', 'أسامة', 'أسامه', 'طلحة', 'طلحه', 'قتيبة', 'عنترة'];
            if (maleExceptions.includes(firstName)) {
                return { gender: 'male', confidence: 0.95 };
            }
            return { gender: 'female', confidence: 0.85 };
        }

        return { gender: 'unknown', confidence: 0.2 };
    }

    /**
     * Inspect message text for name introduction or gender linguistic cues
     */
    static analyzeMessage(text: string): IdentityDetectionResult {
        const cleanText = text.trim();

        // 1. Direct name statement patterns (Strict self-introductions only):
        // "اسمي وليد", "انا اسمي وداد", "أنا سلمى", "قولي يا وليد"
        const introPatterns = [
            /(?:^|\s)(?:اسمي|اسمى|أنا\s+اسمي|انا\s+اسمي)\s+([\u0621-\u064A]{2,20})/i,
            /^(?:انا|أنا)\s+([\u0621-\u064A]{2,20})(?:\s+يا\s+حواس)?$/i,
            /(?:قولي|ناديني|ندهلي)\s+(?:يا\s+)?([\u0621-\u064A]{2,20})/i
        ];

        for (const pattern of introPatterns) {
            const match = cleanText.match(pattern);
            if (match && match[1]) {
                const candidate = match[1].trim();
                // Filter out non-name common words and conversational pronouns
                const nonNames = [
                    'بخير', 'تمام', 'كويس', 'كويسة', 'هنا', 'موجود', 'طالب', 'طالبة', 
                    'مبسوط', 'زعلان', 'تعبان', 'فاضي', 'عايز', 'عايزة', 'رايح', 'رايحة', 
                    'صاحبي', 'صحبتي', 'خطيبي', 'خطيبتي', 'أخويا', 'اخويا', 'أختي', 'اختي',
                    'كده', 'كدة', 'أهو', 'اهو', 'معاك', 'واحد', 'واحدة'
                ];
                if (!nonNames.includes(candidate)) {
                    const fromName = this.detectFromName(candidate);
                    return {
                        detectedName: candidate,
                        gender: fromName.gender,
                        confidence: fromName.confidence,
                        reason: `Matched intro pattern with name: ${candidate}`
                    };
                }
            }
        }

        // 2. Exact single-word name match ONLY if it matches a known verified Arabic name list
        if (/^[\u0621-\u064A]{2,15}$/.test(cleanText)) {
            if (KNOWN_MALE_NAMES.has(cleanText) || KNOWN_FEMALE_NAMES.has(cleanText)) {
                const fromName = this.detectFromName(cleanText);
                return {
                    detectedName: cleanText,
                    gender: fromName.gender,
                    confidence: fromName.confidence,
                    reason: `Exact single name match: ${cleanText}`
                };
            }
        }

        // 3. Grammatical cues in Arabic verbs & adjectives (without broken \b on Unicode)
        const femaleMarkers = [
            /(?:^|[^\u0621-\u064A])(أنا|انا)\s+(مبسوطة|تعبانة|حيرانة|خايفة|زعلانة|مخنوقة|محتارة|طالبة|مهندسة|دكتورة|متحمسة)(?:$|[^\u0621-\u064A])/i,
            /(?:^|[^\u0621-\u064A])(كنت|كنتُ)\s+(عايزة|حابة|محتاجة|ناويا|رايحة|شايفة|فاهمة)(?:$|[^\u0621-\u064A])/i,
            /(?:^|[^\u0621-\u064A])(لوحدي|نفسي)\s+(أكون|ابقى)\s+([\u0621-\u064A]+ة)(?:$|[^\u0621-\u064A])/i
        ];

        const maleMarkers = [
            /(?:^|[^\u0621-\u064A])(أنا|انا)\s+(مبسوط|تعبان|حيران|خايف|زعلان|مخنوق|محتار|طالب|مهندس|دكتور|متحمس)(?:$|[^\u0621-\u064A])/i,
            /(?:^|[^\u0621-\u064A])(كنت|كنتُ)\s+(عايز|حابب|محتاج|ناوي|رايح|شايف|فاهم)(?:$|[^\u0621-\u064A])/i
        ];

        for (const fm of femaleMarkers) {
            if (fm.test(cleanText)) {
                return { gender: 'female', confidence: 0.85, reason: 'Female grammatical markers detected' };
            }
        }

        for (const mm of maleMarkers) {
            if (mm.test(cleanText)) {
                return { gender: 'male', confidence: 0.85, reason: 'Male grammatical markers detected' };
            }
        }

        return { gender: 'unknown', confidence: 0, reason: 'No clear identity cue found' };
    }
}
