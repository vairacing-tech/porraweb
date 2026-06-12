import type { PredictionOutcome } from "../shared/types";

export const missPhrases = [
  `Has fallado, pero con una seguridad admirable.`,
  `Tu predicción era valiente. También era basura.`,
  `El fútbol ha vuelto a demostrar que no eres su amigo.`,
  `Resultado incorrecto. Pero oye, al menos participas.`,
  `Tu apuesta ha sido archivada como prueba de que la intuición no siempre ayuda.`,
  `Cerca no has estado, pero has hecho ruido.`,
  `Ese pronóstico tenía menos futuro que un defensa lento contra Mbappé.`,
  `Hay predicciones malas y luego está esto, que merece categoría propia.`,
  `Tu resultado no era imposible, solo profundamente ofensivo para la lógica.`,
  `Has fallado con tanta convicción que casi parecía una estrategia.`,
  `Tu pronóstico no ha puntuado, pero ha entretenido al grupo.`,
  `La realidad ha visto tu apuesta y ha decidido tomar otro camino.`,
  `No era fácil fallarlo así, y aun así lo has conseguido.`,
  `Tu marcador ha sido incorrecto, pero muy tuyo.`,
  `El fútbol te ha ignorado con una frialdad admirable.`,
  `Has apostado como si tuvieras información privilegiada. No era el caso.`,
  `Cero puntos. Pero con una personalidad difícil de justificar.`
];

export const trendPhrases = [
  `Has acertado. El sistema está revisando si ha sido un error.`,
  `Primer acierto detectado. Se recomienda mantener la calma.`,
  `Has sumado puntos. Nadie sabe cómo.`,
  `Hasta un reloj roto acierta dos veces al día.`,
  `Enhorabuena, hoy la ignorancia coincidió con la realidad.`,
  `Acertaste. El fútbol acaba de pedir perdón.`,
  `Has acertado el ganador. El marcador ya era pedir demasiado.`,
  `Un punto. Lo justo para presumir y lo insuficiente para impresionar.`,
  `Has olido el partido, aunque luego lo has escrito mal.`,
  `La dirección era correcta. El detalle, como siempre, se quedó en casa.`,
  `Acertaste lo básico. Tampoco nos vengamos arriba.`,
  `Un punto ganado contra todo pronóstico, incluido el tuyo.`,
  `Has entendido el partido a medias. Para esta liga, bastante.`,
  `La intuición funcionó, pero solo en versión de prueba.`
];

export const exactPhrases = [
  `Has acertado exacto. Se ruega no mirar por encima del hombro más de lo necesario.`,
  `Resultado clavado. Hoy el fútbol ha tenido un descuido a tu favor.`,
  `Exacto. Disfrútalo antes de volver a la normalidad.`,
  `Has leído el partido como si supieras. Preocupante.`,
  `Tres puntos limpios. El comité sigue buscando explicación.`,
  `Marcador perfecto. Por una vez, la teoría del caos te respetó.`,
  `Has acertado el resultado exacto. Que alguien revise la simulación.`,
  `Pronóstico impecable. No te acostumbres.`,
  `Exacto. La app ha abierto un expediente por comportamiento sospechoso.`,
  `Marcador perfecto. Hoy puedes hablar, pero poco.`,
  `Has clavado el resultado. El grupo necesita unos minutos para aceptarlo.`,
  `Tres puntos. Disfruta este breve episodio de competencia.`,
  `Exacto y sin despeinarte. O eso vas a contar.`,
  `Has acertado de lleno. La estadística pide repetir el análisis, por vergüenza.`,
  `Resultado perfecto. Esto no limpia tu historial, pero ayuda.`,
  `Hoy has parecido experto. Mañana ya veremos.`
];

