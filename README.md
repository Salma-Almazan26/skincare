# 🌸 K-Beauty Store & Admin Dashboard — Stylevana México Sync

Sistema Full Stack de comercio electrónico de alta fidelidad especializado en cosmética coreana para el mercado mexicano, con sincronización de catálogo y precios vía scraping desde **Stylevana México**, motor de precios con margen porcentual dinámico, checkout persistente hacia WhatsApp y panel administrativo protegido por JWT.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Backend & Servidor** | Node.js (v20+ / v24), TypeScript, Express.js |
| **Base de Datos & ORM** | SQLite (`dev.db`) con **Prisma ORM** (Compatible con PostgreSQL / MySQL / MariaDB) |
| **Scraping & Parsing** | Cheerio + emulación de cabeceras de navegación y fallback a Playwright |
| **Automatización** | `node-cron` programado a las **3:00 AM todos los días** (Zona Horaria: `America/Mexico_City`) |
| **Autenticación & Seguridad**| JWT (JSON Web Tokens) en cookies `HttpOnly` y cabeceras Bearer, hashing de contraseñas con `bcryptjs` |
| **Validación de Datos** | Zod schemas para validación estricta en checkout, login y configuración |
| **Frontend Tienda** | SPA reactiva con Tailwind CSS, FontAwesome 6, persistencia en `localStorage` y drawer de carrito |
| **Frontend Dashboard Admin** | SPA en `/admin` con métricas KPI, gestión de pedidos, switch de stock, motor de margen y logs de scraping |

---

## 📋 Arquitectura del Proyecto

```
Cosmetics/
├── prisma/
│   ├── schema.prisma            # Esquema Prisma con modelos: AdminUser, Product, Customer, Order, OrderItem, Config, ScrapingLog
│   └── seed.ts                  # Seeder inicial (Admin, configuraciones de margen, catálogo de Stylevana)
├── public/
│   ├── index.html               # Tienda web pública (catálogo, filtros, carrito, checkout a WhatsApp)
│   ├── admin.html               # Panel Administrativo protegido (KPIs, pedidos, productos, margen, scraping)
│   ├── css/
│   │   └── styles.css           # Estilos personalizados K-Beauty, glassmorphism, animaciones
│   └── js/
│       ├── store.js             # Lógica cliente tienda: carrito reactivo en localStorage, checkout
│       └── admin.js             # Lógica cliente admin: autenticación JWT, actualización de estados, sync manual
├── src/
│   ├── config/
│   │   └── environment.ts       # Validación y tipado de variables de entorno
│   ├── db/
│   │   └── prisma.ts            # Instancia singleton de PrismaClient
│   ├── middleware/
│   │   ├── auth.middleware.ts   # Middleware de validación JWT (HttpOnly cookie / Bearer)
│   │   └── error.middleware.ts  # Manejo centralizado de excepciones
│   ├── routes/
│   │   ├── catalog.routes.ts    # Endpoints públicos de productos, categorías y filtros
│   │   ├── order.routes.ts      # Checkout, creación de órdenes y seguimiento
│   │   ├── auth.routes.ts       # Login, logout y perfil de administrador
│   │   └── admin.routes.ts      # Rutas privadas (KPIs, cambio de estado de pedidos, margen, scraping)
│   ├── services/
│   │   ├── auth.service.ts      # Hashing bcrypt y generación/verificación JWT
│   │   ├── pricing.service.ts   # Motor de margen porcentual dinámico y recálculo masivo
│   │   ├── order.service.ts     # Lógica de creación de órdenes y congelación de unitPrice
│   │   ├── scraper.service.ts   # Scraper Stylevana México + fallback de resiliencia
│   │   └── whatsapp.service.ts  # Formateo de mensaje estético y generación de enlace wa.me
│   ├── cron/
│   │   └── scheduler.ts         # Tarea programada node-cron a las 3:00 AM
│   ├── app.ts                   # Configuración y middlewares de Express
│   └── server.ts                # Inicialización del servidor HTTP y graceful shutdown
├── .env                         # Variables de entorno activas
├── .env.example                 # Plantilla de variables de entorno
├── test-verify.ts               # Suite de pruebas automatizadas E2E
├── tsconfig.json                # Configuración del compilador TypeScript
└── package.json                 # Scripts y dependencias
```

---

## 🚀 Instalación y Puesta en Marcha

### 1. Variables de Entorno (`.env`)
El archivo `.env` ya viene configurado con valores predeterminados:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="kbeauty_jwt_super_secret_key_2026_stylevana_mexico"
STORE_WHATSAPP_PHONE="525512345678"
DEFAULT_MARGIN_PERCENT=30
STYLEVANA_BASE_URL="https://www.stylevana.com/es_MX"
CRON_SCHEDULE="0 3 * * *"
```

### 2. Inicializar la Base de Datos y Sembrar Datos
Ejecuta el script para sincronizar el esquema Prisma y sembrar el catálogo con margen aplicado:

```bash
npm run db:init
```

### 3. Ejecutar en Modo Desarrollo o Producción

**Modo Desarrollo (con recarga en caliente vía `tsx`):**
```bash
npm run dev
```

**Modo Producción (compilado TypeScript):**
```bash
npm run build
npm start
```

### 4. Ejecutar Suite de Pruebas
Verifica todos los componentes con la batería de pruebas end-to-end:
```bash
npm test
```

---

## 🔑 Credenciales del Panel Administrativo

- **URL del Panel:** `http://localhost:3000/admin`
- **Usuario:** `admin@kbeauty.mx`
- **Contraseña:** `Admin123!`

---

## ⚙️ Características Principales

### 1. Motor de Precios Dinámico
- El margen de ganancia porcentual se almacena en la tabla `Config` (`profit_margin_percentage`).
- Fórmula: `calculatedPrice = basePrice * (1 + margin / 100)`.
- Desde el **Admin Dashboard** (`/admin`), al modificar el margen (ej. de 30% a 35%), se puede marcar la opción para **recalcular automáticamente los precios de venta de todos los productos en la base de datos**.

### 2. Automatización con Cron Job (3:00 AM)
- `node-cron` configurado en `0 3 * * *` bajo la zona horaria `America/Mexico_City`.
- Cada ejecución crea un registro en `ScrapingLog` indicando `startedAt`, `completedAt`, `status` (`SUCCESS` / `FAILED` / `RUNNING`), cantidad de productos actualizados y mensaje de error si aplica.
- Botón de **"Sincronizar Catálogo Ahora"** en el panel administrativo para forzar la sincronización en cualquier momento.

### 3. Carrito y Checkout hacia WhatsApp
- Carrito persistente en `localStorage`.
- Formulario de checkout adaptado al formato de direcciones en México (Calle, N.º exterior e interior, Colonia, Código Postal, Ciudad, Estado, Referencias).
- Al confirmar el pedido:
  1. Se actualiza o crea el cliente en la base de datos (`Customer`).
  2. Se crea la orden con un número autoincremental (`#1001`, `#1002`, etc.) y estado `PENDING`.
  3. Se congelan los precios unitarios en `OrderItem`.
  4. Se genera la URL oficial `https://wa.me/<STORE_PHONE>?text=...` con el desglose del pedido formateado y se abre automáticamente en WhatsApp.

