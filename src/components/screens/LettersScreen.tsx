// 書状画面コンポーネント

import { Box, Text } from "ink";
import type { GameState, Letter } from "../../types.js";

interface Props {
  state: GameState;
  currentLetter: Letter | null;
}

export function LettersScreen({ state, currentLetter }: Props) {
  const letters = state.letters.slice(-5);

  return (
    <Box flexDirection="column">
      <Text bold underline>
        書状
      </Text>
      {currentLetter ? (
        <Box
          flexDirection="column"
          marginY={1}
          borderStyle="single"
          paddingX={1}
        >
          <Text dimColor>
            {state.clanCatalog.get(currentLetter.fromClanId)?.name} →{" "}
            {state.clanCatalog.get(currentLetter.toClanId)?.name}
          </Text>
          <Text>{currentLetter.greeting}</Text>
          <Text>{currentLetter.body}</Text>
          <Text>{currentLetter.closing}</Text>
          <Box marginTop={1}>
            <Text color="yellow">要約: {currentLetter.summary}</Text>
          </Box>
        </Box>
      ) : letters.length === 0 ? (
        <Text dimColor>書状はありません</Text>
      ) : (
        letters.map((letter) => (
          <Box key={letter.id} marginY={1}>
            <Text>
              ターン{letter.turn}:{" "}
              {state.clanCatalog.get(letter.fromClanId)?.name} →{" "}
              {state.clanCatalog.get(letter.toClanId)?.name} - {letter.summary}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
}
