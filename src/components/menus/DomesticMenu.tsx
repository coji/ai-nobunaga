// 内政メニューコンポーネント

import { Box, Text } from "ink";
import type { GameState } from "../../types.js";
import type { DomesticType } from "../types.js";
import { getLoyaltyColor } from "../utils.js";

interface MenuProps {
  selectedIndex: number;
}

export function DomesticMenu({ selectedIndex }: MenuProps) {
  const options = [
    { key: "1", label: "農業開発", desc: "兵糧生産を増加（500金）" },
    { key: "2", label: "商業開発", desc: "金収入を増加（500金）" },
  ];

  return (
    <Box flexDirection="column">
      <Text bold underline>
        内政 - コマンドを選択
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
  domesticType: DomesticType;
}

export function DomesticCastleScreen({
  state,
  playerClanId,
  selectedIndex,
  domesticType,
}: CastleScreenProps) {
  const clan = state.clanCatalog.get(playerClanId)!;
  const castles = clan.castleIds.map((id) => state.castleCatalog.get(id)!);
  const typeLabel =
    domesticType === "develop_agriculture" ? "農業開発" : "商業開発";

  return (
    <Box flexDirection="column">
      <Text bold underline>
        内政 - {typeLabel}する城を選択
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
