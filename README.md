# Salud Monitor

App web estática (HTML + JavaScript) para control de glucosa y presión arterial. **Sin backend** — los datos viven en el navegador (`localStorage`) y puedes respaldarlos en GitHub como JSON.

## Inicio rápido (local)

```powershell
cd salud-monitor
npm install
npm run dev
```

O doble clic en [`run_salud_monitor.bat`](../run_salud_monitor.bat) desde la raíz del repo.

Abre http://localhost:5173

## Cómo funciona el almacenamiento

| Dónde | Qué guarda |
|-------|------------|
| **localStorage** | Todas las medidas en este navegador/dispositivo |
| **Exportar JSON** | Backup descargable |
| **GitHub** | Subes el JSON a `public/data/backup.json` y haces push |

Al abrir la app en un dispositivo nuevo (sin datos locales), intenta cargar automáticamente `data/backup.json` del sitio publicado.

## Respaldar en GitHub

1. En la app: **Exportar JSON**
2. Copia el archivo a `salud-monitor/public/data/backup.json`
3. Commit y push a `main`
4. GitHub Pages republica el sitio con el backup incluido

Botón **Cargar backup GitHub** fuerza la recarga del JSON publicado.

## Deploy en GitHub Pages

1. En el repo: **Settings → Pages → Build and deployment → GitHub Actions**
2. Push a `main` con cambios en `salud-monitor/` activa [`.github/workflows/deploy-salud-monitor-pages.yml`](../.github/workflows/deploy-salud-monitor-pages.yml)
3. URL típica: `https://TU_USUARIO.github.io/NOMBRE_REPO/`

Si el repo se llama distinto, el workflow ajusta la ruta base automáticamente.

## Importar desde la app anterior

1. Exporta JSON desde la app vieja
2. **Importar JSON** en Salud Monitor (combinar o reemplazar)

## Build manual

```powershell
npm run build
npm run preview
```

## Funciones

- Glucosa (ayunas, pre/post comida) y presión arterial
- Gráficas, insights, historial editable
- PDF médico + export/import JSON
- PWA (agregar a pantalla de inicio en móvil)

## Disclaimer

Herramienta de seguimiento personal. No sustituye consejo médico.
