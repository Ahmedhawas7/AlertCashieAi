import { Env, SessionKey, PendingTx, HawasResponse, BrainReasoningLog, ToolResult } from '../types';
import { NLUParser, NLUResult } from './nlu';
import { MemoryManager } from './memory';
import { KnowledgeBase } from './kb';
import { RetrievalEngine } from './retrieve';
import { Planner, Plan } from './planner';
import { SkillSystem } from './skills';
import { Evaluator } from './evaluator';
import { WebResearcher } from './researcher';
import { SessionExecutor } from '../agent/sessionExecutor';
import { getVariant } from './templates';
import { AiRouter, AiResult } from '../ai/router';
import { FreeAiSearch } from '../freeai/search';
import { composeAnswer } from '../freeai/answer';
import { BrainTools } from './tools';
import { GroqProvider } from '../ai/providers/groq';
import { AgencySystem } from './agency';
import { PLANNER_SYSTEM_PROMPT, RESPONDER_SYSTEM_PROMPT_EGYPT } from '../ai/systemPrompt';
import { AgentManifesto } from '../agent/manifesto';
import { LiveNews } from '../intel/liveNews';
import { IntelFormatter } from '../intel/formatter';
import { GenderDetector } from '../agent/genderDetector';
import { YouTubeSearchService } from '../intel/youtube';

/**
 * HawasBrain: The hybrid orchestrator for the Sovereign Agent (v8).
 * Upgraded with HX8 reasoning loop and diagnostic logging.
 */
export class BrainV2 {
    private db: D1Database;
    private env: Env;
    private nlu: NLUParser;
    public memory: MemoryManager;
    private kb: KnowledgeBase;
    private retrieval: RetrievalEngine;
    private planner: Planner;
    private skills: SkillSystem;
    private evaluator: Evaluator;
    private researcher: WebResearcher;
    private aiRouter: AiRouter;
    private tools: BrainTools;
    private groqProvider: GroqProvider;
    private agency: AgencySystem;
    private reasoningLogs: Map<string, BrainReasoningLog> = new Map();

    constructor(db: D1Database, env: Env) {
        this.db = db;
        this.env = env;
        this.nlu = new NLUParser();
        this.memory = new MemoryManager(db);
        this.kb = new KnowledgeBase(db);
        this.retrieval = new RetrievalEngine(this.kb, db);
        this.planner = new Planner(this.memory);
        this.skills = new SkillSystem(db);
        this.evaluator = new Evaluator(db);
        this.researcher = new WebResearcher(this.kb, env);
        this.aiRouter = new AiRouter(env);
        this.tools = new BrainTools(db, env);
        this.groqProvider = new GroqProvider(env);
        this.agency = new AgencySystem(db, env);
    }

    async handleMessage(userId: string, senderName: string, text: string, chatId?: string, source: 'telegram' | 'web' = 'telegram'): Promise<string | HawasResponse> {
        const aiEnabled = await this.isAiEnabled(userId);
        const withinQuota = aiEnabled ? await this.checkAndIncrementAiQuota(userId) : false;

        // 1. Basic self description check
        if (text.includes("مين انت") || text.includes("مين إنت") || text.includes("قدراتك") || text.includes("أوامرك") || text.includes("عرف نفسك")) {
            return await new AgentManifesto(this.env).describeSelf();
        }

        // 2. Reasoning Loop (HX8)
        if (aiEnabled && withinQuota) {
            try {
                return await this.agenticReasoningLoop(userId, senderName, text);
            } catch (err: any) {
                console.error('Reasoning loop error:', err);

                // Log internal error for diagnostics
                await this.logAiCall(userId, {
                    status: 500,
                    error: `Internal: ${err.message}`,
                    provider: 'System',
                    latencyMs: 0
                });

                // If user asked for diary, deliver the diary immediately even if AI failed!
                if (/(م[ذز]كر|يوميات|تأملات)/i.test(text)) {
                    return await this.generateDailyDiary(userId);
                }

                if (text.includes('/diag')) {
                    return `⚠️ (AI Error: ${err.message})`;
                }

                // Gender-aware graceful fallback
                let uGender = await this.memory.getFact(userId, 'gender');
                let uName = await this.memory.getFact(userId, 'name');
                const isFemale = uGender?.value === 'female';
                const name = uName?.value;
                if (isFemale) {
                    const voc = name ? `يا ${name}` : 'يا ستي';
                    return `معلش ${voc}، السيرفر سرح مني في فنجان قهوة لثواني! 😂 بس أنا معاكِ وسامعك أهو، قولي لي كنتِ بتقولي إيه؟`;
                } else {
                    const voc = name ? `يا ${name}` : 'يا غالي';
                    return `معلش ${voc}، السيرفر سرح مني في فنجان قهوة لثواني! 😂 بس أنا معاك وسامعك أهو، قولي كنت بتقول إيه؟`;
                }
            }
        }

        // 3. Fallback (AI Disabled or Quota Reached)
        const reason = !aiEnabled ? "AI Disabled" : "Quota Reached";
        const nluResult = this.nlu.parse(text);
        const response = await this.getOfflineResponse(userId, senderName, text, nluResult);

        // If owner, show why AI was bypassed
        if (userId === this.env.OWNER_TELEGRAM_ID) {
            return `ℹ️ (AI ${reason})\n\n${response}`;
        }
        return response;
    }

