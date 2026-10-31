// Behavior for the application-journey forms (src/components/forms/).
// Nothing is sent anywhere: a valid form saves its answers to this tab's
// session (see personalize.ts), which completes that journey step, and the
// form is replaced by a thank-you note and the next step.
//
// Errors follow a common accessible pattern: a summary at the top that links
// to each problem and gets focus, plus a message next to each field.
//
// A form in steps ([data-form-step], request info) shows one at a time:
// submitting checks only the fields in view, then moves on, until the last.

import siteConfig from "../../site.config.ts";
import { listText } from "../lib/format.ts";
import { requestInfoCopy, VISIT_COPY } from "../lib/workbench/handoffs.ts";
import { WORKBENCH_LABEL } from "../lib/workbench/types.ts";
import { workbench } from "../lib/workbench/store.ts";
import { pathSummary } from "./workbench/handoffs.ts";
import { loadSession, markPersonalized, nextStep, recordForm, type Forms, type Session } from "./personalize.ts";

type Kind = keyof Forms;
type Field = HTMLInputElement | HTMLSelectElement;

const errorFor = (field: Field) => document.getElementById(`${field.id}-error`)!;
const labelFor = (field: Field) => field.labels?.[0]?.firstChild?.textContent?.trim() ?? field.name;

function setError(field: Field, message: string) {
  const error = errorFor(field);
  error.textContent = message;
  error.hidden = !message;
  if (message) field.setAttribute("aria-invalid", "true");
  else field.removeAttribute("aria-invalid");
}

// The browser's own checks (required, type, min/max, pattern), worded our way
function problemWith(field: Field) {
  const { validity, dataset } = field;
  if (validity.valid) return "";
  if (validity.valueMissing) return dataset.missing ?? `Enter your ${labelFor(field).toLowerCase()}`;
  return dataset.invalid ?? `Check your ${labelFor(field).toLowerCase()}`;
}

// Request info: picking a level narrows the program list and student types,
// and picking a program sets its level.
function linkLevelAndProgram(form: HTMLFormElement) {
  const level = form.elements.namedItem("level") as HTMLSelectElement | null;
  const program = form.elements.namedItem("program") as HTMLSelectElement | null;
  if (!level || !program) return;
  // Student types that apply at the chosen level (Transfer is only for bachelor's degrees)
  const studentType = form.elements.namedItem("studentType") as HTMLSelectElement | null;
  const narrowTypes = () => {
    if (!studentType) return;
    const studentLevel = level.selectedOptions[0]?.dataset.studentLevel;
    for (const option of studentType.querySelectorAll<HTMLOptionElement>("option[data-student-levels]")) {
      const show = !studentLevel || option.dataset.studentLevels!.split(" ").includes(studentLevel);
      option.hidden = !show;
      option.disabled = !show;
    }
    if (studentType.selectedOptions[0]?.disabled) studentType.value = "";
  };
  const narrow = () => {
    narrowTypes();
    for (const group of program.querySelectorAll("optgroup")) {
      const show = !level.value || group.label === level.value;
      group.hidden = !show;
      group.querySelectorAll("option").forEach((o) => (o.disabled = !show));
    }
    if (program.selectedOptions[0]?.disabled) program.value = "";
  };
  level.addEventListener("change", narrow);
  program.addEventListener("change", () => {
    const chosen = program.selectedOptions[0]?.dataset.level;
    if (chosen && level.value !== chosen) {
      level.value = chosen;
      narrow();
    }
  });
  // ?program=<id> in the address, e.g. from an older link to the request-info page
  const requested = new URLSearchParams(location.search).get("program");
  if (requested && program.querySelector(`option[value="${CSS.escape(requested)}"]`)) {
    program.value = requested;
    program.dispatchEvent(new Event("change"));
  } else if (level.value) narrow(); // picked by the page, e.g. a program page
}

