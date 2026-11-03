// The photo library, with alt text, so a photo is described the same way
// wherever it's used. Pages pass these to Astro's <Picture> or getImage().

import art from "../assets/images/art-1.jpg";
import business from "../assets/images/business-1.jpg";
import health from "../assets/images/health-1.jpg";
import helping from "../assets/images/helping-1.jpg";
import science from "../assets/images/science-1.jpg";
import teacher from "../assets/images/teacher-1.jpg";
import technology from "../assets/images/technology-1.jpg";
import classTalk from "../assets/images/students-class-2.jpg.jpg";
import classDesks from "../assets/images/students-class-3.jpg";
import lectureHall from "../assets/images/students-class-4.jpg";
import campusWalk from "../assets/images/students-campus-6.jpg";
import student1 from "../assets/images/profile-student-1.jpg";
import student2 from "../assets/images/profile-student-2.jpg";
import student3 from "../assets/images/profile-student-3.jpg";
import adult1 from "../assets/images/profile-adult-1.jpg";
import adult2 from "../assets/images/profile-adult-2.jpg";
import adult3 from "../assets/images/profile-adult-3.jpg";
import adult4 from "../assets/images/profile-adult-4.jpg";
import type { PROGRAM_SCENES, STORY_PHOTOS } from "./schemas.ts";

export type Photo = { image: ImageMetadata; alt: string };

// One per college: the home page hero and program pages
export const collegePhotos: Record<string, Photo> = {
  "College of Science": { image: science, alt: "Students gathered around lab equipment, watching an experiment" },
  "Carver College of Business": { image: business, alt: "A professional in a light suit working on a laptop in a city plaza" },
  "College of Social & Behavioral Sciences": { image: helping, alt: "A counselor talking with two clients in a small group session" },
  "College of Engineering & Computing": { image: technology, alt: "A team at a table of laptops while a colleague sketches on a whiteboard" },
  "College of Education": { image: teacher, alt: "A smiling teacher at a whiteboard speaking to students" },
  "College of Arts & Letters": { image: art, alt: "A painter at an easel in a bright studio" },
  "College of Health & Human Services": { image: health, alt: "A doctor in a white coat speaking with a patient in an exam room" },
};

// Classroom and campus scenes, for program pages' highlights
export const scenePhotos: Record<(typeof PROGRAM_SCENES)[number], Photo> = {
  "students-class-2": { image: classTalk, alt: "Students talking and laughing at their desks in a lecture hall, one with a laptop open" },
  "students-class-3": { image: classDesks, alt: "An instructor talking with students at their desks in a bright classroom" },
  "students-class-4": { image: lectureHall, alt: "An instructor speaking to students with laptops in a wood-paneled lecture hall" },
  "students-campus-6": { image: campusWalk, alt: "Three students with backpacks walking and talking on a brick path through campus" },
};

// Portraits for student stories. The caption names the person, so the photo needs no alt text.
export const storyPhotos: Record<(typeof STORY_PHOTOS)[number], ImageMetadata> = {
  "profile-student-1": student1,
  "profile-student-2": student2,
  "profile-student-3": student3,
  "profile-adult-1": adult1,
  "profile-adult-2": adult2,
  "profile-adult-3": adult3,
  "profile-adult-4": adult4,
};
