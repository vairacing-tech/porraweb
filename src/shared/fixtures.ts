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

export const initialTeams = Array.from(
  new Set(rawGroupMatches.flatMap((match) => [match[4], match[5]]))
)
  .sort((a, b) => a.localeCompare(b, "es"))
  .map((name) => ({
    id: teamId(name),
    name,
    shortCode: getTeamCode(name)
  }));

export const initialMatches = rawGroupMatches.map(([id, round, matchday, groupName, homeTeam, awayTeam, kickoffAt]) => ({
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
