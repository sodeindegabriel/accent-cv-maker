// Translations for the multi-step build form. Used when the user opts to see
// the questions in their selected language. Keys cover step titles, subtitles,
// navigation buttons, and the most common labels/hints. Missing keys fall back
// to English per-key so partial translations remain readable.

export type TKey =
  | "step2Title"
  | "step2Subtitle"
  | "step3Title"
  | "step3Subtitle"
  | "step4Title"
  | "step4Subtitle"
  | "step5Title"
  | "step5Subtitle"
  | "step6Title"
  | "step6Subtitle"
  | "continue"
  | "back"
  | "modalQuestion"
  | "stepOf"
  // Step 2
  | "job_hospitality"
  | "job_construction"
  | "job_care"
  | "job_delivery"
  | "job_cleaning"
  | "job_retail"
  | "job_warehouse"
  | "job_office"
  | "job_beauty"
  | "job_other"
  | "otherWorkType"
  | "otherWorkPlaceholder"
  // Step 3
  | "fullName"
  | "phoneNumber"
  | "email"
  | "cityUk"
  | "rightToWork"
  | "rtw_british"
  | "rtw_settled"
  | "rtw_skilled"
  | "rtw_student"
  | "rtw_refugee"
  | "rtw_other"
  | "describeStatus"
  | "describeStatusPlaceholder"
  // Step 4
  | "expType_paid"
  | "expType_paid_desc"
  | "expType_informal"
  | "expType_informal_desc"
  | "expType_volunteer"
  | "expType_volunteer_desc"
  | "expType_none"
  | "expType_none_desc"
  | "experienceN"
  | "remove"
  | "roleOrActivity"
  | "companyOrPlace"
  | "dates"
  | "whatYouDid"
  | "addExperience"
  // Step 5
  | "skills"
  | "addAnotherSkill"
  | "add"
  | "availability"
  | "skill_customer"
  | "skill_teamwork"
  | "skill_timekeeping"
  | "skill_cleaning"
  | "skill_food"
  | "skill_stock"
  | "skill_driving"
  | "skill_cash"
  | "skill_care"
  | "skill_office"
  | "skill_problem"
  | "skill_english"
  | "avail_weekdays"
  | "avail_weekends"
  | "avail_evenings"
  | "avail_mornings"
  | "avail_full"
  | "avail_part"
  // Step 6
  | "language"
  | "workWanted"
  | "personalDetails"
  | "experience"
  | "skillsAndAvailability"
  | "edit"
  | "close"
  | "notSelected"
  | "nameMissing"
  | "phoneMissing"
  | "emailMissing"
  | "cityMissing"
  | "rtwMissing"
  | "noExperienceYet"
  | "notAdded"
  | "noSkills"
  | "noAvailability"
  | "generateCv"
  | "generating"
  | "somethingWrong"
  | "retry";

type Dict = Partial<Record<TKey, string>>;

