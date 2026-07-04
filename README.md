# Porra Fortilin

Web movil para la liga fija `Fortilin`.

## Acceso

- Produccion Cloudflare: `https://porra-fortilin-app.vairacing.workers.dev`
- Vercel: `https://porraweb-vairacing-s-projects.vercel.app`
  - Nota: este despliegue puede redirigir al login de Vercel si Deployment Protection esta activo.
- Participantes: crean usuario desde la pantalla inicial. No hay codigo de liga ni codigo de admin.
- El admin se crea automaticamente al inicializar D1. No participa en la liga, no aparece en la clasificacion y no suma puntos.

## Flujo recomendado antes de invitar usuarios

1. Desplegar la app y aplicar la migracion D1.
2. Entrar con admin.
3. Ir a `Perfil -> Admin`.
4. Pulsar `Cargar convocatorias`.
5. Cuando haya jugadores cargados, invitar a los participantes.

El maximo goleador se elige en dos pasos: seleccion y jugador convocado. Si una seleccion no tiene plantilla cargada, el alta avisa de que la convocatoria esta pendiente.

## Admin

Desde `Perfil -> Admin`, el admin puede:

- Cargar convocatorias desde la tabla local `squad_players`.
- Sincronizar resultados con OpenLigaDB.
- Resetear contrasenas de participantes.
- Modificar resultados reales.
- Marcar o quitar puntos dobles.
- Modificar el pronostico de un participante para un partido.

## Datos externos

El proveedor principal de calendario/resultados es OpenLigaDB:

- `OPENLIGADB_BASE_URL=https://api.openligadb.de`
- `OPENLIGADB_LEAGUE_SHORTCUT=wm26`
- `OPENLIGADB_SEASON=2026`

El shortcut `wm26` esta en configuracion, no en codigo. Si OpenLigaDB publica el Mundial con otro shortcut, cambia `OPENLIGADB_LEAGUE_SHORTCUT` en `wrangler.toml`, `wrangler.sync.toml` y en los vars/secrets del entorno si aplica.

Las convocatorias iniciales se cargan desde `migrations/0002_seed_squads.sql`, generada desde los CSV de equipos/jugadores. Usa IDs internos negativos para no fingir IDs externos.

Los moviles nunca llaman a proveedores externos directamente: solo consultan datos cacheados en D1.

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

### 5. Aplicar migraciones D1

```bash
npm run cf:migrate:remote
```

La migracion `0002_seed_squads.sql` carga 48 selecciones y 1247 jugadores en `squad_players`, mas alias de equipos y jugadores.

### 6. Desplegar Pages y Worker Cron

```bash
npm run build
npm run cf:deploy
npm run cf:deploy:sync
```

El worker cron queda configurado cada 5 minutos entre las 18:00 y las 05:00 de Madrid durante el horario de verano, y cada hora fuera de esa franja. Los moviles solo leen D1; nunca llaman directamente a OpenLigaDB.

## Desarrollo local

```bash
npm run dev
```

Validaciones:

```bash
npm test
npm run build
```
