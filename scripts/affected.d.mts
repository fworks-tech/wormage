// Types for the plain-ESM selector; the runtime lives in affected.mjs.
export interface TestSelection {
  full: boolean;
  unit: string[];
  e2e: string[];
  reason: string;
}

export function listTests(root?: string): { specs: string[]; units: string[] };
export function selectTests(input: { changed: string[]; labels?: string[] }): TestSelection;
