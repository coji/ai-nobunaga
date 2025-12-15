// 勢力情報画面コンポーネント

import { Box, Text } from "ink";
import type { GameState } from "../../types.js";
import { getDiplomacyLabel, getLoyaltyColor } from "../utils.js";

interface Props {
  state: GameState;
  playerClanId: string;
}

export function StatusScreen({ state, playerClanId }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold underline>
        勢力情報
      </Text>
      {[...state.clanCatalog.values()].map((clan) => {
        const leader = state.bushoCatalog.get(clan.leaderId);
        const isPlayer = clan.id === playerClanId;
        const relation = state.diplomacyRelations.find(
          (r) =>
            (r.clan1Id === playerClanId && r.clan2Id === clan.id) ||
            (r.clan1Id === clan.id && r.clan2Id === playerClanId)
        );
        return (
          <Box key={clan.id} flexDirection="column" marginY={1}>
            <Text color={isPlayer ? "cyan" : "white"} bold>
              {clan.name} {isPlayer && "(あなた)"}
            </Text>
            <Text>
              当主: {leader?.name} | 金: {clan.gold} | 兵糧: {clan.food}
            </Text>
            {clan.castleIds.map((id) => {
              const castle = state.castleCatalog.get(id)!;
              const castellan = castle.castellanId
                ? state.bushoCatalog.get(castle.castellanId)
                : null;
              const loyaltyColor = getLoyaltyColor(castle.loyalty);
              const bushoLoyaltyColor = castellan
                ? getLoyaltyColor(castellan.emotions.loyalty)
                : "green";
              return (
                <Text key={id}>
                  　{castle.name}（
                  {castellan ? (
                    <Text color={bushoLoyaltyColor}>{castellan.name}</Text>
                  ) : (
                    "空席"
                  )}
                  ）: 兵{castle.soldiers} 農{castle.agriculture} 商
                  {castle.commerce} 防{castle.defense} 民忠
                  <Text color={loyaltyColor}>{castle.loyalty}</Text>
                </Text>
              );
            })}
            {!isPlayer && relation && (
              <Text dimColor>関係: {getDiplomacyLabel(relation.type)}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
