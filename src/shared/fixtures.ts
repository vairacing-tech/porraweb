import { getLockAt } from "../domain/scoring";
import type { MatchStage } from "./types";

type RawMatch = readonly [
  id: string,
  round: string,
  matchday: number,
  groupName: string,
  homeTeam: string,
  awayTeam: string,
  kickoffAt: string
];

export const groupLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

export type GroupLetter = (typeof groupLetters)[number];

export type KnockoutSlot =
  | { kind: "group"; group: GroupLetter; rank: 1 | 2 }
  | { kind: "third"; candidates: string }
  | { kind: "winner"; matchNumber: number }
  | { kind: "loser"; matchNumber: number };

type RawKnockoutMatch = readonly [
  matchNumber: number,
  stage: MatchStage,
  round: string,
  homeSlot: KnockoutSlot,
  awaySlot: KnockoutSlot,
  kickoffAt: string
];

export const leagueSeed = {
  id: "fortilin",
  name: "Fortilin",
  slug: "fortilin"
} as const;

export const teamCodes: Record<string, string> = {
  "Alemania": "GER",
  "Arabia Saudi": "KSA",
  "Arabia Saudí": "KSA",
  "Argelia": "ALG",
  "Argentina": "ARG",
  "Australia": "AUS",
  "Austria": "AUT",
  "Belgica": "BEL",
  "Bélgica": "BEL",
  "Bosnia y Herzegovina": "BIH",
  "Brasil": "BRA",
  "Cabo Verde": "CPV",
  "Canada": "CAN",
  "Canadá": "CAN",
  "Catar": "QAT",
  "Colombia": "COL",
  "Corea del Sur": "KOR",
  "Costa de Marfil": "CIV",
  "Croacia": "CRO",
  "Curazao": "CUW",
  "Ecuador": "ECU",
  "Egipto": "EGY",
  "Escocia": "SCO",
  "Espana": "ESP",
  "España": "ESP",
  "Estados Unidos": "USA",
  "Francia": "FRA",
  "Ghana": "GHA",
  "Haiti": "HAI",
  "Haití": "HAI",
  "Inglaterra": "ENG",
  "Irak": "IRQ",
  "Iran": "IRN",
  "Irán": "IRN",
  "Japon": "JPN",
  "Japón": "JPN",
  "Jordania": "JOR",
  "Marruecos": "MAR",
  "Mexico": "MEX",
  "México": "MEX",
  "Noruega": "NOR",
  "Nueva Zelanda": "NZL",
  "Paises Bajos": "NED",
  "Países Bajos": "NED",
  "Panama": "PAN",
  "Panamá": "PAN",
  "Paraguay": "PAR",
  "Portugal": "POR",
  "RD Congo": "COD",
  "Republica Checa": "CZE",
  "República Checa": "CZE",
  "Senegal": "SEN",
  "Sudafrica": "RSA",
  "Sudáfrica": "RSA",
  "Suecia": "SWE",
  "Suiza": "SUI",
  "Tunez": "TUN",
  "Túnez": "TUN",
  "Turquia": "TUR",
  "Turquía": "TUR",
  "Uruguay": "URU",
  "Uzbekistan": "UZB",
  "Uzbekistán": "UZB"
};

