# Bloquera San Carlos

Primera base de la app interna para la ferreteria **Bloquera San Carlos**.

## Incluye en esta etapa

- Interfaz de login en Next.js
- Conexión a PostgreSQL por `DATABASE_URL`
- Tabla inicial de usuarios
- Sesión segura con cookie firmada
- Script para crear el esquema y sembrar el usuario administrador

## Configuración

1. Instala PostgreSQL localmente o usa una base remota de Postgres.
2. Copia `.env.example` a `.env`.
3. Ajusta `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
4. Instala dependencias:

```bash
npm install
```

5. Crea el esquema y el administrador inicial:

```bash
npm run db:setup
```

6. Inicia la aplicación:

```bash
npm run dev
```

La pantalla de login quedará disponible en `http://localhost:3000`.

## Siguiente paso

Cuando compartas el Excel actual, transformamos sus procesos en módulos concretos dentro de la aplicación.
