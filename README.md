# FrontendUTN_TPF

Frontend estatico para consumir la API de BookmarksUTN.

## Produccion

- Frontend (Render): https://frontendutn-tpf.onrender.com
- Backend API: https://backendutn-tpf.onrender.com
- Swagger API: https://backendutn-tpf.onrender.com/api-docs

## Archivos principales

- `index.html`: pantalla principal de la app
- `index.js`: logica principal del cliente
- `auth-demo.html`: demo aislada de auth
- `auth-demo.js`: pruebas de register/login/reset
- `styles.css`: estilos globales

## Configuracion de backend

La URL del backend se define en:

- `index.js` -> `API_BASE_URL`
- `auth-demo.js` -> `API_BASE_URL`

Valor actual:

```js
const API_BASE_URL = "https://backendutn-tpf.onrender.com";
```

## Deploy en Render (Static Site)

1. Crear un servicio `Static Site` desde este repo.
2. Configurar:
   - Build command: _(vacio)_
   - Publish directory: `.`
3. Deploy.

## Notas

- Este frontend usa Bearer token en `Authorization`.
- El backend debe permitir CORS desde el dominio del frontend.