export const rawGroupMatches: RawMatch[] = [
  ["grp-01-001", "J1 fase de grupos", 1, "A", "México", "Sudáfrica", "2026-06-11T19:00:00Z"],
  ["grp-01-002", "J1 fase de grupos", 1, "A", "Corea del Sur", "República Checa", "2026-06-12T02:00:00Z"],
  ["grp-01-003", "J1 fase de grupos", 1, "B", "Canadá", "Bosnia y Herzegovina", "2026-06-12T19:00:00Z"],
  ["grp-01-004", "J1 fase de grupos", 1, "D", "Estados Unidos", "Paraguay", "2026-06-13T01:00:00Z"],
  ["grp-01-005", "J1 fase de grupos", 1, "B", "Catar", "Suiza", "2026-06-13T19:00:00Z"],
  ["grp-01-006", "J1 fase de grupos", 1, "C", "Brasil", "Marruecos", "2026-06-13T22:00:00Z"],
  ["grp-01-007", "J1 fase de grupos", 1, "C", "Haití", "Escocia", "2026-06-14T01:00:00Z"],
  ["grp-01-008", "J1 fase de grupos", 1, "D", "Australia", "Turquía", "2026-06-14T04:00:00Z"],
  ["grp-01-009", "J1 fase de grupos", 1, "E", "Alemania", "Curazao", "2026-06-14T17:00:00Z"],
  ["grp-01-010", "J1 fase de grupos", 1, "F", "Países Bajos", "Japón", "2026-06-14T20:00:00Z"],
  ["grp-01-011", "J1 fase de grupos", 1, "E", "Costa de Marfil", "Ecuador", "2026-06-14T23:00:00Z"],
  ["grp-01-012", "J1 fase de grupos", 1, "F", "Suecia", "Túnez", "2026-06-15T02:00:00Z"],
  ["grp-01-013", "J1 fase de grupos", 1, "H", "España", "Cabo Verde", "2026-06-15T16:00:00Z"],
  ["grp-01-014", "J1 fase de grupos", 1, "G", "Bélgica", "Egipto", "2026-06-15T19:00:00Z"],
  ["grp-01-015", "J1 fase de grupos", 1, "H", "Arabia Saudí", "Uruguay", "2026-06-15T22:00:00Z"],
  ["grp-01-016", "J1 fase de grupos", 1, "G", "Irán", "Nueva Zelanda", "2026-06-16T01:00:00Z"],
  ["grp-01-017", "J1 fase de grupos", 1, "I", "Francia", "Senegal", "2026-06-16T19:00:00Z"],
  ["grp-01-018", "J1 fase de grupos", 1, "I", "Irak", "Noruega", "2026-06-16T22:00:00Z"],
  ["grp-01-019", "J1 fase de grupos", 1, "J", "Argentina", "Argelia", "2026-06-17T01:00:00Z"],
  ["grp-01-020", "J1 fase de grupos", 1, "J", "Austria", "Jordania", "2026-06-17T04:00:00Z"],
  ["grp-01-021", "J1 fase de grupos", 1, "K", "Portugal", "RD Congo", "2026-06-17T17:00:00Z"],
  ["grp-01-022", "J1 fase de grupos", 1, "L", "Inglaterra", "Croacia", "2026-06-17T20:00:00Z"],
  ["grp-01-023", "J1 fase de grupos", 1, "L", "Ghana", "Panamá", "2026-06-17T23:00:00Z"],
  ["grp-01-024", "J1 fase de grupos", 1, "K", "Uzbekistán", "Colombia", "2026-06-18T02:00:00Z"],
  ["grp-02-025", "J2 fase de grupos", 2, "A", "República Checa", "Sudáfrica", "2026-06-18T16:00:00Z"],
  ["grp-02-026", "J2 fase de grupos", 2, "B", "Suiza", "Bosnia y Herzegovina", "2026-06-18T19:00:00Z"],
  ["grp-02-027", "J2 fase de grupos", 2, "B", "Canadá", "Catar", "2026-06-18T22:00:00Z"],
  ["grp-02-028", "J2 fase de grupos", 2, "A", "México", "Corea del Sur", "2026-06-19T01:00:00Z"],
  ["grp-02-029", "J2 fase de grupos", 2, "D", "Estados Unidos", "Australia", "2026-06-19T19:00:00Z"],
  ["grp-02-030", "J2 fase de grupos", 2, "C", "Escocia", "Marruecos", "2026-06-19T22:00:00Z"],
  ["grp-02-031", "J2 fase de grupos", 2, "C", "Brasil", "Haití", "2026-06-20T00:30:00Z"],
  ["grp-02-032", "J2 fase de grupos", 2, "D", "Turquía", "Paraguay", "2026-06-20T03:00:00Z"],
  ["grp-02-033", "J2 fase de grupos", 2, "F", "Países Bajos", "Suecia", "2026-06-20T17:00:00Z"],
  ["grp-02-034", "J2 fase de grupos", 2, "E", "Alemania", "Costa de Marfil", "2026-06-20T20:00:00Z"],
  ["grp-02-035", "J2 fase de grupos", 2, "E", "Ecuador", "Curazao", "2026-06-21T00:00:00Z"],
  ["grp-02-036", "J2 fase de grupos", 2, "F", "Túnez", "Japón", "2026-06-21T04:00:00Z"],
  ["grp-02-037", "J2 fase de grupos", 2, "H", "España", "Arabia Saudí", "2026-06-21T16:00:00Z"],
  ["grp-02-038", "J2 fase de grupos", 2, "G", "Bélgica", "Irán", "2026-06-21T19:00:00Z"],
  ["grp-02-039", "J2 fase de grupos", 2, "H", "Uruguay", "Cabo Verde", "2026-06-21T22:00:00Z"],
  ["grp-02-040", "J2 fase de grupos", 2, "G", "Nueva Zelanda", "Egipto", "2026-06-22T01:00:00Z"],
  ["grp-02-041", "J2 fase de grupos", 2, "J", "Argentina", "Austria", "2026-06-22T17:00:00Z"],
  ["grp-02-042", "J2 fase de grupos", 2, "I", "Francia", "Irak", "2026-06-22T21:00:00Z"],
  ["grp-02-043", "J2 fase de grupos", 2, "I", "Noruega", "Senegal", "2026-06-23T00:00:00Z"],
  ["grp-02-044", "J2 fase de grupos", 2, "J", "Jordania", "Argelia", "2026-06-23T03:00:00Z"],
  ["grp-02-045", "J2 fase de grupos", 2, "K", "Portugal", "Uzbekistán", "2026-06-23T17:00:00Z"],
  ["grp-02-046", "J2 fase de grupos", 2, "L", "Inglaterra", "Ghana", "2026-06-23T20:00:00Z"],
  ["grp-02-047", "J2 fase de grupos", 2, "L", "Panamá", "Croacia", "2026-06-23T23:00:00Z"],
  ["grp-02-048", "J2 fase de grupos", 2, "K", "Colombia", "RD Congo", "2026-06-24T02:00:00Z"],
  ["grp-03-049", "J3 fase de grupos", 3, "B", "Suiza", "Canadá", "2026-06-24T19:00:00Z"],
  ["grp-03-050", "J3 fase de grupos", 3, "B", "Bosnia y Herzegovina", "Catar", "2026-06-24T19:00:00Z"],
  ["grp-03-051", "J3 fase de grupos", 3, "C", "Marruecos", "Haití", "2026-06-24T22:00:00Z"],
  ["grp-03-052", "J3 fase de grupos", 3, "C", "Escocia", "Brasil", "2026-06-24T22:00:00Z"],
  ["grp-03-053", "J3 fase de grupos", 3, "A", "Sudáfrica", "Corea del Sur", "2026-06-25T01:00:00Z"],
  ["grp-03-054", "J3 fase de grupos", 3, "A", "República Checa", "México", "2026-06-25T01:00:00Z"],
  ["grp-03-055", "J3 fase de grupos", 3, "E", "Curazao", "Costa de Marfil", "2026-06-25T20:00:00Z"],
  ["grp-03-056", "J3 fase de grupos", 3, "E", "Ecuador", "Alemania", "2026-06-25T20:00:00Z"],
  ["grp-03-057", "J3 fase de grupos", 3, "F", "Japón", "Suecia", "2026-06-25T23:00:00Z"],
  ["grp-03-058", "J3 fase de grupos", 3, "F", "Túnez", "Países Bajos", "2026-06-25T23:00:00Z"],
  ["grp-03-059", "J3 fase de grupos", 3, "D", "Turquía", "Estados Unidos", "2026-06-26T02:00:00Z"],
  ["grp-03-060", "J3 fase de grupos", 3, "D", "Paraguay", "Australia", "2026-06-26T02:00:00Z"],
  ["grp-03-061", "J3 fase de grupos", 3, "I", "Noruega", "Francia", "2026-06-26T19:00:00Z"],
  ["grp-03-062", "J3 fase de grupos", 3, "I", "Senegal", "Irak", "2026-06-26T19:00:00Z"],
  ["grp-03-063", "J3 fase de grupos", 3, "H", "Cabo Verde", "Arabia Saudí", "2026-06-27T00:00:00Z"],
  ["grp-03-064", "J3 fase de grupos", 3, "H", "Uruguay", "España", "2026-06-27T00:00:00Z"],
  ["grp-03-065", "J3 fase de grupos", 3, "G", "Egipto", "Irán", "2026-06-27T03:00:00Z"],
  ["grp-03-066", "J3 fase de grupos", 3, "G", "Nueva Zelanda", "Bélgica", "2026-06-27T03:00:00Z"],
  ["grp-03-067", "J3 fase de grupos", 3, "L", "Panamá", "Inglaterra", "2026-06-27T21:00:00Z"],
  ["grp-03-068", "J3 fase de grupos", 3, "L", "Croacia", "Ghana", "2026-06-27T21:00:00Z"],
  ["grp-03-069", "J3 fase de grupos", 3, "K", "Colombia", "Portugal", "2026-06-27T23:30:00Z"],
  ["grp-03-070", "J3 fase de grupos", 3, "K", "RD Congo", "Uzbekistán", "2026-06-27T23:30:00Z"],
  ["grp-03-071", "J3 fase de grupos", 3, "J", "Argelia", "Austria", "2026-06-28T02:00:00Z"],
  ["grp-03-072", "J3 fase de grupos", 3, "J", "Jordania", "Argentina", "2026-06-28T02:00:00Z"]
];

