import type { AchievementId, AchievementLeaderboardRow } from "../shared/types";

export interface RawParticipantAchievementRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  achievementId: AchievementId | null;
}

interface GroupedAchievementRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  achievementIds: AchievementId[];
}

export function rankAchievementRows(
  rows: RawParticipantAchievementRow[],
  poolRanks: Map<string, number>
): AchievementLeaderboardRow[] {
  const groupedRows = new Map<string, GroupedAchievementRow>();

  for (const row of rows) {
    const grouped = groupedRows.get(row.userId) ?? {
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      achievementIds: []
    };

    if (row.achievementId !== null && !grouped.achievementIds.includes(row.achievementId)) {
      grouped.achievementIds.push(row.achievementId);
    }

    groupedRows.set(row.userId, grouped);
  }

  const rankedRows = [...groupedRows.values()]
    .map((row) => ({ ...row, achievementCount: row.achievementIds.length }))
    .sort(
      (left, right) =>
        right.achievementCount - left.achievementCount ||
        (poolRanks.get(left.userId) ?? Number.MAX_SAFE_INTEGER) - (poolRanks.get(right.userId) ?? Number.MAX_SAFE_INTEGER) ||
        left.displayName.localeCompare(right.displayName, "es")
    );

  let previousCount: number | undefined;
  let rank = 0;

  return rankedRows.map((row, index) => {
    if (row.achievementCount !== previousCount) {
      rank = index + 1;
      previousCount = row.achievementCount;
    }

    return { ...row, rank };
  });
}
