# 📜 Constitución del Proyecto — gemini.md

> Este archivo es **LEY**. Define los esquemas de datos, reglas de comportamiento e invariantes arquitectónicas del proyecto.

---

## Estado del Proyecto

| Campo | Valor |
|---|---|
| **Proyecto** | AI News Dashboard |
| **Fase Actual** | 🏗️ Fase 1: Blueprint (pendiente aprobación) |
| **Fecha de Inicio** | 2026-02-08 |

---

## North Star

> Dashboard interactivo y hermoso que recopila artículos de IA de las últimas 24 horas desde múltiples newsletters y los muestra con un diseño premium.

---

## Esquema de Datos

### Article (Unidad principal)
```json
{
  "id": "string (hash único basado en URL)",
  "title": "string",
  "summary": "string (extracto de ~200 chars)",
  "content": "string (contenido HTML)",
  "source": "string (nombre del newsletter)",
  "sourceIcon": "string (emoji)",
  "url": "string (link al artículo original)",
  "publishedAt": "ISO 8601 datetime",
  "fetchedAt": "ISO 8601 datetime",
  "tags": ["string"],
  "saved": "boolean (favorito del usuario)",
  "read": "boolean"
}
```

### DashboardState (Estado global)
```json
{
  "lastFetchedAt": "ISO 8601 datetime",
  "articles": "Article[]",
  "savedArticles": "Article[] (persistidos en localStorage)",
  "activeFilters": {
    "source": "string | null",
    "saved": "boolean",
    "search": "string"
  }
}
```

---

## Fuentes de Datos

| Newsletter | Método | URL | Estado |
|---|---|---|---|
| Ben's Bites | RSS (Substack) | `bensbites.substack.com/feed` | ✅ Verificado |
| The Rundown AI | Scraping/RSS proxy | `therundownai.com` | 🔍 Requiere proxy |
| TLDR AI | Scraping/RSS proxy | `tldr.tech/ai` | 🔍 Requiere proxy |
| The Neuron | Scraping | `theneurondaily.com` | 📋 Planificado |

---

## Reglas de Comportamiento

1. **Determinismo:** Toda lógica de negocio es determinista. No se usan LLMs para decisiones del pipeline.
2. **Frescura:** Solo se muestran artículos de las últimas 24 horas.
3. **Persistencia:** Artículos guardados se almacenan en `localStorage`. Al refrescar, deben persistir.
4. **Deduplicación:** Un artículo se identifica por hash de su URL. No se duplican.
5. **Graceful Degradation:** Si una fuente falla, el dashboard muestra las demás. Nunca se rompe.
6. **Auto-refresh:** Al cargar la página, si han pasado +24h desde la última actualización, se re-fetcha automáticamente.
7. **Sin Backend (v1):** Todo client-side. Supabase es futuro (v2).

---

## Invariantes Arquitectónicas

- **Arquitectura A.N.T. de 3 capas:**
  - `architecture/` → SOPs técnicos
  - Navegación → Enrutamiento de datos entre parser → storage → UI
  - `tools/` → Scripts JS atómicos y testeables
- Variables de entorno → `.env`
- Archivos temporales → `.tmp/`
- Cambios de lógica → SOP primero, código después

---

## Registro de Mantenimiento

| Fecha | Cambio | Razón |
|---|---|---|
| 2026-02-08 | Archivo creado | Inicialización Protocolo 0 |
| 2026-02-08 | Esquema de datos definido | Descubrimiento completado |
| 2026-02-08 | Fuentes verificadas | Investigación de RSS feeds |
