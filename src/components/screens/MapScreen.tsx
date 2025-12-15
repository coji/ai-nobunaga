// 地図表示画面コンポーネント

import { Box, Text } from "ink";
import type { GameState } from "../../types.js";

interface Props {
  state: GameState;
  playerClanId: string;
}

// 勢力ごとの色を定義
const CLAN_COLORS: Record<string, string> = {
  oda: "yellow",
  imagawa: "cyan",
  saito: "magenta",
  takeda: "red",
  uesugi: "blue",
  hojo: "green",
  mori: "white",
  chosokabe: "yellowBright",
  shimazu: "redBright",
  otomo: "cyanBright",
  ryuzoji: "greenBright",
  azai: "blueBright",
  asakura: "magentaBright",
  honganji: "whiteBright",
  miyoshi: "gray",
};

// 城の略称マッピング
const CASTLE_ABBREV: Record<string, string> = {
  // 東北
  sannohe: "三戸",
  yonezawa: "米沢",
  yamagata: "山形",
  kurokawa: "黒川",
  // 関東
  utsunomiya: "宇都",
  minowa: "箕輪",
  kawagoe: "河越",
  edo: "江戸",
  odawara: "小田",
  // 甲信越
  kasugayama: "春日",
  toyama: "富山",
  matsumoto: "深志",
  kaizu: "海津",
  kofu: "躑躅",
  // 東海
  sunpu: "駿府",
  hamamatsu: "浜松",
  yoshida_mikawa: "吉田",
  okazaki: "岡崎",
  nagoya: "那古",
  kiyosu: "清洲",
  inabayama: "稲葉",
  ogaki: "大垣",
  ise: "長島",
  // 北陸
  kanazawa: "尾山",
  ichijodani: "一乗",
  // 近畿
  odani: "小谷",
  kannonji: "観音",
  nijo: "御所",
  ishiyama: "石山",
  sakai: "堺　",
  saika: "雑賀",
  himeji: "姫路",
  // 中国
  okayama: "天神",
  tottori: "鳥取",
  gassan_toda: "月山",
  hiroshima: "郡山",
  // 四国
  sogawa: "十河",
  tokushima: "徳島",
  matsuyama: "湯築",
  uwajima: "黒瀬",
  kochi: "岡豊",
  // 九州
  kokura: "小倉",
  funai: "府内",
  usuki: "臼杵",
  saga: "佐嘉",
  hirado: "平戸",
  hitoyoshi: "人吉",
  kagoshima: "内城",
  obi: "飫肥",
};

// 城を地図上の位置に配置
// 位置: [row, col] (0-indexed)
const CASTLE_POSITIONS: Record<string, [number, number]> = {
  // 東北 (row 0-3)
  sannohe: [0, 38],
  yamagata: [2, 34],
  yonezawa: [3, 32],
  kurokawa: [3, 36],
  // 関東 (row 4-7)
  kasugayama: [4, 28],
  minowa: [5, 32],
  utsunomiya: [5, 36],
  toyama: [5, 22],
  kawagoe: [6, 34],
  edo: [7, 36],
  odawara: [8, 34],
  // 甲信越 (row 5-8)
  matsumoto: [6, 28],
  kaizu: [6, 30],
  kofu: [8, 30],
  // 東海 (row 8-10)
  sunpu: [9, 32],
  hamamatsu: [10, 28],
  yoshida_mikawa: [10, 26],
  okazaki: [10, 24],
  nagoya: [10, 22],
  kiyosu: [10, 20],
  inabayama: [9, 18],
  ogaki: [9, 16],
  ise: [11, 18],
  // 北陸 (row 5-7)
  kanazawa: [6, 20],
  ichijodani: [7, 18],
  // 近畿 (row 8-12)
  odani: [8, 16],
  kannonji: [9, 14],
  nijo: [10, 12],
  ishiyama: [11, 10],
  sakai: [12, 10],
  saika: [13, 10],
  himeji: [11, 6],
  // 中国 (row 10-13)
  okayama: [11, 4],
  tottori: [10, 2],
  gassan_toda: [9, 0],
  hiroshima: [12, 2],
  // 四国 (row 13-15)
  sogawa: [13, 6],
  tokushima: [14, 8],
  matsuyama: [14, 4],
  uwajima: [15, 2],
  kochi: [16, 6],
  // 九州 (row 15-19)
  kokura: [15, 0],
  funai: [16, 0],
  usuki: [17, 2],
  saga: [17, -2],
  hirado: [16, -4],
  hitoyoshi: [18, 0],
  kagoshima: [19, -2],
  obi: [18, 4],
};

export function MapScreen({ state, playerClanId }: Props) {
  // 地図の行数と列数
  const MAP_HEIGHT = 21;
  const MAP_WIDTH = 44;

  // 空の地図を作成
  const map: { char: string; color: string }[][] = Array.from(
    { length: MAP_HEIGHT },
    () =>
      Array.from({ length: MAP_WIDTH }, () => ({
        char: "　",
        color: "gray",
      }))
  );

  // 城を地図に配置
  for (const castle of state.castleCatalog.values()) {
    const pos = CASTLE_POSITIONS[castle.id];
    if (!pos) continue;

    const [row, col] = pos;
    // 列を調整（負の値や範囲外を処理）
    const adjustedCol = Math.max(0, Math.min(MAP_WIDTH - 2, col));
    if (row < 0 || row >= MAP_HEIGHT) continue;

    const abbrev = CASTLE_ABBREV[castle.id] || castle.name.slice(0, 2);
    const color =
      castle.ownerId === playerClanId
        ? "cyan"
        : (CLAN_COLORS[castle.ownerId] ?? "white");

    // 2文字分の城名を配置
    if (adjustedCol < MAP_WIDTH) {
      map[row]![adjustedCol] = { char: abbrev[0] || "　", color };
    }
    if (adjustedCol + 1 < MAP_WIDTH) {
      map[row]![adjustedCol + 1] = { char: abbrev[1] || "　", color };
    }
  }

  // 勢力の凡例を作成
  const clans = [...state.clanCatalog.values()];
  const legend = clans.map((clan) => ({
    name: clan.name,
    color:
      clan.id === playerClanId
        ? "cyan"
        : (CLAN_COLORS[clan.id] ?? "white"),
    castleCount: clan.castleIds.length,
  }));

  return (
    <Box flexDirection="column">
      <Text bold underline>
        勢力地図
      </Text>
      <Box marginTop={1}>
        <Box flexDirection="column">
          {/* 地図本体 */}
          {map.map((row, rowIndex) => (
            <Box key={rowIndex}>
              {row.map((cell, colIndex) => (
                <Text key={colIndex} color={cell.color}>
                  {cell.char}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
        {/* 凡例 */}
        <Box flexDirection="column" marginLeft={2}>
          <Text bold>【凡例】</Text>
          {legend.slice(0, 16).map((item) => (
            <Text key={item.name} color={item.color}>
              {item.name}({item.castleCount}城)
            </Text>
          ))}
          {legend.length > 16 && (
            <Text dimColor>...他{legend.length - 16}勢力</Text>
          )}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          ※ 城名の色が勢力を表します。自勢力は水色で表示。
        </Text>
      </Box>
    </Box>
  );
}