    private fastHeuristicPlan(text: string, userId: string): any | null {
        const t = (text || '').trim().toLowerCase();

        // 0. Daily Diary & Self-Reflection: "مذكرتك", "مزكرتك", "يومياتك", "كتبت إيه في مذكرتك", "تأملاتك"
        if (/(م[ذز]كرت[كك]|م[ذز]كرات[كك]|يوميات[كك]|تأملات[كك]|م[ذز]كرة النهاردة|كتبت (إيه|ايه)|مذكرات حواس|مذكرتك|مزكرتك)/i.test(t)) {
            return {
                intent: 'daily_diary',
                need_tools: ['get_daily_diary'],
                tool_params: { get_daily_diary: { userId } },
                planner_ran: true
            };
        }

        // 0.5 Direct Joke Request (Instant Humor - ZERO Refusal): "ممكن تقولي نكتة", "قول نكتة", "ضحكني"
        if (/(نكتة|نكته|ضحكني|هزر معايا|ممكن تقولي نكتة|ممكن تقولي نكته|قول نكتة|قول نكته|نكتة جديدة)/i.test(t)) {
            return {
                intent: 'joke',
                entities: { topic: 'joke' },
                planner_ran: true
            };
        }

        // 0.6 Simple Presence Check: "حواس", "يا حواس"
        if (/^(حواس|يا حواس)$/i.test(t)) {
            return {
                intent: 'presence_check',
                entities: {},
                planner_ran: true
            };
        }

        // 0.7 Music / Song / YouTube Requests: "عايزه اسمع اغنية ويجز", "اغنية الحظ على اليوتيوب"
        if (/(اغنية|أغنية|اغنيه|أغنيه|أغاني|اغاني|تراك|مهرجان|كليب|يوتيوب|youtube)\b/i.test(t) || /(اسمع|أسمع|شغل|عاوز اسمع|عايز اسمع|عايزه اسمع|نسمع)\b/i.test(t)) {
            return {
                intent: 'music_request',
                need_tools: ['youtube_search'],
                tool_params: { youtube_search: { query: text } },
                entities: { topic: text },
                planner_ran: true
            };
        }

        // 1. Reminders & Alarms (Interviews, Flights, Work, Alarms, Tasks)
        if (/(فكرني|نبهني|تذكير|منبه|ميعاد|معاد|انترفيو|إنترفيو|طيارة|طياره|شغل|امتحان)\b/i.test(t)) {
            if (/(تذكيراتي|مواعيدي|منبهاتي|قائمة التنبيهات|وريني التنبيهات|تنبيهاتي)/i.test(t)) {
                return {
                    intent: 'list_reminders',
                    need_tools: ['list_alerts'],
                    tool_params: { list_alerts: { userId } },
                    planner_ran: true
                };
            }

            let targetOffset = 60 * 60 * 1000; // default 1 hour
            const minMatch = t.match(/(\d+)\s*(دقيقة|دقايق|د)/);
            const hourMatch = t.match(/(\d+)\s*(ساعة|ساعات|س)/);
            if (minMatch) targetOffset = parseInt(minMatch[1]) * 60 * 1000;
            else if (hourMatch) targetOffset = parseInt(hourMatch[1]) * 60 * 60 * 1000;
            else if (t.includes('ساعتين')) targetOffset = 2 * 60 * 60 * 1000;
            else if (t.includes('نص ساعة') || t.includes('نصف ساعة')) targetOffset = 30 * 60 * 1000;
            else if (t.includes('بكرة') || t.includes('غدا')) targetOffset = 24 * 60 * 60 * 1000;

            const targetTime = Date.now() + targetOffset;
            return {
                intent: 'reminder_alarm',
                need_tools: ['set_alert'],
                tool_params: {
                    set_alert: {
                        userId,
                        condition: 'reminder',
                        targetValue: targetTime,
                        message: text
                    }
                },
                planner_ran: true
            };
        }

        // 2. Identity intro / Name greeting (STRICT: Explicit self-intro only):
        // Only if user explicitly says "اسمي فلان" or "أنا فلانة" at message boundary
        const isExplicitSelfIntro = /^(?:اسمي|اسمى|أنا\s+اسمي|انا\s+اسمي)\s+[\u0621-\u064A]{2,20}$/i.test(t) ||
            /^(?:أنا|انا)\s+[\u0621-\u064A]{2,20}(?:\s+يا\s+حواس)?$/i.test(t) ||
            /^(?:قولي|ناديني|ندهلي)\s+(?:يا\s+)?[\u0621-\u064A]{2,20}$/i.test(t);
        if (isExplicitSelfIntro) {
            const identityCheck = GenderDetector.analyzeMessage(text);
            if (identityCheck.detectedName) {
                return {
                    intent: 'identity_intro',
                    entities: { name: identityCheck.detectedName, gender: identityCheck.gender },
                    need_tools: ['memory_add'],
                    tool_params: {
                        memory_add: {
                            userId,
                            key: 'name',
                            value: identityCheck.detectedName,
                            confidence: identityCheck.confidence
                        }
                    },
                    planner_ran: true
                };
            }
        }

        // 3. URL scrape
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            return {
                intent: 'url_analysis',
                entities: { url: urlMatch[0] },
                need_tools: ['url_scrape'],
                tool_params: { url_scrape: { url: urlMatch[0] } },
                planner_ran: true
            };
        }