const en: Record<TKey, string> = {
  step2Title: "What kind of work are you looking for?",
  step2Subtitle: "Choose every type of role you would consider.",
  step3Title: "Tell us about yourself",
  step3Subtitle: "These details help employers contact you.",
  step4Title: "What experience do you have?",
  step4Subtitle: "Paid, informal and volunteer experience can all help your CV.",
  step5Title: "What are your skills and availability?",
  step5Subtitle: "Select the strengths and working times that fit you.",
  step6Title: "Review your CV details",
  step6Subtitle: "Check everything before generating your English CV.",
  continue: "Continue",
  back: "Back",
  modalQuestion: "Would you like the questions in {lang} or in English?",
  stepOf: "Step {n} of 6",
  job_hospitality: "Hospitality",
  job_construction: "Construction",
  job_care: "Care work",
  job_delivery: "Delivery & driving",
  job_cleaning: "Cleaning",
  job_retail: "Retail",
  job_warehouse: "Warehouse",
  job_office: "Office work",
  job_beauty: "Beauty & salon",
  job_other: "Something else",
  otherWorkType: "Other work type",
  otherWorkPlaceholder: "Tell us what kind of work",
  fullName: "Full name",
  phoneNumber: "Phone number",
  email: "Email",
  cityUk: "City in the UK",
  rightToWork: "Right to work",
  rtw_british: "British citizen",
  rtw_settled: "Settled / pre-settled status",
  rtw_skilled: "Skilled worker visa",
  rtw_student: "Student visa",
  rtw_refugee: "Refugee status",
  rtw_other: "Other / not sure",
  describeStatus: "Please describe your status",
  describeStatusPlaceholder: "e.g. Pre-settled status, applying for visa…",
  expType_paid: "Paid work",
  expType_paid_desc: "Jobs in the UK or back home",
  expType_informal: "Informal / family work",
  expType_informal_desc: "Helped family business or neighbours",
  expType_volunteer: "Volunteering",
  expType_volunteer_desc: "Unpaid work for community or charity",
  expType_none: "No experience yet",
  expType_none_desc: "I’m just starting out",
  experienceN: "Experience {n}",
  remove: "Remove",
  roleOrActivity: "Role or activity",
  companyOrPlace: "Company or place",
  dates: "Dates",
  whatYouDid: "What you did",
  addExperience: "Add experience",
  skills: "Skills",
  addAnotherSkill: "Add another skill",
  add: "Add",
  availability: "Availability",
  skill_customer: "Customer service",
  skill_teamwork: "Teamwork",
  skill_timekeeping: "Timekeeping",
  skill_cleaning: "Cleaning",
  skill_food: "Food preparation",
  skill_stock: "Stock handling",
  skill_driving: "Driving",
  skill_cash: "Cash handling",
  skill_care: "Care support",
  skill_office: "Microsoft Office",
  skill_problem: "Problem solving",
  skill_english: "English communication",
  avail_weekdays: "Weekdays",
  avail_weekends: "Weekends",
  avail_evenings: "Evenings",
  avail_mornings: "Early mornings",
  avail_full: "Full-time",
  avail_part: "Part-time",
  language: "Language",
  workWanted: "Work wanted",
  personalDetails: "Personal details",
  experience: "Experience",
  skillsAndAvailability: "Skills and availability",
  edit: "Edit",
  close: "Close",
  notSelected: "Not selected",
  nameMissing: "Name missing",
  phoneMissing: "Phone missing",
  emailMissing: "Email not provided",
  cityMissing: "City missing",
  rtwMissing: "Right to work missing",
  noExperienceYet: "No experience yet",
  notAdded: "Not added",
  noSkills: "No skills selected",
  noAvailability: "No availability selected",
  generateCv: "Generate My CV",
  generating: "Generating…",
  somethingWrong: "Something went wrong. Please try again.",
  retry: "Retry",
};

