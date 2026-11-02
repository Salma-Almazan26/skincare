"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperService = exports.BRANDS = void 0;
const cheerio = __importStar(require("cheerio"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../db/prisma"));
const pricing_service_1 = require("./pricing.service");
/**
 * ScraperService (solo obtención de datos, sin datos inventados)
 *
 * - Trabaja por MARCA. La lista de URLs de producto de cada marca sale de
 *   data/brand-urls.json (se genera con scripts/build-brand-urls.ts a partir del sitemap).
 * - Cada dato (título, precio, imagen, disponibilidad) sale de la página real del producto.
 *   Si no se puede leer un precio real, el producto se omite. Nunca se inventa nada.
 * - La BD funciona como caché (TTL configurable). No se borra nada de la BD.
 * - Peticiones en serie, con pausa, timeout y 1 reintento.
 */
// ============ CONFIGURACIÓN ============
// slug = prefijo que usan las URLs del sitemap (/es_MX/<slug>-...). Ajusta esta lista.
exports.BRANDS = [
    { slug: 'cosrx', name: 'COSRX' },
    { slug: 'beauty-of-joseon', name: 'Beauty of Joseon' },
    { slug: 'anua', name: 'Anua' },
    { slug: 'skin1004', name: 'SKIN1004' },
    { slug: 'medicube', name: 'medicube' },
    { slug: 'round-lab', name: 'Round Lab' },
    { slug: 'torriden', name: 'Torriden' },
    { slug: 'biodance', name: 'Biodance' },
    { slug: 'laneige', name: 'LANEIGE' },
    { slug: 'romand', name: 'Romand' },
];
const BRAND_URLS_FILE = process.env.BRAND_URLS_FILE || path_1.default.join(process.cwd(), 'data', 'brand-urls.json');
const TTL_MS = Number(process.env.SCRAPER_TTL_HOURS || 12) * 60 * 60 * 1000;
const DELAY_MS = Number(process.env.SCRAPER_DELAY_MS || 1500);
const TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS || 15000);
const MAX_PER_SYNC = Number(process.env.SCRAPER_MAX_PER_SYNC || 60);
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ============ SERVICIO ============
class ScraperService {
    static queue = Promise.resolve();
    static lastRequestAt = 0;
    static inFlight = new Map();
    // ---------- Red ----------
    /** Encola la petición: una a la vez, con pausa mínima entre ellas. */
    static schedule(fn) {
        const run = this.queue.then(async () => {
            const wait = Math.max(0, this.lastRequestAt + DELAY_MS - Date.now());
            if (wait > 0)
                await sleep(wait);
            try {
                return await fn();
            }
            finally {
                this.lastRequestAt = Date.now();
            }
        });
        this.queue = run.catch(() => undefined);
        return run;
    }
    static async fetchOnce(url) {
        const response = await fetch(url, {
            headers: HEADERS,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const blocked = response.status === 403 || response.headers.get('cf-mitigated') === 'challenge';
        if (!response.ok)
            return { html: null, status: response.status, blocked };
        return { html: await response.text(), status: response.status, blocked: false };
    }
    /** Descarga una URL con 1 reintento (solo en error de red o 5xx). */
    static async fetchHtml(url) {
        const attempt = async () => {
            try {
                return await this.schedule(() => this.fetchOnce(url));
            }
            catch {
                return { html: null, status: 0, blocked: false };
            }
        };
        let result = await attempt();
        if (!result.html && !result.blocked && (result.status === 0 || result.status >= 500)) {
            await sleep(3000);
            result = await attempt();
        }
        return result;
    }
    // ---------- Parseo ----------
    static findProductNode(node) {
        if (!node)
            return null;
        if (Array.isArray(node)) {
            for (const n of node) {
                const f = this.findProductNode(n);
                if (f)
                    return f;
            }
            return null;
        }
        if (typeof node === 'object') {
            const type = node['@type'];
            const isProduct = Array.isArray(type) ? type.includes('Product') : type === 'Product';
            if (isProduct)
                return node;
            if (node['@graph'])
                return this.findProductNode(node['@graph']);
        }
        return null;
    }
    static toPrice(value) {
        if (value === undefined || value === null)
            return null;
        const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    /**
     * Extrae los datos reales de una página de producto.
     * Prioridad: JSON-LD (@type Product) -> metaetiquetas Open Graph/product.
     * Devuelve null si no hay un precio real (no se inventa nada).
     */
    static parseProductPage(html, url, brandName) {
        const $ = cheerio.load(html);
        let ld = null;
        $('script[type="application/ld+json"]').each((_, el) => {
            if (ld)
                return;
            try {
                const found = this.findProductNode(JSON.parse($(el).contents().text()));
                if (found)
                    ld = found;
            }
            catch {
                // JSON-LD inválido: se ignora
            }
        });
        let title = '';
        let price = null;
        let currency;
        let image = null;
        let inStock = true;
        if (ld) {
            title = String(ld.name || '').trim();
            const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
            price = this.toPrice(offer?.price ?? offer?.lowPrice);
            currency = offer?.priceCurrency;
            const img = Array.isArray(ld.image) ? ld.image[0] : ld.image;
            image = typeof img === 'string' ? img : img?.url || null;
            const availability = String(offer?.availability || '');
            if (availability)
                inStock = /InStock/i.test(availability);
        }
        // Respaldo con metaetiquetas (solo para lo que falte)
        if (!title)
            title = ($('meta[property="og:title"]').attr('content') || '').trim();
        if (price === null) {
            price = this.toPrice($('meta[property="product:price:amount"]').attr('content'));
            currency = currency || $('meta[property="product:price:currency"]').attr('content');
        }
        if (!image)
            image = $('meta[property="og:image"]').attr('content') || null;
        if (!title || price === null)
            return null;
        if (currency && currency.toUpperCase() !== 'MXN')
            return null; // solo precios en MXN
        const slugMatch = url.match(/\/([^/]+)\.html/);
        if (!slugMatch)
            return null;
        return {
            externalId: slugMatch[1],
            title,
            brand: brandName,
            category: brandName,
            stylevanaUrl: url,
            imageUrl: image,
            basePrice: price,
            inStock,
        };
    }
    // ---------- Datos de marcas ----------
    static loadBrandUrls() {
        if (!fs_1.default.existsSync(BRAND_URLS_FILE)) {
            throw new Error(`No existe ${BRAND_URLS_FILE}. Genera el archivo con scripts/build-brand-urls.ts`);
        }
        return JSON.parse(fs_1.default.readFileSync(BRAND_URLS_FILE, 'utf-8'));
    }
    static slugFromUrl(url) {
        const m = url.match(/\/([^/]+)\.html/);
        return m ? m[1] : url;
    }
    // ---------- Guardado ----------
    static async saveProduct(item, margin) {
        const calculatedPrice = pricing_service_1.PricingService.computePrice(item.basePrice, margin);
        const data = {
            title: item.title,
            brand: item.brand,
            category: item.category,
            stylevanaUrl: item.stylevanaUrl,
            imageUrl: item.imageUrl ?? '', // si tu esquema permite null, cambia a: item.imageUrl
            basePrice: item.basePrice,
            calculatedPrice,
            inStock: item.inStock,
        };
        return prisma_1.default.product.upsert({
            where: { externalId: item.externalId },
            update: data,
            create: { externalId: item.externalId, ...data },
        });
    }
    /** Descarga y guarda UN producto. Evita peticiones duplicadas simultáneas. */
    static refreshProduct(url, brandName, margin) {
        const existing = this.inFlight.get(url);
        if (existing)
            return existing;
        const job = (async () => {
            const { html, status, blocked } = await this.fetchHtml(url);
            if (!html)
                return { ok: false, blocked, reason: `HTTP ${status || 'sin respuesta'}` };
            const parsed = this.parseProductPage(html, url, brandName);
            if (!parsed)
                return { ok: false, blocked: false, reason: 'No se encontró precio real' };
            await this.saveProduct(parsed, margin);
            return { ok: true, blocked: false };
        })().finally(() => this.inFlight.delete(url));
        this.inFlight.set(url, job);
        return job;
    }
    // ---------- API pública ----------
    /**
     * Productos de una marca, paginados. Usa la BD como caché; solo consulta
     * a Stylevana los productos de esta página que falten o estén vencidos.
     * Requiere que Product tenga el campo updatedAt (@updatedAt).
     */
    static async getBrandPage(brandSlug, page = 1, pageSize = 12) {
        const brand = exports.BRANDS.find((b) => b.slug === brandSlug);
        if (!brand)
            throw new Error(`Marca no configurada: ${brandSlug}`);
        const allUrls = this.loadBrandUrls()[brandSlug] || [];
        const totalPages = Math.max(1, Math.ceil(allUrls.length / pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const urls = allUrls.slice((safePage - 1) * pageSize, safePage * pageSize);
        const ids = urls.map((u) => this.slugFromUrl(u));
        const cached = await prisma_1.default.product.findMany({ where: { externalId: { in: ids } } });
        const cachedMap = new Map(cached.map((p) => [p.externalId, p]));
        const isFresh = (p) => Date.now() - new Date(p.updatedAt).getTime() < TTL_MS;
        const toRefresh = urls.filter((u) => {
            const p = cachedMap.get(this.slugFromUrl(u));
            return !p || !isFresh(p);
        });
        let stale = false;
        if (toRefresh.length > 0) {
            const margin = await pricing_service_1.PricingService.getActiveMargin();
            for (const url of toRefresh) {
                const res = await this.refreshProduct(url, brand.name, margin);
                if (!res.ok) {
                    stale = true;
                    console.warn(`[scraper] ${url} -> ${res.reason}`);
                    if (res.blocked)
                        break; // Cloudflare bloqueó: no insistir
                }
            }
        }
        // Se devuelve lo que haya en BD (fresco o viejo), en el orden de la marca
        const final = await prisma_1.default.product.findMany({ where: { externalId: { in: ids } } });
        const byId = new Map(final.map((p) => [p.externalId, p]));
        const products = ids.map((id) => byId.get(id)).filter(Boolean);
        return { products, page: safePage, totalPages, fromCache: toRefresh.length === 0, stale };
    }
    /**
     * Sincronización por lotes: refresca productos faltantes o vencidos de todas
     * las marcas, hasta MAX_PER_SYNC por ejecución. No borra nada de la BD.
     */
    static async runSync(triggeredBy = 'MANUAL') {
        const log = await prisma_1.default.scrapingLog.create({
            data: { startedAt: new Date(), status: 'RUNNING' },
        });
        try {
            const margin = await pricing_service_1.PricingService.getActiveMargin();
            const brandUrls = this.loadBrandUrls();
            let attempted = 0;
            let saved = 0;
            let blockedByCloudflare = false;
            const failures = [];
            outer: for (const brand of exports.BRANDS) {
                const urls = brandUrls[brand.slug] || [];
                const ids = urls.map((u) => this.slugFromUrl(u));
                const cached = await prisma_1.default.product.findMany({
                    where: { externalId: { in: ids } },
                    select: { externalId: true, updatedAt: true },
                });
                const freshIds = new Set(cached
                    .filter((p) => Date.now() - new Date(p.updatedAt).getTime() < TTL_MS)
                    .map((p) => p.externalId));
                for (const url of urls) {
                    if (freshIds.has(this.slugFromUrl(url)))
                        continue;
                    if (attempted >= MAX_PER_SYNC)
                        break outer;
                    attempted++;
                    const res = await this.refreshProduct(url, brand.name, margin);
                    if (res.ok) {
                        saved++;
                    }
                    else {
                        failures.push(`${url} (${res.reason})`);
                        if (res.blocked) {
                            blockedByCloudflare = true;
                            break outer;
                        }
                    }
                }
            }
            const failed = attempted > 0 && saved === 0;
            const detail = failures.length > 0
                ? `${blockedByCloudflare ? 'Cloudflare bloqueó la conexión. ' : ''}Fallaron ${failures.length} de ${attempted}. Ejemplos: ${failures
                    .slice(0, 3)
                    .join(' | ')}`
                : null;
            await prisma_1.default.scrapingLog.update({
                where: { id: log.id },
                data: {
                    completedAt: new Date(),
                    status: failed ? 'FAILED' : 'SUCCESS',
                    productsUpserted: saved,
                    errorMessage: detail,
                },
            });
            return {
                success: !failed,
                productsUpserted: saved,
                logId: log.id,
                message: `Sincronización (${triggeredBy}): ${saved} productos reales guardados de ${attempted} intentados, margen ${margin}%.${detail ? ' ' + detail : ''}`,
                errorMessage: failed ? detail || 'No se obtuvo ningún producto real' : undefined,
            };
        }
        catch (error) {
            const errorMsg = error?.message || 'Error inesperado durante la sincronización';
            await prisma_1.default.scrapingLog.update({
                where: { id: log.id },
                data: {
                    completedAt: new Date(),
                    status: 'FAILED',
                    productsUpserted: 0,
                    errorMessage: errorMsg,
                },
            });
            return { success: false, productsUpserted: 0, logId: log.id, errorMessage: errorMsg };
        }
    }
}
exports.ScraperService = ScraperService;
