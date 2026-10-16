// Shared vocabulary. The content schemas and the MCP tools both import these
// lists, so a value is either valid everywhere or nowhere.

export const PROGRAM_LEVELS = ["Bachelor's", "Master's", "Doctorate", "Certificate", "Minor"] as const;
export const COURSE_LEVELS = ["Lower division", "Upper division", "Graduate"] as const;
export const MODALITIES = ["In person", "Online", "Hybrid"] as const;
export const TERMS = ["Fall", "Winter", "Spring", "Summer"] as const;
export const CAMPUSES = ["Tacoma Bay campus", "Olympia campus", "Online"] as const;
export const SERVICE_CATEGORIES = ["Academics", "Enrollment", "Money", "Wellbeing", "Support", "Career", "Campus life", "Technology"] as const;

// Week starts Monday, the way people read opening hours.
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" } as const;

export type Day = (typeof DAYS)[number];

export const FACULTY_TITLES = ["Professor", "Associate Professor", "Assistant Professor", "Senior Lecturer"] as const;
export const EVENT_CATEGORIES = ["Admissions", "Academics", "Arts", "Career", "Community", "Money", "Wellbeing"] as const;
export const AUDIENCES = ["Prospective students", "Current students", "Families", "Alumni", "Faculty and staff", "Public"] as const;

// Your Path: who a student is. Level and type decide which enrollment steps,
// dates, and offices apply (see content/enrollment/). The labels may change,
// so use these lists rather than writing them out.
export const STUDENT_LEVELS = ["Undergraduate", "Graduate"] as const;
export const STUDENT_TYPES = {
  Undergraduate: ["First-year", "Transfer", "Returning adult", "International", "Current student"],
  Graduate: ["New graduate student", "International", "Current student"],
} as const satisfies Record<(typeof STUDENT_LEVELS)[number], readonly string[]>;
export const ALL_STUDENT_TYPES = [...new Set(Object.values(STUDENT_TYPES).flat())] as [string, ...string[]];
// Which student level each program level belongs to
export const LEVEL_OF_PROGRAM: Record<(typeof PROGRAM_LEVELS)[number], (typeof STUDENT_LEVELS)[number]> = {
  "Bachelor's": "Undergraduate",
  Minor: "Undergraduate",
  "Master's": "Graduate",
  Doctorate: "Graduate",
  Certificate: "Graduate",
};
