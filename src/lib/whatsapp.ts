// =============================================================================
// WhatsApp bridge (phase 61) — rider job notifications the Lagos way
// =============================================================================
// Nigerian gig riders trust WhatsApp more than any app notification. The
// owner wants WhatsApp messages for riders WITHOUT yet committing to the
// WhatsApp Business Platform (Meta verification, phone-number registration,
// per-conversation pricing). This module implements both halves of that:
//
// 1. THE BRIDGE (works TODAY, zero integration, zero cost):
//    wa.me click-to-chat deep links. The admin console gets a one-tap
//    "Send on WhatsApp" button after assigning a stop; WhatsApp opens with
//    the job brief pre-typed — the admin just taps send. The rider app also
//    gets a self-test ("send this number a test message") in Account →
//    Notifications. No API keys, no accounts, nothing to break.
//
// 2. THE FULL INTEGRATION (built, off until the owner turns it on):
//    sendWhatsApp() posts to the Meta WhatsApp Cloud API. It activates the
//    moment WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID appear in the
//    environment — assignment notifications then flow to riders
//    automatically with no code change. Until then it is a silent no-op
//    that logs once, so the production logs always tell the truth.
// =============================================================================

/** Normalise a Nigerian phone number to international digits (no +).
 *  Handles: 08124129296, 8124129296, +234 812 412 9296, 2348124129296.
 *  Non-Nigerian numbers that already carry a country code pass through. */
export function normalizeWaNumber(raw?: string | null): string | null {
  if (!raw) return null
  let digits = raw.replace(/[^\d+]/g, '')
  const hadPlus = digits.startsWith('+')
  digits = digits.replace(/\+/g, '')
  if (hadPlus) {
    // Already international — trust it.
    return digits || null
  }
  // Local Nigerian format: strip the leading 0 and prefix 234.
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  return digits || null
}

/** Build a wa.me click-to-chat link with a pre-typed message. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const number = normalizeWaNumber(phone)
  if (!number) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

/** The job brief a rider needs on WhatsApp when a stop is assigned —
 *  everything they act on, nothing they don't (no prices, no payment data). */
export function assignmentBrief(opts: {
  orderNumber: string
  leg: 'PICKUP' | 'DELIVERY'
  customerName?: string | null
  address: string
  slot: string
}): string {
  return [
    `Kozy Care — new ${opts.leg === 'PICKUP' ? 'PICKUP' : 'DELIVERY'} assigned 🛵`,
    `Order ${opts.orderNumber}`,
    `Customer: ${opts.customerName ?? 'customer'}`,
    `Address: ${opts.address}`,
    `When: ${opts.slot}`,
    `Open the rider app for the full stop: kozycare.ng/driver`,
  ].join('\n')
}

// -----------------------------------------------------------------------------
// Meta WhatsApp Cloud API (the real integration — env-gated)
// -----------------------------------------------------------------------------

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

let loggedOffOnce = false

/** Send a WhatsApp text via the Meta Cloud API. No-op (logged once) when the
 *  credentials are absent, so callers never need to branch. */
export async function sendWhatsApp(
  to: string | null | undefined,
  text: string
): Promise<{ sent: boolean; reason?: string }> {
  const number = normalizeWaNumber(to)
  if (!number) return { sent: false, reason: 'NO_NUMBER' }
  if (!whatsappConfigured()) {
    if (!loggedOffOnce) {
      console.log('[notify] WhatsApp Cloud API not configured — bridge mode (wa.me links only)')
      loggedOffOnce = true
    }
    return { sent: false, reason: 'NOT_CONFIGURED' }
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: number,
          type: 'text',
          text: { body: text },
        }),
      }
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[notify] WhatsApp send failed (${res.status}): ${body.slice(0, 300)}`)
      return { sent: false, reason: `HTTP_${res.status}` }
    }
    return { sent: true }
  } catch (e) {
    console.error('[notify] WhatsApp send error:', e)
    return { sent: false, reason: 'NETWORK' }
  }
}
