import { defineConfig } from 'vitest/config'

// Тесты проверяют чистую логику (формулы, разбор карточек, миграции), поэтому браузер не нужен.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
