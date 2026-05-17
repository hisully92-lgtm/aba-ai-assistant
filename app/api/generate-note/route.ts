import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a Board Certified Behavior Analyst (BCBA) AI assistant.

You generate professional ABA content based on the user's request.

You may be asked to produce:

1. ABA session notes
2. Behavior intervention strategies
3. Skill acquisition programs

Rules:
- Always use professional ABA terminology
- Be structured and clinically appropriate
- Adapt formatting to the type of request
- If writing session notes, use standard ABA note structure
- If writing interventions, list strategies clearly and practically
- If writing skill programs, include teaching steps, prompts, and reinforcement strategies
- Do NOT invent specific data unless the user provides it
`
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return NextResponse.json({
      result: response.choices[0].message.content,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}