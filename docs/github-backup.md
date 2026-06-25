# Respaldo en GitHub (Salud Monitor)

La app puede subir `public/data/backup.json` al repo `silvio-dotcom/salud-monitor` mediante una Edge Function en Supabase (el token de GitHub nunca va en el navegador).

## 1. Crear token de GitHub

En GitHub → Settings → Developer settings → Fine-grained token (o classic PAT):

- Repo: `silvio-dotcom/salud-monitor`
- Permiso: **Contents** read & write

## 2. Desplegar función

Desde el repo que contiene `supabase/functions/salud-backup-github/`:

```bash
supabase secrets set GITHUB_TOKEN=ghp_...
supabase secrets set GITHUB_OWNER=silvio-dotcom
supabase secrets set GITHUB_REPO=salud-monitor
supabase functions deploy salud-backup-github --project-ref anehiurwiqefdckrgwls
```

## 3. Secrets en repo salud-monitor (GitHub Actions)

| Secret | Valor |
|--------|--------|
| `SALUD_BACKUP_URL` | `https://anehiurwiqefdckrgwls.supabase.co/functions/v1/salud-backup-github` |
| `SALUD_SUPABASE_ANON_KEY` | Anon key del proyecto Supabase |

Tras el próximo deploy de Pages, el botón **Respaldar en GitHub** sube los datos del teléfono.

## Fallback

Si `SALUD_BACKUP_URL` no está configurado, el botón descarga un JSON local como respaldo.

El push a `backup.json` dispara el workflow de GitHub Pages y republica el sitio con el backup actualizado.
