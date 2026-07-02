import React, { useState, useRef } from "react";
import { 
  Check, 
  Copy, 
  Sparkles, 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Settings, 
  Flame, 
  ShieldAlert, 
  RotateCcw, 
  ArrowRightLeft, 
  Smartphone, 
  Hash, 
  CheckCircle2, 
  HelpCircle,
  FileCode,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  MonitorPlay,
  Share2,
  Download
} from "lucide-react";
import { 
  MOBILE_PROFILES, 
  changeImageFingerprint, 
  changeVideoFingerprint, 
  MediaProfile 
} from "./utils";

export default function App() {
  // Input settings
  const [postText, setPostText] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [filteringStrength, setFilteringStrength] = useState("high");
  const [selectedProfile, setSelectedProfile] = useState<MediaProfile>(MOBILE_PROFILES[0]);

  // AI Loading & Result states
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [optimizedOutput, setOptimizedOutput] = useState<{
    optimizedText?: string;
    originalFlaggedWords?: string[];
    replacementsExplanation?: string;
    suggestedHashtags?: string[];
    targetPlatformTip?: string;
    isFallback?: boolean;
  } | null>(null);

  // File states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [processedResult, setProcessedResult] = useState<{
    modifiedDataUrl: string;
    originalHash: string;
    newHash: string;
    metadataDetails: Record<string, string>;
  } | null>(null);

  // Clipboard notify
  const [copiedText, setCopiedText] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);

  // Session Logs
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessText = async () => {
    if (!postText.trim()) {
      setAiError("الرجاء كتابة نص أولاً للمباشرة بالتحليل والتحسين.");
      return;
    }

    setIsAiLoading(true);
    setAiError("");
    setOptimizedOutput(null);

    try {
      const response = await fetch("/api/optimize-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: postText,
          platform: selectedPlatform,
          strength: filteringStrength
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "عذراً، فشل الاتصال بالخادم الذكي");
      }

      const data = await response.json();
      setOptimizedOutput(data);
      setSessionLogs(prev => [...prev, {
        type: "text_optimization",
        timestamp: new Date().toISOString(),
        originalText: postText,
        platform: selectedPlatform,
        strength: filteringStrength,
        result: data
      }]);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "فشلت عملية التحليل الذكي. الرجاء المحاولة مرة أخرى.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setFileError("الصيغة غير مدعومة. الرجاء اختيار صورة (JPG, PNG) أو فيديو (MP4, HEVC).");
      return;
    }

    setSelectedFile(file);
    setIsProcessingFile(true);
    setFileError("");
    setProcessedResult(null);

    try {
      if (isImage) {
        const result = await changeImageFingerprint(file, selectedProfile);
        setProcessedResult(result);
        setSessionLogs(prev => [...prev, {
          type: "media_fingerprint_change",
          timestamp: new Date().toISOString(),
          originalFileName: file.name,
          mediaType: "image",
          deviceProfile: selectedProfile.name,
          originalHash: result.originalHash,
          newHash: result.newHash,
          metadataDetails: result.metadataDetails
        }]);
      } else {
        const result = await changeVideoFingerprint(file, selectedProfile);
        setProcessedResult(result);
        setSessionLogs(prev => [...prev, {
          type: "media_fingerprint_change",
          timestamp: new Date().toISOString(),
          originalFileName: file.name,
          mediaType: "video",
          deviceProfile: selectedProfile.name,
          originalHash: result.originalHash,
          newHash: result.newHash,
          metadataDetails: result.metadataDetails
        }]);
      }
    } catch (err: any) {
      console.error(err);
      setFileError("حدث خطأ أثناء محاولة تعديل بصمة الوسائط الرقمية.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const copyToClipboard = (text: string, type: "text" | "tags") => {
    navigator.clipboard.writeText(text);
    if (type === "text") {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } else {
      setCopiedHashtags(true);
      setTimeout(() => setCopiedHashtags(false), 2000);
    }
  };

  const clearPostFields = () => {
    setPostText("");
    setOptimizedOutput(null);
    setAiError("");
  };

  const resetFileState = () => {
    setSelectedFile(null);
    setProcessedResult(null);
    setFileError("");
  };

  const handleExportReport = () => {
    if (sessionLogs.length === 0) {
      alert("لا توجد سجلات لتصديرها في الجلسة الحالية.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessionLogs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `basma_session_report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased rtl p-4 sm:p-6 md:p-8" dir="rtl">
      {/* Premium Header */}
      <header className="max-w-6xl mx-auto mb-8 sm:mb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-2xl shadow-xl shadow-emerald-500/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                تطبيق بصمة <span className="text-emerald-400">Reach Booster</span>
              </h1>
            </div>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
              النظام الشامل الأذكى لتخطي قيود خوارزميات فيسبوك، منصة إكس الرقمية (تويتر سابقاً)، وإنستغرام. قم بتغيير توقيع بصمة الصور أو الفيديو بلمحة بصر وفلترة النصوص المتسببة في تقليص الوصول (Shadowban).
            </p>
          </div>

          {/* Quick Platform Badge Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                محاكي خوارزميات نشط
            </span>
            <span className="text-xs font-mono text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              خالية من رصد الذكاء الاصطناعي للمنصات
            </span>
            <button 
              onClick={handleExportReport}
              disabled={sessionLogs.length === 0}
              className={`text-xs font-mono px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-sm transition duration-200 ${
                sessionLogs.length > 0 
                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 cursor-pointer" 
                  : "bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-70"
              }`}
              title="تصدير سجل عمليات الجلسة الحالية (JSON)"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير التقرير ({sessionLogs.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 mb-16">
        
        {/* Left Column: Post Optimizer (Text Tools) */}
        <section className="lg:col-span-12 xl:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
            {/* Decors */}
            <div className="absolute top-0 right-1/4 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">1. فلترة وتنقيب النصوص وتحفيز التفاعل</h2>
              </div>
              <button 
                onClick={clearPostFields}
                className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-xs transition duration-200"
                title="تصفية الحقول للكتابة مجدداً"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                مسح الحقل
              </button>
            </div>

            {/* Platform Settings Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">المنصة ذات الأولوية:</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "all", label: "الكل" },
                    { key: "facebook", label: "فيسبوك" },
                    { key: "twitter", label: "منصة X" },
                    { key: "instagram", label: "إنستغرام" }
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setSelectedPlatform(p.key)}
                      className={`text-xs py-1.5 rounded-lg border font-semibold transition duration-200 ${
                        selectedPlatform === p.key 
                          ? "bg-slate-800 text-emerald-300 border-emerald-500/40" 
                          : "bg-slate-950 text-slate-450 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">مستوى الفلترة والتمويه:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "high", label: "عالي جداً" },
                    { key: "medium", label: "متوسط" },
                    { key: "low", label: "ذكي خفيف" }
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setFilteringStrength(s.key)}
                      className={`text-xs py-1.5 rounded-lg border font-semibold transition duration-200 ${
                        filteringStrength === s.key 
                          ? "bg-slate-800 text-emerald-300 border-emerald-500/40" 
                          : "bg-slate-950 text-slate-450 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Text Area Input */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">اكتب أو ألصق منشورك هنا:</label>
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="مثال: يرجى دعم القـ.ـضـ.ـة الفلسطينية ولا تشتروا المنتجات الداعمة للمحـ.ـتل والمقاطـ.ـعة ومهاجمة الحسابات السياسية لأن الخوارزميات تخفي الرابط..."
                className="w-full h-40 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 ring-offset-slate-900 transition duration-200 resize-none font-sans"
              />
              <div className="flex items-center justify-between mt-1 px-1">
                <span className="text-[10px] text-slate-500 font-mono">
                  {postText.length} حرف تقريباً
                </span>
                <span className="text-[10px] text-slate-450 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  سيتم تعويض كلمات الحظر بنقاط وفواصل تشفيرية لمنع روبوت المراجعة التلقائية
                </span>
              </div>
            </div>

            {/* Action Trigger */}
            <button
              onClick={handleProcessText}
              disabled={isAiLoading}
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-650 text-slate-950 font-bold text-sm py-3 rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isAiLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  جاري تشفير الكلمات وتوليد التفاعل...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  تحسين المنشور ومكافحة حظر الوصول
                </>
              )}
            </button>

            {/* Error view */}
            {aiError && (
              <div className="mt-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-2xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{aiError}</p>
              </div>
            )}
          </div>

          {/* AI Result Comparison Panel */}
          {optimizedOutput && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative">
              
              {/* Fallback Active Banner */}
              {optimizedOutput.isFallback && (
                <div className="mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-450 p-3.5 rounded-2xl text-xs flex gap-2.5 items-start">
                  <span className="bg-amber-500/20 p-1.5 rounded-lg text-amber-400 shrink-0 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="font-bold mb-1 text-amber-300">تم تنشيط المحرك الاحتياطي المحلي الذاتي (الوضع الآمن)</h4>
                    <p className="leading-relaxed text-slate-300">
                      لقد تم تفعيل المحرك المحلي تلقائياً لتخطي قيود موفر الخدمة الخارجية المؤقتة (API Rate Limit). جميع ميزات الفلترة من كلمات الحظر والهاشتاغات والصياغة التفاعلية تعمل الآن بشكل سلس وموثوق وآمن بالكامل!
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-md font-bold text-white">النتيجة المعالجة والمحسنة للانتشار والوصول العريض</h3>
                </div>
                <button
                  onClick={() => optimizedOutput.optimizedText && copyToClipboard(optimizedOutput.optimizedText, "text")}
                  className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold px-3 py-1.5 rounded-xl border border-emerald-500/20 transition duration-200 flex items-center gap-1"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      تم نسخ المنشور!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      نسخ المنشور الكامل
                    </>
                  )}
                </button>
              </div>

              {/* Enhanced Live Output Box */}
              <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 mb-4 text-emerald-100 whitespace-pre-wrap text-sm leading-relaxed font-sans relative">
                <div className="absolute top-2 left-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-md border border-emerald-500/20">
                  جاهز للنشر ومجهّز بالأيقونات والهاشتاغات
                </div>
                {optimizedOutput.optimizedText}
              </div>

              {/* Mini Metrics / Flags Met in Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Flagged and Cleansed list */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-2 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    المنظف الذكي (الكلمات الحساسة المكتشفة والمموهة):
                  </span>
                  {optimizedOutput.originalFlaggedWords && optimizedOutput.originalFlaggedWords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {optimizedOutput.originalFlaggedWords.map((word, idx) => (
                        <span key={idx} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium px-2 py-0.5 rounded-full">
                          {word}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xxs text-slate-500">لم يتم العثور على كلمات حظر تذكر. النص نظيف جداً!</p>
                  )}
                  {optimizedOutput.replacementsExplanation && (
                    <p className="text-xs text-slate-400 mt-2 italic leading-relaxed">
                      {optimizedOutput.replacementsExplanation}
                    </p>
                  )}
                </div>

                {/* Tags block */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-semibold">
                      <Hash className="w-3.5 h-3.5 text-emerald-400" />
                      الهاشتاغات الرائجة المقترحة (Reach Tags):
                    </span>
                    <button
                      onClick={() => optimizedOutput.suggestedHashtags && copyToClipboard(optimizedOutput.suggestedHashtags.join(" "), "tags")}
                      className="text-xxs text-emerald-450 hover:underline"
                    >
                      {copiedHashtags ? "تم نسخها!" : "نسخ فقط"}
                    </button>
                  </div>
                  {optimizedOutput.suggestedHashtags && optimizedOutput.suggestedHashtags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {optimizedOutput.suggestedHashtags.map((tag, idx) => (
                        <span key={idx} className="bg-slate-900 border border-slate-800 text-emerald-300 text-[11px] font-mono px-2 py-0.5 rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">لا توجد دلالات هاشتاغ جديدة حالياً.</p>
                  )}
                </div>
              </div>

              {/* Dynamic Algorithm Tip */}
              {optimizedOutput.targetPlatformTip && (
                <div className="mt-4 bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/10 flex items-start gap-2 text-xs">
                  <span className="bg-emerald-500/10 text-emerald-400 p-1 rounded-lg shrink-0 flex items-center justify-center">
                    <Flame className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <strong className="text-emerald-400 block mb-0.5 font-bold">تلميحة لانتشار الصاروخي (Reach Hack):</strong>
                    <span className="text-slate-350 leading-relaxed font-sans">{optimizedOutput.targetPlatformTip}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Video & Image Fingerprint Editor (تغيير بصمة الصور والفيديو) */}
        <section className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h2 className="text-md sm:text-lg font-bold text-white">2. تعديل بصمة ملف الميديا كلياً</h2>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                مكافحة حظر الحسابات المتكررة
              </span>
            </div>

            {/* Profile configuration */}
            <div className="mb-4">
              <label className="block text-slate-400 text-xs font-semibold mb-1.5">حاكِ جهاز الجوال الذكي لإدراج بيانات EXIF جديدة:</label>
              <div className="grid grid-cols-1 gap-1.5">
                {MOBILE_PROFILES.map((prof, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedProfile(prof);
                      // If a file was already loaded, refresh the fingerprint change with newly selected profile
                      if (selectedFile) {
                        handleFileSelected(selectedFile);
                      }
                    }}
                    className={`text-slate-200 text-xs py-2 px-3 rounded-xl border text-right transition duration-250 flex items-center justify-between ${
                      selectedProfile.name === prof.name 
                        ? "bg-emerald-500/5 text-emerald-300 border-emerald-500/40" 
                        : "bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className={`w-3.5 h-3.5 ${selectedProfile.name === prof.name ? "text-emerald-400 animate-bounce" : "text-slate-600"}`} />
                      <span>{prof.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{prof.software}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drag & Drop Upload field */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition duration-200 cursor-pointer ${
                selectedFile 
                  ? "bg-slate-950 border-emerald-500/30" 
                  : "bg-slate-950 border-slate-800 hover:border-slate-755 hover:bg-slate-900/40"
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                className="hidden" 
              />
              
              {!selectedFile ? (
                <div className="space-y-3">
                  <div className="bg-slate-900 w-11 h-11 mx-auto rounded-full border border-slate-800 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-250 font-bold">اسحب صورتك أو مقطع الفيديو هنا</p>
                    <p className="text-[10px] text-slate-500 mt-1">أو انقر لتصفح الملفات من جهازك</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[9px] text-slate-557">
                    <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3 text-emerald-400" /> صور (PNG, JPG)</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                    <span className="flex items-center gap-1"><VideoIcon className="w-3 h-3 text-emerald-400" /> فيديو (MP4, QuickTime)</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-emerald-500/10 w-10.5 h-10.5 mx-auto rounded-full border border-emerald-500/20 flex items-center justify-center">
                    {selectedFile.type.startsWith("image/") ? (
                      <ImageIcon className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <VideoIcon className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300 truncate max-w-xs mx-auto">{selectedFile.name}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">{(selectedFile.size / (1024 * 1024)).toFixed(2)} ميغابايت</p>
                  </div>
                  
                  {isProcessingFile ? (
                    <div className="flex items-center justify-center gap-2 text-[10px] text-emerald-400">
                      <svg className="animate-spin h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      جاري محاكاة كاميرا الجوال وتعديل البصمة...
                    </div>
                  ) : (
                    <span className="inline-block text-[10px] bg-emerald-500/5 text-emerald-400 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                      جاهز للمعالجة! انقر لاختيار ملف بديل
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Error in media block */}
            {fileError && (
              <div className="mt-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Processed Metadata and Result download */}
            {processedResult && selectedFile && (
              <div className="mt-4 bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    تم تعديل البصمة الرقمية بنجاح!
                  </span>
                  <button 
                    onClick={resetFileState}
                    className="text-[10px] text-slate-500 hover:text-slate-350"
                  >
                    تصفية الملف
                  </button>
                </div>

                {/* Fingerprint Compare badge */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">البصمة السابقة (الخطر):</span>
                    <span className="text-slate-400 line-through truncate max-w-[120px] block font-mono">{processedResult.originalHash}</span>
                  </div>
                  <ArrowRightLeft className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-left">
                    <span className="text-[10px] text-emerald-400 block font-semibold">بصمة الجوال الجديدة (فريدة):</span>
                    <span className="text-emerald-300 font-bold truncate max-w-[140px] block font-mono bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/20">{processedResult.newHash}</span>
                  </div>
                </div>

                {/* Simulated EXIF specs list */}
                <div>
                  <h4 className="text-[10px] text-slate-450 uppercase mb-2 font-bold flex items-center gap-1">
                    <Settings className="w-3 h-3 text-slate-500" />
                    المواصفات الملصقة بملفات الميديا (EXIF / Tag Injection):
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {Object.entries(processedResult.metadataDetails).map(([key, val]) => (
                      <div key={key} className="bg-slate-900/60 p-2 rounded-lg border border-slate-850/40">
                        <span className="text-slate-500 block text-[9px] mb-0.5">{key}</span>
                        <strong className="text-slate-300 font-medium truncate block leading-tight">{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real Download action with Simulated Device Parameters */}
                <a
                  href={processedResult.modifiedDataUrl}
                  download={`Basma-${selectedProfile.brand}-${Date.now()}-${selectedFile.name}`}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  <MonitorPlay className="w-4 h-4" />
                  تحميل الملف المحسن ذو البصمة الجديدة
                </a>

                <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                  * تم تشويش البكسلات بمستوى غير محسوس للعين البشرية ولكنه يغير البصمة الرقمية للروبوتات تماماً لجعلها كأنها أخذت بهاتفك أصلياً.
                </p>
              </div>
            )}
          </div>

          {/* Tips for reaching millions on Instagram / Facebook / X & anti-shadowban */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-slate-850 pb-2">
              <Flame className="w-4 h-4 text-emerald-400" />
              أسرار وخبايا الخوارزميات (2026/2026 Hacks)
            </h3>
            
            <ul className="space-y-2.5 text-xs text-slate-350">
              <li className="flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>
                  <strong>خوارزمية إنستجرام:</strong> تفضل المحتوى الأصيل وترصد المكرر. تغيير البصمة الرقمية هنا وتعديل صبغة اللون يرفع تقييم الحساب ويرشحه لصفحة الإكسبلور.
                </span>
              </li>
              <li className="flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>
                  <strong>تعديل الكلمات المقيدة:</strong> وضع النقاط بمنتصف الحروف يشتت الذكاء المسؤول عن حجب المصطلحات الحساسة بفيسبوك ويعطيك ظهور اعتيادي للجمهور.
                </span>
              </li>
              <li className="flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>
                  <strong>منصة X وتفاعل الهاشتاغات:</strong> إدراج الهاشتاغات المتداولة بذيل المنشور بشكل منسق مع الإيموجي المناسب يزيد فرص انضمامه للتريند بأول نصف ساعة.
                </span>
              </li>
            </ul>
          </div>
        </section>

      </main>

      {/* Decorative footer */}
      <footer className="max-w-6xl mx-auto border-t border-slate-900 pt-6 text-center text-slate-600 text-[11px] mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          تطبيق بصمة وبوصلة الوصول الذكي © {new Date().getFullYear()} - خوارزميات ريادة المنشورات الاحترافية
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-slate-900 px-2 py-1 rounded text-[10px] border border-slate-850">
            قوة المعالجة: فائقة السرعة
          </span>
          <span className="bg-emerald-500/5 text-emerald-400 px-2 py-1 rounded text-[10px] border border-emerald-500/10">
            الذكاء الاصطناعي: نشط
          </span>
        </div>
      </footer>
    </div>
  );
}
