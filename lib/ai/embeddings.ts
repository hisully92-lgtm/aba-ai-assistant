import { supabaseAdmin } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  // Anthropic doesn't have embeddings — use a simple hash-based fallback
  // or integrate OpenAI text-embedding-3-small here
  // For now returns empty array as placeholder
  console.info("[embeddings] embedding requested for text length:", text.length);
  return [];
}

export async function storeClientEmbedding(
  clientId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const embedding = await generateEmbedding(content);

  await supabaseAdmin.from("client_embeddings").insert({
    client_id: clientId,
    content,
    embedding: embedding.length > 0 ? embedding : null,
    metadata: metadata ?? {},
  });
}

export async function searchSimilarContent(
  clientId: string,
  query: string,
  limit = 5
): Promise<{ content: string; metadata: any }[]> {
  const { data } = await supabaseAdmin
    .from("client_embeddings")
    .select("content, metadata")
    .eq("client_id", clientId)
    .limit(limit);

  return data ?? [];
}