# Porra Fortilin

Web movil para la liga fija `Fortilin`.

## Acceso

- Participantes: crean usuario desde la pantalla inicial. No hay codigo de liga ni codigo de admin.
- Admin: usuario `admin`, contrasena `Porra.44`.
- El admin se crea automaticamente al inicializar D1. No participa en la liga, no aparece en la clasificacion y no suma puntos.

## Flujo recomendado antes de invitar usuarios

1. Desplegar la app y aplicar la migracion D1.
2. Entrar con `admin` / `Porra.44`.
3. Ir a `Perfil -> Admin`.
4. Pulsar `Cargar convocatorias`.
5. Cuando haya jugadores cargados, invitar a los participantes.

El maximo goleador se elige en dos pasos: seleccion y jugador convocado. Si una seleccion no tiene plantilla cargada, el alta avisa de que la convocatoria esta pendiente.

## Admin

Desde `Perfil -> Admin`, el admin puede:

- Cargar convocatorias desde API-Football.
- Sincronizar resultados.
- Resetear contrasenas de participantes.
- Modificar resultados reales.
- Marcar o quitar puntos dobles.
- Modificar el pronostico de un participante para un partido.

## API-Football y limite diario

La clave se configura como secreto `API_FOOTBALL_KEY`; no se guarda en el repo.

El plan Free probado devuelve que no tiene acceso a `fixtures?league=1&season=2026`. Por eso el sincronizador de convocatorias usa este fallback:

1. Intenta descubrir equipos con el calendario 2026.
2. Si el plan no lo permite, resuelve IDs de selecciones con `teams?name=...`.
3. Carga convocatorias con `players/squads?team=...`.

El presupuesto operativo esta en `API_FOOTBALL_DAILY_BUDGET=70` para no acercarse al limite de 100 requests/dia. Si no da tiempo a cargar todas las convocatorias en un dia, vuelve a pulsar `Cargar convocatorias` al dia siguiente.

Los moviles nunca llaman a API-Football directamente: solo consultan datos cacheados en D1.

## Despliegue en Cloudflare

### 1. Instalar dependencias

```bash
npm install
```

### 2. Login en Cloudflare

```bash
npx wrangler login
```

### 3. Crear D1

```bash
npx wrangler d1 create porra-fortilin
```

Copia el `database_id` que devuelve Cloudflare y sustituyelo en:

- `wrangler.toml`
- `wrangler.sync.toml`

### 4. Crear el proyecto Pages

Puedes crearlo desde el dashboard de Cloudflare Pages conectando el repo, o desplegar una primera vez con:

```bash
npm run build
npm run cf:deploy
```

### 5. Configurar secretos

```bash
npx wrangler pages secret put API_FOOTBALL_KEY --project-name porra-fortilin
npx wrangler secret put API_FOOTBALL_KEY --config wrangler.sync.toml
```

Pega la key cuando Wrangler la pida. No la escribas en archivos del repo.

### 6. Aplicar migraciones D1

```bash
npm run cf:migrate:remote
```

### 7. Desplegar Pages y Worker Cron

```bash
npm run build
npm run cf:deploy
npm run cf:deploy:sync
```

El worker cron queda configurado cada 30 minutos. Respeta el presupuesto diario definido en `wrangler.sync.toml`.

## Desarrollo local

```bash
npm run dev
```

Validaciones:

```bash
npm test
npm run build
```
