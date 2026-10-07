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
