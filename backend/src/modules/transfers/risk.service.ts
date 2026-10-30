import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface RiskAssessment {
  score: number;
  reasons: string[];
  action: "ALLOW" | "REVIEW";
}

export async function assessRisk(
  fromAccountId: string,
  amountMinor: number,
): Promise<RiskAssessment> {
  let score = 0;
  const reasons: string[] = [];

  // 1. Existing rule-based risk assessment
  if (amountMinor > 10_000_000) {
    score += 60;
    reasons.push(
      `🚨 System Alert: Extremely high-value transfer (₹${(
        amountMinor / 100
      ).toLocaleString("en-IN")})`,
    );
  } else if (amountMinor > 500_000) {
    score += 40;
    reasons.push(
      `⚠️ System Alert: High-value transfer (₹${(
        amountMinor / 100
      ).toLocaleString("en-IN")})`,
    );
  }

  // 2. AI-generated risk reasoning using Groq
  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: `
You are a financial transaction risk analyst.
Use only the information provided.
A high amount alone does not prove fraud.
Do not invent account history or suspicious behavior.

Return exactly two concise bullet points in plain text:
- Transaction risk assessment.
- Recommended verification or action.

Do not return JSON.
          `.trim(),
        },
        {
          role: "user",
          content: `
Source account ID: ${fromAccountId}
Transaction amount: ₹${(amountMinor / 100).toLocaleString("en-IN")}
Rule-based risk score: ${score}/100
Existing risk alerts: ${reasons.join("; ") || "No rule-based alerts"}

Explain the risk based on the available information and recommend
what should be verified before approving the transfer.
          `.trim(),
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 300,
    });

    const aiResponse = completion.choices[0]?.message?.content?.trim();

    if (aiResponse) {
      const points = aiResponse
        .split("\n")
        .map((line) => line.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
        .filter(Boolean);

      reasons.push(...(points.length > 0 ? points : [aiResponse]));
    } else {
      reasons.push("⚠️ AI returned an empty response. Manual review required.");
    }
  } catch (error: any) {
    console.error("❌ Groq AI Analysis Error:");
    console.error("Message:", error?.message);
    console.error("Status:", error?.status);
    console.error("Details:", error?.error ?? error);

    reasons.push("⚠️ AI analysis unavailable. Manual review required.");
  }

  // 3. Preserve the existing decision threshold
  const action: RiskAssessment["action"] = score >= 40 ? "REVIEW" : "ALLOW";

  const result: RiskAssessment = {
    score,
    reasons,
    action,
  };

  return result;
}
