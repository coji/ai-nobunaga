#!/usr/bin/env node
import 'dotenv/config'
import { render } from 'ink'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { GameUI } from './components/GameUI.js'
import { createInitialGameState } from './data/scenario.js'

const CONFIG_PATH = path.join(os.homedir(), '.nobunaga')

// 設定ファイルからAPIキーを読み込む
function loadApiKey(): string | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8')
      const match = content.match(/GEMINI_API_KEY=(.+)/)
      return match?.[1]?.trim() || null
    }
  } catch {
    // 読み込み失敗時は無視
  }
  return null
}

// APIキーを設定ファイルに保存
function saveApiKey(apiKey: string): void {
  fs.writeFileSync(CONFIG_PATH, `GEMINI_API_KEY=${apiKey}\n`, { mode: 0o600 })
}

// ユーザーにAPIキーを入力させる
async function promptApiKey(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    console.log('\n╔════════════════════════════════════════════════╗')
    console.log('║  npx 信長 - 初期設定                            ║')
    console.log('╚════════════════════════════════════════════════╝\n')
    console.log('Gemini APIキーが必要です。')
    console.log('取得先: https://aistudio.google.com/apikey\n')

    rl.question('APIキーを入力: ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  // 1. 環境変数をチェック
  let apiKey = process.env.GEMINI_API_KEY

  // 2. 設定ファイルをチェック
  if (!apiKey) {
    apiKey = loadApiKey() ?? undefined
    if (apiKey) {
      process.env.GEMINI_API_KEY = apiKey
    }
  }

  // 3. どちらもなければ入力を求める
  if (!apiKey) {
    apiKey = await promptApiKey()
    if (!apiKey) {
      console.log('APIキーが入力されませんでした。終了します。')
      process.exit(1)
    }
    saveApiKey(apiKey)
    process.env.GEMINI_API_KEY = apiKey
    console.log(`\n設定を保存しました: ${CONFIG_PATH}\n`)
  }

  // プレイヤーは織田家でスタート
  const initialState = createInitialGameState('oda')

  console.clear()
  console.log('npx 信長 を起動中...\n')

  render(<GameUI initialState={initialState} />)
}

main()
