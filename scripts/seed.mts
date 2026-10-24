// Fills an empty database with test contacts and notes.
// Run with: pnpm db:seed
//
// The script only inserts: it never deletes or overwrites data,
// and it refuses to run when the contacts table already has rows.
// It is executed by Node.js directly (no bundler), which is why the file is
// an ES module (.mts) and the local import keeps its .ts extension.

import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  contacts,
  notes,
  type KeepInTouchInterval,
} from "../src/db/schema.ts";

const CONTACT_COUNT = 1000;
const RANDOM_SEED = 20261008;
const DAY_MS = 24 * 60 * 60 * 1000;

type Gender = "male" | "female";
// A phrase that changes with the gender of the contact: [male, female].
type Gendered = readonly [string, string];
type Phrase = string | Gendered;

// --- Deterministic random numbers: the same seed gives the same people. ---

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(RANDOM_SEED);

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function chance(probability: number): boolean {
  return random() < probability;
}

function pickWeighted<T>(
  options: readonly (readonly [T, number])[],
  next: () => number = random,
): T {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let threshold = next() * total;

  for (const [value, weight] of options) {
    threshold -= weight;
    if (threshold < 0) {
      return value;
    }
  }

  return options[options.length - 1][0];
}

function resolve(phrase: Phrase, gender: Gender): string {
  return typeof phrase === "string"
    ? phrase
    : phrase[gender === "male" ? 0 : 1];
}

// --- Names ---

const MALE_FIRST_NAMES = [
  "Александр", "Алексей", "Андрей", "Антон", "Артём", "Борис", "Вадим",
  "Валерий", "Василий", "Виктор", "Виталий", "Владимир", "Владислав",
  "Вячеслав", "Георгий", "Глеб", "Григорий", "Даниил", "Денис", "Дмитрий",
  "Евгений", "Егор", "Иван", "Игорь", "Илья", "Кирилл", "Константин", "Лев",
  "Леонид", "Максим", "Марк", "Матвей", "Михаил", "Никита", "Николай", "Олег",
  "Павел", "Пётр", "Роман", "Руслан", "Семён", "Сергей", "Станислав",
  "Степан", "Тимофей", "Тимур", "Фёдор", "Эдуард", "Юрий", "Ярослав",
] as const;

const FEMALE_FIRST_NAMES = [
  "Александра", "Алина", "Алиса", "Алла", "Анастасия", "Анна", "Валентина",
  "Валерия", "Вера", "Вероника", "Виктория", "Галина", "Дарья", "Диана",
  "Ева", "Евгения", "Екатерина", "Елена", "Елизавета", "Жанна", "Зоя", "Инна",
  "Ирина", "Карина", "Кира", "Кристина", "Ксения", "Лариса", "Лидия",
  "Любовь", "Людмила", "Маргарита", "Марина", "Мария", "Милана", "Надежда",
  "Наталья", "Нина", "Оксана", "Олеся", "Ольга", "Полина", "Светлана",
  "София", "Таисия", "Тамара", "Татьяна", "Ульяна", "Юлия", "Яна",
] as const;

