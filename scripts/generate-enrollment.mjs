// Writes the first version of content/enrollment/: the academic calendar,
// enrollment steps, and offices by student type, for Your Path.
//
// Run once. After that the files are edited by hand, the way an admissions
// office would own them: this is a deliberate exception to "change the
// generator, not the JSON." Running it again overwrites hand edits, so it
// refuses unless you pass --force.
//
//   node scripts/generate-enrollment.mjs [--force]

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../content/enrollment");
if (existsSync(join(outDir, "steps.json")) && !process.argv.includes("--force")) {
  console.error("content/enrollment/ already exists and is edited by hand. Pass --force to overwrite it.");
  process.exit(1);
}

// Calendar ----------------------------------------------------------------------

// The first day of classes each term (quarters). Every other date is worked
// out from these, or from fixed dates in the admissions cycle below.
const TERMS = [
  ["Fall 2026", "2026-09-23"],
  ["Winter 2027", "2027-01-04"],
  ["Spring 2027", "2027-03-29"],
  ["Summer 2027", "2027-06-21"],
  ["Fall 2027", "2027-09-22"],
  ["Winter 2028", "2028-01-03"],
  ["Spring 2028", "2028-03-27"],
  ["Summer 2028", "2028-06-19"],
];

const toDay = (d) => d.toISOString().slice(0, 10);
const addDays = (day, n) => toDay(new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000));
const weekday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
// Step back to a weekday if a date falls on a weekend
const onWeekday = (day) => (weekday(day) === 0 ? addDays(day, -2) : weekday(day) === 6 ? addDays(day, -1) : day);
const mondayOf = (day) => addDays(day, -((weekday(day) + 6) % 7));
// Fixed dates in the admissions cycle. "prev" means the year before the term starts.
const fixed = (term, monthDay, prev = false) => `${Number(term.split(" ")[1]) - (prev ? 1 : 0)}-${monthDay}`;

const PROSPECTIVE = ["First-year", "Transfer", "Returning adult", "International", "New graduate student"];
const termSlug = (term) => term.toLowerCase().replace(" ", "-");

const calendar = [];
function add(entry) {
  calendar.push({ id: `${entry.term ? termSlug(entry.term) : entry.year}-${entry.key}`, ...entry });
}

for (const [term, classesBegin] of TERMS) {
  const season = term.split(" ")[0];
  const cycle = {
    Fall: { decisions: ["04-01"], deposit: ["05-01"], registration: ["05-17"], i20: ["06-01"] },
    Winter: { decisions: ["11-16", true], deposit: ["12-01", true], registration: ["11-09", true], i20: ["11-01", true] },
    Spring: { decisions: ["02-15"], deposit: ["03-01"], registration: ["02-16"], i20: ["02-01"] },
    Summer: { decisions: ["05-01"], deposit: ["05-15"], registration: ["04-19"], i20: ["04-15"] },
  }[season];
  const at = (key) => onWeekday(fixed(term, ...cycle[key]));
  // Tuition is due on the third Friday of the term
  let firstFriday = classesBegin;
  while (weekday(firstFriday) !== 5) firstFriday = addDays(firstFriday, 1);
  // Finals: the 11th week (fall starts mid-week, so 12th Monday), 9th in the shorter summer term
  const finals = addDays(mondayOf(classesBegin), 7 * { Fall: 11, Winter: 10, Spring: 10, Summer: 8 }[season]);
  const fall = season === "Fall";
  // Orientation is the week before classes, except in winter, when it's in early December, before the break
  const winter = season === "Winter";
  const orientation = (daysBefore, december) => onWeekday(winter ? fixed(term, december, true) : addDays(classesBegin, -daysBefore));

  add({ key: "admission-decisions", term, title: "Admission decisions released", date: at("decisions"), kind: "milestone", student_types: PROSPECTIVE, description: "Decisions go out by email for applications that were complete by the program's deadline.", service: "admissions" });
  add({ key: "enrollment-deposit", term, title: "Enrollment deposit due", date: at("deposit"), kind: "deadline", student_types: PROSPECTIVE, description: "Admitted students confirm their place with a $200 deposit, credited to the first tuition bill.", service: "admissions" });
  add({ key: "i20-documents", term, title: "I-20 financial documents due", date: at("i20"), kind: "deadline", student_types: ["International"], description: "International students send proof of funding so the university can issue an I-20.", service: "international-student-services" });
  add({ key: "registration-opens", term, title: "Registration opens", date: at("registration"), kind: "milestone", description: "Students can sign up for classes. New students register at orientation.", service: "registrar" });
  add({ key: "orientation-first-year", term, title: "First-year orientation", date: orientation(fall ? 7 : 4, "12-08"), ...(fall && { end: onWeekday(addDays(classesBegin, -6)) }), kind: "event", levels: ["Undergraduate"], student_types: ["First-year", "International"], description: "Meet an advisor, register for classes, and get a student ID.", service: "new-student-orientation" });
  add({ key: "orientation-transfer", term, title: "Transfer orientation", date: orientation(fall ? 5 : 3, "12-09"), kind: "event", levels: ["Undergraduate"], student_types: ["Transfer", "Returning adult"], description: "Review how credits apply, meet an advisor, and register for classes.", service: "new-student-orientation" });
  add({ key: "orientation-graduate", term, title: "Graduate orientation", date: orientation(2, "12-10"), kind: "event", levels: ["Graduate"], student_types: ["New graduate student", "International"], description: "Meet program directors and other new graduate students, and learn about funding and research support.", service: "graduate-school-office" });
  add({ key: "classes-begin", term, title: "Classes begin", date: classesBegin, kind: "milestone", service: "registrar" });
  add({ key: "last-day-to-add", term, title: "Last day to add classes", date: addDays(classesBegin, 7), kind: "deadline", description: "After this, adding a class needs the instructor's approval.", service: "registrar" });
  add({ key: "tuition-due", term, title: "Tuition due", date: addDays(firstFriday, 14), kind: "deadline", description: "Pay in full or set up a payment plan to keep your classes.", service: "student-accounts" });
  add({ key: "finals-week", term, title: "Finals week", date: finals, end: addDays(finals, 4), kind: "milestone" });
}

