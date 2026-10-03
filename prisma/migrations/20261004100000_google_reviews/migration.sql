-- Task 87: Google reviews as the public testimonial source + the
-- review-ask anti-harassment memory.

-- CreateTable
CREATE TABLE "GoogleReview" (
    "id" TEXT NOT NULL,
    "googleKey" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "relativeTime" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'SYNC',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReview_googleKey_key" ON "GoogleReview"("googleKey");

-- CreateIndex
CREATE INDEX "GoogleReview_hidden_rating_idx" ON "GoogleReview"("hidden", "rating");

-- CreateTable
CREATE TABLE "ReviewAskState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asksTotal" INTEGER NOT NULL DEFAULT 0,
    "lastAskedAt" TIMESTAMP(3),
    "clickedThroughAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "lastOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewAskState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAskState_userId_key" ON "ReviewAskState"("userId");

-- AddForeignKey
ALTER TABLE "ReviewAskState" ADD CONSTRAINT "ReviewAskState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
