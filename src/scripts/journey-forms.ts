// Behavior for the application-journey forms (src/components/forms/).
// Nothing is sent anywhere: a valid form saves its answers to this tab's
// session (see personalize.ts), which completes that journey step, and the
// form is replaced by a thank-you note and the next step.
//
// Errors follow a common accessible pattern: a summary at the top that links
// to each problem and gets focus, plus a message next to each field.

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

// Request info: picking a level narrows the program list, and picking a
// program sets its level.
function linkLevelAndProgram(form: HTMLFormElement) {
  const level = form.elements.namedItem("level") as HTMLSelectElement | null;
  const program = form.elements.namedItem("program") as HTMLSelectElement | null;
  if (!level || !program) return;
  const narrow = () => {
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
  // ?program=<id> in the address, e.g. from a program page's "Request information" link
  const requested = new URLSearchParams(location.search).get("program");
  if (requested && program.querySelector(`option[value="${CSS.escape(requested)}"]`)) {
    program.value = requested;
    program.dispatchEvent(new Event("change"));
  }
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
  return { ...contact, level: data.level, startTerm: data.startTerm, ...(program && { program }), at };
}

const thanks: Record<Kind, (session: Session) => string> = {
  requestInfo: ({ forms }) =>
    `We'll send information about ${forms.requestInfo?.program?.name ?? `${forms.requestInfo?.level} programs`} starting ${forms.requestInfo?.startTerm}.`,
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
  form.hidden = true;
  success.hidden = false;
  title.focus();
}

document.querySelectorAll<HTMLFormElement>("form[data-journey-form]").forEach((form) => {
  const kind = form.dataset.journeyForm as Kind;
  const wrapper = form.parentElement!;
  const summary = form.querySelector<HTMLElement>(".error-summary")!;
  const fields = [...form.querySelectorAll<Field>("input, select")];

  // No visits in the past (by local time)
  const visitDate = form.elements.namedItem("date") as HTMLInputElement | null;
  if (visitDate) visitDate.min = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");

  linkLevelAndProgram(form);
  prefill(form, loadSession());

  // Clear a field's error as soon as it's fixed
  fields.forEach((field) =>
    field.addEventListener(field.tagName === "SELECT" ? "change" : "input", () => {
      if (field.getAttribute("aria-invalid") && !problemWith(field)) setError(field, "");
    })
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const problems = fields.map((field) => ({ field, message: problemWith(field) }));
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
    const session = recordForm(kind, answersFrom(form, kind));
    showSuccess(wrapper, form, kind, session);
  });
});