export const rawKnockoutMatches: RawKnockoutMatch[] = [
  [73, "ROUND_OF_32", "Dieciseisavos", groupSlot("A", 2), groupSlot("B", 2), "2026-06-28T19:00:00Z"],
  [74, "ROUND_OF_32", "Dieciseisavos", groupSlot("E", 1), thirdSlot("ABCDF"), "2026-06-29T20:30:00Z"],
  [75, "ROUND_OF_32", "Dieciseisavos", groupSlot("F", 1), groupSlot("C", 2), "2026-06-30T01:00:00Z"],
  [76, "ROUND_OF_32", "Dieciseisavos", groupSlot("C", 1), groupSlot("F", 2), "2026-06-29T17:00:00Z"],
  [77, "ROUND_OF_32", "Dieciseisavos", groupSlot("I", 1), thirdSlot("CDFGH"), "2026-06-30T21:00:00Z"],
  [78, "ROUND_OF_32", "Dieciseisavos", groupSlot("E", 2), groupSlot("I", 2), "2026-06-30T17:00:00Z"],
  [79, "ROUND_OF_32", "Dieciseisavos", groupSlot("A", 1), thirdSlot("CEFHI"), "2026-07-01T01:00:00Z"],
  [80, "ROUND_OF_32", "Dieciseisavos", groupSlot("L", 1), thirdSlot("EHIJK"), "2026-07-01T16:00:00Z"],
  [81, "ROUND_OF_32", "Dieciseisavos", groupSlot("D", 1), thirdSlot("BEFIJ"), "2026-07-02T00:00:00Z"],
  [82, "ROUND_OF_32", "Dieciseisavos", groupSlot("G", 1), thirdSlot("AEHIJ"), "2026-07-01T20:00:00Z"],
  [83, "ROUND_OF_32", "Dieciseisavos", groupSlot("K", 2), groupSlot("L", 2), "2026-07-02T23:00:00Z"],
  [84, "ROUND_OF_32", "Dieciseisavos", groupSlot("H", 1), groupSlot("J", 2), "2026-07-02T19:00:00Z"],
  [85, "ROUND_OF_32", "Dieciseisavos", groupSlot("B", 1), thirdSlot("EFGIJ"), "2026-07-03T03:00:00Z"],
  [86, "ROUND_OF_32", "Dieciseisavos", groupSlot("J", 1), groupSlot("H", 2), "2026-07-03T22:00:00Z"],
  [87, "ROUND_OF_32", "Dieciseisavos", groupSlot("K", 1), thirdSlot("DEIJL"), "2026-07-04T01:30:00Z"],
  [88, "ROUND_OF_32", "Dieciseisavos", groupSlot("D", 2), groupSlot("G", 2), "2026-07-03T18:00:00Z"],
  [89, "ROUND_OF_16", "Octavos", winnerSlot(74), winnerSlot(77), "2026-07-04T21:00:00Z"],
  [90, "ROUND_OF_16", "Octavos", winnerSlot(73), winnerSlot(75), "2026-07-04T17:00:00Z"],
  [91, "ROUND_OF_16", "Octavos", winnerSlot(76), winnerSlot(78), "2026-07-05T20:00:00Z"],
  [92, "ROUND_OF_16", "Octavos", winnerSlot(79), winnerSlot(80), "2026-07-06T00:00:00Z"],
  [93, "ROUND_OF_16", "Octavos", winnerSlot(83), winnerSlot(84), "2026-07-06T19:00:00Z"],
  [94, "ROUND_OF_16", "Octavos", winnerSlot(81), winnerSlot(82), "2026-07-07T00:00:00Z"],
  [95, "ROUND_OF_16", "Octavos", winnerSlot(86), winnerSlot(88), "2026-07-07T16:00:00Z"],
  [96, "ROUND_OF_16", "Octavos", winnerSlot(85), winnerSlot(87), "2026-07-07T20:00:00Z"],
  [97, "QUARTER_FINAL", "Cuartos", winnerSlot(89), winnerSlot(90), "2026-07-09T20:00:00Z"],
  [98, "QUARTER_FINAL", "Cuartos", winnerSlot(93), winnerSlot(94), "2026-07-10T19:00:00Z"],
  [99, "QUARTER_FINAL", "Cuartos", winnerSlot(91), winnerSlot(92), "2026-07-11T21:00:00Z"],
  [100, "QUARTER_FINAL", "Cuartos", winnerSlot(95), winnerSlot(96), "2026-07-12T01:00:00Z"],
  [101, "SEMI_FINAL", "Semifinal", winnerSlot(97), winnerSlot(98), "2026-07-14T19:00:00Z"],
  [102, "SEMI_FINAL", "Semifinal", winnerSlot(99), winnerSlot(100), "2026-07-15T19:00:00Z"],
  [103, "THIRD_PLACE", "Tercer puesto", loserSlot(101), loserSlot(102), "2026-07-18T21:00:00Z"],
  [104, "FINAL", "Final", winnerSlot(101), winnerSlot(102), "2026-07-19T19:00:00Z"]
];