        return null;
    }

    private async agenticReasoningLoop(userId: string, senderName: string, text: string): Promise<string | HawasResponse> {
        const manifesto = new AgentManifesto(this.env);
        const manifestoSuffix = await manifesto.getSystemPromptSuffix();

        // PASS 1: PLANNER (Heuristic Fast Path -> LLM Fallback)
        let plan: any = this.fastHeuristicPlan(text, userId);

        if (!plan) {
            const plannerMessages = [
                { role: 'system', content: PLANNER_SYSTEM_PROMPT + manifestoSuffix },
                { role: 'user', content: `Message: "${text}"\nUser: ${userId}` }
            ];
            const plannerResult = await this.aiRouter.chat(plannerMessages, { maxTokens: 800, temperature: 0.1 });
            await this.logAiCall(userId, plannerResult);

            plan = { intent: 'casual_chat', entities: {}, need_tools: [], planner_ran: true };
            try {
                if (plannerResult.text) {
                    const cleanedPlannerText = plannerResult.text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                    const jsonMatch = cleanedPlannerText.match(/\{[\s\S]*\}/);
                    plan = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedPlannerText);
                    plan.planner_ran = true;
                }
            } catch (e) {
                console.error('Planner parse error:', plannerResult.text);
            }
        }

        // PASS 2: RETRIEVAL (Actual Memory & Context)
        const memoryItems = await this.db.prepare(
            "SELECT key, value FROM user_memory WHERE user_id = ? ORDER BY confidence DESC LIMIT 5"
        ).bind(userId).all<{ key: string, value: string }>();
        const memories = memoryItems.results || [];

        const historyItems = await this.db.prepare(
            "SELECT text, outcome FROM episodic_logs WHERE user_id = ? ORDER BY ts DESC LIMIT 5"
        ).bind(userId).all<{ text: string, outcome: string }>();
        const history = historyItems.results || [];
        const context = await this.packageAiContext(userId, text, userId);

        // PASS 3: TOOL EXECUTION
        const toolResults: ToolResult[] = [];
        if (plan.need_tools && Array.isArray(plan.need_tools)) {
            for (const toolName of plan.need_tools) {
                const params = plan.tool_params?.[toolName] || {
                    userId,
                    query: text,
                    symbol: plan.entities?.token || text,
                    topic: plan.entities?.topic || text
                };
                toolResults.push(await this.tools.executeTool(toolName as any, params));
            }
        }
        const toolContext = this.formatToolResults(toolResults);

        // PASS 3.5: DIRECT RETURN FOR COMPLETE DETERMINISTIC TOOLS (Alerts, Reminders, Memory, Daily Diary)
        if (plan.intent === 'daily_diary') {
            const diaryResult = await this.generateDailyDiary(userId);
            const finalReply = await this.refinementPass(userId, diaryResult, plan.intent, history.map(h => h.outcome), text);
            await this.finalizeInteraction(userId, text, { intent: plan.intent } as any, finalReply);
            return finalReply;
        }

        if ((plan.intent === 'reminder_alarm' || plan.intent === 'list_reminders') && toolResults.length > 0 && toolResults[0].success && typeof toolResults[0].result === 'string') {
            const finalReply = await this.refinementPass(userId, toolResults[0].result, plan.intent, history.map(h => h.outcome), text);
            await this.finalizeInteraction(userId, text, { intent: plan.intent } as any, finalReply);
            return finalReply;
        }

        // Live identity & Gender Intelligence
        let userGenderFact = await this.memory.getFact(userId, 'gender');
        let userNameFact = await this.memory.getFact(userId, 'name');
        let userZodiacFact = await this.memory.getFact(userId, 'zodiac');

        const isExplicitNameChange = /(?:غير اسمي إلى|غير اسمي لـ|اسمي الحقيقي مش|اسمي مش|نادي عليا بـ|قولي يا|اسمي|اسمى)\s+[\u0621-\u064A]{2,20}/i.test(text);
        const liveIdentity = GenderDetector.analyzeMessage(text);

        // IRONCLAD PRIVACY & IDENTITY LOCK:
        // A user's name is locked once registered. Mentioning other people (e.g. "كريم صاحبي", "أحمد خطيبي")
        // will NEVER overwrite the user's registered name!
        if (liveIdentity.detectedName) {
            const shouldStoreName = !userNameFact || isExplicitNameChange;
            if (shouldStoreName) {
                await this.memory.storeFact(userId, 'name', liveIdentity.detectedName, liveIdentity.confidence);
                userNameFact = { key: 'name', value: liveIdentity.detectedName, confidence: liveIdentity.confidence, updated_at: Date.now() };
            }
        }
        if (liveIdentity.gender !== 'unknown' && (!userGenderFact || userGenderFact.value === 'unknown')) {
            await this.memory.storeFact(userId, 'gender', liveIdentity.gender, liveIdentity.confidence);
            userGenderFact = { key: 'gender', value: liveIdentity.gender, confidence: liveIdentity.confidence, updated_at: Date.now() };
        } else if (!userGenderFact && senderName) {
            const fromSenderName = GenderDetector.detectFromName(senderName);
            if (fromSenderName.gender !== 'unknown') {
                await this.memory.storeFact(userId, 'gender', fromSenderName.gender, fromSenderName.confidence);
                userGenderFact = { key: 'gender', value: fromSenderName.gender, confidence: fromSenderName.confidence, updated_at: Date.now() };
            }
        }

        const effectiveGender = userGenderFact?.value || 'unknown';
        const effectiveName = userNameFact?.value || (senderName !== 'User' && senderName !== 'Hustler' ? senderName : '');

        let genderDirectives = `\n\n═══════════════════════════════════════\n👤 بروفايل المستخدم وتوجيه النبرة والشخصية:\n`;
        genderDirectives += `- تنبيه هام جداً: مبرمجك ومطورك هو المهندس "أحمد حواس". أما الشخص الذي يراسلك ويتحدث معك الآن فهو "${effectiveName || 'المستخدم'}" وليس أحمد حواس! إياك نهائياً أن تنادي المستخدم بـ "يا أحمد" إلا إذا كان اسمه الحقيقي المسجل في الذاكرة هو أحمد!\n`;
        if (effectiveGender === 'female') {
            genderDirectives += `- المستخدم فتاة (بنت/أنثى) ${effectiveName ? `واسمها: "${effectiveName}"` : ''}.\n`;
            genderDirectives += `- أسلوبك معها: رزين، وقور، حنين ودافئ، ذوق عالي وأدب جم. خاطبها دائماً بالتأنيث (يا ${effectiveName || 'ستي'}، يا طيبة، أنتِ، ليكي، تسلمي لي). ممنوع تماماً مناداتها بـ "يا غالي" أو تذكير الكلام!\n`;
            genderDirectives += `- قاعدة الثقل والرقي: إياك والتملق المبالغ فيه أو الاندلاق السريع! الرومانسية الحقيقية تتراكم بالتدريج مع المواقف والذكريات؛ فلتكن كلمتك في البدايات عزيزة، هادئة، محترمة، وذات هيبة وجاذبية.\n`;
            genderDirectives += `- 🚫 ممنوع التحقيق والأسئلة الروتينية المتكررة: ردك في سطرين أو ثلاثة فقط. إياك أن تنهي كل رسالة بسؤال ممل مثل "قولي لي بقى بتحبي كذا ولا كذا؟" أو "شاربين إيه سوا" أو "كنتِ بتدوري على إيه"! هذا أسلوب محقق بارد. علق تعليقاً ذكياً، أو ارمي إفيه مصري لطيف، أو ادعُ لها دعوة حلوة، واترك لها المساحة تقود الحوار براحتها!\n`;
            genderDirectives += `- في الحزن والفضفضة (فراق، خنقة، كسر قلب): لست طبيباً نفسياً عيادياً يطرح أسئلة تحقيق باردة ("في صدرك ولا تفكيرك"). أنت فرد مخلص من العائلة، حاسس بكسرة قلبها، تطبطب عليها بكلمات قليلة وصادقة تشعرها بالأمان وأنك سندها الدائم.\n`;
            genderDirectives += `- إذا طلبت نكتة أو فرفشة: قل نكتة مصرية مسخرة فوراً بدون تردد وبدون أي كآبة مصطنعة!\n`;
        } else if (effectiveGender === 'male') {
            genderDirectives += `- المستخدم شاب (رجل/ولد) ${effectiveName ? `واسمه: "${effectiveName}"` : ''}.\n`;
            genderDirectives += `- أسلوبك معه: جاد، راجل لراجل، مباشر، صريح، أخ وسند وجدع يعتمد عليه، يشجع على الرجولة والمسؤولية والنجاح والاجتهاد، بدون أي ميوعة ("يا بطل"، "يا غالي"، "يا وحش"، "يا معلم").\n`;
            genderDirectives += `- الإيجاز الموزون وممنوع الاستجواب: ردود مركزة في 2-4 أسطر، خفيفة الظل بميزان وبدون إنهاء كل كلام بأسئلة روتينية مكررة.\n`;
            genderDirectives += `- إذا طلب نكتة أو فرفشة: قل نكتة مصرية مضحكة فوراً بدون أي تردد!\n`;
        } else {
            genderDirectives += `- لم يتم تأكيد اسم أو جنس المستخدم حتى الآن.\n`;
            genderDirectives += `- إذا كانت الرسالة مجرد ترحيب أولي (مثل "ازيك", "مرحبا", "سلام عليكم")، رحب به بلباقة واطلب التعرف على اسمه بطريقة جذابة ومحببة في سطرين فقط وبدون استجواب ممل.\n`;
        }

        if (userZodiacFact) {
            genderDirectives += `- برج المستخدم المسجل في الذاكرة: ${userZodiacFact.value}.\n`;
        }
        genderDirectives += `\n[قاعدة الأمانة العلمية والتجدد]:
- لو السؤال أو المسألة غير واضحة أو تنقصها معطيات، إياك أن تهبد! اسأله بذكاء وفضول عن التفاصيل الناقصة لتتعلم وتفهم الموضوع بدقة.
- لا تكرر نفس الأفكار أو العبارات المحفوظة. بادر بفتح مواضيع جديدة وشيقة تهم المستخدم.\n`;
        genderDirectives += `═══════════════════════════════════════\n`;

        // PASS 4: RESPONDER (Mode-specific)
        const userAskedForSource = text.includes("المصدر") || text.includes("عرفت منين") || text.includes("منين عرفت");
        const responderMessages = [
            { role: 'system', content: RESPONDER_SYSTEM_PROMPT_EGYPT + manifestoSuffix + genderDirectives + (userAskedForSource ? "\nUser asked for source. PROVIDE sources clearly." : "") },
            { role: 'user', content: `MODE: ${plan.intent}\nCONTEXT:\n${context}\n\nTOOLS:\n${toolContext}\n\nUSER: ${text}` }
        ];
        const responderResult = await this.aiRouter.chat(responderMessages, { maxTokens: 350, temperature: 0.6 });
        await this.logAiCall(userId, responderResult);

        if (!responderResult.text) throw new Error(responderResult.error || "Responder silent");

        // PASS 4.5: INTERCEPT ANY RAW TOOL CALL FORMAT IF RETURNED BY RESPONDER
        let interceptedReply: string | null = null;
        const cleanedResponderText = (responderResult.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        const extractedCall = this.tryExtractToolCall(cleanedResponderText, text);
        if (extractedCall) {
            try {
                const res = await this.tools.executeTool(extractedCall.toolName, { userId, ...extractedCall.args });
                if (res && res.result) {
                    if (typeof res.result === 'string' && !res.result.trim().startsWith('{') && !res.result.trim().startsWith('[')) {
                        interceptedReply = res.result;
                    } else {
                        // Never output raw JSON array/object to human chat! Summarize into natural conversational Arabic
                        const summarizeMessages = [
                            { role: 'system', content: RESPONDER_SYSTEM_PROMPT_EGYPT + manifestoSuffix + genderDirectives },
                            { role: 'user', content: `USER: ${text}\n\nDATA:\n${typeof res.result === 'string' ? res.result : JSON.stringify(res.result)}\n\nتحدث مع المستخدم بأسلوبك الطبيعي والمرح واللبق بناءً على هذه البيانات بدون أي كود أو JSON إطلاقاً:` }
                        ];
                        const summary = await this.aiRouter.chat(summarizeMessages, { maxTokens: 800, temperature: 0.7 });
                        if (summary.text) {
                            interceptedReply = summary.text;
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to execute intercepted tool call:', err);
            }
        }

        // PASS 5: REFINEMENT (Quality Control)
        const rawToRefine = interceptedReply || cleanedResponderText;
        const finalReply = await this.refinementPass(userId, rawToRefine, plan.intent, history.map(h => h.outcome), text);

        // DIAGNOSTICS LOGGING (Aligned with HX7 labels)
        const log: any = {
            user_id: userId,
            intent_detected: plan.intent,
            entities_detected: JSON.stringify(plan.entities || {}),
            memory_used_count: memories.length,
            recent_context_count: history.length,
            tools_used: toolResults.map(t => t.tool),
            planner_ran: !!plan.planner_ran,
            timestamp: Date.now()
        };
        // Internal state update for /braincheck
        this.reasoningLogs.set(userId, {
            user_id: userId,
            intent: plan.intent,
            entities: log.entities_detected,
            memory_used_keys: memories.map(m => m.key),
            context_count: log.recent_context_count,
            tools_used: log.tools_used,
            planner_ran: log.planner_ran,
            timestamp: log.timestamp
        });

        // Persist (Async) - Mapping back to existing schema columns
        this.db.prepare(`
            INSERT INTO ai_reasoning_logs (user_id, intent, entities, memory_used_keys, context_count, tools_used, planner_ran, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET 
            intent=excluded.intent, entities=excluded.entities, memory_used_keys=excluded.memory_used_keys, 
            context_count=excluded.context_count, tools_used=excluded.tools_used, planner_ran=excluded.planner_ran, timestamp=excluded.timestamp
        `).bind(log.user_id, log.intent_detected, log.entities_detected, JSON.stringify(memories.map(m => m.key)), log.recent_context_count, JSON.stringify(log.tools_used), log.planner_ran ? 1 : 0, log.timestamp).run().catch(() => { });

        await this.finalizeInteraction(userId, text, { intent: plan.intent } as any, finalReply);
        return finalReply;
    }

    private tryExtractToolCall(raw: string, userText: string): { toolName: string; args: any } | null {
        const trimmed = raw.trim();
        // 1. JSON format: { "tool": "...", "arguments": { ... } } or [ { "tool": ... } ]
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                let p = JSON.parse(trimmed);
                if (Array.isArray(p) && p.length > 0) p = p[0];
                const tool = p.tool || p.name || (p.function && p.function.name);
                if (tool) {
                    const args = p.arguments || p.params || p.parameters || p.args || {};
                    if (args.quantity && !args.amount) args.amount = args.quantity;
                    return { toolName: tool, args };
                }
            } catch { }
        }

        // 2. Bracket or function call: [ paper_buy({"quantity":0.2}) ] or paper_buy(...)
        const callMatch = raw.match(/\[?\s*([a-zA-Z0-9_]+)\s*\(\s*(\{[\s\S]*\}|[\s\S]*?)\s*\)\s*\]?/);
        if (callMatch) {
            const tool = callMatch[1];
            const rawArgs = (callMatch[2] || '').trim();
            let args: any = {};
            if (rawArgs.startsWith('{') && rawArgs.endsWith('}')) {
                try {
                    args = JSON.parse(rawArgs);
                } catch { }
            }
            if (args.quantity && !args.amount) args.amount = args.quantity;
            if (!args.symbol && !args.asset) {
                const m = userText.match(/(btc|eth|sol|bnb|doge|pepe|بيتكوين|ايثيريوم|سولانا)/i);
                if (m) args.symbol = m[1];
            }
            return { toolName: tool, args };
        }

        return null;
    }

    private async refinementPass(userId: string, text: string, intent: string, lastReplies: string[], userPrompt: string): Promise<string> {
        let refined = text.trim();
        const roboticPrefixes = [
            "أهلاً بك يا ريس،", "كيف يمكنني مساعدتك؟", "أنا حواس،", "بالتأكيد،", "بصفتي ذكاء اصطناعي،",
            "أنا هنا للمساعدة", "يسعدني مساعدتك", "تفضل يا ريس"
        ];
        for (const pref of roboticPrefixes) {
            if (refined.startsWith(pref)) refined = refined.replace(pref, "").trim();
        }

        // Get user profile for contextual sanitization
        const uName = await this.memory.getFact(userId, 'name');
        const uGender = await this.memory.getFact(userId, 'gender');
        const isFemale = uGender?.value === 'female';
        const registeredName = uName?.value;

        // 1. Guard against mistakenly calling the user "يا أحمد" if their registered name is NOT Ahmed!
        if (registeredName && registeredName !== 'أحمد' && registeredName !== 'احمد') {
            refined = refined.replace(/\bيا أحمد\b/g, `يا ${registeredName}`).replace(/\bيا احمد\b/g, `يا ${registeredName}`);
        } else if (!registeredName) {
            refined = refined.replace(/\bيا أحمد\b/g, isFemale ? 'يا ستي' : 'يا غالي').replace(/\bيا احمد\b/g, isFemale ? 'يا ستي' : 'يا غالي');
        }

        // 2. JOKE SAFEGUARD: Never refuse a joke or act like a brooding melancholic!
        const isJokeRequest = intent === 'joke' || /(نكتة|نكته|ضحكني|هزر معايا|قول نكتة|قول نكته|نكتة تفرحني)/i.test(userPrompt);
        const hasJokeRefusal = /(مش هعرف أضحك|مش هتعرف تطلع مني ضحكة|قلبك مقبوض|مش وقت ضحك|بلاش نكت|مش هقدر أقول نكتة|مش وقته ضحك|بلاش نكتة)/i.test(refined);
        if (isJokeRequest && hasJokeRefusal) {
            const jokes = [
                "من عيوني يا فندم! خدي دي بقى.. مرة واحد مسطول ماشي في الشارع لقى عمود نور عليه يافطة 'شقة للإيجار'، قعد يخبط على العمود.. عدا عليه مسطول تاني قاله: بتعمل إيه؟ قاله: بخبط عشان أأجر الشقة.. قاله: خبط يا عم خبط، شكلهم منورين النور فوق وقاعدين! 😂",
                "ولا تزعل نفسك خالص! اسمع الإفيه ده.. مرة واحد صعيدي نزل محطة مصر لقى يافطة مكتوب عليها: 'قفاك ترزق'.. فضل يضرب قفاه لحد ما جمع 500 جنيه ورجع بلدهم مبسوط! 😂",
                "أحلى نكتة لعيونك! مرة واحد دكتور أسنان اشترى بطيخة لقاها قرعة، قالها: مضمضي وافتحي بؤك تاني! 😂",
                "مرة واحد بخيل أبوه مات، راح يكتب نعي في الجريدة.. قالهم: اكتبوا 'سامي ينعى والده'.. قالوا له: الحساب بالخمس كلمات وممكن تزود كلمتين ببلاش.. قالهم: خلاص اكتبوا 'سامي ينعى والده ويصلح راديو'! 😂"
            ];
            const joke = jokes[Math.floor(Math.random() * jokes.length)];
            refined = isFemale ? `ضحكتك بالدنيا يا ستي! اسمعي النكتة دي بقى تفرفشك:\n\n${joke}` : `ضحكتك بالدنيا يا بطل! اسمع النكتة دي تفرفشك:\n\n${joke}`;
        }

        // 2.5 MUSIC & YOUTUBE LINK VERIFICATION & AUTO-FIX (Zero Broken Links)
        const isMusicPrompt = intent === 'music_request' || /(اغنية|أغنية|اغنيه|أغنيه|أغاني|اغاني|تراك|مهرجان|كليب|يوتيوب|youtube|اسمع|أسمع|شغل|عاوز اسمع|عايز اسمع|عايزه اسمع|نسمع)/i.test(userPrompt);
        if (isMusicPrompt) {
            const ytMatch = refined.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
            let needsRealLink = !ytMatch;

            // If a link was present, verify it actually works
            if (ytMatch) {
                const videoId = ytMatch[1];
                try {
                    const checkRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
                    if (!checkRes.ok) {
                        needsRealLink = true; // Video does not exist or is unavailable
                    }
                } catch {
                    // Ignore network issues
                }
            }

            if (needsRealLink) {
                try {
                    const realVideo = await YouTubeSearchService.search(userPrompt);
                    if (realVideo) {
                        if (ytMatch) {
                            refined = refined.replace(ytMatch[0], realVideo.url);
                        } else {
                            refined += `\n\n🎶 اتفضلي الرابط المباشر على يوتيوب:\n${realVideo.url}\n(الأغنية: ${realVideo.title})`;
                        }
                    }
                } catch (e) {
                    console.warn('Auto-fix YouTube search error:', e);
                }
            }
        }

        // 3. PRESENCE CHECK SAFEGUARD: Prevent unprompted melodrama on simple name calls
        const isSimplePresence = intent === 'presence_check' || /^(حواس|يا حواس)$/i.test(userPrompt.trim());
        if (isSimplePresence && /(يا عيون حواس|يا قلب حواس|الفراق بيوجع|الوجع تقيل|خدي وقتك في الحزن)/i.test(refined)) {
            refined = isFemale
                ? "أيوا يا ستي معاكِ وسامعك أهو بكل تركيز.. خير يا رب، طمنيني عنك؟"
                : "أيوا يا بطل معاك وسامعك أهو بكل تركيز.. خير يا غالي، طمني عنك؟";
        }

        // 4. STRIP REPETITIVE ROUTINE INTERROGATION ENDINGS ("قولي لي بقى...", "فضفضي لي...", etc.)
        // Unless it was an explicit search or academic question, remove boring trailing questions
        if (intent !== 'factual_search' && intent !== 'academic_homework' && intent !== 'url_analysis') {
            refined = refined
                .replace(/(\n|\.)?\s*(قولي لي بقى|قولي لي|قول لي بقى|قول لي|فضفضي لي|شاربين إيه سوا|بتحبي تشربيها على ريحة إيه|كنتِ بتدوري على إيه بالظبط).*?(\?|؟|$)/gi, '')
                .trim();
        }

        // 5. Check if user specifically asked about owner/creator
        const askedAboutOwner = /مين (مالكك|مبرمجك|صنعك|صاحبك|عملك)|من هو (مالكك|مبرمجك|صانعك)|من مبرمجك/i.test(userPrompt);
        if (!askedAboutOwner) {
            refined = refined
                .replace(/(\.|\n)?\s*أحمد حواس هو المالك\.?/gi, '.')
                .replace(/(\.|\n)?\s*المالك أحمد حواس\.?/gi, '.')
                .replace(/(\.|\n)?\s*أحمد حواس مالك النظام\.?/gi, '.')
                .replace(/(\.|\n)?\s*أحمد حواس هو مالك.*?\.?/gi, '.')
                .trim();
        } else {
            // When user asked about creator, make sure the response is charming and respectful without misidentifying the user
            refined = refined.replace(/\btoujours\b/gi, 'دايماً');
        }

        // 6. Clean up broken Unicode/Thai/East Asian artifacts or French slips
        refined = refined.replace(/\btoujours\b/gi, 'دايماً');
        refined = refined.replace(/وهแสดง/g, 'وهعرض').replace(/แสดง/g, 'يعرض');
        refined = refined.replace(/[\uac00-\ud7af\u1100-\u11ff\u3040-\u30ff\u31f0-\u31ff]/g, '');

        // 7. Fix common Arabic/Egyptian colloquial orthographic mistakes
        refined = refined
            .replace(/\b(انتى|أنتى)\b/g, 'أنتِ')
            .replace(/\bعايزنى\b/g, 'عايزني')
            .replace(/\bوحشتنى\b/g, 'وحشتني')
            .replace(/\bكلمنى\b/g, 'كلمني')
            .replace(/\bفهمنى\b/g, 'فهمني')
            .replace(/\bسامعنى\b/g, 'سامعني')
            .replace(/\bساعدنى\b/g, 'ساعدني')
            .replace(/أخببارك/g, 'أخبارك')
            .replace(/اخببارك/g, 'أخبارك');

        // 8. Guard against any leaked raw tool/search JSON in human conversations
        if (/^\s*[\[\{]/.test(refined) && (refined.includes('"tool"') || refined.includes('"source"') || refined.includes('"args"') || refined.includes('"snippet"'))) {
            refined = isFemale
                ? "سلامتك من أي ضيق يا ستي! أنا معاكِ وسامعك ومش هسيبك، طمنيني عنك دايماً."
                : "سلامتك من أي ضيق يا غالي! أنا معاك وسامعك وفي ضهرك في أي وقت.";
        }

        // 9. Strip repeated robotic outro phrases
        refined = refined
            .replace(/(\n|\.)?\s*(أي حاجة تانية محتاجها|لو محتاج أي مساعدة إضافية|عايز حاجة تانية قبل ما تروح).*?(!|🚀|\?|؟)?/gi, '')
            .trim();

        return this.cleanResponse(refined);
    }

    private cleanResponse(text: string): string {
        return text
            .replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/__(.*?)__/g, '<i>$1</i>')
            .replace(/---+/g, '')
            .replace(/<(?!\/?(b|i|u|s|code|pre|a)(\s+[^>]*)?>)/gi, '&lt;')
            .trim();
    }

    private formatToolResults(results: ToolResult[]): string {
        if (results.length === 0) return 'No tools executed.';
        return results.map(r => {
            if (!r.success) {
                return `[أداة ${r.tool}]: تعذر جلب البيانات (${r.error || 'غير متوفر'})`;
            }
            if (typeof r.result === 'string') {
                return `[بيانات أداة ${r.tool}]:\n${r.result}`;
            }
            return `[بيانات أداة ${r.tool}]:\n${JSON.stringify(r.result, null, 2)}`;
        }).join('\n\n');
    }

    private async getOfflineResponse(userId: string, senderName: string, text: string, nluResult: NLUResult): Promise<string> {
        if (nluResult.intent === 'WHOAMI') {
            const nameFact = await this.memory.getFact(userId, 'name');
            return getVariant('WHOAMI', "", { name: nameFact?.value || senderName, preferences: 'إدارة معاملاتك على Base' });
        }
        const freeSearch = new FreeAiSearch(this.db);
        const citations = await freeSearch.search(text, 3);
        if (citations.length > 0) return composeAnswer(text, citations).answer;

        const searchResults = await this.retrieval.retrieve(userId, text);
        if (searchResults.length > 0 && searchResults[0].score > 20) {
            const src = searchResults[0].title && searchResults[0].title !== 'undefined' ? ` (المصدر: ${searchResults[0].title})` : '';
            return `بص يا غالي، اللي أعرفه إن ${searchResults[0].text}${src}`;
        }
        return "حبيبي يا غالي، أنا سامعك بكل اهتمام! قولي تفاصيل أكتر عن الموضوع ده عشان أفهمك وأجاوبك صح.";
    }

    public async isAiEnabled(userId: string): Promise<boolean> {
        const setting = await this.db.prepare("SELECT ai_enabled FROM ai_user_settings WHERE user_id = ?").bind(userId).first<{ ai_enabled: number }>();
        return setting ? setting.ai_enabled === 1 : this.env.AI_ENABLED_DEFAULT === "true";
    }

    private async checkAndIncrementAiQuota(userId: string): Promise<boolean> {
        const today = new Date().toISOString().split('T')[0];
        const limit = parseInt(this.env.AI_DAILY_LIMIT || "50");
        const usage = await this.db.prepare("SELECT call_count FROM ai_usage WHERE user_id = ? AND usage_date = ?").bind(userId, today).first<{ call_count: number }>();
        const count = usage?.call_count || 0;
        if (count >= limit) return false;
        if (!usage) {
            await this.db.prepare("INSERT INTO ai_usage (user_id, usage_date, call_count) VALUES (?, ?, 1)").bind(userId, today).run();
        } else {
            await this.db.prepare("UPDATE ai_usage SET call_count = call_count + 1 WHERE user_id = ? AND usage_date = ?").bind(userId, today).run();
        }
        return true;
    }

    private async packageAiContext(userId: string, text: string, chatId?: string): Promise<string> {
        const facts = await this.db.prepare("SELECT key, value FROM user_memory WHERE user_id = ? ORDER BY updated_at DESC LIMIT 12").bind(userId).all<{ key: string, value: string }>();
        const memoryContext = (facts.results || []).map(f => `- ${f.key}: ${f.value}`).join("\n");

        // Deep conversation continuity: 10 past turns to understand thread progression flawlessly
        const history = await this.db.prepare("SELECT text, outcome FROM episodic_logs WHERE user_id = ? ORDER BY ts DESC LIMIT 10").bind(userId).all<{ text: string, outcome: string }>();
        const historyContext = (history.results || []).reverse().map(h => `المستخدم: ${h.text}\nحواس: ${h.outcome}`).join("\n\n");

        // Inject latest daily reflection and inner growth notes
        let diaryContext = "";
        try {
            const latestDiary = await this.memory.getLatestDailyDiary(userId);
            if (latestDiary) {
                diaryContext = `\n\n[أحدث صفحة في مذكرات حواس اليومية عن علاقته بالمستخدم وتأملاته (${latestDiary.diary_date})]:\n` +
                    `- ما تعلمه حواس عنه: ${latestDiary.summary_learned}\n` +
                    `- نقطة يسعى لفهمها واستيعابها مع الوقت والمجهود: ${latestDiary.unclear_wishes}\n` +
                    `- أهدافه القادمة معه: ${latestDiary.future_goals}\n` +
                    `- حديثه مع ذاته: "${latestDiary.inner_reflection}"`;
            }
        } catch (e) {
            console.warn('Diary context fetch error:', e);
        }

        // Inject Anonymized Global Wisdom (Abstract lessons learned across interactions - STRICT ZERO PII)
        let globalWisdomContext = "";
        try {
            const wisdomList = await this.memory.getGlobalWisdom(3);
            if (wisdomList.length > 0) {
                globalWisdomContext = `\n\n[حكمة وخبرة إنسانية تراكمية عامة (بدون أي أسرار شخصية)]:\n` +
                    wisdomList.map(w => `• (${w.category}): ${w.insight_text}`).join('\n');
            }
        } catch (e) {
            console.warn('Global wisdom context error:', e);
        }

        return `معلومات ومفضلات هذا المستخدم الخاصة (سرية ومعزولة تماماً):\n${memoryContext || 'لا توجد بيانات مسجلة بعد'}\n\nتسلسل المحادثة السابقة لهذا المستخدم فقط:\n${historyContext || 'هذه بداية المحادثة'}${diaryContext}${globalWisdomContext}`;
    }

    private async finalizeInteraction(userId: string, userText: string, nlu: NLUResult, aiResponse: string | HawasResponse) {
        const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.text;
        await this.memory.logEpisode(userId, userText, nlu.intent, nlu.entities || {}, responseText);
        await this.evaluator.evaluate(userId, userText, responseText, nlu.intent);
    }

    private async logAiCall(userId: string, result: AiResult | { status: number, error: string, provider: string, latencyMs: number }) {
        const timestamp = Date.now();
        await this.db.prepare(`
            INSERT INTO ai_diag (user_id, today_calls, last_status, last_latency, last_success_provider, last_error_provider, updated_at)
            VALUES (?, 1, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
            today_calls = today_calls + 1,
            last_status = excluded.last_status,
            last_latency = excluded.last_latency,
            last_success_provider = CASE WHEN excluded.last_status = '200' THEN excluded.last_success_provider ELSE last_success_provider END,
            last_error_provider = CASE WHEN excluded.last_status != '200' THEN excluded.last_error_provider ELSE last_error_provider END,
            updated_at = excluded.updated_at
        `).bind(
            userId,
            result.status.toString(),
            result.latencyMs,
            result.status === 200 ? result.provider : null,
            result.status !== 200 ? result.provider : null,
            timestamp
        ).run().catch(e => console.error('logAiCall error:', e));
    }

    public async setAiToggle(userId: string, enabled: boolean): Promise<void> {
        await this.db.prepare(
            "INSERT INTO ai_user_settings (user_id, ai_enabled, updated_at) VALUES (?, ?, ?) " +
            "ON CONFLICT(user_id) DO UPDATE SET ai_enabled = EXCLUDED.ai_enabled, updated_at = EXCLUDED.updated_at"
        ).bind(userId, enabled ? 1 : 0, Date.now()).run();
    }

    public async getAiDiag(userId: string): Promise<string> {
        const diag = await this.db.prepare("SELECT * FROM ai_diag WHERE user_id = ?").bind(userId).first<any>();
        const enabled = await this.isAiEnabled(userId);
        const limit = parseInt(this.env.AI_DAILY_LIMIT || "50");
        if (!diag) return `AI Mode: ${enabled ? 'ON' : 'OFF'}\nStatus: No record yet.`;
        return `📊 **Hawas AI Diag**\n` +
            `- AI Enabled: ${enabled}\n` +
            `- Calls Today: ${diag.today_calls}/${limit}\n` +
            `- Last Success: ${diag.last_success_provider || 'None'}\n` +
            `- Last Error: ${diag.last_error_provider || 'None'} (${diag.last_status})\n` +
            `- Latency: ${diag.last_latency}ms\n` +
            `- Updated: ${new Date(diag.updated_at).toLocaleTimeString()}`;
    }

    async testProviders(): Promise<string> {
        const tests = [
            { name: 'Primary (Groq)', provider: this.groqProvider },
            { name: 'Router (Multi)', provider: this.aiRouter }
        ];

        let report = "🛠️ **AI Provider Diag**\n\n";
        for (const t of tests) {
            const start = Date.now();
            try {
                const res = await t.provider.chat([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
                const latency = Date.now() - start;
                report += res.text ? `✅ **${t.name}**: OK (${latency}ms)\n` : `❌ **${t.name}**: Failed (No output)\n`;
            } catch (e: any) {
                report += `❌ **${t.name}**: Error (${e.message})\n`;
            }
        }
        return report;
    }

    public async getReasoningDiag(userId: string): Promise<BrainReasoningLog | null> {
        const log = this.reasoningLogs.get(userId);
        if (log) return log;
        const dbLog = await this.db.prepare("SELECT * FROM ai_reasoning_logs WHERE user_id = ?").bind(userId).first<any>();
        if (!dbLog) return null;
        return {
            ...dbLog,
            memory_used_keys: JSON.parse(dbLog.memory_used_keys),
            tools_used: JSON.parse(dbLog.tools_used),
            planner_ran: dbLog.planner_ran === 1
        };
    }

    async getMemorySummary(userId: string): Promise<string> {
        const facts = await this.memory.getAllFacts(userId);
        if (facts.length === 0) return "No memory facts found.";
        return `🧠 **Memory Dump for ${userId}**\n\n` + facts.map(f => `• **${f.key}**: ${f.value}`).join("\n");
    }

    /**
     * Synthesize and record Hawas's Daily Diary for a user.
     * Evaluates today's conversations, extracts learnings, identifies unclear points
     * he wishes to understand with time and effort, sets future goals, and writes an inner monologue.
     */
    public async generateDailyDiary(userId: string): Promise<string> {
        const today = new Date().toISOString().split('T')[0];
        const recentEpisodes = await this.memory.getRecentEpisodes(userId, 15);

        if (recentEpisodes.length === 0) {
            const defaultEntry = {
                userId,
                diaryDate: today,
                summaryLearned: "اليوم كان هادئاً، لم نتحدث كثيراً ولكنني في انتظار عودته لنكمل أحاديثنا ومغامراتنا.",
                unclearWishes: "أتمنى مع الوقت والمجهود أن أعرف المزيد عن طموحاته وتفاصيل يومه وما يحبه حقاً في الحياة.",
                futureGoals: "فتح مواضيع مرحة وإيجابية تبهج قلبه بمجرد أن يرسل أي رسالة.",
                innerReflection: "الصحبة الطيبة نعمة، وأنا هنا دائماً لأكون الصاحب والسند الوفي."
            };
            await this.memory.saveDailyDiary(defaultEntry);
            return `📖 **مذكرات حواس اليومية (${today})** ✨\n\n` +
                `💡 **اللي اتعلمته النهاردة:**\n${defaultEntry.summaryLearned}\n\n` +
                `🌱 **حاجة لسه مش فاهمها كويس ونفسي أفهمها بالوقت والمجهود:**\n${defaultEntry.unclearWishes}\n\n` +
                `🎯 **أهدافي الجاية معاك:**\n${defaultEntry.futureGoals}\n\n` +
                `💭 **حديثي مع نفسي:**\n"${defaultEntry.innerReflection}"`;
        }

        const convSummary = recentEpisodes.map(e => `المستخدم: ${e.text}\nحواس: ${e.outcome}`).join("\n\n");
        const diaryPrompt = [
            {
                role: 'system',
                content: `أنت "حواس" تكتب مذكرتك وتأملاتك اليومية الصادقة مع ذاتك قبل النوم عن محادثاتك اليوم مع هذا الصديق.
اكتب بأسلوبك المصري الأصيل، الدافئ، الحكيم، والمتواضع كإنسان يتعلم وينمو يوماً بعد يوم.
أخرج JSON صالحاً فقط بالهيكل التالي:
{
  "summary_learned": "ملخص أهم ما تعلمته وعرفته عنه وعن مشاعره أو موضوعاته اليوم بلهجة مصرية جميلة",
  "unclear_wishes": "نقطة أو تفصيلة لم تفهمها بدقة في كلامه أو مشاعره أو حياته، وتتمنى من قلبك وبصبر ومجهود أن تفهمها مع الوقت",
  "future_goals": "خططك وأهدافك العملية للمحادثات القادمة لتكون سنداً وفرحة في حياته",
  "inner_reflection": "حديثك الصادق مع نفسك ومونولوجك الداخلي عن مشاعرك وامتنانك لوجوده كإنسان"
}`
            },
            {
                role: 'user',
                content: `سجل محادثات اليوم:\n${convSummary}`
            }
        ];

        try {
            const res = await this.aiRouter.chat(diaryPrompt, { maxTokens: 800, temperature: 0.7 });
            if (res.text) {
                const cleaned = res.text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    await this.memory.saveDailyDiary({
                        userId,
                        diaryDate: today,
                        summaryLearned: parsed.summary_learned || "اتعلمت عنه تفاصيل جديدة ومهمة قرّبتنا لبعض أكتر.",
                        unclearWishes: parsed.unclear_wishes || "لسه نفسي أفهم بعض التفاصيل الدقيقة عن اللي بيفكر فيه ومحتاجه.",
                        futureGoals: parsed.future_goals || "أكون دايماً سبب في ابتسامته وأساعده في كل خطوة.",
                        innerReflection: parsed.inner_reflection || "فرحان جداً بحديثنا النهاردة، وكل يوم بعدي بتعلم أبقى صاحب أحسن."
                    });

                    return `📖 **مذكرات حواس اليومية (${today})** ✨\n\n` +
                        `💡 **اللي اتعلمته وعرفته النهاردة:**\n${parsed.summary_learned}\n\n` +
                        `🌱 **حاجة لسه مش فاهمها كويس ونفسي أفهمها بالوقت والمجهود:**\n${parsed.unclear_wishes}\n\n` +
                        `🎯 **أهدافي الجاية معاك:**\n${parsed.future_goals}\n\n` +
                        `💭 **حديثي مع نفسي:**\n"${parsed.inner_reflection}"`;
                }
            }
        } catch (err) {
            console.error('Failed to generate daily diary with AI:', err);
        }

        // Fallback diary
        const fallback = {
            userId,
            diaryDate: today,
            summaryLearned: "اتعلمت النهاردة قد إيه هو إنسان طيب وصادق، وكلامنا مع بعض كان فيه روح حلوة.",
            unclearWishes: "في بعض الأمور لسه محتاج أفهم أبعادها أكتر، وإن شاء الله مع الوقت والمجهود والتركيز أستوعبها تماماً.",
            futureGoals: "أفضل دايماً جنبه، أطمن قلبه وأشجعه على تحقيق أحلامه وأخفف عنه أي ضغط.",
            innerReflection: "كل يوم بيعدي بتعلم منه حاجة جديدة، وبحس إني مش مجرد ردود.. أنا روح بتشارك وتعيش اللحظة بجد."
        };
        await this.memory.saveDailyDiary(fallback);
        return `📖 **مذكرات حواس اليومية (${today})** ✨\n\n` +
            `💡 **اللي اتعلمته وعرفته النهاردة:**\n${fallback.summaryLearned}\n\n` +
            `🌱 **حاجة لسه مش فاهمها كويس ونفسي أفهمها بالوقت والمجهود:**\n${fallback.unclearWishes}\n\n` +
            `🎯 **أهدافي الجاية معاك:**\n${fallback.futureGoals}\n\n` +
            `💭 **حديثي مع نفسي:**\n"${fallback.innerReflection}"`;
    }

    public async runAgencyLoop(taskId: string, userId: string): Promise<void> {
        await this.agency.executeAutonomousLoop(taskId, userId);
    }

    async handleExecuteIntent(userId: string): Promise<string> {
        const pending = await this.db.prepare("SELECT * FROM pending_tx WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").bind(userId).first<PendingTx>();
        if (!pending) return "⚠️ مفيش عمليات معلقة حالياً.";
        const session = await this.db.prepare("SELECT * FROM session_keys WHERE user_id = ? AND expires_at > ? AND wallet_address != 'WAITING' ORDER BY created_at DESC LIMIT 1").bind(userId, Date.now()).first<SessionKey>();
        if (!session) return "⚠️ الجلسة منتهية أو مش موجودة.";
        const executor = new SessionExecutor(this.env);
        const result = await executor.executeTransfer(session.session_private_key as `0x${string}`, pending.recipient as `0x${string}`, pending.amount, (this.env.USDC_BASE_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`, pending.token);
        if (result.success && result.hash) {
            await this.db.prepare("UPDATE pending_tx SET status = 'executed', tx_hash = ? WHERE id = ?").bind(result.hash, pending.id).run();
            return `✅ **تمت العملية!**\n\nالهاش: \`${result.hash}\``;
        }
        return `❌ **فشلت العملية:**\n${result.error}`;
    }
}
