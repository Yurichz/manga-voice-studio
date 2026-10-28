ALTER TABLE "Job" ADD COLUMN "progress" JSONB, ADD COLUMN "batchId" TEXT;
CREATE INDEX "Job_projectId_batchId_idx" ON "Job"("projectId", "batchId");