export const previewPhrases = [
  `Consejo del cuñado: este partido lo gana el que meta más goles.`,
  `Huele a empate. O a miedo. Difícil saberlo.`,
  `Partido trampa: perfecto para que demuestres que no tienes ni idea.`,
  `Aquí un 2-1 queda elegante, cobarde y suficientemente defendible.`,
  `Si dudas, apuesta contra tu intuición. Ya te ha fallado antes.`,
  `Este partido tiene pinta de arruinar amistades.`,
  `El algoritmo recomienda pensar. Sabemos que es mucho pedir.`,
  `Cuidado: este es el típico partido que todos creen entender.`,
  `Tu corazón dice una cosa. La clasificación te pide que no le hagas caso.`,
  `Apostar con fe también cuenta como rendirse ante la estadística.`,
  `Partido ideal para poner un resultado y arrepentirte 10 minutos después.`,
  `Si vas a poner una goleada absurda, al menos hazlo con dignidad.`,
  `El VAR del bar recomienda empate y otra ronda.`,
  `Este partido no necesita análisis, necesita una moneda.`,
  `La lógica dice una cosa, tu historial de puntos dice otra.`,
  `Aquí se separan los visionarios de los que solo escriben números.`,
  `No te vengas arriba: acertar uno no te convierte en Maldini.`,
  `Partido con pinta de ‘yo lo sabía’ después de acabar.`,
  `Si marcas 0-0, la app avisará a tus seres queridos.`,
  `Este resultado puede definir tu jornada o confirmar tu decadencia.`,
  `Apuesta rápido, antes de que empieces a pensar demasiado.`,
  `Tu predicción será usada como material educativo sobre el exceso de confianza.`,
  `El que apueste 1-1 aquí tiene miedo a vivir.`,
  `Partido perfecto para perder puntos con convicción.`,
  `La estadística no garantiza nada, pero al menos no hace el ridículo sola.`,
  `Si este partido fuera fácil, no estarías tú dudando.`,
  `No hay presión: solo tu reputación de entendido de sofá.`,
  `El grupo juzgará tu apuesta. La app también.`,
  `Pon lo que quieras, luego ya culparás al árbitro.`,
  `Este partido tiene cara de sorpresa desagradable.`,
  `Apostar al favorito es válido, aunque moralmente flojo.`,
  `Si aciertas este exacto, se abre investigación.`,
  `Aquí un empate parece sensato. Por eso probablemente será una locura.`,
  `Tu cuñado interior quiere hablar. Ignóralo.`,
  `Partido patrocinado por la frase: ‘yo iba a poner ese resultado’.`,
  `La app no puede impedirte apostar mal, solo registrarlo.`,
  `Este es de esos partidos que parecen claros hasta que empiezan.`,
  `Recuerda: cambiar la predicción no garantiza mejorarla.`,
  `El fútbol es imprevisible. Tus errores, bastante previsibles.`,
  `Apuesta con cabeza, aunque sea por variar.`,
  `Este partido pide análisis táctico. Tú probablemente pondrás 2-1.`,
  `Si no sabes qué poner, mira la tabla y haz lo contrario que el último.`,
  `El resultado exacto existe. Que tú lo encuentres ya es otra película.`,
  `Hay quien estudia datos. Hay quien pone 3-1 porque sí.`,
  `Cuidado con el exceso de confianza: suele venir antes del cero puntos.`,
  `Este partido está para valientes. O para inconscientes, que en la porra es parecido.`,
  `Si apuestas por goleada, que al menos sea una fantasía bonita.`,
  `La app ha consultado al oráculo y ha dicho: ‘ni idea, pero este usuario menos’.`,
  `No subestimes al rival. Subestímate a ti, que hay precedentes.`,
  `Aquí puedes ganar puntos o regalar memes al grupo.`,
  `Partido de alto riesgo para los que creen saber de fútbol.`,
  `Elige bien: luego no vale decir que era una apuesta emocional.`,
  `Si lo aciertas, finge que lo tenías estudiado.`,
  `Si lo fallas, culpa al césped. Siempre funciona.`,
  `Este partido huele a captura de pantalla humillante.`,
  `La confianza es importante. La puntería, más.`,
  `No todos los resultados malos son tuyos, pero muchos lo parecen.`,
  `Partido apto para expertos, cuñados y gente que pone números al azar.`,
  `Elige con cuidado: la mediocridad también deja rastro.`,
  `Este partido puede ser tu remontada. O otra piedra en tu museo del fracaso.`,
  `Apostar 2-0 no es personalidad, pero se acepta.`,
  `Si dudas entre dos resultados, tranquilo: seguramente fallarás ambos.`,
  `La app recomienda no explicar demasiado tu apuesta. Luego queda peor.`,
  `Partido con aroma a ‘esto no lo acierta nadie’. Tú incluido.`,
  `El resultado perfecto está ahí fuera. Lejos de ti, probablemente.`,
  `Tu predicción será guardada para futuras burlas.`,
  `Aquí el empate es tentador, como todas las malas decisiones.`,
  `Pon el marcador y aléjate lentamente.`,
  `Este partido no perdona a los intensitos del análisis.`,
  `Si vas líder, este partido viene a bajarte los humos.`,
  `Si vas último, este partido también puede empeorarlo. Ánimo.`,
  `Partido ideal para demostrar que la suerte existe, aunque no te visite.`,
  `No es una apuesta mala si la defiendes con suficiente soberbia.`,
  `Este partido parece fácil. Señal inequívoca de trampa.`,
  `El dato clave: nadie sabe nada, pero algunos lo disimulan mejor.`,
  `Apuesta como si supieras. Es lo que hacen todos.`,
  `Si aciertas, talento. Si fallas, narrativa.`,
  `La app ha detectado exceso de fe. Procediendo a ignorarla.`,
  `Este partido puede romper quinielas y egos.`,
  `Un 1-0 aquí dice: ‘me gusta sufrir y puntuar poco’.`,
  `Un 4-3 aquí dice: ‘he jugado demasiado al FIFA’.`,
  `El consejo profesional es no pedir consejo a esta app.`,
  `Partido delicado: perfecto para que tu intuición se estrelle.`,
  `No pongas lo primero que pienses. Bueno, tampoco lo segundo suele ayudarte.`,
  `Aquí se premia el conocimiento, pero a veces también la potra indecente.`,
  `Si tu apuesta empieza con ‘yo creo que…’, mala señal.`,
  `El fútbol no entiende de sentimientos. Tu porra tampoco debería.`,
  `Este partido viene con bonus de arrepentimiento.`,
  `Apostar tarde no te hace más sabio, solo más lento.`,
  `El marcador exacto está sobrevalorado, sobre todo cuando no lo aciertas.`,
  `Que no te tiemble el pulso. Total, ya has fallado antes.`,
  `Este partido pide humildad. Tú dale al 3-0, campeón.`,
  `El grupo necesita un villano. Tu predicción puede ayudar.`,
  `Si no tienes claro el resultado, bienvenido al método oficial de todos.`,
  `Apuesta con confianza moderada y excusas preparadas.`,
  `Este partido puede confirmar que la tabla no miente. O que tú sí.`,
  `Elige resultado. La dignidad es opcional.`
];

export function pickStablePhrase(phrases: readonly string[], seed: string): string | null {
  if (phrases.length === 0) return null;
  return phrases[hashSeed(seed) % phrases.length] ?? null;
}

export function getPostMatchPhrase(outcome: PredictionOutcome, seed: string): string | null {
  if (outcome === "miss") return pickStablePhrase(missPhrases, seed);
  if (outcome === "trend") return pickStablePhrase(trendPhrases, seed);
  if (outcome === "exact") return pickStablePhrase(exactPhrases, seed);
  return null;
}

export function getPreviewPhrase(seed: string): string {
  return pickStablePhrase(previewPhrases, seed) ?? previewPhrases[0];
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
