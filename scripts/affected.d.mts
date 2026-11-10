// Types for the plain-ESM selector; the runtime lives in affected.mjs.
export interface TestSelection {
  full: boolean;
  unit: string[];
  e2e: string[];
  reason: string;
}

export function listTests(): { specs: string[]; units: string[] };
export function selectTests(input: { changed: string[]; labels?: string[] }): TestSelection;
