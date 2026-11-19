// Pre-written content (no AI — BRD §4.10).

export const journalPrompts = [
  'إيه أكتر حاجة فرحتك النهارده؟',
  'إيه الحاجة اللي اتعلمتها النهارده؟',
  'لو تقدر تعيد لحظة من اليوم، تختار إيه؟',
  'إيه اللي ضايقك وإزاي تتعامل معاه المرة الجاية؟',
  'مين الشخص اللي ممتن له النهارده وليه؟',
  'إيه خطوة صغيرة تقربك من هدفك بكرة؟',
  'إيه اللي كان مستهلك طاقتك النهارده؟',
  'اكتب 3 حاجات حلوة حصلت النهارده.',
  'إيه اللي محتاج تبطّل تأجله؟',
  'إزاي كنت لطيف مع نفسك النهارده؟',
  'إيه الفكرة اللي ماشية في دماغك الأيام دي؟',
  'لو كلمت نفسك من سنة، هتقول لها إيه؟',
  'إيه اللي حاسس إنك بتتحسن فيه؟',
  'إيه اللي تحب يكون مختلف في أسبوعك الجاي؟',
];

export const moods = [
  { value: 'happy', label: 'مبسوط', mee: 'happy' },
  { value: 'calm', label: 'هادي', mee: 'calm' },
  { value: 'tired', label: 'تعبان', mee: 'sleep' },
  { value: 'upset', label: 'مضايق', mee: 'sad' },
] as const;

export const meeUp = [
  'أسبوع حلو! كمّل بنفس الروح.',
  'طالع لفوق 👏 واضح إنك ماسك يومك.',
  'شغل نظيف الأسبوع ده. MEE فخور بيك.',
];
export const meeDown = [
  'أسبوع تقيل شوية، عادي. نبدأ من جديد.',
  'مش لازم كل أسبوع يبقى مثالي. خطوة صغيرة تكفي.',
  'MEE معاك. خلينا نركز على حاجة واحدة الأسبوع الجاي.',
];
export const meeSame = ['ثابت ومستقر. ثبات حلو.', 'نفس مستوى الأسبوع اللي فات — جرّب تزوّد حاجة صغيرة.'];

export const sectionLabels: Record<string, string> = {
  tasks: 'المهام',
  habits: 'العادات',
  prayers: 'الصلاة',
  study: 'المذاكرة',
  routine: 'السكن كير',
  gym: 'الجيم',
  money: 'المصاريف',
};

export const suggestions: Record<string, string> = {
  tasks: 'خلّي مهام اليوم 3 بس، وابدأ بأصعبها الصبح.',
  habits: 'اختار عادة واحدة وخليها بعد حاجة بتعملها كل يوم.',
  prayers: 'فعّل إشعار قبل الصلاة وجهّز نفسك قبلها بخمس دقايق.',
  study: 'جلسة تركيز واحدة 25 دقيقة كل يوم تفرق جامد.',
  routine: 'حط منتجات الروتين في مكان قدام عينك.',
  gym: 'سجّل تمرينك حتى لو قصير — الاستمرارية أهم.',
  money: 'سجّل كل مصروف فور ما يحصل، حتى الصغير.',
};

export const expenseCategories = ['أكل', 'مواصلات', 'اشتراكات', 'تسوق', 'صحة', 'تعليم', 'ترفيه', 'أخرى'];

export const skillIcons = ['leaf', 'book', 'code-slash', 'language', 'barbell', 'brush', 'musical-notes', 'camera', 'calculator', 'chatbubbles', 'school', 'rocket', 'bulb', 'heart', 'globe', 'trophy'] as const;

export const defaultSkincare = {
  AM: ['غسول', 'سيروم', 'مرطب', 'واقي شمس'],
  PM: ['غسول', 'سيروم', 'مرطب'],
};
export const JOURNAL_LOCK_KEY = 'me.journalLock';
