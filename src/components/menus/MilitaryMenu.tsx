// 軍事メニューコンポーネント

import { Box, Text } from "ink";
import type { GameState } from "../../types.js";
import type { MilitaryType } from "../types.js";
import { getLoyaltyColor } from "../utils.js";

interface MenuProps {
  selectedIndex: number;
}

export function MilitaryMenu({ selectedIndex }: MenuProps) {
  const options = [
    { key: "1", label: "徴兵", desc: "兵を増やす（500人/兵糧1500）" },
    { key: "2", label: "城修築", desc: "防御力を上げる（750金）" },
    { key: "3", label: "攻撃", desc: "隣接する敵城を攻める" },
  ];

  return (
    <Box flexDirection="column">
      <Text bold underline>
        軍事 - コマンドを選択
      </Text>
      {options.map((opt, i) => (
        <Box key={opt.key}>
          {i === selectedIndex ? (
            <Text color="cyan">
              ▶ [{opt.key}] {opt.label}
            </Text>
          ) : (
            <Text>
              {"  "}[{opt.key}] {opt.label}
            </Text>
          )}
          <Text dimColor> - {opt.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

interface CastleScreenProps {
  state: GameState;
  playerClanId: string;
  selectedIndex: number;
  militaryType: MilitaryType;
}

export function MilitaryCastleScreen({
  state,
  playerClanId,
  selectedIndex,
  militaryType,
}: CastleScreenProps) {
  const clan = state.clanCatalog.get(playerClanId)!;
  const castles = clan.castleIds.map((id) => state.castleCatalog.get(id)!);
  const typeLabel = militaryType === "recruit_soldiers" ? "徴兵" : "城修築";

  return (
    <Box flexDirection="column">
      <Text bold underline>
        軍事 - {typeLabel}する城を選択
      </Text>
      {castles.map((castle, i) => {
        const loyaltyColor = getLoyaltyColor(castle.loyalty);
        return (
          <Box key={castle.id}>
            {i === selectedIndex ? (
              <Text color="cyan">
                ▶ {castle.name}: 兵{castle.soldiers} 農業{castle.agriculture} 商業
                {castle.commerce} 防御{castle.defense} 民忠
                <Text color={loyaltyColor}>{castle.loyalty}</Text>
              </Text>
            ) : (
              <Text>
                {"  "}
                {castle.name}: 兵{castle.soldiers} 農業{castle.agriculture} 商業
                {castle.commerce} 防御{castle.defense} 民忠
                <Text color={loyaltyColor}>{castle.loyalty}</Text>
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

interface AttackScreenProps {
  state: GameState;
  playerClanId: string;
  selectedIndex: number;
}

export function MilitaryAttackScreen({
  state,
  playerClanId,
  selectedIndex,
}: AttackScreenProps) {
  const clan = state.clanCatalog.get(playerClanId)!;
  const attackTargets: {
    from: string;
    to: string;
    fromName: string;
    toName: string;
    fromSoldiers: number;
    toSoldiers: number;
  }[] = [];

  for (const castleId of clan.castleIds) {
    const castle = state.castleCatalog.get(castleId)!;
    for (const adjId of castle.adjacentCastleIds) {
      const adjCastle = state.castleCatalog.get(adjId)!;
      if (adjCastle.ownerId !== playerClanId) {
        attackTargets.push({
          from: castleId,
          to: adjId,
          fromName: castle.name,
          toName: adjCastle.name,
          fromSoldiers: castle.soldiers,
          toSoldiers: adjCastle.soldiers,
        });
      }
    }
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>
        軍事 - 攻撃対象を選択
      </Text>
      {attackTargets.length === 0 ? (
        <Text dimColor>攻撃可能な城がありません</Text>
      ) : (
        attackTargets.map((target, i) => {
          const owner = state.castleCatalog.get(target.to)?.ownerId;
          const ownerName = owner ? state.clanCatalog.get(owner)?.name : "不明";
          const label = `${target.fromName}(兵${target.fromSoldiers}) → ${target.toName}(${ownerName}, 兵${target.toSoldiers})`;
          return (
            <Box key={`${target.from}-${target.to}`}>
              {i === selectedIndex ? (
                <Text color="cyan">▶ {label}</Text>
              ) : (
                <Text>{"  "}{label}</Text>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
}
