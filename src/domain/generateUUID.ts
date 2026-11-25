import type { UUID } from "./type";

export const generateUUID = (): UUID => {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("crypto.randomUUID() is required to create record IDs.");
  }

  return globalThis.crypto.randomUUID();
};
