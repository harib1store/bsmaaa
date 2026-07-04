import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import multer from 'multer';
import fs from 'fs';

dotenv.config();

// تعيين مسار ffmpeg: جرّب أولاً متغير البيئة، وإلا استخدم ffmpeg-static كحل احتياطي
try {
  const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || '';

  // إذا وُجِد ثنائي ffmpeg من ffmpeg-static حاول منح صلاحية التنفيذ
  if (ffmpegStatic) {
    try {
      fs.chmodSync(ffmpegStatic, 0o755);
      console.log('Set execute permissions on ffmpeg-static binary');
    } catch (chmodErr) {
      console.warn('Failed to set execute permissions on ffmpeg-static binary:', chmodErr);
    }
  }

  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log('ffmpeg path set to:', ffmpegPath);
  } else {
    console.warn('No ffmpeg path found in FFMPEG_PATH or ffmpeg-static.');
  }
} catch (e) {
  console.warn('Could not set ffmpeg path from FFMPEG_PATH or ffmpeg-static:', e);
}

const app = express();
const PORT = 3000;

// Initialize Gemini client on the server asynchronously & lazily to prevent start-up failure
let aiInstance: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("رمز Gemini API Key غير مهيأ بعد. يرجى تهيئة رمز الاختصار من قائمة الإعدادات (Settings > Secrets) في بيئة AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

app.use(express.json({ limit: "50mb" }));

// -------------------------
// Video conversion helper
// -------------------------
export const convertVideoTo720p = (inputPath: string, outputPath: string) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .size('?x720')
      .videoCodec('libx264')
      .output(outputPath)
      .on('end', () => {
        console.log('ffmpeg conversion finished:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('ffmpeg conversion error:', err);
        reject(err);
      })
      .run();
  });
};

// In-memory "Basma" state. Replace or extend with your real application logic.
const basmaState: { lastUpdatedVideo?: string } = {};

function updateBasmaWithVideo(videoPath: string) {
  // This function represents the logic that "changes البسمة" in your application.
  // Replace this with calls to your real application services, database updates, or events.
  basmaState.lastUpdatedVideo = videoPath;
  console.log('Basma state updated with video:', videoPath);
  return basmaState;
}

// Multer setup for handling uploads (temporary storage in uploads/)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB limit (adjust as needed)

// Endpoint to upload, convert to 720p, and hook into Basma logic.
app.post('/api/upload-video', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'video file required' });

  const inputPath = req.file.path;
  const outputFilename = `${req.file.filename}-720p.mp4`;
  const outputPath = path.join(uploadDir, outputFilename);

  try {
    // Protect the server from crashing by wrapping conversion in try-catch
    await convertVideoTo720p(inputPath, outputPath);

    // Integrate with Basma logic: update application state with the converted video
    const newState = updateBasmaWithVideo(outputPath);

    // Return a safe relative URL for the frontend to fetch the converted video
    const publicUrl = `/uploads/${path.basename(outputPath)}`;

    // Ensure uploads folder is served as static (if not already)
    // Note: we only add this once; adding again is harmless in express.
    app.use('/uploads', express.static(uploadDir));

    // Clean up the original uploaded file asynchronously (do not await to keep response fast)
    fs.unlink(inputPath, (err) => {
      if (err) console.warn('Failed to remove temp input file', inputPath, err);
    });

    return res.json({ success: true, video: publicUrl, basma: newState });
  } catch (err: any) {
    console.error('Video conversion failed (upload-video):', err);
    console.error('FFMPEG_ERROR_DETAILS:', err);
    // Attempt to clean input file even on error
    try { fs.unlinkSync(inputPath); } catch (e) { console.warn('Failed to cleanup input file after error', e); }
    // Do NOT crash the server; return a controlled error response
    return res.status(500).json({ error: 'Conversion failed', details: err?.message || String(err) });
  }
});

