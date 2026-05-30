-- Migration 029: add provider column to ai_generations
-- Tracks which AI provider was used (claude / groq / qwen).
-- Existing rows default to 'claude' since that was the only provider.

ALTER TABLE public.ai_generations
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'claude';

-- Loose constraint — new providers can be added without a migration.
ALTER TABLE public.ai_generations
  ADD CONSTRAINT ai_generations_provider_check
    CHECK (provider IN ('claude', 'groq', 'qwen'));

COMMENT ON COLUMN public.ai_generations.provider IS
  'AI provider used for this generation (claude | groq | qwen). Defaults to claude.';
