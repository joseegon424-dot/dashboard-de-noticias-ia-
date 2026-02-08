# 🚀 Despliegue del Backend AI Pulse (Modal)

Para activar el backend que procesa las noticias diariamente, sigue estos pasos:

## 1. Autenticación en Modal
Si no lo has hecho, autentica tu terminal con Modal:

```bash
modal setup
```
Sigue las instrucciones en el navegador.

## 2. Desplegar el Backend
Ejecuta el siguiente comando para subir el código a la nube de Modal:

```bash
modal deploy backend/news_aggregator.py
```

Al finalizar, verás un output parecido a este:

```
✓ Created objects...
├── 🔨 Created mount...
└── ⚡ Created web endpoint: https://usuario-ai-pulse-news-get-news.modal.run
```

**COPIA esa URL.** Esta es tu API de noticias.

## 3. Conectar el Frontend
Abre el archivo `.env` en la raíz del proyecto y pega tu URL:

```env
VITE_API_URL=https://tu-url-copiada.modal.run
```

## 4. Probar
Reinicia tu servidor de desarrollo si estaba corriendo:

```bash
npm run dev
```

¡Listo! El dashboard ahora consume noticias procesadas en la nube.
