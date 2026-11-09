-- CreateTable
CREATE TABLE "github_person" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "name" TEXT,
    "displayName" VARCHAR(100),
    "bio" TEXT,
    "company" TEXT,
    "location" TEXT,
    "blog" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "publicRepos" INTEGER NOT NULL,
    "followers" INTEGER NOT NULL,
    "following" INTEGER NOT NULL,
    "githubCreatedAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_person_githubId_key" ON "github_person"("githubId");

-- CreateIndex
CREATE INDEX "github_person_createdAt_id_idx" ON "github_person"("createdAt", "id");

