// メインメニューコンポーネント

import { Box, Text } from "ink";

interface Props {
  selectedIndex: number;
}

export function MainMenu({ selectedIndex }: Props) {
  const options = [
    { key: "1", label: "勢力情報", desc: "自勢力と他勢力の状況を確認" },
    { key: "2", label: "内政", desc: "農業・商業開発" },
    { key: "3", label: "軍事", desc: "徴兵・城修築・攻撃" },
    { key: "4", label: "外交", desc: "同盟・贈答・威嚇" },
    { key: "5", label: "書状", desc: "受け取った書状を確認" },
    { key: "6", label: "ターン終了", desc: "AI勢力が行動します" },
  ];

  return (
    <Box flexDirection="column">
      <Text bold underline>
        コマンド
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
