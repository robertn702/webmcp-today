import { browser } from "wxt/browser";
import type { StorageArea } from "./store-schema.js";

// The only module that touches browser.storage.local. Everything else takes a
// StorageArea (store-schema.ts) so tests never import wxt/browser.

export const localStorageArea: StorageArea = {
  get: (keys = null) => browser.storage.local.get(keys),
  set: (items) => browser.storage.local.set(items),
  remove: (keys) => browser.storage.local.remove(keys),
};
