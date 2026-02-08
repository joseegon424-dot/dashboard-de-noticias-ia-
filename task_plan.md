# 📋 Plan de Tareas — task_plan.md

## Protocolo 0: Inicialización ✅
- [x] Crear archivos de memoria (`gemini.md`, `task_plan.md`, `findings.md`, `progress.md`)
- [x] Responder las 5 Preguntas de Descubrimiento
- [x] Definir Esquema de Datos (JSON) en `gemini.md`
- [/] Aprobar Blueprint (plan de implementación)

---

## Fase 1: B — Blueprint (Visión y Lógica) ✅
- [x] Preguntas de Descubrimiento
  - [x] 🎯 North Star: Dashboard interactivo de noticias AI
  - [x] 🔗 Integraciones: Scraper web (RSS + proxy CORS)
  - [x] 💾 Fuente de Verdad: localStorage (Supabase futuro)
  - [x] 📦 Payload: Dashboard web con auto-refresh 24h
  - [x] ⚖️ Reglas: Diseño premium, persistencia de guardados
- [x] Investigación de fuentes RSS y scraping
- [/] Aprobar plan de implementación

---

## Fase 2: L — Link (Conectividad)
- [ ] Verificar proxy CORS con `api.allorigins.win`
- [ ] Test de fetch del RSS de Ben's Bites via proxy
- [ ] Test de scraping de The Rundown AI via proxy
- [ ] Test de scraping de TLDR AI via proxy

---

## Fase 3: A — Architect (Construcción)
- [ ] SOP `architecture/data-pipeline.md`
- [ ] SOP `architecture/dashboard-layout.md`
- [ ] `tools/feed-parser.js` — parser RSS/XML
- [ ] `tools/scraper.js` — scraping HTML
- [ ] `tools/storage.js` — abstracción localStorage
- [ ] `index.html` — layout del dashboard
- [ ] `src/style.css` — design system premium
- [ ] `src/main.js` — lógica principal

---

## Fase 4: S — Stylize (Refinamiento)
- [ ] Glassmorphism y animaciones pulidas
- [ ] Colores por fuente, tipografía moderna
- [ ] Responsive mobile/tablet/desktop
- [ ] Feedback del usuario

---

## Fase 5: T — Trigger (Despliegue)
- [ ] Auto-refresh con timestamps
- [ ] Documentación final en `gemini.md`
