import type { DataProfile } from "./types";

export function resolveDataProfile(value = process.env.NEXT_PUBLIC_DATA_PROFILE): DataProfile {
  return value === "api" ? "api" : "mock";
}
