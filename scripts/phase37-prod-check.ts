// Phase 37 pre-deploy safety check: verify production has ZERO campaigns
// (so the daily cron can never send anything after deploy).
import { db } from '../src/lib/db'

async function main() {
  const [campaigns, scheduled, subscribers, pendingRecipients] = await Promise.all([
    db.newsletterCampaign.count(),
    db.newsletterCampaign.count({ where: { status: 'SCHEDULED' } }),
    db.newsletterSubscriber.count({ where: { optIn: true } }),
    db.newsletterRecipient.count({ where: { deliveryStatus: 'PENDING' } }),
  ])
  console.log(JSON.stringify({ campaigns, scheduled, subscribers, pendingRecipients }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
