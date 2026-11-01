// Ask Knowvia page contexts for the public screens. W6: register each with the page-context hook once W1 is merged.
export const publicPageContexts = {
  landing: { page: "Beta access", reads: "the Knowvia beta page", examples: ["What does Knowvia do?", "Is it free?", "How do I get access?"] },
  signin: { page: "Sign in", reads: "the sign-in page", examples: ["I didn’t get the code", "Sign in with email instead", "Is my data safe?"] },
  welcome: { page: "Getting started", reads: "what you have added so far", examples: ["I can’t find my policy", "My employer gives me insurance", "Skip this for now"] },
  cards: { page: "Cards", reads: "your saved policy cards", examples: ["Add Papa’s card to my wallet", "Share Mumma’s card with Rohan", "Which card do I show at the hospital?"] },
} as const;
