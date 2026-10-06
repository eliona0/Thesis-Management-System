-- AlterTable
ALTER TABLE "Thesis" ADD COLUMN     "finalEvaluatedAt" TIMESTAMP(3),
ADD COLUMN     "finalGrade" DECIMAL(4,2),
ADD COLUMN     "mentorFinalEvaluation" TEXT;

-- AlterTable
ALTER TABLE "ThesisVersion" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);
