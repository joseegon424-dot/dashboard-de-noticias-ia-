# 🔍 Hallazgos e Investigación — findings.md

> Descubrimientos, restricciones y recursos del proyecto AI News Dashboard.

---

## Descubrimientos

| # | Fecha | Hallazgo | Fuente |
|---|---|---|---|
| 1 | 2026-02-08 | Ben's Bites usa Substack. RSS público funcional en `bensbites.substack.com/feed` | Investigación directa |
| 2 | 2026-02-08 | The Rundown AI usa Beehiiv. Feed RSS privado — requiere proxy CORS o scraping | Web search + verificación |
| 3 | 2026-02-08 | TLDR AI tiene feeds por tema pero URLs no son públicas directamente | Web search |
| 4 | 2026-02-08 | Ben's Bites publica martes y jueves. Contenido incluye: herramientas, demos, dev dish | RSS feed analysis |
| 5 | 2026-02-08 | The Rundown AI: 2M+ suscriptores, diario, enfoque en noticias + herramientas + exclusivas | therundownai.com |
| 6 | 2026-02-08 | Newsletters adicionales identificadas: The Neuron (500K+), Superhuman AI (1M+), Mindstream, The Batch | Web search |

---

## Restricciones

1. **CORS:** Los feeds RSS no se pueden leer directamente desde el navegador por políticas CORS. Se necesita un proxy como `api.allorigins.win`
2. **Rate Limits:** Los proxies CORS gratuitos pueden tener límites de tasa
3. **Sin Backend v1:** Todo debe funcionar client-side. No hay servidor propio
4. **Beehiiv RSS privado:** The Rundown AI no tiene un feed RSS público estándar

---

## Estrategia de Scraping Definida

```
Fuente → Proxy CORS → Parse XML/HTML → Normalizar → Article Schema → localStorage → UI
```

- Ben's Bites: RSS directo via proxy → XML → parse `<item>` tags
- The Rundown AI: Página principal via proxy → HTML → parse article cards
- TLDR AI: Página de feed via proxy → HTML → parse article entries