// Once a year: the FAFSA/WASFA priority date for each academic year
for (const year of ["2026-27", "2027-28"]) {
  add({ key: "fafsa-priority", year, title: "FAFSA and WASFA priority date", date: `${year.slice(0, 4)}-02-15`, kind: "deadline", student_types: ["First-year", "Transfer", "Returning adult", "New graduate student", "Current student"], description: `File by this date to be considered for the most grants and scholarships for ${year.replace("-", "–")}.`, service: "financial-aid-and-scholarships", url: "https://studentaid.gov/" });
}
calendar.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

// Steps ------------------------------------------------------------------------

const UG = ["Undergraduate"];
const GRAD = ["Graduate"];
const BOTH = ["Undergraduate", "Graduate"];
const UG_PROSPECTIVE = ["First-year", "Transfer", "Returning adult", "International"];
const GRAD_PROSPECTIVE = ["New graduate student", "International"];

// The application journey comes first for prospective students (explore,
// request information, visit, apply), then each type's own steps.
const steps = [
  { id: "explore-programs", order: 10, levels: BOTH, student_types: PROSPECTIVE, journey: "explore", url: "/academics/programs/", title: "Explore programs", description: "Find programs that fit what you want to study, how you want to learn, and when you want to start. Save the ones you like to compare them." },
  { id: "request-info", order: 20, levels: UG, student_types: UG_PROSPECTIVE, journey: "requestInfo", office: "admissions", url: "/admissions/request-info/", title: "Request information", description: "Tell us what interests you, and an admissions counselor will send details about programs, costs, and next steps." },
  { id: "grad-request-info", order: 20, levels: GRAD, student_types: GRAD_PROSPECTIVE, journey: "requestInfo", office: "graduate-school-office", url: "/admissions/request-info/", title: "Request information", description: "Tell us which programs interest you, and a graduate admissions advisor will send details about requirements, funding, and next steps." },
  { id: "visit-campus", order: 30, levels: BOTH, student_types: PROSPECTIVE, journey: "visit", office: "admissions", url: "/admissions/visit/schedule/", title: "Visit campus", description: "Take a tour, sit in on a class, and talk with an admissions counselor. Online sessions work if you can't come in person." },
  { id: "apply", order: 40, levels: UG, student_types: UG_PROSPECTIVE, journey: "apply", due: { program_deadline: true }, office: "admissions", url: "/admissions/apply/", title: "Apply", description: "Submit your application by your program's deadline. It's free for Washington residents and takes about 30 minutes." },
  { id: "grad-apply", order: 40, levels: GRAD, student_types: GRAD_PROSPECTIVE, journey: "apply", due: { program_deadline: true }, office: "graduate-school-office", url: "/admissions/apply/", title: "Apply, with transcripts and recommendations", description: "Submit your application by your program's deadline, with transcripts from every college you've attended and two letters of recommendation." },
  { id: "send-transcripts", order: 45, levels: UG, student_types: ["Transfer", "Returning adult"], due: { program_deadline: true }, office: "transfer-center", title: "Send transcripts from every college you've attended", description: "Ask each college to send an official transcript. Unofficial copies are fine while we review your application." },
  { id: "english-proficiency", order: 45, levels: BOTH, student_types: ["International"], due: { program_deadline: true }, office: "international-student-services", title: "Send English proficiency scores", description: "Send TOEFL, IELTS, or Duolingo English Test scores, unless English is your first language or you studied in English." },
  { id: "fafsa", order: 50, levels: BOTH, student_types: ["First-year", "Transfer", "Returning adult", "New graduate student", "Current student"], due: { calendar: "fafsa-priority" }, office: "financial-aid-and-scholarships", url: "https://studentaid.gov/", title: "Submit your FAFSA or WASFA", description: "File by the priority date to be considered for the most grants and scholarships. Use the WASFA if you can't file the FAFSA. File again every year." },
  { id: "financial-documents", order: 55, levels: BOTH, student_types: ["International"], due: { calendar: "i20-documents" }, office: "international-student-services", title: "Send financial documents for your I-20", description: "Show that you can cover a year of tuition and living costs. We need these before we can issue your I-20." },
  { id: "housing", order: 60, levels: UG, student_types: ["First-year"], due: { before_term_start_days: 60 }, office: "housing-and-residence-life", title: "Apply for housing", description: "First-year students get priority for the residence halls. Apply early for the best choice of rooms." },
  { id: "assistantship", order: 60, levels: GRAD, student_types: GRAD_PROSPECTIVE, due: { before_term_start_days: 90 }, office: "graduate-school-office", title: "Ask about assistantships", description: "Teaching and research assistantships cover tuition and pay a stipend. Ask your program about openings when you apply." },
  { id: "credit-evaluation", order: 65, levels: UG, student_types: ["Transfer"], due: { before_term_start_days: 45 }, office: "transfer-center", title: "Get your credits evaluated", description: "After you're admitted, the Transfer Center shows how your credits apply to your program, so you know what's left." },
  { id: "adult-advising", order: 65, levels: UG, student_types: ["Returning adult"], due: { before_term_start_days: 30 }, office: "academic-advising", title: "Plan your schedule with an advisor", description: "Build a schedule that fits around work and family, with evening, hybrid, and online classes, and ask about credit for prior learning." },
  { id: "enrollment-deposit", order: 70, levels: UG, student_types: UG_PROSPECTIVE, due: { calendar: "enrollment-deposit" }, office: "admissions", title: "Confirm your place", description: "Pay the $200 enrollment deposit to hold your place. It's credited to your first tuition bill." },
  { id: "grad-accept-offer", order: 70, levels: GRAD, student_types: GRAD_PROSPECTIVE, due: { calendar: "enrollment-deposit" }, office: "graduate-school-office", title: "Accept your offer of admission", description: "Accept your offer and pay the enrollment deposit to hold your place in your program." },
  { id: "i20-visa", order: 75, levels: BOTH, student_types: ["International"], due: { before_term_start_days: 60 }, office: "international-student-services", title: "Get your I-20 and apply for a visa", description: "When your I-20 arrives, pay the SEVIS fee and book your F-1 visa interview. Interview waits can take several weeks." },
  { id: "orientation-first-year", order: 80, levels: UG, student_types: ["First-year", "International"], due: { calendar: "orientation-first-year" }, office: "new-student-orientation", title: "Attend first-year orientation", description: "Meet your advisor, register for your first classes, and get your student ID. Families are welcome on the first morning." },
  { id: "orientation-transfer", order: 80, levels: UG, student_types: ["Transfer", "Returning adult"], due: { calendar: "orientation-transfer" }, office: "new-student-orientation", title: "Attend transfer orientation", description: "Meet your advisor, review how your credits apply, and register for your first classes." },
  { id: "orientation-graduate", order: 80, levels: GRAD, student_types: GRAD_PROSPECTIVE, due: { calendar: "orientation-graduate" }, office: "graduate-school-office", title: "Attend graduate orientation", description: "Meet your program director and other new graduate students, and learn about funding, research support, and campus resources." },
  { id: "meet-advisor", order: 82, levels: BOTH, student_types: ["Current student"], due: { calendar: "registration-opens" }, office: "academic-advising", title: "Meet with your advisor", description: "Check your degree progress and plan next term's classes before registration opens." },
  { id: "register", order: 84, levels: BOTH, student_types: ["Current student"], due: { calendar: "classes-begin" }, office: "registrar", title: "Register for classes", description: "Sign up as soon as registration opens for the best choice of sections." },
  { id: "pay-tuition", order: 90, levels: BOTH, student_types: [...PROSPECTIVE, "Current student"], due: { calendar: "tuition-due" }, office: "student-accounts", title: "Pay tuition", description: "Pay your bill or set up a payment plan with Student Accounts by the due date to keep your classes." },
  { id: "finalize-schedule", order: 95, levels: BOTH, student_types: ["Current student"], due: { calendar: "last-day-to-add" }, office: "registrar", title: "Finalize your schedule", description: "Add or drop classes by the deadline. After that, changes need an instructor's approval." },
];

