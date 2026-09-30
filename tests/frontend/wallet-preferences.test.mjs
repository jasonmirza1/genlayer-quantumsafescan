import assert from "node:assert/strict";
import { test } from "node:test";
import { readWalletPreference, writeWalletPreference } from "../../frontend/lib/genlayer/wallet-preferences.ts";

const inaccessible = () => { throw new Error("Browser storage blocked"); };
test("blocked storage cannot break wallet initialization or provider selection", () => {
  assert.equal(readWalletPreference("active_wallet_provider", null, inaccessible), null);
  assert.equal(readWalletPreference("wallet_disconnected", "true", inaccessible), "true");
  assert.equal(writeWalletPreference("active_wallet_provider", "okx", inaccessible), false);
  assert.equal(writeWalletPreference("wallet_disconnected", null, inaccessible), false);
});
test("an absent disconnect preference is not an intentional disconnect", () => {
  assert.equal(readWalletPreference("wallet_disconnected", "true", () => ({ getItem: () => null })), null);
});
test("normal preferences still persist, read and clear", () => {
  const values = new Map();
  const access = () => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  assert.equal(writeWalletPreference("wallet_disconnected", "true", access), true);
  assert.equal(readWalletPreference("wallet_disconnected", null, access), "true");
  assert.equal(writeWalletPreference("wallet_disconnected", null, access), true);
  assert.equal(readWalletPreference("wallet_disconnected", "true", access), null);
});
test("storage method failures and unavailable storage are contained", () => {
  const access = () => ({ getItem: inaccessible, setItem: inaccessible, removeItem: inaccessible });
  assert.equal(readWalletPreference("provider", "fallback", access), "fallback");
  assert.equal(writeWalletPreference("provider", "okx", access), false);
  assert.equal(writeWalletPreference("provider", null, access), false);
  assert.equal(writeWalletPreference("provider", "okx", () => null), false);
});
