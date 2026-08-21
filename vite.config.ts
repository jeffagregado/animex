import { configDefaults, defineConfig } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
  test: {
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
    setupFiles: ['./src/test/setup-env.ts'],
    testTimeout: 10_000,
  },
})

export default config
