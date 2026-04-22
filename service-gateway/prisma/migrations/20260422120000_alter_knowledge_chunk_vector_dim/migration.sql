-- Change embedding dimension from 1536 (OpenAI) to 384 (sentence-transformers/all-MiniLM-L6-v2)
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "embedding" TYPE vector(384);
