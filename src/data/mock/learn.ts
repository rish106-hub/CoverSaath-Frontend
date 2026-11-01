import type { LearnPost } from "@/adapters/schemas";

export const readingList = [
  { title: "Room rent, explained with one bill", minutes: 4, progress: 60 },
  { title: "Before an admission: 5 calls to make", minutes: 6, progress: 0 },
  { title: "Super top-up vs top-up", minutes: 5, progress: 25 },
];

export const learnPosts: LearnPost[] = [
  { id: "l1", kind: "Video", title: "Co-pay explained with a real hospital bill", why: "Because your parents’ plan has 20% co-pay", minutes: 6 },
  { id: "l2", kind: "Guide", title: "Before Father’s next admission: the room rent question to ask", why: "Because his documents disagree on room rent", minutes: 4 },
  { id: "l3", kind: "News", title: "Insurers must settle cashless requests within 3 hours of discharge", why: "Applies to all three of your insurers", minutes: 3 },
];
