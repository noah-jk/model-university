// /data/enrollment.json: the enrollment rules (calendar, steps, and offices)
// for Your Path in the browser. Built whenever the workbench is switched on.
// Kept apart from workbench-index.json, which is near its size budget.
import type { APIRoute } from "astro";
import { calendar, officeSets, steps } from "../lib/enrollment.ts";

export const ENROLLMENT_BUDGET_KB = 60;

export const enrollmentData = () => JSON.stringify({ calendar, steps, offices: officeSets });

export const GET: APIRoute = () => {
  const body = enrollmentData();
  console.log(`[workbench] enrollment.json: ${(body.length / 1024).toFixed(0)} KB (budget ${ENROLLMENT_BUDGET_KB} KB)`);
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
