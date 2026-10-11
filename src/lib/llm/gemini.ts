// Gemini, through Google's Gen AI SDK. One request per search: the tools are
// offered as functions, and the model is required to answer only with calls
// to them (mode ANY), which come back as the plan. The calls aren't sent back
// to the model; src/lib/search/ runs them.
//
// The API key is passed in by the Netlify Function, the only place that
// reads it (see CLAUDE.md).

import { FunctionCallingConfigMode, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Planner } from "./types.ts";

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
          // Picking searches needs little reasoning, and thinking adds time and cost
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          maxOutputTokens: 1024,
          abortSignal: signal,
        },
      });
      return (response.functionCalls ?? []).map((call) => ({ tool: call.name ?? "", args: call.args ?? {} }));
    },
  };
}