// Surnames are listed in the male form; the female form is derived.
const SURNAMES = [
  "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов",
  "Михайлов", "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев",
  "Лебедев", "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев",
  "Орлов", "Андреев", "Макаров", "Никитин", "Захаров", "Зайцев", "Соловьёв",
  "Борисов", "Яковлев", "Григорьев", "Романов", "Воробьёв", "Сергеев",
  "Кузьмин", "Фролов", "Александров", "Дмитриев", "Королёв", "Гусев",
  "Киселёв", "Ильин", "Максимов", "Поляков", "Сорокин", "Виноградов",
  "Ковалёв", "Белов", "Медведев", "Антонов", "Тарасов", "Жуков", "Баранов",
  "Филиппов", "Комаров", "Давыдов", "Беляев", "Герасимов", "Богданов",
  "Осипов", "Сидоров", "Матвеев", "Титов", "Марков", "Миронов", "Крылов",
  "Куликов", "Карпов", "Власов", "Мельников", "Денисов", "Гаврилов",
  "Тихонов", "Казаков", "Афанасьев", "Данилов", "Савельев", "Тимофеев",
  "Фомин", "Чернов", "Абрамов", "Мартынов", "Ефимов", "Федотов", "Щербаков",
  "Назаров", "Калинин", "Исаев", "Чернышёв", "Быков", "Маслов", "Родионов",
  "Коновалов", "Лазарев", "Воронин", "Климов", "Филатов", "Пономарёв",
  "Голубев", "Кудрявцев", "Прохоров", "Наумов", "Потапов", "Журавлёв",
  "Овчинников", "Трофимов", "Леонов", "Соболев", "Ермаков", "Колесников",
  "Гончаров", "Емельянов", "Никифоров", "Грачёв", "Котов", "Гришин",
  "Ефремов", "Архипов", "Громов", "Кириллов", "Малышев", "Панов", "Моисеев",
  "Румянцев", "Акимов", "Кондратьев", "Бирюков", "Горбунов", "Анисимов",
  "Тихомиров", "Галкин", "Лукьянов", "Михеев", "Скворцов", "Юдин",
  "Белоусов", "Нестеров", "Симонов", "Прокофьев", "Харитонов", "Князев",
  "Цветков", "Левин", "Митрофанов", "Воронов", "Аксёнов", "Мальцев",
  "Логинов", "Горшков", "Савин", "Краснов", "Майоров", "Демидов", "Елисеев",
  "Рыбаков", "Сафонов", "Плотников", "Фокин",
  "Островский", "Крамской", "Высоцкий", "Белинский", "Полянский",
  "Вишневский", "Левицкий", "Троицкий", "Садовский", "Покровский", "Раевский",
  "Шевченко", "Бондаренко", "Коваленко", "Ткаченко", "Кравченко", "Савченко",
  "Лысенко", "Петренко", "Ковальчук", "Ткачук", "Романюк", "Гуревич",
  "Саакян", "Григорян", "Петросян",
] as const;

function toFemaleSurname(surname: string): string {
  if (/(ов|ев|ёв|ин|ын)$/.test(surname)) {
    return `${surname}а`;
  }

  if (/(ский|цкий|ой)$/.test(surname)) {
    return `${surname.slice(0, -2)}ая`;
  }

  // Шевченко, Ковальчук, Гуревич, Саакян stay the same.
  return surname;
}

// --- Vocabulary ---

// Fictional companies, written in the form that follows the preposition "в".
const COMPANIES = [
  "компании «Северный ветер»", "фирме «Альфа-Проект»", "студии «Пиксель»",
  "бюро «Чертёж»", "клинике «Медлайн»", "компании «ГрузЭкспресс»",
  "компании «Финлаб»", "компании «Зелёный квартал»", "компании «ТехноСфера»",
  "холдинге «Орбита Медиа»", "издательстве «Абзац»", "фирме «Прайм Консалт»",
  "компании «СтройГарант»", "компании «Вектор Логистик»",
  "стартапе «Лаборатория данных»", "агентстве «Маяк»", "клинике «Здоровье+»",
  "школе «Перспектива»", "турфирме «Яркий мир»", "магазине «Домашний очаг»",
] as const;

const JOB_TITLES = [
  "Дизайнер", "Продакт-менеджер", "Разработчик", "Аналитик", "Бухгалтер",
  "Юрист", "Маркетолог", "HR-менеджер", "Архитектор", "Инженер", "Редактор",
  "Переводчик", "Руководитель отдела продаж", "Проектный менеджер",
  "Тестировщик", "Копирайтер", "Фотограф", "Финансовый директор",
  "Системный администратор", "Менеджер по закупкам", "Журналист",
  "Экономист", "Логист", "Технолог",
] as const;

const CONFERENCES = [
  "«Продуктовая среда»", "«Дизайн-выходные»", "«Код и кофе»",
  "«Данные рядом»", "«Маркетинг без воды»", "«Стройфорум»",
] as const;

const COURSES = [
  "английского", "испанского", "вождения", "по аналитике данных",
  "ораторского мастерства", "рисования", "по фотографии",
] as const;

const MONTHS_PREPOSITIONAL = [
  "январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе",
  "сентябре", "октябре", "ноябре", "декабре",
] as const;

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
  "сентября", "октября", "ноября", "декабря",
] as const;

