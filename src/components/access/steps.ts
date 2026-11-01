const STEPS = [
  { slug: "add", title: "How would you like to add your policy?", kicker: "Step 1 of 4 · about 30 seconds" },
  { slug: "reading", title: "Reading your policy", kicker: "Step 2 of 4 · reading your policy" },
  { slug: "people", title: "Who is on this policy?", kicker: "Step 3 of 4 · we found these on the schedule" },
  { slug: "ready", title: "Here’s what your cover does.", kicker: "Step 4 of 4 · done" },
] as const;
export const WELCOME_STEPS = STEPS;
