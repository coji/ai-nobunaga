#!/usr/bin/env npx tsx
// データ整合性チェックスクリプト
// 使い方: npx tsx scripts/check-data-integrity.ts
import { bushoList } from '../src/data/busho.js'
import { castleList } from '../src/data/castles.js'
import { clanList } from '../src/data/clans.js'
import { diplomacyRelations, factionList } from '../src/data/diplomacy.js'
let hasError = false
function error(msg) {
  console.error(`  ❌ ${msg}`)
  hasError = true
}
function warn(msg) {
  console.warn(`  ⚠️  ${msg}`)
}
function ok(msg) {
  console.log(`  ✅ ${msg}`)
}
// IDセットを作成
const bushoIds = new Set(bushoList.map((b) => b.id))
const castleIds = new Set(castleList.map((c) => c.id))
const clanIds = new Set(clanList.map((c) => c.id))
const factionIds = new Set(factionList.map((f) => f.id))
console.log('=== データ整合性チェック ===\n')
// 1. 武将データチェック
console.log('【武将データ】')
console.log(`  総数: ${bushoList.length}名`)
for (const busho of bushoList) {
  // clanIdの存在確認
  if (!clanIds.has(busho.clanId)) {
    error(
      `武将 ${busho.name}(${busho.id}) の所属勢力 "${busho.clanId}" が存在しない`,
    )
  }
  // factionIdの存在確認
  if (busho.factionId && !factionIds.has(busho.factionId)) {
    error(
      `武将 ${busho.name}(${busho.id}) の派閥 "${busho.factionId}" が存在しない`,
    )
  }
}
// 2. 城データチェック
console.log('\n【城データ】')
console.log(`  総数: ${castleList.length}城`)
for (const castle of castleList) {
  // ownerIdの存在確認
  if (!clanIds.has(castle.ownerId)) {
    error(
      `城 ${castle.name}(${castle.id}) の所有者 "${castle.ownerId}" が存在しない`,
    )
  }
  // castellanIdの存在確認
  if (castle.castellanId && !bushoIds.has(castle.castellanId)) {
    error(
      `城 ${castle.name}(${castle.id}) の城主 "${castle.castellanId}" が存在しない`,
    )
  }
  // 隣接城の存在確認
  for (const adjId of castle.adjacentCastleIds) {
    if (!castleIds.has(adjId)) {
      error(`城 ${castle.name}(${castle.id}) の隣接城 "${adjId}" が存在しない`)
    }
  }
}
// 隣接関係の双方向チェック
console.log('\n【隣接関係の双方向チェック】')
let adjacencyErrors = 0
for (const castle of castleList) {
  for (const adjId of castle.adjacentCastleIds) {
    const adjCastle = castleList.find((c) => c.id === adjId)
    if (adjCastle && !adjCastle.adjacentCastleIds.includes(castle.id)) {
      warn(`${castle.name} → ${adjCastle.name} は片方向のみ（逆方向がない）`)
      adjacencyErrors++
    }
  }
}
if (adjacencyErrors === 0) {
  ok('全ての隣接関係が双方向')
}
// 3. 勢力データチェック
console.log('\n【勢力データ】')
console.log(`  総数: ${clanList.length}家`)
for (const clan of clanList) {
  // leaderIdの存在確認
  if (!bushoIds.has(clan.leaderId)) {
    error(
      `勢力 ${clan.name}(${clan.id}) の当主 "${clan.leaderId}" が存在しない`,
    )
  }
  // castleIdsの存在確認
  for (const castleId of clan.castleIds) {
    if (!castleIds.has(castleId)) {
      error(`勢力 ${clan.name}(${clan.id}) の城 "${castleId}" が存在しない`)
    }
  }
}
// 勢力の城と城データの所有者の整合性
console.log('\n【勢力-城の所有関係チェック】')
let ownershipErrors = 0
for (const clan of clanList) {
  for (const castleId of clan.castleIds) {
    const castle = castleList.find((c) => c.id === castleId)
    if (castle && castle.ownerId !== clan.id) {
      error(
        `${clan.name} は ${castle.name} を所有しているが、城の ownerId は "${castle.ownerId}"`,
      )
      ownershipErrors++
    }
  }
}
// 城の所有者が勢力のcastleIdsに含まれているか
for (const castle of castleList) {
  const clan = clanList.find((c) => c.id === castle.ownerId)
  if (clan && !clan.castleIds.includes(castle.id)) {
    error(
      `${castle.name} の所有者は ${clan.name} だが、勢力の castleIds に含まれていない`,
    )
    ownershipErrors++
  }
}
if (ownershipErrors === 0) {
  ok('全ての勢力-城の所有関係が一致')
}
// 4. 派閥データチェック
console.log('\n【派閥データ】')
console.log(`  総数: ${factionList.length}派閥`)
for (const faction of factionList) {
  // clanIdの存在確認
  if (!clanIds.has(faction.clanId)) {
    error(
      `派閥 ${faction.name}(${faction.id}) の所属勢力 "${faction.clanId}" が存在しない`,
    )
  }
  // memberIdsの存在確認
  for (const memberId of faction.memberIds) {
    if (!bushoIds.has(memberId)) {
      error(
        `派閥 ${faction.name}(${faction.id}) のメンバー "${memberId}" が存在しない`,
      )
    }
  }
}
// 5. 外交関係チェック
console.log('\n【外交関係データ】')
console.log(`  総数: ${diplomacyRelations.length}件`)
for (const rel of diplomacyRelations) {
  if (!clanIds.has(rel.clan1Id)) {
    error(`外交関係の clan1Id "${rel.clan1Id}" が存在しない`)
  }
  if (!clanIds.has(rel.clan2Id)) {
    error(`外交関係の clan2Id "${rel.clan2Id}" が存在しない`)
  }
}
// 6. 当主が所属勢力と一致しているか
console.log('\n【当主の所属チェック】')
let leaderErrors = 0
for (const clan of clanList) {
  const leader = bushoList.find((b) => b.id === clan.leaderId)
  if (leader && leader.clanId !== clan.id) {
    error(
      `${clan.name} の当主 ${leader.name} の所属が "${leader.clanId}" になっている`,
    )
    leaderErrors++
  }
}
if (leaderErrors === 0) {
  ok('全ての当主が正しい勢力に所属')
}
// 7. 城主が城の所有者に所属しているか
console.log('\n【城主の所属チェック】')
let castellanErrors = 0
for (const castle of castleList) {
  if (castle.castellanId) {
    const castellan = bushoList.find((b) => b.id === castle.castellanId)
    if (castellan && castellan.clanId !== castle.ownerId) {
      warn(
        `${castle.name} の城主 ${castellan.name} の所属(${castellan.clanId})が城の所有者(${castle.ownerId})と異なる`,
      )
      castellanErrors++
    }
  }
}
if (castellanErrors === 0) {
  ok('全ての城主が城の所有者に所属')
}
// サマリー
console.log('\n=== サマリー ===')
console.log(`武将: ${bushoList.length}名`)
console.log(`城: ${castleList.length}城`)
console.log(`勢力: ${clanList.length}家`)
console.log(`派閥: ${factionList.length}派閥`)
console.log(`外交関係: ${diplomacyRelations.length}件`)
if (hasError) {
  console.log('\n❌ エラーがあります。修正してください。')
  process.exit(1)
} else {
  console.log('\n✅ 全てのチェックに合格しました！')
  process.exit(0)
}
//# sourceMappingURL=check-data-integrity.js.map