const TOPICS = [
  "планы на лето", "совместный проект", "ремонт", "поездку на выходные",
  "новую работу", "подарок на юбилей", "встречу выпускников",
  "детский лагерь", "аренду дачи", "общий отпуск", "покупку машины",
  "переезд", "курсы для детей", "день рождения",
] as const;

const NEWS = [
  "переходит на новую работу", "переезжает в Петербург",
  "в семье ждут второго ребёнка", "открывает свою студию",
  "ремонт наконец закончился", "собирается в отпуск на Байкал",
  "поступает в магистратуру", "дома появилась собака",
  "готовится к марафону", "ищет новую квартиру", "учит испанский",
  "меняет машину", "планирует свадьбу на лето", "дочка пошла в первый класс",
  "всё лето проведёт на даче",
] as const;

const FOLLOW_UPS = [
  "Договорились созвониться через месяц.",
  "Пришлёт подробности на почту.",
  "Нужно не забыть ответить до пятницы.",
  "Передаёт привет семье.",
  "Позовёт, когда определится с датой.",
  "Вернёмся к этому после праздников.",
  "Хороший повод встретиться лично.",
  "",
  "",
] as const;

const MEETING_PLACES = [
  "на дне рождения общих друзей", "на конференции", "в спортзале", "на даче",
  "в аэропорту", "на школьном собрании", "в кино", "на выставке",
  "в парке на пробежке",
] as const;

const FAVOURS = [
  "с переездом", "разобраться с налоговым вычетом", "выбрать ноутбук",
  "найти хорошего врача", "с переводом документов", "починить кран",
  "подготовиться к собеседованию", "с выбором подрядчика",
] as const;

const ADVICE_TOPICS = [
  "по смене работы", "куда поехать в отпуск", "по выбору школы для ребёнка",
  "по ипотеке", "какую машину взять", "по ремонту ванной",
] as const;

const SPECIALISTS = [
  "хорошего юриста", "своего стоматолога", "мастера по окнам", "турагента",
  "репетитора по английскому", "проверенного бухгалтера", "автомеханика",
] as const;

const BOOKS = [
  "«Мастер и Маргарита»", "«Двенадцать стульев»", "«Три товарища»",
  "«Цветы для Элджернона»", "«Понедельник начинается в субботу»",
  "«Маленький принц»",
] as const;

const TRIPS = [
  "на Байкал летом", "в Карелию на майские", "на дачу в следующие выходные",
  "в Суздаль осенью", "на Алтай в августе", "в Калининград на выходные",
] as const;

function recentYear(): number {
  return randomInt(2012, 2025);
}

// --- Who the person is and how we met, by social circle ---

type Circle = {
  about: (gender: Gender) => string;
  howWeMet: (gender: Gender) => string;
};

function fromPhrases(phrases: readonly Phrase[]): (gender: Gender) => string {
  return (gender) => resolve(pick(phrases), gender);
}

const WORK: Circle = {
  about: (gender) => {
    const title = pick(JOB_TITLES);
    const company = pick(COMPANIES);

    return pickWeighted([
      [`${title} в ${company}`, 6],
      [
        `${resolve(["Бывший коллега", "Бывшая коллега"], gender)}, сейчас ${title.toLowerCase()} в ${company}`,
        2,
      ],
      [`${title}, работаем над общим проектом`, 1],
    ]);
  },
  howWeMet: (gender) =>
    pick([
      `Работали вместе в ${pick(COMPANIES)}`,
      `Познакомились на конференции ${pick(CONFERENCES)} в ${recentYear()} году`,
      `Вместе делали проект в ${pick(COMPANIES)}`,
      "Пересеклись на отраслевом митапе",
      `${resolve(["Собеседовал", "Собеседовала"], gender)} меня в ${pick(COMPANIES)}`,
      "Клиент с прошлой работы",
      "Познакомил общий знакомый по работе",
    ]),
};

const STUDY: Circle = {
  about: fromPhrases([
    ["Однокурсник", "Однокурсница"],
    ["Одноклассник", "Одноклассница"],
    ["Одногруппник", "Одногруппница"],
    ["Сосед по общежитию", "Соседка по общежитию"],
    ["Учился на курс старше", "Училась на курс старше"],
    "Научный руководитель",
    "Преподаватель английского",
  ]),
  howWeMet: () =>
    pick([
      "Учились в одной группе в университете",
      "Сидели за одной партой в школе",
      `Вместе ходили на курсы ${pick(COURSES)}`,
      "Жили на одном этаже в общежитии",
      "Писали вместе диплом",
      `Познакомились на летней школе в ${recentYear()} году`,
    ]),
};

