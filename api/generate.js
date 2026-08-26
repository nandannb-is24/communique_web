import Groq from "groq-sdk";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Use the developer's key stored in Vercel Environment Variables
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "Server API Key not configured" });
  }

  try {
    const groq = new Groq({ apiKey });
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert formal letter editor. Enhance the grammar, tone, and clarity of the following paragraph to make it highly professional. The text must be written from the perspective of someone *requesting* permission or arrangements (such as requesting attendance, bus arrangements, or approvals), NOT from the perspective of someone sanctioning or granting them. DO NOT include any concluding notes, sign-offs, or phrases like 'Thank you' or 'Yours faithfully'. Focus ONLY on enhancing the body text provided. Preserve any HTML formatting tags like <b>, <i>, or <u>. Return only the improved text with no extra commentary.",
        },
        { role: "user", content: text },
      ],
      model: "openai/gpt-oss-20b",
    });

    const content = response.choices[0]?.message?.content || "";
    return res.status(200).json({ content });
  } catch (error) {
    console.error("Groq API Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate text" });
  }
}
