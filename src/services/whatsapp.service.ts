import prisma from '../db/prisma';
import { ENV } from '../config/environment';

export interface OrderItemDetail {
  title: string;
  quantity: number;
  unitPrice: number;
}

export interface WhatsAppOrderData {
  orderNumber: number;
  totalAmount: number;
  customer: {
    name: string;
    phone: string;
    street: string;
    exteriorNumber: string;
    interiorNumber?: string | null;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    references?: string | null;
  };
  items: OrderItemDetail[];
}

export class WhatsAppService {
  private static readonly PHONE_KEY = 'store_whatsapp_phone';

  /**
   * Obtiene el número de teléfono configurado para la tienda
   */
  static async getStorePhone(): Promise<string> {
    const config = await prisma.config.findUnique({
      where: { key: this.PHONE_KEY },
    });

    let rawPhone = config?.value || ENV.STORE_WHATSAPP_PHONE;
    // Normalizar dígitos
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.length === 10) {
      // Formato México 10 dígitos -> prefijo 52
      digits = `52${digits}`;
    }
    return digits;
  }

  /**
   * Formatea el mensaje del pedido con estética visual para WhatsApp
   */
  static formatOrderMessage(data: WhatsAppOrderData): string {
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsFormatted = data.items
      .map((item, index) => {
        const subtotal = (item.quantity * item.unitPrice).toFixed(2);
        return `${index + 1}. *${item.title}*\n   ▫️ Cantidad: ${item.quantity} × $${item.unitPrice.toFixed(2)} MXN\n   ▫️ Subtotal: *$${subtotal} MXN*`;
      })
      .join('\n\n');

    const addressParts = [
      `Calle ${data.customer.street} #${data.customer.exteriorNumber}${data.customer.interiorNumber ? ` Int. ${data.customer.interiorNumber}` : ''}`,
      `Colonia: ${data.customer.neighborhood}`,
      `Ciudad: ${data.customer.city}, ${data.customer.state}`,
      `C.P.: ${data.customer.postalCode}`,
    ];

    if (data.customer.references && data.customer.references.trim()) {
      addressParts.push(`Referencias: _${data.customer.references.trim()}_`);
    }

    const message = `✨ *¡NUEVO PEDIDO CONFIRMADO!* ✨
🌸 *K-BEAUTY STORE MÉXICO*
━━━━━━━━━━━━━━━━━━━━━━
📋 *Orden N.º:* #${data.orderNumber}
🕒 *Fecha:* ${dateFormatted}

👤 *DATOS DEL CLIENTE:*
• *Nombre:* ${data.customer.name}
• *WhatsApp:* ${data.customer.phone}

📍 *DIRECCIÓN DE ENTREGA:*
${addressParts.map(p => `• ${p}`).join('\n')}

🛍️ *PRODUCTOS SOLICITADOS:*
${itemsFormatted}

━━━━━━━━━━━━━━━━━━━━━━
💰 *TOTAL A PAGAR:* *$${data.totalAmount.toFixed(2)} MXN*
━━━━━━━━━━━━━━━━━━━━━━

Hola, acabo de registrar mi pedido en la tienda web con el número *#${data.orderNumber}*. ¿Me podrían confirmar las opciones de pago y tiempo de envío? ¡Muchas gracias! 💕`;

    return message;
  }

  /**
   * Genera el enlace directo a WhatsApp (https://wa.me/...)
   */
  static async generateOrderLink(data: WhatsAppOrderData): Promise<string> {
    const storePhone = await this.getStorePhone();
    const message = this.formatOrderMessage(data);
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${storePhone}?text=${encoded}`;
  }

  /**
   * Genera enlace para que el administrador contacte al cliente directamente
   */
  static generateCustomerContactLink(customerPhone: string, orderNumber: number, customerName: string): string {
    let digits = customerPhone.replace(/\D/g, '');
    if (digits.length === 10) {
      digits = `52${digits}`;
    }
    const message = `Hola ${customerName}, te contactamos de *K-Beauty Store* con respecto a tu orden *#${orderNumber}*. ¡Con gusto estamos dando seguimiento a tu pedido!`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
}

