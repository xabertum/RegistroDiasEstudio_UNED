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
| PATCH | `/api/asignaturas/{id}/semana` | `{"semana": 1 \| 2}` |
| PATCH | `/api/temas/{id}` | `{"estudiado": true \| false}` |

Al marcar un tema se marcan todos sus apartados; un tema padre cuenta como estudiado cuando lo están todos sus hijos.
