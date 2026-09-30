-- Phase 81: member-scheduled tier changes (upgrade + the quiet downgrade).
-- pendingPlanId holds the plan the NEXT paid cycle runs on; the renew/verify
-- engine swaps planId → pendingPlanId when money lands. For a still-pending
-- membership request the API swaps planId immediately (nothing prorated —
-- no money has moved).
ALTER TABLE "Subscription" ADD COLUMN "pendingPlanId" TEXT;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_pendingPlanId_fkey"
  FOREIGN KEY ("pendingPlanId") REFERENCES "SubscriptionPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
