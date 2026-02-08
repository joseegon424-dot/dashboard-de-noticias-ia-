# Data Pipeline SOP

## Objetivo
Obtener artículos de IA de las últimas 72h desde múltiples newsletters y presentarlos en el dashboard.

## Flujo
```
1. Check needsRefresh() → ¿Han pasado +24h?
   ├── SÍ → fetchAllFeeds()
   └── NO → loadCached()

2. fetchAllFeeds():
   ├── Promise.allSettled([
   │     fetchBensBites(),      // RSS Substack
   │     fetchRundownAI(),      // HTML scraping
   │     fetchTldrAI(),         // HTML scraping
   │   ])
   ├── Cada fuente usa proxy CORS (allorigins → corsproxy.io)
   ├── Si una fuente falla → retorna [] (graceful degradation)
   └── Resultado → saveArticles() → deduplicar → sort por fecha

3. saveArticles():
   ├── Merge con artículos existentes (por ID)
   ├── Preservar estado saved/read del usuario
   └── Guardar en localStorage
```

## Reglas
- **Deduplicación:** ID = hash de URL del artículo
- **Frescura:** Solo artículos de últimas 72h (configurable)
- **Fallback:** Si todas las fuentes fallan, mostrar caché
- **Auto-refresh:** Verificar timestamp al cargar la página

## Errores Conocidos
| Error | Causa | Solución |
|---|---|---|
| CORS blocked | Proxy caído | Intentar siguiente proxy |
| 404 en RSS | URL cambió | Actualizar URL en feed-parser.js |
| Parse error | Formato XML inesperado | Fallback a parser genérico |
