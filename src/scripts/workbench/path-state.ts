// Your Path on every page: whether a plan exists, its steps, and the next
// one, for the header's badge and button and the next-step tile. Uses only
// the steps (bundled), the saved workbench, and this tab's session, so it
// needs no download. The Your Path page works out the full plan, with dates.

import stepsData from "../../../content/enrollment/steps.json" with { type: "json" };
import siteConfig from "../../../site.config.ts";
import { rulesFrom } from "../../lib/enrollment-rules.ts";
import type { EnrollmentStep } from "../../lib/schemas.ts";
import { upcomingTerms } from "../../lib/terms.ts";
import { pagePath } from "../../lib/urls.ts";
import { nextOf, planSteps, type JourneyStepName, type PlanStep } from "../../lib/workbench/plan.ts";
import { resolveProfile, type ResolvedProfile } from "../../lib/workbench/profile.ts";
import { workbench } from "../../lib/workbench/store.ts";
import { WORKBENCH_PATH } from "../../lib/workbench/types.ts";
import type { Session } from "../personalize.ts";

const stepsOnly = rulesFrom({ steps: stepsData as EnrollmentStep[], calendar: [], offices: [] });

// What this tab's session tells Your Path: page views, the request-info
// answer, and which journey steps are done
export function signalsFrom(session: Session | undefined) {
  return {
    views: session?.views ?? [],
    requestInfo: session?.forms.requestInfo,
    journeyDone: Object.keys(session?.profile.journey ?? {}) as JourneyStepName[],
  };
}

export type PathState = { profile: ResolvedProfile; steps?: PlanStep[]; next?: PlanStep; toDo: number; saved: number };

export function pathState(session?: Session): PathState {
  const w = workbench.get();
  const { views, requestInfo, journeyDone } = signalsFrom(session);
  const profile = resolveProfile(w.profile, { views, requestInfo, items: w.items }, upcomingTerms());
  const saved = w.items.filter((i) => i.kind !== "answer").length;
  if (!siteConfig.features.workbench || !profile.ready) return { profile, toDo: 0, saved };
  const steps = planSteps(stepsOnly, profile.level.value!, profile.studentType.value!, profile.startTerm.value, { completed: w.completed, journeyDone, programDeadlines: [] });
  return { profile, steps, next: nextOf(steps), toDo: steps.filter((s) => s.status !== "done").length, saved };
}

// Where a step is done: its own page, else its office, else Your Path
export const stepHref = (step: EnrollmentStep) => step.url ?? (step.office ? pagePath("services", step.office) : WORKBENCH_PATH);
