import type { AchievementDefinition, AchievementId } from "./types";

export const achievementDefinitions: AchievementDefinition[] = [
  {
    id: "visionario_desastre",
    name: "Visionario del desastre",
    description: "Has fallado 5 resultados seguidos. No es mala suerte, es talento inverso."
  },
  {
    id: "nostradamus_aliexpress",
    name: "El Nostradamus de AliExpress",
    description: "Has acertado el ganador pero jamás el resultado exacto."
  },
  {
    id: "analista_de_bar",
    name: "Analista de bar",
    description: "Has apostado 2-1 en más de 5 partidos. Revolucionario, imprevisible, peligroso."
  },
  {
    id: "cementerio_de_puntos",
    name: "Cementerio de puntos",
    description: "Donde tú apuestas, los puntos van a morir."
  },
  {
    id: "antipatriota_estadistico",
    name: "Antipatriota estadístico",
    description: "Has apostado contra España. Valiente o traidor, aún no se sabe."
  },
  {
    id: "arquitecto_del_cero_cero",
    name: "Arquitecto del 0-0",
    description: "Has apostado 0-0 en 4 partidos. La emoción no era una prioridad."
  },
  {
    id: "funcionario_del_empate",
    name: "Funcionario del empate",
    description: "Has apostado empate en 6 partidos. Prudencia, miedo o falta de imaginación."
  },
  {
    id: "el_var_te_odia",
    name: "El VAR te odia",
    description: "Has fallado por un solo gol en 5 partidos. Ya es mala suerte, o una forma de vida."
  },
  {
    id: "mano_rota",
    name: "Mano rota",
    description: "Has acertado 3 exactos en una misma jornada. Hoy no te reconocería ni tu cuñado."
  },
  {
    id: "doble_o_nada_pero_nada",
    name: "Doble o nada, pero nada",
    description: "Has sacado 0 puntos en un partido x2. Doblar la ruina también cuenta."
  },
  {
    id: "ultima_hora_fc",
    name: "Última hora FC",
    description: "Has guardado un pronóstico a menos de 15 minutos del bloqueo. La planificación era para otros."
  },
  {
    id: "boton_de_guardar_desconocido",
    name: "Botón de guardar, ese desconocido",
    description: "Has dejado pasar un partido sin guardar pronóstico. La app avisó; tú decidiste vivir peligrosamente."
  },
  {
    id: "rey_del_barro",
    name: "Rey del barro",
    description: "Vas primero, pero en esta liga de paquetes eso tampoco dice mucho."
  },
  {
    id: "dictador_de_la_tabla",
    name: "Dictador de la tabla",
    description: "Vas primero y ya estás mirando a los demás como si supieras leer partidos."
  },
  {
    id: "campeon_con_asterisco",
    name: "Campeón con asterisco",
    description: "La victoria es tuya. El respeto todavía está en revisión."
  },
  {
    id: "zurullo_de_oro",
    name: "Zurullo de oro",
    description: "Has demostrado una capacidad sobrenatural para esquivar puntos."
  }
];

export const achievementDefinitionById = new Map<AchievementId, AchievementDefinition>(
  achievementDefinitions.map((achievement) => [achievement.id, achievement])
);

export function getAchievementDefinition(id: AchievementId): AchievementDefinition {
  return achievementDefinitionById.get(id) ?? {
    id,
    name: id,
    description: "Logro desbloqueado."
  };
}