const translations: Record<string, Dict> = {
  en,
  ar: {
    step2Title: "ما نوع العمل الذي تبحث عنه؟",
    step2Subtitle: "اختر كل نوع من الوظائف التي تفكر فيها.",
    step3Title: "أخبرنا عن نفسك",
    step3Subtitle: "تساعد هذه التفاصيل أصحاب العمل على التواصل معك.",
    step4Title: "ما هي خبراتك؟",
    step4Subtitle: "الخبرة المدفوعة وغير الرسمية والتطوعية كلها تفيد سيرتك الذاتية.",
    step5Title: "ما هي مهاراتك وأوقات توفرك؟",
    step5Subtitle: "اختر نقاط قوتك وأوقات العمل المناسبة لك.",
    step6Title: "راجع تفاصيل سيرتك الذاتية",
    step6Subtitle: "تحقق من كل شيء قبل إنشاء سيرتك الذاتية باللغة الإنجليزية.",
    continue: "متابعة",
    back: "رجوع",
    modalQuestion: "هل تريد الأسئلة باللغة {lang} أم بالإنجليزية؟",
    stepOf: "الخطوة {n} من 6",
    fullName: "الاسم الكامل",
    phoneNumber: "رقم الهاتف",
    email: "البريد الإلكتروني",
    cityUk: "المدينة في المملكة المتحدة",
    rightToWork: "الحق في العمل",
    skills: "المهارات",
    availability: "التوفر",
    add: "إضافة",
    remove: "حذف",
    edit: "تعديل",
    close: "إغلاق",
    language: "اللغة",
    workWanted: "العمل المطلوب",
    personalDetails: "البيانات الشخصية",
    experience: "الخبرة",
    skillsAndAvailability: "المهارات والتوفر",
    generateCv: "أنشئ سيرتي الذاتية",
    generating: "جارٍ الإنشاء…",
    retry: "إعادة المحاولة",
    addExperience: "أضف خبرة",
    addAnotherSkill: "أضف مهارة أخرى",
    dates: "التواريخ",
    whatYouDid: "ما الذي قمت به",
    roleOrActivity: "الدور أو النشاط",
    companyOrPlace: "الشركة أو المكان",
  },
  uk: {
    step2Title: "Яку роботу ви шукаєте?",
    step2Subtitle: "Оберіть усі типи ролей, які ви розглядаєте.",
    step3Title: "Розкажіть про себе",
    step3Subtitle: "Ці дані допоможуть роботодавцям зв’язатися з вами.",
    step4Title: "Який у вас досвід?",
    step4Subtitle: "Оплачуваний, неформальний і волонтерський досвід — усе допомагає.",
    step5Title: "Які ваші навички та доступність?",
    step5Subtitle: "Оберіть сильні сторони та час роботи, що вам підходить.",
    step6Title: "Перевірте дані вашого резюме",
    step6Subtitle: "Перевірте все перед створенням резюме англійською.",
    continue: "Далі",
    back: "Назад",
    modalQuestion: "Бажаєте бачити запитання {lang} чи англійською?",
    stepOf: "Крок {n} з 6",
    fullName: "Повне ім'я",
    phoneNumber: "Номер телефону",
    email: "Електронна пошта",
    cityUk: "Місто у Великій Британії",
    skills: "Навички",
    availability: "Доступність",
    add: "Додати",
    edit: "Редагувати",
    close: "Закрити",
    language: "Мова",
    generateCv: "Створити моє резюме",
    generating: "Створюється…",
  },
  pl: {
    step2Title: "Jakiej pracy szukasz?",
    step2Subtitle: "Wybierz wszystkie rodzaje pracy, które rozważasz.",
    step3Title: "Opowiedz nam o sobie",
    step3Subtitle: "Te dane pomogą pracodawcom się z Tobą skontaktować.",
    step4Title: "Jakie masz doświadczenie?",
    step4Subtitle: "Płatna, nieformalna i wolontariacka praca pomoże Twojemu CV.",
    step5Title: "Jakie masz umiejętności i dostępność?",
    step5Subtitle: "Wybierz mocne strony i godziny pracy, które Ci pasują.",
    step6Title: "Sprawdź dane swojego CV",
    step6Subtitle: "Sprawdź wszystko przed wygenerowaniem CV po angielsku.",
    continue: "Dalej",
    back: "Wstecz",
    modalQuestion: "Czy chcesz widzieć pytania po {lang} czy po angielsku?",
    stepOf: "Krok {n} z 6",
    job_hospitality: "Gastronomia",
    job_construction: "Budownictwo",
    job_care: "Opieka",
    job_delivery: "Dostawy i kierowanie",
    job_cleaning: "Sprzątanie",
    job_retail: "Handel",
    job_warehouse: "Magazyn",
    job_office: "Praca biurowa",
    job_beauty: "Uroda i salon",
    job_other: "Coś innego",
    otherWorkType: "Inny rodzaj pracy",
    otherWorkPlaceholder: "Powiedz nam, jaką pracę",
    fullName: "Imię i nazwisko",
    phoneNumber: "Numer telefonu",
    email: "E-mail",
    cityUk: "Miasto w Wielkiej Brytanii",
    rightToWork: "Prawo do pracy",
    rtw_british: "Obywatel brytyjski",
    rtw_settled: "Status osiedlony / wstępny",
    rtw_skilled: "Wiza pracownika wykwalifikowanego",
    rtw_student: "Wiza studencka",
    rtw_refugee: "Status uchodźcy",
    rtw_other: "Inny / nie wiem",
    describeStatus: "Opisz swój status",
    describeStatusPlaceholder: "np. status wstępny, w trakcie wnioskowania o wizę…",
    expType_paid: "Praca płatna",
    expType_paid_desc: "Praca w Wielkiej Brytanii lub w kraju",
    expType_informal: "Praca nieformalna / rodzinna",
    expType_informal_desc: "Pomoc w firmie rodzinnej lub u sąsiadów",
    expType_volunteer: "Wolontariat",
    expType_volunteer_desc: "Praca bez wynagrodzenia dla wspólnoty",
    expType_none: "Brak doświadczenia",
    expType_none_desc: "Dopiero zaczynam",
    experienceN: "Doświadczenie {n}",
    remove: "Usuń",
    roleOrActivity: "Rola lub działalność",
    companyOrPlace: "Firma lub miejsce",
    dates: "Daty",
    whatYouDid: "Co robiłeś/aś",
    addExperience: "Dodaj doświadczenie",
    skills: "Umiejętności",
    addAnotherSkill: "Dodaj kolejną umiejętność",
    add: "Dodaj",
    availability: "Dostępność",
    skill_customer: "Obsługa klienta",
    skill_teamwork: "Praca zespołowa",
    skill_timekeeping: "Punktualność",
    skill_cleaning: "Sprzątanie",
    skill_food: "Przygotowywanie jedzenia",
    skill_stock: "Obsługa towaru",
    skill_driving: "Prowadzenie pojazdu",
    skill_cash: "Obsługa kasy",
    skill_care: "Opieka",
    skill_office: "Microsoft Office",
    skill_problem: "Rozwiązywanie problemów",
    skill_english: "Komunikacja po angielsku",
    avail_weekdays: "Dni robocze",
    avail_weekends: "Weekendy",
    avail_evenings: "Wieczory",
    avail_mornings: "Wczesne ranki",
    avail_full: "Pełny etat",
    avail_part: "Niepełny etat",
    language: "Język",
    workWanted: "Poszukiwana praca",
    personalDetails: "Dane osobowe",
    experience: "Doświadczenie",
    skillsAndAvailability: "Umiejętności i dostępność",
    edit: "Edytuj",
    close: "Zamknij",
    notSelected: "Nie wybrano",
    nameMissing: "Brak imienia",
    phoneMissing: "Brak telefonu",
    emailMissing: "Nie podano e-maila",
    cityMissing: "Brak miasta",
    rtwMissing: "Brak prawa do pracy",
    noExperienceYet: "Brak doświadczenia",
    notAdded: "Nie dodano",
    noSkills: "Nie wybrano umiejętności",
    noAvailability: "Nie wybrano dostępności",
    generateCv: "Wygeneruj moje CV",
    generating: "Generowanie…",
    somethingWrong: "Coś poszło nie tak. Spróbuj ponownie.",
    retry: "Spróbuj ponownie",
  },
  ro: {
    step2Title: "Ce fel de muncă cauți?",
    step2Subtitle: "Alege toate tipurile de roluri pe care le-ai lua în considerare.",
    step3Title: "Spune-ne despre tine",
    step3Subtitle: "Aceste detalii ajută angajatorii să te contacteze.",
    step4Title: "Ce experiență ai?",
    step4Subtitle: "Experiența plătită, informală și de voluntariat ajută CV-ul tău.",
    step5Title: "Care sunt abilitățile și disponibilitatea ta?",
    step5Subtitle: "Alege punctele forte și programul care ți se potrivesc.",
    step6Title: "Verifică detaliile CV-ului",
    step6Subtitle: "Verifică totul înainte de a genera CV-ul în engleză.",
    continue: "Continuă",
    back: "Înapoi",
    modalQuestion: "Vrei întrebările în {lang} sau în engleză?",
    stepOf: "Pasul {n} din 6",
    fullName: "Nume complet",
    phoneNumber: "Număr de telefon",
    email: "Email",
    cityUk: "Oraș în Marea Britanie",
    skills: "Abilități",
    availability: "Disponibilitate",
    add: "Adaugă",
    edit: "Editează",
    close: "Închide",
    language: "Limbă",
    generateCv: "Generează CV-ul meu",
    generating: "Se generează…",
  },
  es: {
    step2Title: "¿Qué tipo de trabajo buscas?",
    step2Subtitle: "Elige todos los tipos de empleo que considerarías.",
    step3Title: "Cuéntanos sobre ti",
    step3Subtitle: "Estos datos ayudan a los empleadores a contactarte.",
    step4Title: "¿Qué experiencia tienes?",
    step4Subtitle: "La experiencia pagada, informal y voluntaria ayuda a tu CV.",
    step5Title: "¿Cuáles son tus habilidades y disponibilidad?",
    step5Subtitle: "Selecciona las fortalezas y horarios que mejor te convengan.",
    step6Title: "Revisa los datos de tu CV",
    step6Subtitle: "Comprueba todo antes de generar tu CV en inglés.",
    continue: "Continuar",
    back: "Atrás",
    modalQuestion: "¿Quieres las preguntas en {lang} o en inglés?",
    stepOf: "Paso {n} de 6",
    job_hospitality: "Hostelería",
    job_construction: "Construcción",
    job_care: "Cuidado",
    job_delivery: "Reparto y conducción",
    job_cleaning: "Limpieza",
    job_retail: "Comercio",
    job_warehouse: "Almacén",
    job_office: "Trabajo de oficina",
    job_beauty: "Belleza y salón",
    job_other: "Otra cosa",
    fullName: "Nombre completo",
    phoneNumber: "Número de teléfono",
    email: "Correo electrónico",
    cityUk: "Ciudad en el Reino Unido",
    rightToWork: "Derecho a trabajar",
    skills: "Habilidades",
    availability: "Disponibilidad",
    add: "Añadir",
    remove: "Quitar",
    edit: "Editar",
    close: "Cerrar",
    language: "Idioma",
    workWanted: "Trabajo deseado",
    personalDetails: "Datos personales",
    experience: "Experiencia",
    skillsAndAvailability: "Habilidades y disponibilidad",
    addExperience: "Añadir experiencia",
    addAnotherSkill: "Añadir otra habilidad",
    dates: "Fechas",
    whatYouDid: "Qué hiciste",
    roleOrActivity: "Rol o actividad",
    companyOrPlace: "Empresa o lugar",
    generateCv: "Generar mi CV",
    generating: "Generando…",
    somethingWrong: "Algo salió mal. Inténtalo de nuevo.",
    retry: "Reintentar",
  },
  pt: {
    step2Title: "Que tipo de trabalho você procura?",
    step2Subtitle: "Escolha todos os tipos de função que consideraria.",
    step3Title: "Fale sobre você",
    step3Subtitle: "Estes dados ajudam os empregadores a entrar em contato.",
    step4Title: "Que experiência você tem?",
    step4Subtitle: "Trabalho remunerado, informal e voluntário ajudam o seu CV.",
    step5Title: "Quais são as suas competências e disponibilidade?",
    step5Subtitle: "Selecione os pontos fortes e horários que lhe convêm.",
    step6Title: "Revise os dados do seu CV",
    step6Subtitle: "Verifique tudo antes de gerar o seu CV em inglês.",
    continue: "Continuar",
    back: "Voltar",
    modalQuestion: "Quer as perguntas em {lang} ou em inglês?",
    stepOf: "Passo {n} de 6",
    fullName: "Nome completo",
    phoneNumber: "Número de telefone",
    email: "Email",
    cityUk: "Cidade no Reino Unido",
    skills: "Competências",
    availability: "Disponibilidade",
    add: "Adicionar",
    edit: "Editar",
    close: "Fechar",
    language: "Idioma",
    generateCv: "Gerar meu CV",
    generating: "Gerando…",
  },
  fr: {
    step2Title: "Quel type de travail recherchez-vous ?",
    step2Subtitle: "Choisissez tous les types de postes qui vous intéressent.",
    step3Title: "Parlez-nous de vous",
    step3Subtitle: "Ces informations aident les employeurs à vous contacter.",
    step4Title: "Quelle est votre expérience ?",
    step4Subtitle: "L’expérience rémunérée, informelle et bénévole aide votre CV.",
    step5Title: "Quelles sont vos compétences et disponibilités ?",
    step5Subtitle: "Sélectionnez vos points forts et vos horaires de travail.",
    step6Title: "Vérifiez les détails de votre CV",
    step6Subtitle: "Vérifiez tout avant de générer votre CV en anglais.",
    continue: "Continuer",
    back: "Retour",
    modalQuestion: "Voulez-vous les questions en {lang} ou en anglais ?",
    stepOf: "Étape {n} sur 6",
    fullName: "Nom complet",
    phoneNumber: "Numéro de téléphone",
    email: "Email",
    cityUk: "Ville au Royaume-Uni",
    skills: "Compétences",
    availability: "Disponibilité",
    add: "Ajouter",
    edit: "Modifier",
    close: "Fermer",
    language: "Langue",
    generateCv: "Générer mon CV",
    generating: "Génération…",
  },
  ur: {
    step2Title: "آپ کس قسم کا کام تلاش کر رہے ہیں؟",
    step2Subtitle: "ہر قسم کا کام منتخب کریں جس پر آپ غور کریں گے۔",
    step3Title: "اپنے بارے میں بتائیں",
    step3Subtitle: "یہ تفصیلات آجروں کو آپ سے رابطہ کرنے میں مدد دیتی ہیں۔",
    step4Title: "آپ کے پاس کیا تجربہ ہے؟",
    step4Subtitle: "تنخواہ، غیر رسمی اور رضاکارانہ تجربہ سب آپ کے سی وی کے لیے مفید ہے۔",
    step5Title: "آپ کی مہارتیں اور دستیابی کیا ہیں؟",
    step5Subtitle: "اپنی خوبیاں اور کام کے اوقات منتخب کریں۔",
    step6Title: "اپنے سی وی کی تفصیلات کا جائزہ لیں",
    step6Subtitle: "انگریزی سی وی بنانے سے پہلے ہر چیز چیک کریں۔",
    continue: "جاری رکھیں",
    back: "واپس",
    modalQuestion: "کیا آپ سوالات {lang} میں چاہتے ہیں یا انگریزی میں؟",
    stepOf: "مرحلہ {n} از 6",
    fullName: "پورا نام",
    phoneNumber: "فون نمبر",
    email: "ای میل",
    cityUk: "برطانیہ میں شہر",
    skills: "مہارتیں",
    availability: "دستیابی",
    add: "شامل کریں",
    edit: "ترمیم",
    close: "بند کریں",
    language: "زبان",
    generateCv: "میرا سی وی بنائیں",
    generating: "بن رہا ہے…",
  },
  hi: {
    step2Title: "आप किस तरह का काम ढूंढ रहे हैं?",
    step2Subtitle: "हर उस तरह का काम चुनें जिस पर आप विचार करेंगे।",
    step3Title: "अपने बारे में बताएं",
    step3Subtitle: "ये विवरण नियोक्ताओं को आपसे संपर्क करने में मदद करते हैं।",
    step4Title: "आपके पास क्या अनुभव है?",
    step4Subtitle: "वेतन वाला, अनौपचारिक और स्वयंसेवी अनुभव आपके CV में मदद करता है।",
    step5Title: "आपके कौशल और उपलब्धता क्या हैं?",
    step5Subtitle: "अपनी ताकत और काम के समय चुनें।",
    step6Title: "अपने CV के विवरण की समीक्षा करें",
    step6Subtitle: "अंग्रेज़ी CV बनाने से पहले सब कुछ जांचें।",
    continue: "जारी रखें",
    back: "पीछे",
    modalQuestion: "क्या आप प्रश्न {lang} में चाहते हैं या अंग्रेज़ी में?",
    stepOf: "चरण {n} / 6",
    fullName: "पूरा नाम",
    phoneNumber: "फ़ोन नंबर",
    email: "ईमेल",
    cityUk: "यूके में शहर",
    skills: "कौशल",
    availability: "उपलब्धता",
    add: "जोड़ें",
    edit: "संपादित करें",
    close: "बंद करें",
    language: "भाषा",
    generateCv: "मेरा CV बनाएं",
    generating: "बना रहे हैं…",
  },
  bn: {
    step2Title: "আপনি কী ধরনের কাজ খুঁজছেন?",
    step2Subtitle: "যে ধরনের কাজ আপনি বিবেচনা করবেন সব নির্বাচন করুন।",
    step3Title: "নিজের সম্পর্কে বলুন",
    step3Subtitle: "এই তথ্য নিয়োগকর্তাদের আপনার সাথে যোগাযোগ করতে সাহায্য করে।",
    step4Title: "আপনার কী অভিজ্ঞতা আছে?",
    step4Subtitle: "বেতনের, অনানুষ্ঠানিক ও স্বেচ্ছাসেবী অভিজ্ঞতা সবই সাহায্য করে।",
    step5Title: "আপনার দক্ষতা ও প্রাপ্যতা কী?",
    step5Subtitle: "আপনার শক্তি ও কাজের সময় নির্বাচন করুন।",
    step6Title: "আপনার সিভি বিবরণ পর্যালোচনা করুন",
    step6Subtitle: "ইংরেজি সিভি তৈরির আগে সবকিছু পরীক্ষা করুন।",
    continue: "চালিয়ে যান",
    back: "পেছনে",
    modalQuestion: "আপনি কি প্রশ্নগুলি {lang} ভাষায় চান, না ইংরেজিতে?",
  },
  so: {
    step2Title: "Shaqo noocee ah ayaad raadinaysaa?",
    step2Subtitle: "Dooro dhammaan noocyada shaqada ee aad ka fikiri lahayd.",
    step3Title: "Naga sheeg wax ku saabsan adiga",
    step3Subtitle: "Faahfaahintan waxay shaqo bixiyeyaasha ka caawisaa inay kula soo xiriiraan.",
    step4Title: "Maxaad waaya'aragnimo u leedahay?",
    step4Subtitle: "Shaqada lacagta, qoyska iyo iskaa wax u qabso oo dhan way kaa caawisaa.",
    step5Title: "Waa maxay xirfadahaaga iyo helitaankaaga?",
    step5Subtitle: "Dooro xoogaagga iyo wakhtiyada shaqada ee kuu habboon.",
    step6Title: "Dib u eeg faahfaahinta CV-gaaga",
    step6Subtitle: "Hubi wax walba ka hor inta aanad samaynin CV-ga Ingiriisiga.",
    continue: "Sii wad",
    back: "Dib",
    modalQuestion: "Ma rabtaa su'aalaha {lang} mise Ingiriis?",
  },
  tr: {
    step2Title: "Ne tür bir iş arıyorsunuz?",
    step2Subtitle: "Düşünebileceğiniz tüm iş türlerini seçin.",
    step3Title: "Kendinizden bahsedin",
    step3Subtitle: "Bu bilgiler işverenlerin size ulaşmasını sağlar.",
    step4Title: "Ne tür deneyiminiz var?",
    step4Subtitle: "Ücretli, gayri resmi ve gönüllü deneyim CV'nize yardımcı olur.",
    step5Title: "Beceri ve uygunluğunuz nedir?",
    step5Subtitle: "Güçlü yönlerinizi ve çalışma saatlerinizi seçin.",
    step6Title: "CV bilgilerinizi gözden geçirin",
    step6Subtitle: "İngilizce CV'nizi oluşturmadan önce her şeyi kontrol edin.",
    continue: "Devam",
    back: "Geri",
    modalQuestion: "Soruları {lang} dilinde mi yoksa İngilizce mi istersiniz?",
  },
  fa: {
    step2Title: "به دنبال چه نوع کاری هستید؟",
    step2Subtitle: "همه نوع کاری را که در نظر می‌گیرید انتخاب کنید.",
    step3Title: "درباره خودتان بگویید",
    step3Subtitle: "این جزئیات به کارفرمایان کمک می‌کند با شما تماس بگیرند.",
    step4Title: "چه تجربه‌ای دارید؟",
    step4Subtitle: "تجربه‌ی شغلی، غیررسمی و داوطلبانه همه به رزومه کمک می‌کند.",
    step5Title: "مهارت‌ها و دسترسی شما چیست؟",
    step5Subtitle: "نقاط قوت و ساعات کاری مناسب خود را انتخاب کنید.",
    step6Title: "جزئیات رزومه خود را بررسی کنید",
    step6Subtitle: "قبل از ایجاد رزومه انگلیسی همه چیز را بررسی کنید.",
    continue: "ادامه",
    back: "بازگشت",
    modalQuestion: "آیا سؤالات را به {lang} می‌خواهید یا به انگلیسی؟",
  },
  zh: {
    step2Title: "您在找什么样的工作？",
    step2Subtitle: "选择您愿意考虑的所有工作类型。",
    step3Title: "介绍一下您自己",
    step3Subtitle: "这些信息有助于雇主与您联系。",
    step4Title: "您有哪些经验？",
    step4Subtitle: "有薪、非正式和志愿者经验都对简历有帮助。",
    step5Title: "您的技能和可工作时间是什么？",
    step5Subtitle: "选择适合您的强项和工作时间。",
    step6Title: "查看您的简历详情",
    step6Subtitle: "在生成英文简历前请检查所有内容。",
    continue: "继续",
    back: "返回",
    modalQuestion: "您希望以{lang}还是英文显示问题？",
  },
};

export function t(code: string | undefined, key: TKey, vars?: Record<string, string | number>): string {
  const dict = (code && translations[code]) || translations.en;
  let str: string = dict[key] ?? translations.en[key] ?? "";
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}
