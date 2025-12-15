// 外交メニューコンポーネント

import { Box, Text } from "ink";
import type { GameState } from "../../types.js";
import { getDiplomacyLabel } from "../utils.js";

interface MenuProps {
  selectedIndex: number;
}

export function DiplomacyMenu({ selectedIndex }: MenuProps) {
  const options = [
    { key: "1", label: "同盟申入", desc: "同盟を提案する" },
    { key: "2", label: "贈答", desc: "金品を贈る" },
    { key: "3", label: "威嚇", desc: "恫喝する" },
  ];

  return (
    <Box flexDirection="column">
      <Text bold underline>
        外交 - コマンドを選択
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

interface TargetScreenProps {
  state: GameState;
  playerClanId: string;
  selectedIndex: number;
  diplomacyTypeIndex: number;
}

export function DiplomacyTargetScreen({
  state,
  playerClanId,
  selectedIndex,
  diplomacyTypeIndex,
}: TargetScreenProps) {
  const otherClans = [...state.clanCatalog.values()].filter(
    (c) => c.id !== playerClanId
  );
  const typeLabels = ["同盟申入", "贈答", "威嚇"];
  const typeLabel = typeLabels[diplomacyTypeIndex] || "外交";

  return (
    <Box flexDirection="column">
      <Text bold underline>
        外交 - {typeLabel}する勢力を選択
      </Text>
      {otherClans.map((clan, i) => {
        const relation = state.diplomacyRelations.find(
          (r) =>
            (r.clan1Id === playerClanId && r.clan2Id === clan.id) ||
            (r.clan1Id === clan.id && r.clan2Id === playerClanId)
        );
        const label = `${clan.name} - 関係: ${getDiplomacyLabel(relation?.type)}`;
        return (
          <Box key={clan.id}>
            {i === selectedIndex ? (
              <Text color="cyan">▶ {label}</Text>
            ) : (
              <Text>{"  "}{label}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
