CREATE EXTENSION IF NOT EXISTS vector;
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "textLanguage" TEXT NOT NULL DEFAULT 'ru',
    "speechLanguage" TEXT NOT NULL DEFAULT 'Russian',
    "readingDirection" TEXT NOT NULL DEFAULT 'rtl',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "readingDirection" TEXT,
    "narratorVoiceVersionId" TEXT,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "previewKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "transform" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Panel" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bbox" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "Panel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utterance" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "panelId" TEXT,
    "bbox" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'dialogue',
    "originalText" TEXT NOT NULL,
    "spokenText" TEXT NOT NULL,
    "characterId" TEXT,
    "voiceVersionId" TEXT,
    "activeAudioId" TEXT,
    "pauseMs" INTEGER NOT NULL DEFAULT 300,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "reviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Utterance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "defaultVoiceVersionId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterReference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "cropKey" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "bbox" JSONB NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "encoderRevision" TEXT,
    "embedding" vector(768),

    CONSTRAINT "CharacterReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterAppearance" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bbox" JSONB NOT NULL,
    "candidates" JSONB NOT NULL,
    "confirmedCharacterId" TEXT,

    CONSTRAINT "CharacterAppearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceProfileVersion" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "referenceKey" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "modelRevision" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inputRevision" INTEGER NOT NULL,
    "modelRevision" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "proposal" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attemptToken" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "utteranceId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "fileKey" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "sampleRate" INTEGER NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "modelRevision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterRender" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inputRevision" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterRender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterMerge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "assignments" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Project_ownerId_deletedAt_idx" ON "Project"("ownerId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_ownerId_key" ON "Project"("id", "ownerId");

-- CreateIndex
CREATE INDEX "Chapter_projectId_order_idx" ON "Chapter"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_id_projectId_key" ON "Chapter"("id", "projectId");

-- CreateIndex
CREATE INDEX "Page_chapterId_order_idx" ON "Page"("chapterId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Page_id_projectId_key" ON "Page"("id", "projectId");

-- CreateIndex
CREATE INDEX "Panel_pageId_order_idx" ON "Panel"("pageId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Panel_id_pageId_projectId_key" ON "Panel"("id", "pageId", "projectId");

-- CreateIndex
CREATE INDEX "Utterance_pageId_order_idx" ON "Utterance"("pageId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Character_id_projectId_key" ON "Character"("id", "projectId");

-- CreateIndex
CREATE INDEX "CharacterReference_characterId_idx" ON "CharacterReference"("characterId");

-- CreateIndex
CREATE INDEX "CharacterAppearance_pageId_idx" ON "CharacterAppearance"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceProfile_id_projectId_key" ON "VoiceProfile"("id", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceProfileVersion_id_projectId_key" ON "VoiceProfileVersion"("id", "projectId");

-- CreateIndex
CREATE INDEX "Job_status_updatedAt_idx" ON "Job"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_projectId_kind_idempotencyKey_key" ON "Job"("projectId", "kind", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_jobId_key" ON "OutboxEvent"("jobId");

-- CreateIndex
CREATE INDEX "OutboxEvent_deliveredAt_createdAt_idx" ON "OutboxEvent"("deliveredAt", "createdAt");

-- CreateIndex
CREATE INDEX "AudioArtifact_projectId_utteranceId_idx" ON "AudioArtifact"("projectId", "utteranceId");

-- CreateIndex
CREATE UNIQUE INDEX "AudioArtifact_projectId_inputHash_key" ON "AudioArtifact"("projectId", "inputHash");

-- CreateIndex
CREATE INDEX "ChapterRender_chapterId_createdAt_idx" ON "ChapterRender"("chapterId", "createdAt");

-- CreateIndex
CREATE INDEX "CharacterMerge_projectId_createdAt_idx" ON "CharacterMerge"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_narratorVoiceVersionId_projectId_fkey" FOREIGN KEY ("narratorVoiceVersionId", "projectId") REFERENCES "VoiceProfileVersion"("id", "projectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_chapterId_projectId_fkey" FOREIGN KEY ("chapterId", "projectId") REFERENCES "Chapter"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Panel" ADD CONSTRAINT "Panel_pageId_projectId_fkey" FOREIGN KEY ("pageId", "projectId") REFERENCES "Page"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utterance" ADD CONSTRAINT "Utterance_pageId_projectId_fkey" FOREIGN KEY ("pageId", "projectId") REFERENCES "Page"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utterance" ADD CONSTRAINT "Utterance_panelId_pageId_projectId_fkey" FOREIGN KEY ("panelId", "pageId", "projectId") REFERENCES "Panel"("id", "pageId", "projectId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Utterance" ADD CONSTRAINT "Utterance_characterId_projectId_fkey" FOREIGN KEY ("characterId", "projectId") REFERENCES "Character"("id", "projectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utterance" ADD CONSTRAINT "Utterance_voiceVersionId_projectId_fkey" FOREIGN KEY ("voiceVersionId", "projectId") REFERENCES "VoiceProfileVersion"("id", "projectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_defaultVoiceVersionId_projectId_fkey" FOREIGN KEY ("defaultVoiceVersionId", "projectId") REFERENCES "VoiceProfileVersion"("id", "projectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterReference" ADD CONSTRAINT "CharacterReference_characterId_projectId_fkey" FOREIGN KEY ("characterId", "projectId") REFERENCES "Character"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAppearance" ADD CONSTRAINT "CharacterAppearance_pageId_projectId_fkey" FOREIGN KEY ("pageId", "projectId") REFERENCES "Page"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfile" ADD CONSTRAINT "VoiceProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfileVersion" ADD CONSTRAINT "VoiceProfileVersion_profileId_projectId_fkey" FOREIGN KEY ("profileId", "projectId") REFERENCES "VoiceProfile"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_pageId_projectId_fkey" FOREIGN KEY ("pageId", "projectId") REFERENCES "Page"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_projectId_ownerId_fkey" FOREIGN KEY ("projectId", "ownerId") REFERENCES "Project"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioArtifact" ADD CONSTRAINT "AudioArtifact_projectId_ownerId_fkey" FOREIGN KEY ("projectId", "ownerId") REFERENCES "Project"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterRender" ADD CONSTRAINT "ChapterRender_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

