import Groq from "groq-sdk";
import OpenAI from "openai";
import { getModelById } from "./models";

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

const nimClient = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// DeepSeek R1 uses chain-of-thought and needs more tokens
const MAX_TOKENS_BY_MODEL: Record<string, number> = {
  "nim-deepseek-r1-70b": 2000,
};
const DEFAULT_MAX_TOKENS = 1000;

export async function callModel(
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const model = getModelById(modelId);
  if (!model) throw new Error(`Model ${modelId} not found`);

  const maxTokens = MAX_TOKENS_BY_MODEL[modelId] ?? DEFAULT_MAX_TOKENS;
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    if (model.provider === "groq") {
      const res = await groqClient.chat.completions.create({
        model: model.apiModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      });
      return res.choices[0]?.message?.content ?? "";
    } else {
      const res = await nimClient.chat.completions.create({
        model: model.apiModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      });
      return res.choices[0]?.message?.content ?? "";
    }
  } catch (err) {
    console.error(`[llmClient] Error calling ${modelId}:`, err);
    return "";
  }
}