// Fill in name, email, and phone from an earlier form in this tab
function prefill(form: HTMLFormElement, session: Session) {
  const filled: string[] = [];
  for (const [name, value] of Object.entries(session.profile.contact)) {
    const field = form.elements.namedItem(name) as HTMLInputElement | null;
    if (!value || !field || field.value) continue;
    field.value = value;
    filled.push(labelFor(field).toLowerCase());
  }
  if (filled.length) {
    markPersonalized(form, `${form.querySelector("h2, h3")?.textContent} form: filled in your ${filled.join(", ")}, because you gave them in an earlier form.`);
  }
}

// Fill in the student type and start term from what the student chose on
// Your Path, or else said in an earlier request, and say where everything
// that's filled in came from (the page picks the level and program)
function prefillInterests(form: HTMLFormElement, session: Session) {
  const note = form.querySelector<HTMLDetailsElement>("[data-filled-in]");
  if (!note) return;
  const chosen = siteConfig.features.workbench ? workbench.get().profile : {};
  const earlier = session.forms.requestInfo;
  const filled: string[] = [];
  const sources = new Set<string>();
  const level = form.elements.namedItem("level") as HTMLSelectElement;
  if (level.querySelector("option[selected]")) sources.add("this program's page");
  for (const name of ["studentType", "startTerm"] as const) {
    const field = form.elements.namedItem(name) as HTMLSelectElement;
    const value = chosen[name] ?? earlier?.[name];
    const option = value ? field.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(value)}"]`) : null;
    if (field.value || !option || option.disabled) continue;
    field.value = value!;
    filled.push(labelFor(field).toLowerCase());
    sources.add(chosen[name] ? `your choices on ${WORKBENCH_LABEL}` : "your earlier request");
  }
  if (!sources.size) return;
  const from = listText([...sources]);
  note.querySelector("[data-filled-in-text]")!.textContent = `Filled in from ${from}. Change anything that isn't right.`;
  note.hidden = false;
  if (filled.length) markPersonalized(form, `${form.querySelector("h2, h3")?.textContent} form: filled in your ${filled.join(" and ")}, from ${from}.`);
}

// Steps: show one, and say which in the step count (which gets focus on a move)
function showStep(form: HTMLFormElement, n: number, { focus = true } = {}) {
  const steps = [...form.querySelectorAll<HTMLElement>("[data-form-step]")];
  steps.forEach((step, i) => (step.hidden = i !== n - 1));
  const count = form.querySelector<HTMLElement>("[data-step-count]")!;
  const names = JSON.parse(count.dataset.stepNames!) as string[];
  count.textContent = `Step ${n} of ${names.length}: ${names[n - 1]}`;
  form.querySelector<HTMLElement>("[data-step-back]")!.hidden = n === 1;
  const submit = form.querySelector<HTMLButtonElement>("[data-submit]")!;
  submit.textContent = n === names.length ? submit.dataset.submit! : "Continue";
  form.dataset.step = String(n);
  if (focus) count.focus();
}

function answersFrom(form: HTMLFormElement, kind: Kind): Forms[Kind] {
  const data = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
  const at = new Date().toISOString();
  const contact = { firstName: data.firstName, lastName: data.lastName, email: data.email };
  if (kind === "visit") {
    return { ...contact, date: data.date, guests: Number(data.guests), ...(data.phone && { phone: data.phone }), at };
  }
  const option = (form.elements.namedItem("program") as HTMLSelectElement).selectedOptions[0];
  const program = option?.value
    ? { id: option.value, name: option.text.trim(), department: option.dataset.department!, college: option.dataset.college!, level: option.dataset.level!, modality: option.dataset.modality! }
    : undefined;
  return { ...contact, level: data.level, ...(data.studentType && { studentType: data.studentType }), startTerm: data.startTerm, ...(program && { program }), ...(data.military && { military: true }), at };
}