// Route to analyze and optimize the user Arabic/English post text
app.post("/api/optimize-text", async (req, res) => {
  const { text, platform, strength } = req.body;

  if (!text) {
    return res.status(400).json({ error: "النص مطلوب للبدء في التحسين" });
  }

  // Local fallback engine to process text in case of API limitations (e.g. 429 Quota exhaustion / No API Key)
  const runLocalFallback = (reason: string) => {
    const dictionary: Record<string, string> = {
      "فلسطين": "فـ.ـلـ.ـسـ.ـطـ.ـيـ.ـن",
      "القدس": "الـ.ـقـ.ـدس",
      "غزة": "غـ.ـزة",
      "شهيد": "شـ.ـهـ.ـيـ.ـد",
      "شهداء": "شـ.ـهـ.ـداء",
      "المقاومة": "الـ.ـمـ.ـقـ.ـاومـ.ـة",
      "حماس": "حـ.ـمـ.ـاس",
      "إسرائيل": "إِ*سـ.ـرَائـ.ـيـ.ـل",
      "اسرائيل": "إِ*سـ.ـرَائـ.ـيـ.ـل",
      "صهيوني": "صـ.ـهـ.ـيـ.ـونـ.ـي",
      "الصهيونية": "الـ.ـصـ.ـهـ.ـيـ.ـونـ.ـيـ.ـة",
      "حرب": "حـ.ـرب",
      "القتل": "الـ.ـقـ.ـتـ.ـل",
      "قتل": "قـ.ـتـ.ـل",
      "دماء": "د*مـاء",
      "دم": "د*م",
      "سلاح": "سـ.ـلاح",
      "صواريخ": "صـ.ـواريـ.ـخ",
      "قصف": "قـ.ـصـ.ـف",
      "تفجير": "تـ.ـفـ.ـجـ.ـيـ.ـر",
      "دولار": "دولا$ر",
      "ربح": "ر*بـح",
      "تسويق": "تـ.ـسـ.ـويـ.ـق",
      "مبيعات": "مـ.ـبـ.ـيـ.ـعـ.ـات",
      "شراء": "شـ.ـراء",
      "بيع": "بـ.ـيـ.ـع",
      "جنس": "جـ.ـنـ.ـس",
      "سكس": "سـ.ـكـ.ـس",
    };

    let processedText = text;
    const flaggedFound: string[] = [];

    // Replace words
    for (const [key, val] of Object.entries(dictionary)) {
      if (processedText.includes(key)) {
        flaggedFound.push(key);
        const regex = new RegExp(key, "g");
        processedText = processedText.replace(regex, val);
      }
    }

    // Inject emojis intelligently based on context
    let ems = " ✨ ";
    if (text.includes("فلسطين") || text.includes("غزة") || text.includes("القدس")) {
      ems += " 🇵🇸 ✌️";
    }
    if (text.includes("دولار") || text.includes("ربح") || text.includes("بيع") || text.includes("شراء")) {
      ems += " 💰 📈 💸";
    }
    if (text.includes("فيديو") || text.includes("صورة") || text.includes("تفاعل") || text.includes("منشور")) {
      ems += " 📸 🎥 🔥";
    } else {
      ems += " 💡 🚀";
    }

    processedText = `📣 ${ems}\n\n${processedText}\n\n🌟`;

    // Generate Platform specific hashtags and tips
    let suggestedHashtags: string[] = [];
    let targetPlatformTip = "";

    if (platform === "facebook") {
      suggestedHashtags = ["#تفاعل_فيسبوك", "#المحتوى_الأصلي", "#بصمة_الوصول", "#اكسبلور_2026", "#مكافحة_الحظر"];
      targetPlatformTip = "خوارزمية فيسبوك تمنع المنشورات التي تحتوي روابط مضللة أو ترويجية مباشرة. قمنا بتنظيف منشورك.";
    } else if (platform === "twitter") {
      suggestedHashtags = ["#التريند_الآن", "#منصة_اكس_العربية", "#هاشتاق_الموسم", "#بصمة_ظهور", "#ميديا_اليوم"];
      targetPlatformTip = "خوارزمية منصة X تكافئ التميز اللغوي والأيقونات المنتشرة حالياً. لتخطي Shadowban، تجنب الردود المباشرة والمحتوى المتكرر.";
    } else if (platform === "instagram") {
      suggestedHashtags = ["#explore_page", "#انستجرام_العائله", "#صناع_محتوى", "#بصمتي", "#فيديو_اليوم"];
      targetPlatformTip = "إنستغرام يعاقب النسخ الحرفي. تعديل هذا النص مع تغيير بصمة الصورة عبر التطبيق سيمنع تمييز المحتوى.";
    } else {
      suggestedHashtags = ["#محتوى_شائع", "#بصمة_رقمية", "#تخطي_الخوارزمية", "#ريتش_عالي", "#الحساب_الآمن"];
      targetPlatformTip = "ملاحظة: تم استخدام وضع الفلترة المحلي الآمن لتخطي قيود فحص الخوارزميات وروبوتات المراقبة بشكل آمن.";
    }

    return {
      optimizedText: processedText,
      originalFlaggedWords: flaggedFound.length > 0 ? flaggedFound : ["رقابة تلقائية"],
      replacementsExplanation: `تم تنشيط المحرك الاحتياطي المحلي الذاتي لعدم توفر خادم السحاب المؤقت (${reason}). بدائل التمويج الآمنة اختيرت لتقليل مخاطر الحجب.`,
      suggestedHashtags,
      targetPlatformTip,
      isFallback: true
    };
  };

  try {
    const ai = getGeminiClient();
    const prompt = `
أنت خبير محترف في خوارزميات وسائل التواصل الاجتماعي ومكافحة حظر الظل (Shadowban) ورفع التفاعل على منصات فيسبوك ([...]
المهمة المطلوبة:
تحليل وتعديل النص العربي أو الإنجليزي التالي لتحقيق الأهداف التالية:
1. **فلترة الكلمات الحساسة والخاضعة للتقييد**: استبدل الكلمات التي قد تسبب حظراً للمنشور أو تقليلاً لنسبة ارت[...]
2. **تحسين أسلوب التفاعل وصياغة جذابة**: اجعل الأسلوب يحفز التفاعل والمشاركة من خلال جمل افتتاحية قوية وتساؤل[...]
3. **الأيقونات التعبيرية المناسبة**: أضف أيقونات تعبيرية (emojis) جذابة في سياق الموضوع لتسهيل القراءة وتجميل ال�[...]
4. **الهاشتاغات الرائجة والمثيرة للنشاط (Interactive Hashtags)**: اقترح قائمة من 5 إلى 10 هاشتاغات حديثة تلائم طبيعة المن�[...]

النص المراد تعديله:
"${text}"

المنصة المستهدفة ذات الأولوية: ${platform || "الكل"}
قوة الفلترة (Strength): ${strength || "high"} (إذا كانت عالية، قم بتغطية وتعديل الكلمات بشكل مكثف)

الرجاء تقديم استجابة JSON دقيقة تحتوي على الحقول التالية:
- optimizedText: النص النهائي الجاهز للنشر المضاف إليه الرموز التعبيرية والمنسق بشكل رائع ومعدّل فيه الكلمات المق[...]
- originalFlaggedWords: قائمة الكلمات التي تم رصدها كخطر على الخوارزمية وتم تعديلها.
- replacementsExplanation: شرح موجز جداً للبدائل الذكية التي تم استخدامها ولماذا هي آمنة.
- suggestedHashtags: مصفوفة من الهاشتاغات المولدة المناسبة الجاهزة للنسخ.
- targetPlatformTip: نصيحة خاصة بخوارزمية المنصة المحددة لتسريع الوصول (مثل أفضل وقت نشر، أو تفضيل التعليق الأول للر[...]
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedText: {
              type: Type.STRING,
              description: "The modified friendly text ready for publication with emojis."
            },
            originalFlaggedWords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of detected dangerous or flagged words."
            },
            replacementsExplanation: {
              type: Type.STRING,
              description: "Arabic brief explanation of why modifications were made."
            },
            suggestedHashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "High performing viral hashtags for reach."
            },
            targetPlatformTip: {
              type: Type.STRING,
              description: "Reach optimizer tips specifically for this social venue."
            }
          },
          required: ["optimizedText", "originalFlaggedWords", "replacementsExplanation", "suggestedHashtags", "targetPlatformTip"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return res.json({ ...data, isFallback: false });
  } catch (error: any) {
    console.warn("API limit or issue detected. Engaging high-fidelity local Arabic fallback filter engine...", error.message || error);
    const reasonLabel = error.message && error.message.includes("quota") ? "نفاد حصة الطلبات المجانية المؤقتة" : "تعذر الاتصال بمزود الذكاء الاصطناعي الخارجي";
    try {
      const fallbackData = runLocalFallback(reasonLabel);
      return res.json(fallbackData);
    } catch (fallbackError: any) {
      return res.status(500).json({ error: "فشل نظام التحسين والفلترة التلقائي البديل." });
    }
  }
});

// Configure Vite or Static Serve
async function init() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Basma reach algorithm software running on port ${PORT}`);
  });
}

init();
