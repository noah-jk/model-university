// Generates a synthetic course catalog for the fictional "Cascadia State University".
// Deterministic: the same seed always produces the same data, so diffs stay clean.
// Run with: npm run generate   (writes JSON arrays to content/generated/)
// The schemas in src/lib/schemas.ts validate everything written here.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED = 20261003;

// Small seeded PRNG (mulberry32). Each kind of data gets its own stream, so
// adding new data never reshuffles what's already generated.
function makeRandom(seed) {
  let s = seed;
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    chance: (p) => rand() < p,
    between: (min, max) => Math.round(min + rand() * (max - min)),
  };
}
// The catalog: programs, courses, and services
const { pick, chance, between } = makeRandom(SEED);
const slug = (str) => str.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const titleCase = (str) => str.replace(/\b\w/g, (c) => c.toUpperCase());
const listText = (items) => new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(items);

// ---------------------------------------------------------------------------
// Colleges and fields of study (CIP-style codes for realism; data is synthetic)
// ---------------------------------------------------------------------------
const colleges = {
  "College of Engineering & Computing": [
    ["Computer Science", "11.0701", ["software engineer", "systems developer", "research scientist"], ["programming", "algorithms", "software", "ai"]],
    ["Data Science", "30.7001", ["data scientist", "analytics engineer", "machine learning engineer"], ["statistics", "machine learning", "python", "analytics"]],
    ["Cybersecurity", "11.1003", ["security analyst", "penetration tester", "security architect"], ["security", "networks", "privacy", "risk"]],
    ["Mechanical Engineering", "14.1901", ["mechanical engineer", "design engineer", "manufacturing engineer"], ["design", "thermodynamics", "robotics", "manufacturing"]],
    ["Civil Engineering", "14.0801", ["civil engineer", "structural engineer", "transportation planner"], ["infrastructure", "structures", "transportation", "water"]],
    ["Electrical Engineering", "14.1001", ["electrical engineer", "hardware engineer", "power systems engineer"], ["circuits", "power", "signals", "embedded systems"]],
    ["Information Technology", "11.0103", ["IT specialist", "network administrator", "cloud engineer"], ["networks", "cloud", "systems administration", "support"]],
  ],
  "College of Health & Human Services": [
    ["Nursing", "51.3801", ["registered nurse", "nurse educator", "clinical nurse leader"], ["patient care", "clinical", "healthcare", "rn"]],
    ["Public Health", "51.2201", ["epidemiologist", "health educator", "policy analyst"], ["community health", "epidemiology", "health policy", "prevention"]],
    ["Social Work", "44.0701", ["social worker", "case manager", "community organizer"], ["advocacy", "community", "case management", "families"]],
    ["Kinesiology", "31.0505", ["exercise physiologist", "athletic trainer", "strength coach"], ["exercise", "movement", "sports", "fitness"]],
    ["Nutrition & Dietetics", "51.3101", ["registered dietitian", "nutrition educator", "food service manager"], ["nutrition", "food", "wellness", "dietetics"]],
    ["Health Administration", "51.0701", ["healthcare administrator", "practice manager", "health services manager"], ["management", "healthcare", "operations", "policy"]],
    ["Speech-Language Pathology", "51.0203", ["speech-language pathologist", "audiology assistant", "clinical researcher"], ["communication disorders", "language", "clinical", "therapy"]],
  ],
  "Carver College of Business": [
    ["Business Administration", "52.0201", ["operations manager", "management consultant", "entrepreneur"], ["management", "leadership", "strategy", "mba"]],
    ["Accounting", "52.0301", ["accountant", "auditor", "tax advisor"], ["cpa", "audit", "tax", "financial reporting"]],
    ["Finance", "52.0801", ["financial analyst", "investment associate", "corporate treasurer"], ["investing", "markets", "corporate finance", "banking"]],
    ["Marketing", "52.1401", ["marketing manager", "brand strategist", "digital marketer"], ["branding", "digital marketing", "consumer behavior", "advertising"]],
    ["Supply Chain Management", "52.0203", ["logistics analyst", "procurement manager", "operations planner"], ["logistics", "operations", "procurement", "global trade"]],
    ["Human Resource Management", "52.1001", ["HR generalist", "talent acquisition partner", "compensation analyst"], ["people", "recruiting", "workplace", "talent"]],
  ],
  "College of Arts & Letters": [
    ["English", "23.0101", ["editor", "content strategist", "teacher"], ["writing", "literature", "editing", "rhetoric"]],
    ["History", "54.0101", ["archivist", "museum curator", "policy researcher"], ["archives", "research", "museums", "public history"]],
    ["Communication", "09.0100", ["communications specialist", "public relations manager", "journalist"], ["media", "public relations", "journalism", "storytelling"]],
    ["Studio Art", "50.0702", ["artist", "art director", "gallery manager"], ["painting", "sculpture", "printmaking", "drawing"]],
    ["Graphic Design", "50.0409", ["graphic designer", "UX designer", "art director"], ["design", "typography", "branding", "ux"]],
    ["Music", "50.0901", ["performer", "music educator", "audio producer"], ["performance", "composition", "audio", "ensemble"]],
    ["Philosophy", "38.0101", ["ethicist", "policy analyst", "lawyer"], ["ethics", "logic", "critical thinking", "pre-law"]],
    ["World Languages", "16.0101", ["translator", "interpreter", "international liaison"], ["spanish", "japanese", "translation", "culture"]],
  ],
  "College of Science": [
    ["Biology", "26.0101", ["lab researcher", "biotech associate", "pre-med student"], ["life sciences", "genetics", "ecology", "pre-med"]],
    ["Chemistry", "40.0501", ["chemist", "quality control analyst", "pharmaceutical researcher"], ["lab", "organic chemistry", "materials", "pharma"]],
    ["Physics", "40.0801", ["physicist", "data analyst", "engineering researcher"], ["mechanics", "quantum", "astronomy", "modeling"]],
    ["Mathematics", "27.0101", ["actuary", "quantitative analyst", "math teacher"], ["math", "proofs", "modeling", "statistics"]],
    ["Environmental Science", "03.0104", ["environmental consultant", "conservation scientist", "sustainability manager"], ["climate", "sustainability", "conservation", "field research"]],
    ["Marine Biology", "26.1302", ["marine biologist", "fisheries scientist", "aquarium educator"], ["oceans", "salish sea", "fisheries", "field research"]],
    ["Geology", "40.0601", ["geologist", "hydrologist", "hazards analyst"], ["earth science", "volcanoes", "earthquakes", "field research"]],
  ],
  "College of Social & Behavioral Sciences": [
    ["Psychology", "42.0101", ["counselor", "research assistant", "UX researcher"], ["behavior", "mental health", "research", "cognition"]],
    ["Sociology", "45.1101", ["social researcher", "community program manager", "policy analyst"], ["society", "inequality", "research methods", "community"]],
    ["Political Science", "45.1001", ["legislative aide", "policy analyst", "campaign manager"], ["government", "policy", "elections", "pre-law"]],
    ["Economics", "45.0601", ["economist", "financial analyst", "policy researcher"], ["markets", "policy", "data", "econometrics"]],
    ["Criminal Justice", "43.0104", ["probation officer", "victim advocate", "court administrator"], ["justice", "courts", "corrections", "policy"]],
    ["Anthropology", "45.0201", ["cultural resource specialist", "UX researcher", "museum educator"], ["culture", "archaeology", "ethnography", "museums"]],
  ],
  "College of Education": [
    ["Elementary Education", "13.1202", ["elementary teacher", "reading specialist", "curriculum coordinator"], ["teaching", "k-8", "literacy", "certification"]],
    ["Special Education", "13.1001", ["special education teacher", "inclusion specialist", "behavior analyst"], ["inclusion", "disability", "iep", "teaching"]],
    ["Educational Leadership", "13.0401", ["principal", "district administrator", "instructional coach"], ["leadership", "administration", "schools", "policy"]],
    ["Higher Education Administration", "13.0406", ["student affairs director", "academic advisor", "admissions counselor"], ["student affairs", "advising", "colleges", "leadership"]],
  ],
};

