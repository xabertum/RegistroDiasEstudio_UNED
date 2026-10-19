# Registro de estudio · UNED

Cuenta atrás hasta los exámenes y seguimiento del temario de:

- **Introducción a la Sociología** (69011017)
- **Psicología de los Grupos** (62013065)

## Arranque con Docker

```bash
docker compose up -d --build
```

Abrir http://localhost:8088 (otro puerto: `PUERTO=9000 docker compose up -d`).

- `frontend`: nginx sirve la app compilada y reenvía `/api` al backend.
- `backend`: Spring Boot; no se publica fuera, solo lo ve nginx.
- La base de datos se guarda en `backend/data/`, la misma carpeta que en desarrollo, así que el progreso es el mismo.
  No arrancar a la vez la versión Docker y la de desarrollo, porque ambas usan ese fichero.

Parar: `docker compose down`.

## Arranque en desarrollo

Backend (Spring Boot 4.1 · Java 25 · puerto 8080):

```bash
cd backend
./mvnw spring-boot:run
```

Frontend (Angular 21 · puerto 4200, con proxy de `/api` al backend):

```bash
cd frontend
npm install   # solo la primera vez
npx ng serve
```

Abrir http://localhost:4200.

## Datos

- El progreso se guarda en una base H2 en fichero (`backend/data/`). Para empezar de cero basta con borrar esa carpeta.
- El temario y las fechas de examen salen de `backend/src/main/resources/temario.json`, que se sincroniza en cada
  arranque: si cambia el árbol de una asignatura se reemplaza, conservando lo estudiado en los apartados con el mismo título.
- Consola H2: http://localhost:8080/h2-console (JDBC URL `jdbc:h2:file:./data/estudio`, usuario `sa`, sin contraseña).

## API

| Método | Ruta | Cuerpo |
|---|---|---|
| GET | `/api/asignaturas` | |
| GET | `/api/asignaturas/{id}` | |
| GET | `/api/actividad` | Apartados estudiados por día y asignatura (mapa de calor) |
| PATCH | `/api/asignaturas/{id}/semana` | `{"semana": 1 \| 2}` |
| PATCH | `/api/temas/{id}` | `{"estudiado": true \| false}` |

Al marcar un tema se marcan todos sus apartados; un tema padre cuenta como estudiado cuando lo están todos sus hijos.

## Versión online privada: GitHub Pages + Supabase

Esta versión no necesita alojar Spring Boot. El frontend se publica en
`https://xabertum.github.io/RegistroDiasEstudio_UNED/`, sin añadir tarjetas ni enlaces
en el portfolio. El HTML y el temario son públicos; el progreso se protege mediante
Supabase Auth y políticas RLS de PostgreSQL, no mediante la ocultación de la URL.
El modo local anterior (Docker/Spring Boot/H2) sigue disponible sin cambios.

### 1. Crear Supabase

1. Crea un proyecto en el plan gratuito desde el panel de Supabase. Guarda la
   contraseña de PostgreSQL en tu gestor de contraseñas, no en este repositorio.
2. En Authentication, desactiva **Allow new users to sign up** y los accesos anónimos.
   Usa el proveedor Email con contraseña; no se utiliza OAuth ni enlaces mágicos.
3. En el SQL Editor ejecuta una sola vez [`supabase/schema.sql`](./supabase/schema.sql).
   Crea las tablas y las políticas: ningún acceso anónimo; solo usuarios autorizados
   pueden leer y modificar su propio progreso; el cliente no puede autorizar cuentas.
4. En Authentication → Users crea tu usuario con correo y contraseña segura y
   confírmalo desde el panel. Copia su UUID. Después ejecuta en el SQL Editor,
   sustituyendo el UUID por el real:

   ```sql
   begin;
   insert into public.study_allowed_users(user_id)
   values ('UUID-DE-TU-USUARIO');
   insert into public.study_progress(user_id)
   values ('UUID-DE-TU-USUARIO');
   commit;
   ```

   Solo añade tu cuenta a la lista. Para revocar el acceso y borrar su progreso:
   `delete from public.study_allowed_users where user_id = 'UUID-DE-TU-USUARIO';`.
   Para cambiar una contraseña olvidada, usa la administración de usuarios del
   panel de Supabase; esta aplicación no incluye registro ni recuperación por enlace.
