import { useEffect, useState } from "react";

type Lang = string | undefined;

const messages: Record<string, string[]> = {
  en: [
    "Reading your story and crafting your words...",
    "Crafting your personal statement...",
    "Adding your work experience...",
    "Polishing your skills section...",
    "Almost ready — final touches...",
    "Your CV is nearly done...",
  ],
  pl: [
    "Czytamy Twoją historię i dobieramy słowa...",
    "Tworzymy Twoje podsumowanie zawodowe...",
    "Dodajemy Twoje doświadczenie zawodowe...",
    "Dopracowujemy sekcję umiejętności...",
    "Już prawie gotowe — ostatnie szlify...",
    "Twoje CV jest niemal gotowe...",
  ],
  ro: [
    "Îți citim povestea și alegem cuvintele...",
    "Pregătim declarația ta personală...",
    "Adăugăm experiența ta de muncă...",
    "Finisăm secțiunea de abilități...",
    "Aproape gata — ultimele retușuri...",
    "CV-ul tău este aproape gata...",
  ],
  es: [
    "Leemos tu historia y elegimos las palabras...",
    "Redactando tu declaración personal...",
    "Añadiendo tu experiencia laboral...",
    "Puliendo tu sección de habilidades...",
    "Casi listo — toques finales...",
    "Tu CV está casi terminado...",
  ],
  pt: [
    "A ler a tua história e a escolher as palavras...",
    "A criar a tua declaração pessoal...",
    "A adicionar a tua experiência de trabalho...",
    "A polir a tua secção de competências...",
    "Quase pronto — últimos retoques...",
    "O teu CV está quase pronto...",
  ],
  fr: [
    "Nous lisons votre histoire et choisissons les mots...",
    "Rédaction de votre présentation personnelle...",
    "Ajout de votre expérience professionnelle...",
    "Peaufinage de la section compétences...",
    "Presque prêt — derniers ajustements...",
    "Votre CV est presque terminé...",
  ],
  tr: [
    "Hikayenizi okuyup kelimeleri seçiyoruz...",
    "Kişisel beyanınızı hazırlıyoruz...",
    "İş deneyiminizi ekliyoruz...",
    "Beceri bölümünü cilalıyoruz...",
    "Neredeyse hazır — son rötuşlar...",
    "CV'niz neredeyse hazır...",
  ],
  ar: [
    "نقرأ قصتك ونختار الكلمات المناسبة...",
    "نُعدّ بيانك الشخصي...",
    "نضيف خبراتك المهنية...",
    "نُحسّن قسم المهارات...",
    "أوشكنا على الانتهاء — اللمسات الأخيرة...",
    "سيرتك الذاتية شبه جاهزة...",
  ],
  ur: [
    "آپ کی کہانی پڑھ کر الفاظ منتخب کر رہے ہیں...",
    "آپ کا ذاتی بیان تیار کر رہے ہیں...",
    "آپ کا کام کا تجربہ شامل کر رہے ہیں...",
    "مہارتوں کا حصہ سنوار رہے ہیں...",
    "تقریباً تیار — آخری چھوہیں...",
    "آپ کا سی وی تقریباً مکمل ہے...",
  ],
  hi: [
    "आपकी कहानी पढ़कर शब्द चुन रहे हैं...",
    "आपका व्यक्तिगत विवरण तैयार किया जा रहा है...",
    "आपका कार्य अनुभव जोड़ा जा रहा है...",
    "कौशल अनुभाग को निखारा जा रहा है...",
    "लगभग तैयार — अंतिम छुअन...",
    "आपका सीवी लगभग पूरा हो गया है...",
  ],
  fa: [
    "داستان شما را می‌خوانیم و کلمات را انتخاب می‌کنیم...",
    "بیانیه شخصی شما در حال آماده‌سازی است...",
    "تجربه کاری شما اضافه می‌شود...",
    "بخش مهارت‌ها صیقل داده می‌شود...",
    "تقریباً آماده — جزئیات نهایی...",
    "رزومه شما تقریباً آماده است...",
  ],
  uk: [
    "Читаємо вашу історію та добираємо слова...",
    "Готуємо ваше особисте резюме...",
    "Додаємо ваш досвід роботи...",
    "Шліфуємо розділ навичок...",
    "Майже готово — останні штрихи...",
    "Ваше CV майже готове...",
  ],
  bn: [
    "আপনার গল্প পড়ে শব্দ বাছাই করা হচ্ছে...",
    "আপনার ব্যক্তিগত বিবৃতি তৈরি করা হচ্ছে...",
    "আপনার কাজের অভিজ্ঞতা যোগ করা হচ্ছে...",
    "দক্ষতা বিভাগ পরিমার্জন করা হচ্ছে...",
    "প্রায় তৈরি — চূড়ান্ত স্পর্শ...",
    "আপনার সিভি প্রায় সম্পন্ন...",
  ],
  so: [
    "Waxaan akhrinaynaa sheekadaada oo dooranaynaa ereyada...",
    "Waxaan diyaarinayaa bayaankaaga shakhsiga...",
    "Waxaan ku dareynaynaa khibradaada shaqada...",
    "Waxaan qurxinaynaa qaybta xirfadaha...",
    "Ku dhawaad diyaar — taabashada ugu dambeysa...",
    "CV-gaagu wuu dhawaahay inuu dhammaado...",
  ],
  am: [
    "ታሪክህን እያነበብን ቃላትን እየመረጥን ነው...",
    "የግል መግለጫህ እየተዘጋጀ ነው...",
    "የሥራ ልምድህ እየተጨመረ ነው...",
    "የክህሎት ክፍሉ እየተሸሸ ነው...",
    "ቀረብ ብለናል — የመጨረሻ ዳሳሾች...",
    "CV-ህ ሊጠናቀቅ ቀርቦ ነው...",
  ],
  ti: [
    "ታሪኽካ እናበልናን ቃላት እናመርጽናን ኣለና...",
    "ናይ ውልቂ መግለጺኻ ይዳሎ ኣሎ...",
    "ናይ ስራሕ ተመኩሮኻ ይወሰኽ ኣሎ...",
    "ክፋል ክእለት ይሕሸ ኣሎ...",
    "ቀሪቡ — ናይ መጨረሻ ነጥቢታት...",
    "CV-ኻ ቀሪቡ ዝጠናቐቐ...",
  ],
  ta: [
    "உங்கள் கதையை படித்து வார்த்தைகளை தேர்ந்தெடுக்கிறோம்...",
    "உங்கள் தனிப்பட்ட அறிக்கை தயாரிக்கப்படுகிறது...",
    "உங்கள் பணி அனுபவம் சேர்க்கப்படுகிறது...",
    "திறன்கள் பிரிவு மெருகூட்டப்படுகிறது...",
    "கிட்டத்தட்ட தயார் — இறுதி தொடுதல்கள்...",
    "உங்கள் CV கிட்டத்தட்ட முடிந்தது...",
  ],
  ku: [
    "Çîroka te dixwînim û peyvan hildigirin...",
    "Daxuyaniya kesane ya te tê amadekirin...",
    "Ezmûna te ya kar tê zêdekirin...",
    "Beşa jêhatîbûnan tê xemilandin...",
    "Hema amade — destên dawî...",
    "CV-ya te hema te xelas bibe...",
  ],
  gu: [
    "તમારી વાર્તા વાંચીને શબ્દો પસંદ કરી રહ્યા છીએ...",
    "તમારું વ્યક્તિગત નિવેદન તૈયાર કરી રહ્યા છીએ...",
    "તમારો કાર્ય અનુભવ ઉમેરી રહ્યા છીએ...",
    "કૌશલ્ય વિભાગ નિખારી રહ્યા છીએ...",
    "લગભગ તૈયાર — અંતિમ સ્પર્શ...",
    "તમારું CV લગભગ પૂર્ણ છે...",
  ],
  pa: [
    "ਤੁਹਾਡੀ ਕਹਾਣੀ ਪੜ੍ਹ ਕੇ ਸ਼ਬਦ ਚੁਣ ਰਹੇ ਹਾਂ...",
    "ਤੁਹਾਡਾ ਨਿੱਜੀ ਬਿਆਨ ਤਿਆਰ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...",
    "ਤੁਹਾਡਾ ਕੰਮ ਦਾ ਤਜਰਬਾ ਜੋੜਿਆ ਜਾ ਰਿਹਾ ਹੈ...",
    "ਯੋਗਤਾ ਭਾਗ ਨੂੰ ਸੁਧਾਰਿਆ ਜਾ ਰਿਹਾ ਹੈ...",
    "ਲਗਭਗ ਤਿਆਰ — ਅੰਤਿਮ ਛੋਹ...",
    "ਤੁਹਾਡਾ ਸੀਵੀ ਲਗਭਗ ਮੁਕੰਮਲ ਹੈ...",
  ],
};

const RTL = new Set(["ar", "ur", "fa", "ku"]);

export function GeneratingOverlay({ lang = "en" }: { lang?: Lang }) {
  const code = lang && messages[lang] ? lang : "en";
  const list = messages[code];
  const dir = RTL.has(code) ? "rtl" : "ltr";
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), 2200);
    return () => clearInterval(id);
  }, [list.length]);

  // Animate from 0 → 95% over ~25s using a deceleration curve, so progress
  // always feels moving but never lies by reaching 100% before the API returns.
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const next = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 9))));
      setProgress(next);
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      dir={dir}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-primary/80 px-6 backdrop-blur-sm text-primary-foreground"
    >
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary-foreground/30 border-t-primary-foreground" />
      <p className="max-w-md text-center text-lg font-medium">{list[index]}</p>
      <div className="w-full max-w-md">
        <div className="mb-2 text-center text-sm font-semibold tabular-nums">{progress}%</div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/20">
          <div
            className="h-full rounded-full bg-primary-foreground transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