// Offices ------------------------------------------------------------------------

const offices = [
  { level: "Undergraduate", student_type: "First-year", offices: [
    { service: "admissions", reason: "Answers questions about applying and your admission decision." },
    { service: "financial-aid-and-scholarships", reason: "Helps with the FAFSA, grants, and scholarships." },
    { service: "housing-and-residence-life", reason: "Runs the residence halls, where most first-year students live." },
    { service: "new-student-orientation", reason: "Plans your orientation and first week." },
  ] },
  { level: "Undergraduate", student_type: "Transfer", offices: [
    { service: "transfer-center", reason: "Evaluates your credits and helps you plan the rest of your degree." },
    { service: "admissions", reason: "Answers questions about applying and your admission decision." },
    { service: "financial-aid-and-scholarships", reason: "Helps with the FAFSA and transfer scholarships." },
  ] },
  { level: "Undergraduate", student_type: "Returning adult", offices: [
    { service: "academic-advising", reason: "Helps you build a schedule that fits around work and family." },
    { service: "financial-aid-and-scholarships", reason: "Helps with the FAFSA and aid for part-time students." },
    { service: "transfer-center", reason: "Counts credits from any college you've attended before." },
    { service: "veterans-services", reason: "Helps veterans and military-connected students use their education benefits." },
  ] },
  { level: "Undergraduate", student_type: "International", offices: [
    { service: "international-student-services", reason: "Issues your I-20 and helps with visas and arrival." },
    { service: "admissions", reason: "Answers questions about applying and your admission decision." },
    { service: "housing-and-residence-life", reason: "Helps you find a place to live before you arrive." },
  ] },
  { level: "Undergraduate", student_type: "Current student", offices: [
    { service: "academic-advising", reason: "Helps you plan classes and stay on track to graduate." },
    { service: "registrar", reason: "Handles registration, transcripts, and your academic record." },
    { service: "student-accounts", reason: "Handles tuition bills and payment plans." },
  ] },
  { level: "Graduate", student_type: "New graduate student", offices: [
    { service: "graduate-school-office", reason: "Handles graduate admission, assistantships, and your thesis." },
    { service: "financial-aid-and-scholarships", reason: "Helps with the FAFSA and graduate loans." },
  ] },
  { level: "Graduate", student_type: "International", offices: [
    { service: "international-student-services", reason: "Issues your I-20 and helps with visas and arrival." },
    { service: "graduate-school-office", reason: "Handles graduate admission and assistantships." },
  ] },
  { level: "Graduate", student_type: "Current student", offices: [
    { service: "graduate-school-office", reason: "Handles assistantships, thesis deadlines, and graduation." },
    { service: "registrar", reason: "Handles registration, transcripts, and your academic record." },
    { service: "student-accounts", reason: "Handles tuition bills and payment plans." },
  ] },
];

mkdirSync(outDir, { recursive: true });
const save = (name, rows) => writeFileSync(join(outDir, `${name}.json`), JSON.stringify(rows, null, 2) + "\n");
save("calendar", calendar);
save("steps", steps.map(({ id, title, description, levels, student_types, order, due, office, url, journey }) => ({ id, title, description, levels, student_types, order, ...(due && { due }), ...(office && { office }), ...(url && { url }), ...(journey && { journey }) })));
save("offices", offices);
console.log(`Wrote ${calendar.length} calendar entries, ${steps.length} steps, and ${offices.length} office sets to content/enrollment/.`);
