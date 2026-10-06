CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "anonymousId" TEXT,
    "githubLogin" TEXT,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IndexerState" (
    "key" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");
CREATE INDEX "AnalyticsEvent_anonymousId_createdAt_idx" ON "AnalyticsEvent"("anonymousId", "createdAt");
CREATE INDEX "AnalyticsEvent_githubLogin_createdAt_idx" ON "AnalyticsEvent"("githubLogin", "createdAt");
