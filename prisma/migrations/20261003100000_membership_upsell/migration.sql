-- Task 86: the checkout-to-membership conversion engine.
-- MembershipUpsellLog — one row per conversion email sent to a customer
-- (the monthly "your spend says a plan would fit" pitch). The sweep's
-- cadence (30-day gap, band re-check) reads straight from this table.

-- CreateTable
CREATE TABLE "MembershipUpsellLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "spendBand" TEXT NOT NULL,
    "spendWindowDays" INTEGER NOT NULL DEFAULT 60,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipUpsellLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipUpsellLog_userId_sentAt_idx" ON "MembershipUpsellLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "MembershipUpsellLog_sentAt_idx" ON "MembershipUpsellLog"("sentAt");

-- AddForeignKey
ALTER TABLE "MembershipUpsellLog" ADD CONSTRAINT "MembershipUpsellLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