const thanks: Record<Kind, (session: Session) => string> = {
  requestInfo: ({ forms }) =>
    `We'll send information about ${forms.requestInfo?.program?.name ?? `${forms.requestInfo?.level} programs`} starting ${forms.requestInfo?.startTerm}.${forms.requestInfo?.military ? " We'll include information from Veterans Services." : ""}`,
  visit: ({ forms }) => {
    const date = new Date(`${forms.visit!.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const guests = forms.visit!.guests;
    return `Your visit is requested for ${date}${guests ? `, with ${guests} ${guests === 1 ? "guest" : "guests"}` : ""}. We'll confirm a time by email.`;
  },
};

function showSuccess(wrapper: HTMLElement, form: HTMLFormElement, kind: Kind, session: Session) {
  const success = wrapper.querySelector<HTMLElement>(".success")!;
  const title = success.querySelector<HTMLElement>(".success-title")!;
  title.textContent = `Thanks, ${session.forms[kind]!.firstName}`;
  success.querySelector(".success-text")!.textContent = `${thanks[kind](session)} (This is a demo, so nothing was actually sent.)`;
  const link = success.querySelector<HTMLAnchorElement>(".next-step")!;
  const next = nextStep(session.profile);
  link.textContent = next ? `Next step: ${next.label}` : "Next: tuition and financial aid";
  link.href = next?.href ?? "/admissions/tuition-and-aid/";
  link.toggleAttribute("data-journey-apply", next?.step === "apply");
  // What sending the form did for Your Path
  const path = success.querySelector<HTMLElement>("[data-success-path]");
  if (path) {
    const copy = kind === "visit" ? VISIT_COPY : requestInfoCopy(pathSummary());
    path.querySelector("[data-success-path-text]")!.textContent = copy.text;
    const pathLink = path.querySelector<HTMLAnchorElement>("[data-success-path-link]")!;
    pathLink.textContent = copy.action.label;
    pathLink.href = copy.action.href;
  }
  form.hidden = true;
  success.hidden = false;
  title.focus();
}

document.querySelectorAll<HTMLFormElement>("form[data-journey-form]").forEach((form) => {
  const kind = form.dataset.journeyForm as Kind;
  const wrapper = form.parentElement!;
  const summary = form.querySelector<HTMLElement>(".error-summary")!;
  // Checkboxes are optional, so there's nothing to check
  const fields = [...form.querySelectorAll<Field>("input:not([type=checkbox]), select")];

  // No visits in the past (by local time)
  const visitDate = form.elements.namedItem("date") as HTMLInputElement | null;
  if (visitDate) visitDate.min = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");

  linkLevelAndProgram(form);
  prefill(form, loadSession());
  prefillInterests(form, loadSession());
  const stepped = form.querySelector("[data-form-step]") !== null;
  const lastStep = form.querySelectorAll("[data-form-step]").length;
  form.querySelector("[data-step-back]")?.addEventListener("click", () => {
    showStep(form, Number(form.dataset.step) - 1, { focus: false });
    summary.hidden = true;
    (form.elements.namedItem("email") as HTMLInputElement).focus();
  });

  // Clear a field's error as soon as it's fixed
  fields.forEach((field) =>
    field.addEventListener(field.tagName === "SELECT" ? "change" : "input", () => {
      if (field.getAttribute("aria-invalid") && !problemWith(field)) setError(field, "");
    })
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // Only the fields in view: in a form in steps, the rest are hidden
    const inView = fields.filter((field) => !field.closest("[hidden]"));
    const problems = inView.map((field) => ({ field, message: problemWith(field) }));
    problems.forEach(({ field, message }) => setError(field, message));
    const invalid = problems.filter((p) => p.message);
    if (invalid.length) {
      summary.querySelector("ul")!.replaceChildren(
        ...invalid.map(({ field, message }) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = `#${field.id}`;
          a.textContent = message;
          a.addEventListener("click", (event) => {
            event.preventDefault();
            field.focus();
          });
          li.append(a);
          return li;
        })
      );
      summary.hidden = false;
      summary.focus();
      return;
    }
    summary.hidden = true;
    const step = Number(form.dataset.step ?? 1);
    if (stepped && step < lastStep) return showStep(form, step + 1);
    const session = recordForm(kind, answersFrom(form, kind));
    // Sending the visit form puts the visit on Your Path's timeline (only its date is kept)
    if (kind === "visit" && siteConfig.features.workbench) workbench.setVisit(session.forms.visit!.date);
    showSuccess(wrapper, form, kind, session);
  });
});