// Which credential levels each field tends to offer
const levelTemplates = [
  { level: "Bachelor's", credential: (f) => (["Studio Art", "Graphic Design", "Music"].includes(f) ? "BFA" : ["English", "History", "Philosophy", "World Languages", "Communication", "Sociology", "Anthropology", "Political Science"].includes(f) ? "BA" : "BS"), credits: [180, 180], years: "4 years", p: 0.97 },
  { level: "Minor", credential: () => "Minor", credits: [25, 35], years: "Alongside a bachelor's", p: 0.65 },
  { level: "Certificate", credential: () => "Graduate Certificate", credits: [15, 24], years: "9–12 months", p: 0.55 },
  { level: "Master's", credential: (f) => (f === "Business Administration" ? "MBA" : f === "Social Work" ? "MSW" : f === "Public Health" ? "MPH" : f === "Nursing" ? "MSN" : ["English", "History", "Communication", "Studio Art", "Music"].includes(f) ? "MA" : f.includes("Education") || f.includes("Leadership") ? "MEd" : "MS"), credits: [45, 72], years: "1–2 years", p: 0.75 },
  { level: "Doctorate", credential: (f) => (f === "Nursing" ? "DNP" : f.includes("Education") || f.includes("Leadership") ? "EdD" : "PhD"), credits: [90, 135], years: "4–6 years", p: 0.25 },
];

const modalities = ["In person", "Online", "Hybrid"];
const terms = ["Fall", "Winter", "Spring", "Summer"];
const campuses = ["Tacoma Bay campus", "Olympia campus", "Online"];

const descOpeners = [
  (f, lvl) => `The ${lvl} in ${f} pairs rigorous coursework with hands-on projects rooted in the Pacific Northwest.`,
  (f, lvl) => `Cascadia State's ${f} ${lvl} prepares you to solve real problems from your first term.`,
  (f, lvl) => `Study ${f.toLowerCase()} with faculty who work alongside regional employers, agencies, and research partners.`,
  (f, lvl) => `Build a strong foundation in ${f.toLowerCase()} through small classes, mentored research, and community partnerships.`,
];
const descMiddles = [
  "Students complete a capstone with a regional partner organization.",
  "Every student finishes with a portfolio of applied work.",
  "Flexible scheduling supports working students and transfer students.",
  "A required internship connects classroom learning to professional practice.",
  "Small cohorts mean close mentorship from faculty.",
];

const collegeId = (name) => slug(name.replace(/^College of /, ""));

const programs = [];

