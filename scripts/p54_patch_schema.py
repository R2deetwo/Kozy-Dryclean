#!/usr/bin/env python3
"""Phase 54: rewrite the RiderApplication model block in prisma/schema.prisma
and add the two back-relations on User. Line-matching patch (the Edit tool's
old_str keeps failing on this file — transport eats characters)."""

import re, io

SCHEMA = "/home/z/my-project/prisma/schema.prisma"
with io.open(SCHEMA, "r", encoding="utf-8") as f:
    src = f.read()

# --- 1. Replace the RiderApplication model block (from its banner comment
#        down to the closing brace before the PRICE_CATALOG banner) ---
pattern = re.compile(
    r"// =+\n// RIDER_APPLICATION[^\n]*\n// =+\nmodel RiderApplication \{.*?\n\}\n",
    re.DOTALL,
)
m = pattern.search(src)
if not m:
    raise SystemExit("FAIL: RiderApplication block not found")

new_block = """// =====================================================
// RIDER_APPLICATION — driver recruitment applications
// Phase 54: this table is now the full onboarding pipeline.
//   Public: /join-riders collects the application -> the rider gets a
//   confirmation email/SMS with their reference code (refCode).
//   Admin: the console's Riders tab reviews it -> APPROVE creates (or
//   links) a DRIVER account, emails the rider their credentials +
//   onboarding steps, and records userId + reviewedAt. REJECT keeps the
//   row for the audit trail with an internal decisionNote.
// =====================================================
model RiderApplication {
  id            String   @id @default(cuid())
  // Short human reference like KZR-7F2K, generated at submission — shown
  // to the rider in their confirmation email and to the admin in the
  // review list (nobody should quote a 25-char cuid on a phone call).
  refCode       String?  @unique
  fullName      String
  email         String?
  phone         String
  altPhone      String?
  address       String
  lga           String   // preferred area
  bikeModel     String
  bikeYear      String
  licenseNumber String
  availability  String   @default("full-time")
  experience    String?
  consent       Boolean  @default(false)
  status        String   @default("PENDING") // PENDING, REVIEWED, APPROVED, REJECTED
  // The DRIVER account created at approval (null until approved).
  userId        String?
  user          User?    @relation("RiderApplications", fields: [userId], references: [id])
  // Who decided + when (audit trail for the owner).
  reviewedById  String?
  reviewedBy    User?    @relation("RiderApplicationReviews", fields: [reviewedById], references: [id])
  reviewedAt    DateTime?
  // Internal-only note on the decision (e.g. why a rejection happened).
  // Never shown to the applicant — the team communicates declines themselves.
  decisionNote  String?
  createdAt     DateTime @default(now())

  @@index([status])
  @@index([createdAt])
}
"""

src = src[: m.start()] + new_block + src[m.end():]

# --- 2. Add back-relations on User (after the existing referralCode field) ---
if "riderApplications" not in src:
    anchor = """  // ----- Referrals (phase 52) -----
  // This customer's personal referral code (one max — created when they
  // reach the 10-order service milestone).
  referralCode      ReferralCode?
"""
    if anchor not in src:
        # fall back: match the single line
        anchor = "  referralCode      ReferralCode?\n"
    if anchor not in src:
        raise SystemExit("FAIL: User anchor not found")
    addition = anchor + """  // ----- Rider recruitment (phase 54) -----
  // DRIVER account created when a rider application is approved.
  riderApplications     RiderApplication[]      @relation("RiderApplications")
  // Applications this admin reviewed/decided (audit trail).
  reviewedRiderApps     RiderApplication[]      @relation("RiderApplicationReviews")
"""
    src = src.replace(anchor, addition, 1)

with io.open(SCHEMA, "w", encoding="utf-8") as f:
    f.write(src)

print("OK — schema patched")
print("riderApplications on User:", "riderApplications" in src)
print("refCode on RiderApplication:", "refCode" in src)
