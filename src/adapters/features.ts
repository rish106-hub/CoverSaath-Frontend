import { useBackend } from "./mode";

/**
 * What the backend can store today. A control whose value has no backend field is switched off while the backend is
 * the data source, so nothing a person types is shown as saved and then lost on refresh. With the mock adapters (dev, tests)
 * every control stays on. Each flag is turned on again when the backend gains the field (docs/persistence-matrix.md).
 */
export const features = {
  /** Profile, Contact: a mobile number for a signed-in person. No backend route stores it. */
  profileMobile: !useBackend,
  /** Profile, Address: "Fetch from DigiLocker". There is no DigiLocker integration; the fetch is a mock. */
  digilockerFetch: !useBackend,
  /** Family: member mobile, e-mail and invite channel, and sending an invite. No backend field or invite service. */
  memberContact: !useBackend,
  /** Tools: advisor list and booking. A booking is not a scenario and nothing stores it. */
  advisorBooking: !useBackend,
  /** Settings, Sharing: one switch per person. The backend keeps one family-view switch. */
  perPersonSharing: !useBackend,
} as const;

export type FeatureName = keyof typeof features;

/** Reason each control is off, for the persistence report. */
export const FEATURE_REASON: Record<FeatureName, string> = {
  profileMobile: "no backend route stores a mobile number for a signed-in person",
  digilockerFetch: "no DigiLocker integration in the backend; the fetch was a mock",
  memberContact: "no backend field for member mobile, e-mail or invite channel, and no invite service",
  advisorBooking: "a booking is not a scenario kind; nothing stores it",
  perPersonSharing: "backend holds one family-view switch, not one per person",
};