for (const fields of Object.values(colleges)) {
  for (const [field, , careers, keywords] of fields) {
    for (const t of levelTemplates) {
      if (!chance(t.p)) continue;
      const credential = t.credential(field);
      const name = t.level === "Minor" ? `${field} Minor` : t.level === "Certificate" ? `${field} Graduate Certificate` : `${field}, ${credential}`;
      const isGrad = ["Master's", "Doctorate", "Certificate"].includes(t.level);
      const modality = t.level === "Doctorate" ? (chance(0.8) ? "In person" : "Hybrid") : isGrad ? pick(modalities) : chance(0.75) ? "In person" : pick(modalities);
      const startTerms = t.level === "Bachelor's" || t.level === "Minor" ? ["Fall", "Winter", "Spring"] : terms.filter(() => chance(0.5)).concat(["Fall"]).filter((v, i, a) => a.indexOf(v) === i);
      const creditsTotal = between(t.credits[0], t.credits[1]);
      const perCredit = isGrad ? between(520, 890) : between(270, 340);
      const deadlineMonth = { Fall: "March 1", Winter: "October 15", Spring: "January 15", Summer: "April 1" };
      programs.push({
        id: slug(name),
        name,
        level: t.level,
        credential,
        department: slug(field),
        modality,
        campus: modality === "Online" ? "Online" : pick(campuses.slice(0, 2)),
        start_terms: terms.filter((x) => startTerms.includes(x)),
        application_deadlines: t.level === "Minor" ? [] : terms.filter((x) => startTerms.includes(x)).map((term) => ({ term, deadline: deadlineMonth[term] })),
        credits: creditsTotal,
        duration: t.years,
        tuition_per_credit_usd: perCredit,
        estimated_total_tuition_usd: Math.round((perCredit * creditsTotal) / 10) * 10,
        description: `${pick(descOpeners)(field, t.level === "Minor" ? "minor" : t.level === "Certificate" ? "certificate" : `${credential} program`)} ${pick(descMiddles)}`,
        outcomes: [
          `Apply core methods and theory in ${field.toLowerCase()}`,
          `Communicate findings clearly to professional and public audiences`,
          isGrad ? `Lead independent research or advanced professional practice` : `Work effectively on interdisciplinary teams`,
        ],
        careers,
        keywords,
        requirements: isGrad
          ? ["Bachelor's degree from an accredited institution", `Minimum ${pick(["2.75", "3.0", "3.0", "3.2"])} GPA`, "Statement of purpose", chance(0.6) ? "Two letters of recommendation" : "Resume"]
          : t.level === "Minor"
          ? ["Declared bachelor's major at Cascadia State", "Completion of introductory course with C or better"]
          : ["High school diploma or equivalent, or transfer credits", "Completed first-year application"],
        accepts_transfer_credit: !isGrad || chance(0.4),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Courses (the "big table": roughly 20–30 per field)
// ---------------------------------------------------------------------------
const courses = [];
const prefixOverrides = { "Elementary Education": "ELED" };
const prefixFor = (field) => {
  if (prefixOverrides[field]) return prefixOverrides[field];
  const words = field.replace(/&/g, "").split(/[\s-]+/).filter(Boolean);
  return (words.length === 1 ? words[0].slice(0, 4) : words.map((w) => w[0]).join("")).toUpperCase();
};
const courseTemplates = [
  [100, (f) => `Introduction to ${f}`],
  [100, (f) => `Foundations of ${f}`],
  [200, (f, k) => `${titleCase(k)} I`],
  [200, (f, k) => `${titleCase(k)} II`],
  [200, (f) => `Research Methods in ${f}`],
  [300, (f, k) => `Applied ${titleCase(k)}`],
  [300, (f, k) => `${titleCase(k)} Lab`],
  [300, (f) => `Ethics and Practice in ${f}`],
  [300, (f, k) => `${titleCase(k)} in the Pacific Northwest`],
  [300, (f) => `Data and Evidence in ${f}`],
  [400, (f, k) => `Advanced ${titleCase(k)}`],
  [400, (f, k) => `Seminar: ${titleCase(k)}`],
  [400, (f) => `Internship in ${f}`],
  [400, (f) => `Senior Capstone in ${f}`],
  [500, (f, k) => `Graduate Studies in ${titleCase(k)}`],
  [500, (f) => `Professional Practice in ${f}`],
  [600, (f, k) => `Research Seminar: ${titleCase(k)}`],
  [600, (f) => `Thesis Research in ${f}`],
];
// Courses used to get a random instructor name here. Faculty teach them now
// (assigned further down), but the two draws stay so later courses keep their data.
const formerInstructorDraws = () => {
  chance(0);
  chance(0);
  return null;
};

// Every course runs at least once a year. The fallback doesn't draw from the
// PRNG, so fixing an empty list leaves the rest of the data unchanged.
// Terms are listed in academic-year order.
const offeredTerms = (list, num) => (list.length ? list : [terms[num % 3]]).sort((a, b) => terms.indexOf(a) - terms.indexOf(b));

for (const fields of Object.values(colleges)) {
  for (const [field, , , keywords] of fields) {
    const prefix = prefixFor(field);
    const used = new Set();
    for (const [base, make] of courseTemplates) {
      const kws = keywords.filter(() => chance(0.55));
      const variants = make.length > 1 ? (kws.length ? kws : [pick(keywords)]) : [null];
      for (const k of variants) {
        let num = base + between(1, 89);
        while (used.has(num)) num++;
        used.add(num);
        const code = `${prefix} ${num}`;
        const prereq = base >= 300 && courses.length && chance(0.7)
          ? courses.filter((c) => c.code.startsWith(prefix + " ") && Number(c.code.split(" ")[1]) < base).slice(-2).map((c) => c.id)
          : [];
        courses.push({
          id: slug(code),
          code,
          title: make(field, k ?? field),
          department: slug(field),
          level: base >= 500 ? "Graduate" : base >= 300 ? "Upper division" : "Lower division",
          credits: base >= 500 ? 3 : pick([3, 4, 5, 5]),
          terms_offered: offeredTerms(terms.filter(() => chance(0.5)).concat(base < 300 ? ["Fall"] : []).filter((v, i, a) => a.indexOf(v) === i), num),
          modality: pick(["In person", "In person", "Online", "Hybrid"]),
          instructor: formerInstructorDraws(),
          prerequisites: prereq,
          description: `Explores ${(k ?? field).toLowerCase()} through readings, discussion, and applied assignments.${base >= 400 ? " Includes a substantial independent project." : ""}`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Student services
// ---------------------------------------------------------------------------
const H = {
  business: { mon: ["08:00", "17:00"], tue: ["08:00", "17:00"], wed: ["08:00", "17:00"], thu: ["08:00", "17:00"], fri: ["08:00", "17:00"], sat: null, sun: null },
  extended: { mon: ["08:00", "20:00"], tue: ["08:00", "20:00"], wed: ["08:00", "20:00"], thu: ["08:00", "20:00"], fri: ["08:00", "17:00"], sat: ["10:00", "14:00"], sun: null },
  library: { mon: ["07:30", "23:00"], tue: ["07:30", "23:00"], wed: ["07:30", "23:00"], thu: ["07:30", "23:00"], fri: ["07:30", "18:00"], sat: ["10:00", "18:00"], sun: ["12:00", "23:00"] },
  rec: { mon: ["06:00", "22:00"], tue: ["06:00", "22:00"], wed: ["06:00", "22:00"], thu: ["06:00", "22:00"], fri: ["06:00", "20:00"], sat: ["09:00", "18:00"], sun: ["10:00", "18:00"] },
  always: { mon: ["00:00", "24:00"], tue: ["00:00", "24:00"], wed: ["00:00", "24:00"], thu: ["00:00", "24:00"], fri: ["00:00", "24:00"], sat: ["00:00", "24:00"], sun: ["00:00", "24:00"] },
  afternoons: { mon: ["12:00", "18:00"], tue: ["12:00", "18:00"], wed: ["12:00", "18:00"], thu: ["12:00", "18:00"], fri: null, sat: null, sun: null },
};
const buildings = ["Madrona Hall", "Cedar Commons", "Rainier Student Center", "Puget Library", "Alder Hall", "Fir Tower", "Salish Hall"];

const serviceDefs = [
  ["Academic Advising", "Academics", "Plan your degree, choose courses, and stay on track to graduate.", "business", ["advisor", "degree plan", "registration", "major"]],
  ["Tutoring Center", "Academics", "Free drop-in and scheduled tutoring for most 100- and 200-level courses.", "extended", ["tutor", "homework", "study help"]],
  ["Writing Center", "Academics", "One-on-one help with essays, research papers, and personal statements at any stage.", "extended", ["essay", "writing", "papers", "citations"]],
  ["Math Learning Lab", "Academics", "Drop-in support for math, statistics, and quantitative courses.", "afternoons", ["math", "statistics", "calculus"]],
  ["Puget Library", "Academics", "Research help, study rooms, laptop loans, and 24/7 online chat with librarians.", "library", ["research", "study rooms", "books", "laptops"]],
  ["Testing Center", "Academics", "Proctored exams, placement tests, and accommodated testing.", "business", ["exams", "placement", "proctoring"]],
  ["Registrar", "Enrollment", "Registration, transcripts, enrollment verification, and graduation applications.", "business", ["transcripts", "registration", "graduation", "records"]],
  ["Financial Aid & Scholarships", "Money", "FAFSA and WASFA help, scholarships, grants, loans, and work-study.", "business", ["fafsa", "wasfa", "scholarships", "grants", "loans"]],
  ["Student Accounts", "Money", "Tuition bills, payment plans, refunds, and 1098-T tax forms.", "business", ["tuition", "bill", "payment plan", "refund"]],
  ["Student Employment", "Money", "On-campus jobs and work-study positions.", "business", ["jobs", "work-study", "part-time"]],
  ["Basic Needs Center & Food Pantry", "Wellbeing", "Free groceries, emergency grants, and help finding housing and benefits.", "afternoons", ["food", "pantry", "emergency", "groceries"]],
  ["Counseling Center", "Wellbeing", "Short-term counseling, groups, and workshops for currently enrolled students.", "business", ["counseling", "support", "workshops"]],
  ["Student Health Center", "Wellbeing", "Primary care, immunizations, and prescriptions for enrolled students.", "business", ["doctor", "clinic", "immunizations", "health"]],
  ["Recreation & Fitness Center", "Wellbeing", "Gym, pool, climbing wall, intramurals, and group fitness classes.", "rec", ["gym", "pool", "fitness", "intramurals"]],
  ["Accessibility Resources", "Support", "Academic accommodations, accessible materials, and assistive technology.", "business", ["accommodations", "accessibility", "assistive technology"]],
  ["Veterans Services", "Support", "GI Bill certification, veteran lounge, and transition support.", "business", ["veterans", "gi bill", "military"]],
  ["International Student Services", "Support", "Visa advising, orientation, and support for international students.", "business", ["visa", "international", "i-20"]],
  ["First-Generation Student Center", "Support", "Mentoring, community, and resources for first-gen college students.", "business", ["first-gen", "mentoring", "community"]],
  ["Transfer Center", "Enrollment", "Credit evaluation and advising for students transferring in.", "business", ["transfer", "credits", "community college"]],
  ["Admissions", "Enrollment", "Applications, campus tours, and admissions counseling.", "extended", ["apply", "tours", "admissions"]],
  ["New Student Orientation", "Enrollment", "Orientation sessions and first-week programs for new students.", "business", ["orientation", "new students"]],
  ["Graduate School Office", "Enrollment", "Graduate admissions, assistantships, and thesis submission.", "business", ["graduate", "assistantships", "thesis"]],
  ["Career Center", "Career", "Resume reviews, mock interviews, career fairs, and internship search.", "business", ["resume", "internships", "interviews", "jobs"]],
  ["Study Abroad", "Career", "Semester and short-term programs in more than 30 countries.", "business", ["travel", "exchange", "international"]],
  ["Housing & Residence Life", "Campus life", "Residence halls, room assignments, and living-learning communities.", "business", ["dorms", "housing", "residence halls"]],
  ["Dining Services", "Campus life", "Meal plans, campus cafés, and dietary accommodations.", "extended", ["food", "meal plan", "dining"]],
  ["Child Care Center", "Campus life", "Licensed child care for children of students, faculty, and staff.", "business", ["child care", "parents", "kids"]],
  ["Parking & Transportation", "Campus life", "Parking permits, transit passes, and bike storage.", "business", ["parking", "transit", "orca", "bikes"]],
  ["Campus Safety", "Campus life", "24/7 safety escorts, lost and found, and emergency response.", "always", ["safety", "escort", "emergency", "lost and found"]],
  ["IT Help Desk", "Technology", "Account access, Wi-Fi, software downloads, and device help.", "extended", ["wifi", "password", "software", "email"]],
  ["Campus Bookstore", "Campus life", "Textbooks, course materials, supplies, and Cascadia State gear.", "business", ["textbooks", "books", "supplies"]],
  ["Multicultural Center", "Support", "Community space, cultural programs, and student organizations.", "business", ["community", "culture", "events"]],
  ["Student Legal Services", "Support", "Free consultations on leases, contracts, and other legal questions.", "afternoons", ["legal", "lease", "landlord"]],
  ["Ombuds Office", "Support", "Confidential, neutral help resolving university-related concerns.", "business", ["conflict", "concerns", "complaints"]],
  ["Student Government", "Campus life", "Student representation, funding for clubs, and campus initiatives.", "afternoons", ["government", "clubs", "funding"]],
  ["Clubs & Organizations", "Campus life", "More than 200 student clubs, from rock climbing to robotics.", "afternoons", ["clubs", "organizations", "involvement"]],
];

const services = serviceDefs.map(([name, category, description, hoursKey, tags]) => {
  const id = slug(name);
  const online = hoursKey === "always" ? false : chance(0.35);
  return {
    id,
    name,
    category,
    description,
    location: hoursKey === "always" ? "Rainier Student Center, ground floor" : `${pick(buildings)}, room ${between(101, 420)}`,
    campus: pick(["Tacoma Bay campus", "Tacoma Bay campus", "Olympia campus"]),
    virtual_option: online,
    hours: H[hoursKey],
    phone: `(253) 555-${String(between(1000, 9999))}`,
    email: `${id.split("-").slice(0, 2).join("")}@cascadiastate.example`,
    eligibility: category === "Enrollment" && name === "Admissions" ? "Prospective and admitted students" : "Currently enrolled students",
    appointment_required: hoursKey === "business" && chance(0.4),
    tags,
  };
});

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------
const people = makeRandom(SEED + 1);

const firstNames = ["Ana", "Ben", "Chen", "Dana", "Eli", "Farah", "Grace", "Hiro", "Imani", "Jonah", "Kai", "Leila", "Marcus", "Nia", "Omar", "Priya", "Quinn", "Rosa", "Sam", "Tomas", "Uma", "Victor", "Wren", "Yusuf", "Amara", "Bao", "Camila", "Dmitri", "Esther", "Felipe", "Hana", "Ines", "Jamal", "Keiko", "Luis", "Maya", "Nikhil", "Olivia", "Pita", "Rafael", "Sina", "Teresa", "Vikram", "Yara", "Zoe", "Adebayo", "Bridget", "Diego", "Elena", "Gabriel", "Hamid", "Ingrid", "Joaquin", "Lena", "Mateo", "Noor", "Reuben", "Selam", "Tuan", "Aiyana"];
const lastNames = ["Alvarez", "Bergstrom", "Cho", "Delgado", "Eriksen", "Fong", "Garcia", "Haugen", "Iyer", "Johansen", "Kealoha", "Larsen", "Morales", "Nakamura", "Okafor", "Patel", "Quintero", "Reyes", "Sato", "Thompson", "Vu", "Whitehorse", "Yamamoto", "Zhou", "Abebe", "Banerjee", "Castillo", "Dubois", "Fernandes", "Gunnarsson", "Hassan", "Ibarra", "Kowalski", "Lindqvist", "Mendoza", "Nguyen", "Olsen", "Park", "Rahman", "Silva", "Tanaka", "Uribe", "Wallace", "Yazzie", "Adeyemi", "Brennan", "Chavez", "Duarte", "Kim", "Moreau"];
const ranks = ["Professor", "Associate Professor", "Associate Professor", "Assistant Professor", "Assistant Professor", "Senior Lecturer"];
const previousWork = [
  "a postdoctoral fellowship in Vancouver, British Columbia",
  "eight years in industry",
  "teaching at a community college in Eastern Washington",
  "a research post at a federal laboratory",
  "a decade in public service",
  "doctoral work in Oregon",
  "leading a nonprofit in the South Sound",
  "a visiting appointment in Japan",
];
const teachingLines = [
  (first) => `${first} teaches across the curriculum and mentors undergraduate researchers.`,
  (first) => `${first} brings applied projects with regional partners into the classroom.`,
  (first) => `${first} is a past recipient of the university's Excellence in Teaching award.`,
  (first) => `${first} advises graduate students and serves on the university's research council.`,
  (first) => `${first} leads the department's community-engaged learning program.`,
];
const officeBuildings = ["Madrona Hall", "Alder Hall", "Fir Tower", "Salish Hall", "Cedar Commons"];

const faculty = [];
const usedNames = new Set();
// Search keywords that aren't research topics
const notResearchTopics = ["rn", "cpa", "mba", "k-8", "iep", "pre-law", "pre-med", "certification", "python", "lab", "support"];
const fieldKeywords = Object.fromEntries(
  Object.values(colleges).flat().map(([field, , , keywords]) => [field, keywords.filter((k) => !notResearchTopics.includes(k))])
);

for (const fields of Object.values(colleges)) {
  for (const [field] of fields) {
    const count = people.between(6, 8);
    for (let i = 0; i < count; i++) {
      let first, last;
      do {
        first = people.pick(firstNames);
        last = people.pick(lastNames);
      } while (usedNames.has(`${first} ${last}`));
      usedNames.add(`${first} ${last}`);
      // The first person listed in each department chairs it
      const title = i === 0 ? "Professor" : people.pick(ranks);
      const interests = fieldKeywords[field].filter(() => people.chance(0.6));
      if (!interests.length) interests.push(people.pick(fieldKeywords[field]));
      const year = people.between(1998, 2024);
      faculty.push({
        id: slug(`${first} ${last}`),
        name: `${first} ${last}`,
        title,
        ...(i === 0 && { role: "Department chair" }),
        department: slug(field),
        email: `${slug(first)}.${slug(last)}@cascadiastate.example`,
        office: `${people.pick(officeBuildings)}, room ${people.between(101, 480)}`,
        research_interests: interests,
        bio: `${first} ${last} joined Cascadia State in ${year} after ${people.pick(previousWork)}. ${first}'s work in ${field.toLowerCase()} focuses on ${listText(interests)}. ${people.pick(teachingLines)(first)}`,
      });
    }
  }
}

// Courses are taught by faculty in their department. Graduate courses go to
// professorial faculty rather than lecturers.
for (const course of courses) {
  const candidates = faculty.filter((f) => f.department === course.department && (course.level !== "Graduate" || f.title !== "Senior Lecturer"));
  course.instructor = people.pick(candidates).id;
}

// ---------------------------------------------------------------------------
// Events, for the 2026–27 academic year
// ---------------------------------------------------------------------------
const calendar = makeRandom(SEED + 2);
const TIMEZONE = "America/Los_Angeles";

// "2026-10-16" + "10:00" → "2026-10-16T10:00:00-07:00", with the right
// Pacific offset for that date (daylight time or standard time)
function pacific(date, time) {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, timeZoneName: "longOffset" })
    .formatToParts(noonUtc)
    .find((p) => p.type === "timeZoneName")
    .value.replace("GMT", "");
  return `${date}T${time}:00${offset}`;
}
const isoDate = (d) => d.toISOString().slice(0, 10);
// The nth weekday (0 = Sunday) of a month, e.g. the first Friday of October 2026
function nthWeekday(year, month, weekday, n) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * (n - 1));
  return isoDate(d);
}
const academicMonths = [[2026, 9], [2026, 10], [2026, 11], [2026, 12], [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5], [2027, 6]];

const events = [];
function addEvent({ title, date, start, end, endDate = date, ...rest }) {
  events.push({
    id: `${slug(title)}-${date}`,
    title,
    start: pacific(date, start),
    end: pacific(endDate, end),
    registration_required: false,
    ...rest,
  });
}

// Campus tours: first Friday on the Tacoma Bay campus, third Friday in Olympia
for (const [year, month] of academicMonths.slice(1, 8)) {
  for (const [n, campus, place] of [[1, "Tacoma Bay campus", "Admissions lobby, Rainier Student Center"], [3, "Olympia campus", "Welcome center, Salish Hall"]]) {
    addEvent({
      title: `Campus tour: ${campus.replace(" campus", "")}`,
      date: nthWeekday(year, month, 5, n),
      start: "10:00",
      end: "11:30",
      category: "Admissions",
      audience: ["Prospective students", "Families"],
      location: place,
      campus,
      registration_required: true,
      description: `A 90-minute walking tour of the ${campus} led by current students, with time for questions about classes, housing, and student life. Wear comfortable shoes; tours go rain or shine.`,
      related: { services: ["admissions"] },
    });
  }
}

addEvent({
  title: "Fall Open House",
  date: "2026-10-24",
  start: "09:00",
  end: "14:00",
  category: "Admissions",
  audience: ["Prospective students", "Families"],
  location: "Rainier Student Center",
  campus: "Tacoma Bay campus",
  registration_required: true,
  description: "Meet faculty from every college, sit in on sample classes, tour residence halls, and talk with financial aid counselors. Lunch is provided for registered guests.",
  related: { services: ["admissions", "financial-aid-and-scholarships", "housing-and-residence-life"] },
});
addEvent({
  title: "Admitted Student Day",
  date: "2027-04-17",
  start: "09:00",
  end: "15:00",
  category: "Admissions",
  audience: ["Prospective students", "Families"],
  location: "Rainier Student Center",
  campus: "Tacoma Bay campus",
  registration_required: true,
  description: "For students admitted for fall 2027. Meet your future classmates, register for orientation, and get answers about housing, aid, and advising in one visit.",
  related: { services: ["admissions", "new-student-orientation", "housing-and-residence-life"] },
});
addEvent({
  title: "Transfer Student Information Night",
  date: "2026-11-12",
  start: "18:00",
  end: "19:00",
  category: "Admissions",
  audience: ["Prospective students"],
  location: "Online",
  campus: "Online",
  registration_required: true,
  description: "Learn how your community college credits transfer, which programs accept transfer credit, and how to plan a smooth move to Cascadia State.",
  related: { services: ["transfer-center", "admissions"] },
});
addEvent({
  title: "Personal Statement Workshop",
  date: "2026-11-05",
  start: "16:00",
  end: "17:00",
  category: "Admissions",
  audience: ["Prospective students"],
  location: "Online",
  campus: "Online",
  registration_required: true,
  description: "Writing Center consultants walk through what admissions readers look for in a personal statement, with examples and time to start your draft.",
  related: { services: ["writing-center", "admissions"] },
});

// Graduate information sessions: each college, once in fall and once in winter
for (const [college, fields] of Object.entries(colleges)) {
  const hasGrad = programs.some((p) => fields.some(([f]) => slug(f) === p.department) && ["Master's", "Doctorate", "Certificate"].includes(p.level));
  if (!hasGrad) continue;
  for (const [year, month] of [[2026, 11], [2027, 2]]) {
    addEvent({
      title: `Graduate Programs Information Session: ${college.replace(/^College of /, "")}`,
      date: nthWeekday(year, month, calendar.pick([2, 3, 4]), calendar.between(1, 3)),
      start: "17:30",
      end: "18:30",
      category: "Admissions",
      audience: ["Prospective students"],
      location: "Online",
      campus: "Online",
      registration_required: true,
      description: `Faculty and graduate advisors from the ${college} introduce master's, doctoral, and certificate options, then answer questions about admission, funding, and part-time study.`,
      related: { departments: fields.map(([f]) => slug(f)), services: ["graduate-school-office"] },
    });
  }
}

// Paying for college
for (const date of ["2026-10-15", "2027-01-21", "2027-02-18"]) {
  addEvent({
    title: "FAFSA and WASFA Completion Night",
    date,
    start: "17:00",
    end: "19:00",
    category: "Money",
    audience: ["Prospective students", "Current students", "Families"],
    location: "Computer lab, Puget Library",
    campus: "Tacoma Bay campus",
    description: "Bring your tax documents and finish your financial aid application with help from financial aid counselors. Spanish-speaking counselors are available.",
    related: { services: ["financial-aid-and-scholarships"] },
  });
}
addEvent({
  title: "Scholarship Application Workshop",
  date: "2027-01-12",
  start: "15:00",
  end: "16:00",
  category: "Money",
  audience: ["Current students"],
  location: "Online",
  campus: "Online",
  description: "How to find scholarships you qualify for and write applications that stand out, before the February 1 priority deadline.",
  related: { services: ["financial-aid-and-scholarships", "writing-center"] },
});

// Careers
for (const [title, date] of [["Fall Career and Internship Fair", "2026-10-21"], ["Spring Career Fair", "2027-04-14"]]) {
  addEvent({
    title,
    date,
    start: "11:00",
    end: "15:00",
    category: "Career",
    audience: ["Current students", "Alumni"],
    location: "Main gym, Recreation & Fitness Center",
    campus: "Tacoma Bay campus",
    description: "More than 80 employers from across the Puget Sound region, hiring for internships, part-time jobs, and full-time roles. Bring copies of your resume.",
    related: { services: ["career-center"] },
  });
}
for (const date of ["2026-10-07", "2027-04-06"]) {
  addEvent({
    title: "Resume Lab",
    date,
    start: "12:00",
    end: "13:30",
    category: "Career",
    audience: ["Current students"],
    location: "Career Center",
    campus: "Tacoma Bay campus",
    description: "Drop in for a 15-minute resume review with a career counselor before the career fair.",
    related: { services: ["career-center"] },
  });
}

// Public lectures by faculty
for (const [department, title, date, about] of [
  ["marine-biology", "Orcas, Salmon, and a Changing Salish Sea", "2026-10-14", "how warming water and shifting salmon runs are reshaping life for the region's resident orcas"],
  ["geology", "Living with the Cascadia Subduction Zone", "2026-11-18", "what the geologic record says about the next great Northwest earthquake, and how communities can prepare"],
  ["computer-science", "Who Checks the Algorithm? Fairness in Everyday Software", "2026-12-09", "how the software behind loans, hiring, and benefits gets tested for fairness, and where it falls short"],
  ["public-health", "Wildfire Smoke and Community Health", "2027-01-13", "what a decade of smoky summers has taught researchers about protecting the people most at risk"],
  ["history", "Tacoma's Waterfront: A Working History", "2027-01-27", "the people, industries, and labor movements that built Commencement Bay"],
  ["environmental-science", "Rivers After the Dams Come Down", "2027-02-24", "what scientists have learned from watching Northwest rivers recover after dam removal"],
  ["economics", "Housing Costs in Puget Sound: What the Data Shows", "2027-03-10", "the forces behind the region's housing prices and which policies have made a measurable difference"],
  ["nursing", "Rural Nursing and the Future of Care", "2027-04-07", "how nurses are filling gaps in rural health care, from telehealth to mobile clinics"],
  ["philosophy", "Thinking Clearly About Artificial Intelligence", "2027-04-21", "the questions about trust, responsibility, and expertise that AI tools raise for everyone who uses them"],
  ["special-education", "Inclusive Classrooms That Work", "2027-05-19", "classroom practices that help students with and without disabilities learn together"],
]) {
  const speaker = faculty.find((f) => f.department === department && f.role === "Department chair");
  addEvent({
    title,
    date,
    start: "18:30",
    end: "20:00",
    category: "Academics",
    audience: ["Public", "Current students", "Alumni"],
    location: calendar.pick(["Auditorium, Salish Hall", "Lecture hall, Alder Hall", "Community room, Puget Library"]),
    campus: calendar.pick(["Tacoma Bay campus", "Olympia campus"]),
    description: `${speaker.title} ${speaker.name} talks about ${about}, followed by questions from the audience. Free and open to the public.`,
    related: { faculty: [speaker.id], departments: [department] },
  });
}
addEvent({
  title: "Undergraduate Research Symposium",
  date: "2027-05-13",
  start: "13:00",
  end: "17:00",
  category: "Academics",
  audience: ["Current students", "Public", "Families"],
  location: "Rainier Student Center",
  campus: "Tacoma Bay campus",
  description: "More than 150 students present research posters and talks from every college. Stop by, ask questions, and vote for the people's choice award.",
  related: { services: ["puget-library"] },
});

// Arts
for (const [title, date, description] of [
  ["Fall Concert: Wind Ensemble and Choirs", "2026-12-04", "The Wind Ensemble, Concert Choir, and Chamber Singers close the fall term with music from Holst to new work by student composers."],
  ["Winter Jazz Night", "2027-02-26", "The Cascadia State Jazz Orchestra and student combos play standards and originals. Tickets are free for students."],
  ["Spring Choral Concert", "2027-05-21", "The Concert Choir and Chamber Singers perform a program of Pacific Rim choral music."],
]) {
  addEvent({
    title,
    date,
    start: "19:30",
    end: "21:00",
    category: "Arts",
    audience: ["Public", "Current students", "Families"],
    location: "Recital hall, Salish Hall",
    campus: "Olympia campus",
    description,
    related: { departments: ["music"] },
  });
}
addEvent({
  title: "Senior Exhibition: Studio Art and Graphic Design",
  date: "2027-05-03",
  endDate: "2027-05-21",
  start: "10:00",
  end: "17:00",
  category: "Arts",
  audience: ["Public", "Current students", "Families"],
  location: "University Gallery, Cedar Commons",
  campus: "Tacoma Bay campus",
  description: "Graduating BFA students in studio art and graphic design show their capstone work. The gallery is open weekdays; the opening reception is May 6 from 5 to 7 pm.",
  related: { departments: ["studio-art", "graphic-design"] },
});

// Wellbeing
for (const [title, date, description] of [
  ["Managing Exam Stress", "2026-11-30", "Practical ways to plan your study time, sleep better, and manage anxiety before finals."],
  ["Sleep, Focus, and Studying", "2027-01-27", "A counselor and a sleep researcher on why sleep matters for learning, and small changes that help."],
  ["Managing Exam Stress", "2027-03-08", "Practical ways to plan your study time, sleep better, and manage anxiety before finals."],
]) {
  addEvent({
    title,
    date,
    start: "15:30",
    end: "16:30",
    category: "Wellbeing",
    audience: ["Current students"],
    location: "Group room, Counseling Center",
    campus: "Tacoma Bay campus",
    description,
    related: { services: ["counseling-center"] },
  });
}
for (const date of ["2026-10-28", "2027-02-10"]) {
  addEvent({
    title: "Fresh Food Market",
    date,
    start: "11:00",
    end: "14:00",
    category: "Wellbeing",
    audience: ["Current students"],
    location: "Plaza outside Cedar Commons",
    campus: "Tacoma Bay campus",
    description: "Free fresh produce from regional farms for any current student, no questions asked. Bring a bag if you can.",
    related: { services: ["basic-needs-center-and-food-pantry"] },
  });
}

// Community
addEvent({
  title: "New Student Convocation",
  date: "2026-09-22",
  start: "10:00",
  end: "11:30",
  category: "Community",
  audience: ["Current students", "Families"],
  location: "Main gym, Recreation & Fitness Center",
  campus: "Tacoma Bay campus",
  description: "The university welcomes the incoming class, followed by a resource fair with student services and clubs.",
  related: { services: ["new-student-orientation", "clubs-and-organizations"] },
});
addEvent({
  title: "Indigenous Peoples' Day Gathering",
  date: "2026-10-12",
  start: "12:00",
  end: "14:00",
  category: "Community",
  audience: ["Public", "Current students", "Faculty and staff"],
  location: "Multicultural Center",
  campus: "Tacoma Bay campus",
  description: "A gathering with regional tribal speakers, music, and a shared meal, hosted by the Native Student Alliance and the Multicultural Center.",
  related: { services: ["multicultural-center"] },
});
addEvent({
  title: "Veterans Day Recognition",
  date: "2026-11-10",
  start: "11:00",
  end: "12:00",
  category: "Community",
  audience: ["Public", "Current students", "Faculty and staff"],
  location: "Veterans lounge, Madrona Hall",
  campus: "Tacoma Bay campus",
  description: "The university honors student veterans and military-connected students, with remarks and a reception.",
  related: { services: ["veterans-services"] },
});
addEvent({
  title: "Commencement",
  date: "2027-06-12",
  start: "10:00",
  end: "13:00",
  category: "Community",
  audience: ["Current students", "Families", "Alumni", "Public"],
  location: "Harbor Stadium",
  campus: "Tacoma Bay campus",
  description: "Cascadia State celebrates the class of 2027. Graduates receive guest tickets through the Registrar; the ceremony is also streamed online.",
  related: { services: ["registrar"] },
});

events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));

// ---------------------------------------------------------------------------
// Colleges and departments
// ---------------------------------------------------------------------------
const collegeDescriptions = {
  "College of Engineering & Computing": "Engineering, computing, and security programs built around regional industry partners.",
  "College of Health & Human Services": "Clinical, community, and health programs that prepare students to care for people across the Northwest.",
  "Carver College of Business": "Business programs with small cohorts, applied projects, and close ties to Puget Sound employers.",
  "College of Arts & Letters": "Writing, design, languages, music, and the arts, taught by working scholars and artists.",
  "College of Science": "Life, physical, and earth sciences, with field research from the Salish Sea to the Cascades.",
  "College of Social & Behavioral Sciences": "The study of people, societies, and institutions, with strong research and policy training.",
  "College of Education": "Teacher preparation and education leadership for schools and colleges.",
};

const collegeList = Object.keys(colleges).map((name) => ({ id: collegeId(name), name, description: collegeDescriptions[name] }));
const departments = Object.entries(colleges).flatMap(([college, fields]) =>
  fields.map(([field, cip]) => ({
    id: slug(field),
    name: `Department of ${field}`,
    field,
    college: collegeId(college),
    cip,
    course_prefix: prefixFor(field),
  }))
);

const outDir = join(root, "content/generated");
mkdirSync(outDir, { recursive: true });
const save = (name, rows) => writeFileSync(join(outDir, `${name}.json`), JSON.stringify(rows, null, 2) + "\n");
save("colleges", collegeList);
save("departments", departments);
save("programs", programs);
save("courses", courses);
save("services", services);
save("faculty", faculty);
save("events", events);
console.log(`Wrote ${collegeList.length} colleges, ${departments.length} departments, ${programs.length} programs, ${courses.length} courses, ${services.length} services, ${faculty.length} faculty, and ${events.length} events.`);
