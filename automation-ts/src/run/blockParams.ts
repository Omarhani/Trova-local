import { test } from '@playwright/test';
import { fresh } from './runStamp';

/** what a suite block gives its tests: the <parameter> values (with {run} filled) and the login it runs as */
export interface BlockMeta {
  params?: Record<string, string>;
  groups?: string[];
}

/** a parameter of the running test's block (the suite's <parameter>), else the test's own default - like @Optional */
export function param(name: string, fallback: string): string {
  const meta = test.info().project.metadata as BlockMeta | undefined;
  const value = meta?.params?.[name];
  return fresh(value === undefined || value.startsWith('${') ? fallback : value);
}
