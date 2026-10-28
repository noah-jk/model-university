// Gemini, through Google's Gen AI SDK. One request per search: the tools are
// offered as functions, and the model is required to answer only with calls
// to them (mode ANY), which come back as the plan. The calls aren't sent back
// to the model; src/lib/search/ runs them.
//
// The API key is passed in by the Netlify Function, the only place that
// reads it (see CLAUDE.md).

import { FunctionCallingConfigMode, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Planner, Summarizer } from "./types.ts";

// How much the model thinks before answering. Picking searches and writing a
// two-sentence summary need little, and thinking adds time and cost. LOW is
// the least this model accepts: it rejects MINIMAL with a 400 ("Thinking
// level MINIMAL is not supported for this model"), which sent every search to
// keyword search.
const THINKING = { thinkingLevel: ThinkingLevel.LOW };

export function geminiPlanner(apiKey: string, model: string): Planner {
  const ai = new GoogleGenAI({ apiKey });
  return {
    name: model,
    async plan({ system, query, context, tools, signal }) {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: context ? `${query}\n\n(${context})` : query }] }],
        config: {
          systemInstruction: system,
          tools: [{ functionDeclarations: tools.map(({ name, description, parameters }) => ({ name, description, parametersJsonSchema: parameters })) }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
          thinkingConfig: THINKING,
          maxOutputTokens: 1024,
          abortSignal: signal,
        },
      });
      return (response.functionCalls ?? []).map((call) => ({ tool: call.name ?? "", args: call.args ?? {} }));
    },
  };
}

// The AI summary: one request that must answer with JSON in a fixed shape
export function geminiSummarizer(apiKey: string, model: string): Summarizer {
  const ai = new GoogleGenAI({ apiKey });
  return {
    name: model,
    async summarize({ system, prompt, signal }) {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: { text: { type: "string" }, sources: { type: "array", items: { type: "integer" } } },
            required: ["text", "sources"],
          },
          thinkingConfig: THINKING,
          // Room for any thinking as well as the JSON, so the JSON isn't cut off
          maxOutputTokens: 1024,
          abortSignal: signal,
        },
      });
      return JSON.parse(response.text ?? "null");
    },
  };
}