export function teamId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getTeamCode(name: string): string {
  return teamCodes[name] ?? teamId(name).slice(0, 3).toUpperCase();
}

const groupStageTeams = Array.from(
  new Set(rawGroupMatches.flatMap((match) => [match[4], match[5]]))
)
  .sort((a, b) => a.localeCompare(b, "es"))
  .map((name) => ({
    id: teamId(name),
    name,
    shortCode: getTeamCode(name)
  }));

const knockoutPlaceholderTeams = Array.from(
  new Map(
    rawKnockoutMatches
      .flatMap(([, , , homeSlot, awaySlot]) => [homeSlot, awaySlot])
      .map((slot) => {
        const team = knockoutSlotTeam(slot);
        return [team.id, team] as const;
      })
  ).values()
);

export const initialTeams = [...groupStageTeams, ...knockoutPlaceholderTeams];

const initialGroupMatches = rawGroupMatches.map(([id, round, matchday, groupName, homeTeam, awayTeam, kickoffAt]) => ({
  id,
  stage: "GROUP" as MatchStage,
  round,
  matchday,
  groupName,
  homeTeamId: teamId(homeTeam),
  awayTeamId: teamId(awayTeam),
  kickoffAt,
  lockAt: getLockAt(kickoffAt),
  isDoublePoints: groupName === "H"
}));

