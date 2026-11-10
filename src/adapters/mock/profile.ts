import type { ProfileAdapter } from "../types";
import { AdapterError } from "../types";
import { addressSchema, currentLocationSchema, mobileSchema, placeAddressSchema, type Address, type Profile, type SavedPlace } from "../schemas";
import { roundCoarse } from "@/lib/india";
import { delay } from "./delay";

// Mock mode only (NEXT_PUBLIC_ADAPTERS=mock, tests). In memory for the session; the real implementation is ../user-data.ts.
// The Rao family address is synthetic.
const RAO_ADDRESS: Address = {
  line1: "14, Lakeview Residency", line2: "3rd Cross, Indiranagar", landmark: "Near the metro station",
  city: "Bengaluru", state: "Karnataka", pincode: "560038", country: "IN",
};

let state: Profile = { mobile: null, address: null, addressSource: null, permissions: {}, currentLocation: null, places: [] };
let placeSeq = 0;

export const mockProfile: ProfileAdapter = {
  get: () => delay(structuredClone(state)),
  saveContact: async ({ mobile }) => {
    const parsed = mobileSchema.safeParse(mobile);
    if (!parsed.success) throw new AdapterError("INVALID_MOBILE");
    state = { ...state, mobile: parsed.data };
    return delay({ mobile: parsed.data });
  },
  saveAddress: async (address, source = "user_typed") => {
    const parsed = addressSchema.safeParse(address);
    if (!parsed.success) throw new AdapterError("INVALID_ADDRESS");
    state = { ...state, address: parsed.data, addressSource: source };
    return delay(parsed.data);
  },
  deleteAddress: async () => {
    state = { ...state, address: null, addressSource: null };
    return delay(undefined);
  },
  fetchAddressFromDigiLocker: () => delay({ ...RAO_ADDRESS }, 900),
  setPermission: async (permission, value) => {
    state = { ...state, permissions: { ...state.permissions, [permission]: value } };
    // Turning location off erases the saved current position at once.
    if (permission === "location" && (value === "denied" || value === "revoked")) state = { ...state, currentLocation: null };
    return delay(undefined);
  },
  saveCurrentLocation: async (input) => {
    const coarse = input.precision === "coarse";
    const loc = currentLocationSchema.parse({
      ...input,
      lat: coarse ? roundCoarse(input.lat) : input.lat,
      lng: coarse ? roundCoarse(input.lng) : input.lng,
    });
    state = { ...state, currentLocation: loc };
    return delay(loc);
  },
  clearCurrentLocation: async () => {
    state = { ...state, currentLocation: null };
    return delay(undefined);
  },
  savePlace: async (kind, label, address) => {
    const place: SavedPlace = { id: `place-${++placeSeq}`, kind, label: label.trim() || kind, address: placeAddressSchema.parse(address) };
    state = { ...state, places: [...state.places, place] };
    return delay(place);
  },
  deletePlace: async (id) => {
    state = { ...state, places: state.places.filter((p) => p.id !== id) };
    return delay(undefined);
  },
};

/** Test helper: back to an empty profile. */
export function resetMockProfile() {
  state = { mobile: null, address: null, addressSource: null, permissions: {}, currentLocation: null, places: [] };
  placeSeq = 0;
}
