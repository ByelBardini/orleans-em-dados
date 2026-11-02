import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['db', 'collectors', 'backend', 'frontend'],
    passWithNoTests: true,
  },
});
