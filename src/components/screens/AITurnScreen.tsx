// AI行動画面コンポーネント

import { Box, Text } from "ink";
import type { AITurnResult } from "../../ai.js";

interface Props {
  aiResults: { clanName: string; result: AITurnResult }[];
}

export function AITurnScreen({ aiResults }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold underline>
        AI勢力の行動
      </Text>
      {aiResults.map(({ clanName, result }, i) => (
        <Box key={i} flexDirection="column" marginY={1}>
          <Text bold color="cyan">
            {clanName}
          </Text>
          {result.actions.map((action, j) => (
            <Box key={j}>
              <Text color={action.success ? "green" : "red"}>
                {action.success ? "✓" : "✗"} [{action.tool}] {action.narrative}
              </Text>
            </Box>
          ))}
          <Text dimColor>→ {result.summary}</Text>
        </Box>
      ))}
    </Box>
  );
}