const SERVICES: Circle = {
  about: fromPhrases([
    "Сантехник", "Электрик", "Мастер по ремонту", "Риелтор", "Автомеханик",
    "Ветеринар", "Стоматолог", "Тренер по плаванию", "Репетитор по математике",
    "Парикмахер", "Массажист", "Страховой агент", "Нотариус", "Семейный врач",
    "Инструктор по йоге", "Мастер по мебели", "Бухгалтер, ведёт мои налоги",
    "Юрист по недвижимости",
    ["Фотограф, снимал нашу свадьбу", "Фотограф, снимала нашу свадьбу"],
  ]),
  howWeMet: (gender) =>
    pick([
      "Посоветовали соседи",
      "По рекомендации друзей",
      "Нашли через знакомых",
      `${resolve(["Делал", "Делала"], gender)} нам ремонт на кухне в ${recentYear()} году`,
      "Обращаемся уже несколько лет",
      "Посоветовали на работе",
      "Нашли по отзывам в районном чате",
    ]),
};

const NEIGHBOURS: Circle = {
  about: fromPhrases([
    ["Сосед по даче", "Соседка по даче"],
    ["Сосед с пятого этажа", "Соседка с пятого этажа"],
    ["Сосед по лестничной клетке", "Соседка по лестничной клетке"],
    ["Сосед по парковке", "Соседка по парковке"],
    ["Старший по подъезду", "Старшая по подъезду"],
    "Председатель ТСЖ",
  ]),
  howWeMet: fromPhrases([
    "Живём в одном подъезде",
    "Участки рядом в СНТ",
    "Познакомились на собрании жильцов",
    "Вместе сажали деревья во дворе на субботнике",
    "Гуляем с собаками в одном парке",
  ]),
};

const FRIENDS: Circle = {
  about: fromPhrases([
    ["Друг детства", "Подруга детства"],
    ["Старый друг", "Старая подруга"],
    ["Друг семьи", "Подруга семьи"],
    ["Партнёр по теннису", "Партнёрша по теннису"],
    ["Знакомый по спортзалу", "Знакомая по спортзалу"],
    ["Напарник по рыбалке", "Напарница по скалодрому"],
    "Ходим вместе в походы",
    "Играем в настолки по пятницам",
    "Из бегового клуба",
    "Из книжного клуба",
    "Вместе играем в квизы",
    "Из группы по танцам",
  ]),
  howWeMet: () =>
    pick([
      `Познакомились в походе на Алтай в ${recentYear()} году`,
      "Через общих друзей на дне рождения",
      "Бежали вместе полумарафон",
      "Знакомы с детского сада",
      "Познакомились в поезде Москва — Казань",
      "Выросли в одном дворе",
      "Встретились на свадьбе общих друзей",
      "Вместе отдыхали в Карелии",
    ]),
};

const FAMILY: Circle = {
  about: fromPhrases([
    ["Двоюродный брат", "Двоюродная сестра"],
    ["Троюродный брат", "Троюродная сестра"],
    ["Крёстный", "Крёстная"],
    ["Дядя со стороны мамы", "Тётя со стороны мамы"],
    ["Муж сестры", "Жена брата"],
    ["Племянник", "Племянница"],
    ["Папа одноклассника сына", "Мама одноклассницы дочки"],
  ]),
  howWeMet: fromPhrases([
    "Родня",
    "Родственники со стороны папы",
    "Познакомились на семейном празднике",
    "Дети учатся в одном классе",
  ]),
};

const CIRCLES: readonly (readonly [Circle, number])[] = [
  [WORK, 34],
  [FRIENDS, 22],
  [STUDY, 14],
  [SERVICES, 14],
  [NEIGHBOURS, 9],
  [FAMILY, 7],
];

// --- Agreements and notes ---

