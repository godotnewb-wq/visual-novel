import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const directory = resolve(process.env['BREEDHAVEN_USER_DATA_DIR'] ?? '.dev-data/user-data')
const child = spawn(process.execPath, [resolve('node_modules/electron-vite/bin/electron-vite.js'), 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, BREEDHAVEN_USER_DATA_DIR: directory, BREEDHAVEN_ADDONS: '1' }
})
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', (code) => process.exit(code ?? 1))
