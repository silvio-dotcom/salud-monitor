# Insights IA (Salud Monitor)

Función edge que genera insights personalizados con Claude Haiku para monitoreo en embarazo.

## Deploy

Desde el repo principal (donde está `supabase/`):

```bash
supabase functions deploy salud-insights --project-ref anehiurwiqefdckrgwls
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## GitHub Pages (salud-monitor)

Añade secrets en el repo `salud-monitor`:

| Secret | Valor |
|--------|--------|
| `SALUD_INSIGHTS_URL` | `https://anehiurwiqefdckrgwls.supabase.co/functions/v1/salud-insights` |
| `SALUD_SUPABASE_ANON_KEY` | Anon key del proyecto Supabase |

Sin secrets, la app usa análisis local con contexto de semana 33 de embarazo.