function makeAgreement(gender: Gender): string {
  const options: Phrase[] = [
    `Созвониться в ${pick(MONTHS_PREPOSITIONAL)}, обсудить ${pick(TOPICS)}`,
    [
      `Обещал прислать контакты ${pick(SPECIALISTS)}`,
      `Обещала прислать контакты ${pick(SPECIALISTS)}`,
    ],
    `Вернуть книгу ${pick(BOOKS)}`,
    "Встретиться на кофе при следующей поездке в Москву",
    "Жду смету до конца месяца",
    `Договорились вместе поехать ${pick(TRIPS)}`,
    [
      "Одолжил мне дрель — вернуть до выходных",
      "Одолжила мне переноску для кота — вернуть до выходных",
    ],
    "Пришлёт резюме, передам нашему HR",
    `Поздравить с днём рождения ${randomInt(1, 28)} ${pick(MONTHS_GENITIVE)}`,
    "Обсудить совместный проект после отпуска",
    `Напомнить про встречу выпускников в ${pick(MONTHS_PREPOSITIONAL)}`,
    [
      "Должен мне 5 000 ₽ за билеты на концерт",
      "Должна мне 3 000 ₽ за общий подарок",
    ],
    "Раз в месяц созваниваемся по воскресеньям",
    [
      "Обещал познакомить со своим тренером",
      "Обещала познакомить со своим тренером",
    ],
    "Передать привет от родителей при встрече",
    "Договорились о скидке 10% на следующий заказ",
    "Позвать на новоселье",
    [
      "Попросил рекомендацию для новой работы — написать до пятницы",
      "Попросила рекомендацию для новой работы — написать до пятницы",
    ],
  ];

  return resolve(pick(options), gender);
}

function isNewYearSeason(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();

  return (month === 11 && day >= 25) || (month === 0 && day <= 10);
}

function makeNoteBody(gender: Gender, date: Date): string {
  if (isNewYearSeason(date) && chance(0.6)) {
    return "Поздравили друг друга с Новым годом, обменялись новостями.";
  }

  const options: Phrase[] = [
    `Созвонились, обсудили ${pick(TOPICS)}. ${pick(FOLLOW_UPS)}`,
    [
      `Встретились на кофе. Рассказал, что ${pick(NEWS)}.`,
      `Встретились на кофе. Рассказала, что ${pick(NEWS)}.`,
    ],
    [
      "Поздравил меня с днём рождения — приятно, что помнит.",
      "Поздравила меня с днём рождения — приятно, что помнит.",
    ],
    `Списались насчёт: ${pick(TOPICS)}. ${pick(FOLLOW_UPS)}`,
    `Пересеклись ${pick(MEETING_PLACES)}. ${pick(FOLLOW_UPS)}`,
    [
      `Помог мне ${pick(FAVOURS)}. Надо отблагодарить.`,
      `Помогла мне ${pick(FAVOURS)}. Надо отблагодарить.`,
    ],
    [
      `Спрашивал совета ${pick(ADVICE_TOPICS)}. Нужно подумать и ответить.`,
      `Спрашивала совета ${pick(ADVICE_TOPICS)}. Нужно подумать и ответить.`,
    ],
    `Давно не общались. Короткий звонок: всё хорошо, ${pick(NEWS)}.`,
    `Обсудили ${pick(TOPICS)}. Договорились вернуться к разговору через пару недель.`,
    "Обменялись новостями, давно не виделись.",
  ];

  return resolve(pick(options), gender).trim();
}

// --- Phone and email ---

const PHONE_CODES = [
  903, 905, 909, 910, 915, 916, 917, 919, 921, 925, 926, 929, 931, 937, 950,
  952, 960, 961, 963, 965, 967, 977, 980, 981, 985, 987, 989, 991, 995, 999,
] as const;

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function makePhone(): string {
  return `+7 ${pick(PHONE_CODES)} ${pad(randomInt(0, 999), 3)}-${pad(randomInt(0, 99), 2)}-${pad(randomInt(0, 99), 2)}`;
}

const TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(value: string): string {
  return [...value.toLowerCase()]
    .map((char) => TRANSLITERATION[char] ?? "")
    .join("");
}

// Reserved example domains: these addresses can never belong to a real person.
const EMAIL_DOMAINS = ["example.com", "example.org", "example.net"] as const;

