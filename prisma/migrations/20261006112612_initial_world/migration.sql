-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT NOT NULL,
    "bio" TEXT,
    "publicRepos" INTEGER NOT NULL,
    "followers" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "languages" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "worldX" INTEGER NOT NULL,
    "worldZ" INTEGER NOT NULL,
    "islandSize" DOUBLE PRECISION NOT NULL,
    "islandLevel" INTEGER NOT NULL,
    "totalCommits" INTEGER NOT NULL,
    "shipClass" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "stars" INTEGER NOT NULL,
    "forks" INTEGER NOT NULL,
    "commits" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Developer_githubLogin_key" ON "Developer"("githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "Port_developerId_key" ON "Port"("developerId");

-- CreateIndex
CREATE UNIQUE INDEX "Port_worldX_worldZ_key" ON "Port"("worldX", "worldZ");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubUrl_key" ON "Repository"("githubUrl");

-- CreateIndex
CREATE INDEX "Repository_developerId_idx" ON "Repository"("developerId");

-- AddForeignKey
ALTER TABLE "Port" ADD CONSTRAINT "Port_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
