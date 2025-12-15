// 勢力情報サブメニュー

import { Box, Text } from "ink";

interface Props {
  selectedIndex: number;
}

const STATUS_OPTIONS = ["勢力一覧", "地図表示"];

export function StatusMenu({ selectedIndex }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold underline>
        勢力情報
      </Text>
      {STATUS_OPTIONS.map((option, index) => (
        <Text
          key={option}
          color={index === selectedIndex ? "cyan" : "white"}
          bold={index === selectedIndex}
        >
          {index === selectedIndex ? "▶ " : "  "}
          {option}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>[Enter] 選択　[ESC] 戻る</Text>
      </Box>
    </Box>
  );
}