5. En la configuración de API copia la **Project URL** y la clave **publishable**
   (`sb_publishable_...`). Estas dos referencias son públicas. Nunca uses `service_role`,
   `sb_secret_...`, contraseñas de base de datos ni tokens personales en el frontend.
6. Configura Site URL con la URL de GitHub Pages indicada arriba.

### 2. Compilar y publicar

En este repositorio, añade dos **Actions → Variables** (no credenciales privadas):
`SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. El workflow
[`pages.yml`](./.github/workflows/pages.yml) valida y publica solo el frontend en
`gh-pages` al hacer push a `main` o `master`. En Settings → Pages selecciona
**Deploy from a branch**, rama `gh-pages`, raíz `/`.

Para compilar manualmente en PowerShell (Node 24):

```powershell
Set-Location frontend
npm ci
npm run test:cloud
$env:SUPABASE_URL = 'https://TU-PROYECTO.supabase.co'
$env:SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TU-CLAVE-PUBLICA'
npm run build:pages
```

Publica el contenido completo de `frontend/dist/frontend/browser` en la rama
`gh-pages` **de este repositorio**, incluyendo `.nojekyll`. No publiques la raíz
del repositorio ni la carpeta del backend. Si Actions no funciona por límites de
cuenta/facturación, se puede subir ese mismo build manualmente y solicitar una
reconstrucción de Pages desde GitHub. No modifiques la rama del portfolio.

El build genera `config.json` en modo Supabase y copia el temario desde el JSON del
backend, que sigue siendo la única fuente del temario. `npm run build` y `npm start`
usan por defecto `public/config.json` en modo `backend` y conservan la API local.
Para probar el build de Pages, sírvelo bajo `/RegistroDiasEstudio_UNED/` con un
servidor estático: no abras el HTML directamente con `file:`.

### Datos, límites y verificación

- El primer acceso online empieza sin progreso: **no se migra automáticamente la H2
  local**. No borres `backend/data`. Una migración de ese progreso requiere exportarlo
  y mapearlo al nuevo almacenamiento; esta preparación no modifica la base local.
- Cada cuenta autorizada tiene un documento privado con semanas de examen y fechas
  de estudio, identificadas por código de asignatura y ruta de títulos. Cambiar un
  título equivale a un apartado nuevo. Las fechas de estudio usan Europe/Madrid.
- Se conserva el marcado de ramas completas, el recálculo de padres, el conteo de
  hojas, la semana elegida, las cuentas atrás y el mapa de actividad.
- Los cambios se guardan antes de mostrarse. Una revisión evita sobrescribir
  silenciosamente cambios simultáneos: si hay conflicto, repite la acción.
  Usa **Actualizar** para traer cambios de otro dispositivo.
- El temario y las fechas de examen están en hora local de Madrid; como antes,
  el formato visual de las horas depende de la zona horaria del navegador.
- El plan gratuito tiene cuotas y puede pausarse por inactividad. Comprueba los
  límites actuales en el panel; no garantiza disponibilidad continua ni copias
  automáticas. Exporta periódicamente `study_progress` desde el panel.
- Antes de darlo por publicado: prueba inicio/cierre de sesión, guardar y recargar
  una marca, cambiar semana y recuperar el mismo progreso en otro dispositivo.
  Sin sesión, las peticiones a las tablas deben fallar. Un usuario no autorizado
  no debe ver ni modificar filas. Las pruebas locales `npm run test:cloud` ejercitan
  el cálculo del progreso y las políticas RLS contra PostgreSQL embebido; no
  sustituyen esta comprobación contra tu proyecto Supabase real.
