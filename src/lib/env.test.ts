import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getDataSource } from "./env";

const KEYS = [
  "NEXT_PUBLIC_DATA_SOURCE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NODE_ENV",
] as const;

const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  for (const key of KEYS) {
    if (previous[key] === undefined) delete process.env[key];
    else (process.env as Record<string, string | undefined>)[key] = previous[key];
  }
});

describe("data source", () => {
  it("does not fall back to the demo book when public Supabase values exist", () => {
    setNodeEnv("development");
    process.env.NEXT_PUBLIC_DATA_SOURCE = "demo";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ubipxntnfeohqcxwfyhs.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";
    assert.equal(getDataSource(), "supabase");
  });

  it("keeps production closed when the keys are missing", () => {
    setNodeEnv("production");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_DATA_SOURCE = "demo";
    assert.equal(getDataSource(), "unconfigured");
  });

  it("allows the local preview only when no public Supabase value is set", () => {
    setNodeEnv("development");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    assert.equal(getDataSource(), "demo");
  });
});
