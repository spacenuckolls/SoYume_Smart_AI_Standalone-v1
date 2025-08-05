/**
 * Central export for all shared types
 */

export * from './AI';
export * from './Story';
export * from './Common';

// Re-export common Node.js types that might be missing
export interface NodeError extends Error {
  code?: string;
  errno?: number;
  path?: string;
  syscall?: string;
}

// Common utility types
export type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
export type NonNullable<T> = T extends null | undefined ? never : T;
export type Partial<T> = { [P in keyof T]?: T[P] };
export type Required<T> = { [P in keyof T]-?: T[P] };
export type Readonly<T> = { readonly [P in keyof T]: T[P] };

// Event handler types
export type EventHandler<T = any> = (event: T) => void;
export type AsyncEventHandler<T = any> = (event: T) => Promise<void>;

// Generic response wrapper
export interface Response<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Configuration types
export interface BaseConfig {
  [key: string]: any;
}

// Plugin types
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}

// Test types
export interface TestCase {
  name: string;
  execute: () => Promise<void> | void;
  timeout?: number;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
}