const initialKnockoutMatches = rawKnockoutMatches.map(([matchNumber, stage, round, homeSlot, awaySlot, kickoffAt]) => ({
  id: knockoutMatchId(matchNumber),
  stage,
  round,
  matchday: openLigaDbKnockoutOrder(stage),
  groupName: null,
  homeTeamId: knockoutSlotTeam(homeSlot).id,
  awayTeamId: knockoutSlotTeam(awaySlot).id,
  kickoffAt,
  lockAt: getLockAt(kickoffAt),
  isDoublePoints: false
}));

export const initialMatches = [...initialGroupMatches, ...initialKnockoutMatches];

export function knockoutMatchId(matchNumber: number): string {
  return `ko-${String(matchNumber).padStart(3, "0")}`;
}

export function knockoutSlotTeam(slot: KnockoutSlot): { id: string; name: string; shortCode: string } {
  if (slot.kind === "group") {
    const prefix = slot.rank === 1 ? "1.º" : "2.º";
    return {
      id: `slot-${slot.rank}${slot.group.toLowerCase()}`,
      name: `${prefix} Grupo ${slot.group}`,
      shortCode: `${slot.rank}${slot.group}`
    };
  }

  if (slot.kind === "third") {
    return {
      id: `slot-3${slot.candidates.toLowerCase()}`,
      name: `3.º ${slot.candidates.split("").join("/")}`,
      shortCode: `3${slot.candidates.slice(0, 2)}`
    };
  }

  const prefix = slot.kind === "winner" ? "Ganador" : "Perdedor";
  return {
    id: `slot-${slot.kind === "winner" ? "w" : "l"}${slot.matchNumber}`,
    name: `${prefix} M${slot.matchNumber}`,
    shortCode: `${slot.kind === "winner" ? "W" : "L"}${slot.matchNumber}`
  };
}

function groupSlot(group: GroupLetter, rank: 1 | 2): KnockoutSlot {
  return { kind: "group", group, rank };
}

function thirdSlot(candidates: string): KnockoutSlot {
  return { kind: "third", candidates };
}

function winnerSlot(matchNumber: number): KnockoutSlot {
  return { kind: "winner", matchNumber };
}

function loserSlot(matchNumber: number): KnockoutSlot {
  return { kind: "loser", matchNumber };
}

function openLigaDbKnockoutOrder(stage: MatchStage): number {
  if (stage === "ROUND_OF_32") return 4;
  if (stage === "ROUND_OF_16") return 5;
  if (stage === "QUARTER_FINAL") return 6;
  if (stage === "SEMI_FINAL") return 7;
  return 8;
}