function makeEmail(firstName: string, surname: string): string {
  const first = transliterate(firstName);
  const last = transliterate(surname);
  const suffix = chance(0.3) ? String(randomInt(1, 99)) : "";

  const local = pick([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}.${first}`,
    `${first}${last}`,
    `${last}${first[0]}`,
  ]);

  return `${local}${suffix}@${pick(EMAIL_DOMAINS)}`;
}

// --- Keep in touch: about every tenth contact has an interval ---

// A generator of its own: drawing from `random` would shift every later draw
// and change the people this seed has always produced.
const keepInTouchRandom = createRandom(RANDOM_SEED + 1);

const KEEP_IN_TOUCH_SHARE = 0.1;

const KEEP_IN_TOUCH_WEIGHTS = [
  ["week", 15],
  ["month", 40],
  ["quarter", 30],
  ["year", 15],
] as const satisfies readonly (readonly [KeepInTouchInterval, number])[];

function pickKeepInTouch(): KeepInTouchInterval | null {
  if (keepInTouchRandom() >= KEEP_IN_TOUCH_SHARE) {
    return null;
  }

  return pickWeighted(KEEP_IN_TOUCH_WEIGHTS, keepInTouchRandom);
}

// --- Assembling contacts ---

type SeedContact = {
  contact: typeof contacts.$inferInsert;
  noteRows: { body: string; createdAt: Date }[];
};

function makeContacts(now: number): SeedContact[] {
  const usedNames = new Set<string>();
  const result: SeedContact[] = [];

  while (result.length < CONTACT_COUNT) {
    const gender: Gender = chance(0.5) ? "male" : "female";
    const firstName = pick(
      gender === "male" ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES,
    );
    const baseSurname = pick(SURNAMES);
    const surname =
      gender === "male" ? baseSurname : toFemaleSurname(baseSurname);
    const name = `${firstName} ${surname}`;

    if (usedNames.has(name)) {
      continue;
    }

    usedNames.add(name);

    const circle = pickWeighted(CIRCLES);
    const createdAt = new Date(now - randomInt(30, 1095) * DAY_MS);
    const noteCount = pickWeighted([
      [0, 30],
      [1, 30],
      [2, 20],
      [3, 12],
      [4, 5],
      [5, 3],
    ]);

    const noteRows = Array.from({ length: noteCount }, () => {
      const noteDate = new Date(
        createdAt.getTime() +
          Math.floor(random() * (now - createdAt.getTime())),
      );

      return { body: makeNoteBody(gender, noteDate), createdAt: noteDate };
    });

    // Chosen when the contact was added, so contacts without notes are
    // already overdue and the "Пора связаться" block is not empty.
    const keepInTouchEvery = pickKeepInTouch();

    result.push({
      contact: {
        name,
        about: chance(0.95) ? circle.about(gender) : "",
        howWeMet: chance(0.85) ? circle.howWeMet(gender) : "",
        phone: chance(0.88) ? makePhone() : "",
        email: chance(0.75) ? makeEmail(firstName, surname) : "",
        agreements: chance(0.42) ? makeAgreement(gender) : "",
        keepInTouchEvery,
        keepInTouchSince: keepInTouchEvery ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
      },
      noteRows,
    });
  }

  return result;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run the script with `pnpm db:seed` so that .env is loaded.",
    );
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(contacts);

    if (existing > 0) {
      console.error(
        `Seed skipped: the contacts table already has ${existing} rows. ` +
          "The seed only fills an empty database and never deletes data.",
      );
      process.exitCode = 1;
      return;
    }

    const seedContacts = makeContacts(Date.now());
    let insertedNotes = 0;

    await db.transaction(async (tx) => {
      for (const batch of chunk(seedContacts, 250)) {
        const inserted = await tx
          .insert(contacts)
          .values(batch.map((item) => item.contact))
          .returning({ id: contacts.id, name: contacts.name });

        // Names are unique within the seed, so they map rows back to ids.
        const idByName = new Map(inserted.map((row) => [row.name, row.id]));

        const noteValues = batch.flatMap((item) =>
          item.noteRows.map((note) => ({
            contactId: idByName.get(item.contact.name)!,
            body: note.body,
            createdAt: note.createdAt,
          })),
        );

        if (noteValues.length > 0) {
          await tx.insert(notes).values(noteValues);
          insertedNotes += noteValues.length;
        }
      }
    });

    console.log(
      `Seed complete: ${seedContacts.length} contacts and ${insertedNotes} notes inserted.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
