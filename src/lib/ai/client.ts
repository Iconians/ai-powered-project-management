import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = "demo" | "gemini" | "ollama" | "openai" | "anthropic";

// Demo mode - completely free, no API calls
function generateDemoTasks(description: string) {
  // Simulate AI thinking delay
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Simple rule-based task breakdown for demo
  const keywords = description.toLowerCase();
  const tasks: Array<{
    title: string;
    description: string;
    priority: string;
    estimatedHours: number;
  }> = [];

  if (keywords.includes("website") || keywords.includes("web")) {
    tasks.push(
      {
        title: "Design UI/UX mockups",
        description: "Create wireframes and design mockups for the website",
        priority: "HIGH",
        estimatedHours: 8,
      },
      {
        title: "Set up development environment",
        description: "Initialize project structure and development tools",
        priority: "HIGH",
        estimatedHours: 4,
      },
      {
        title: "Implement frontend components",
        description: "Build React components and pages",
        priority: "MEDIUM",
        estimatedHours: 16,
      },
      {
        title: "Set up backend API",
        description: "Create REST API endpoints and database schema",
        priority: "HIGH",
        estimatedHours: 12,
      },
      {
        title: "Implement authentication",
        description: "Add user authentication and authorization",
        priority: "HIGH",
        estimatedHours: 6,
      },
      {
        title: "Testing and bug fixes",
        description: "Write tests and fix any issues",
        priority: "MEDIUM",
        estimatedHours: 8,
      }
    );
  } else if (keywords.includes("api") || keywords.includes("backend")) {
    tasks.push(
      {
        title: "Design API endpoints",
        description: "Plan and document API structure",
        priority: "HIGH",
        estimatedHours: 4,
      },
      {
        title: "Set up database schema",
        description: "Create database models and migrations",
        priority: "HIGH",
        estimatedHours: 6,
      },
      {
        title: "Implement authentication",
        description: "Add JWT authentication and authorization",
        priority: "HIGH",
        estimatedHours: 8,
      },
      {
        title: "Create CRUD operations",
        description: "Implement create, read, update, delete endpoints",
        priority: "MEDIUM",
        estimatedHours: 12,
      },
      {
        title: "Add validation and error handling",
        description: "Implement input validation and error responses",
        priority: "MEDIUM",
        estimatedHours: 6,
      },
      {
        title: "Write API documentation",
        description: "Document endpoints with examples",
        priority: "LOW",
        estimatedHours: 4,
      }
    );
  } else if (keywords.includes("mobile") || keywords.includes("app")) {
    tasks.push(
      {
        title: "Design app screens",
        description: "Create UI/UX designs for mobile app",
        priority: "HIGH",
        estimatedHours: 10,
      },
      {
        title: "Set up mobile project",
        description: "Initialize React Native or Flutter project",
        priority: "HIGH",
        estimatedHours: 4,
      },
      {
        title: "Implement navigation",
        description: "Set up app navigation and routing",
        priority: "HIGH",
        estimatedHours: 6,
      },
      {
        title: "Build core features",
        description: "Implement main app functionality",
        priority: "MEDIUM",
        estimatedHours: 20,
      },
      {
        title: "Add API integration",
        description: "Connect app to backend API",
        priority: "MEDIUM",
        estimatedHours: 8,
      },
      {
        title: "Testing and deployment",
        description: "Test on devices and prepare for app stores",
        priority: "MEDIUM",
        estimatedHours: 10,
      }
    );
  } else {
    // Generic task breakdown
    tasks.push(
      {
        title: "Project planning and setup",
        description: "Define requirements and set up project structure",
        priority: "HIGH",
        estimatedHours: 4,
      },
      {
        title: "Core feature development",
        description: "Implement main functionality",
        priority: "HIGH",
        estimatedHours: 16,
      },
      {
        title: "Testing and quality assurance",
        description: "Write tests and fix bugs",
        priority: "MEDIUM",
        estimatedHours: 8,
      },
      {
        title: "Documentation",
        description: "Write user and technical documentation",
        priority: "LOW",
        estimatedHours: 4,
      },
      {
        title: "Deployment",
        description: "Deploy to production environment",
        priority: "MEDIUM",
        estimatedHours: 4,
      }
    );
  }

  return delay(1500).then(() => tasks);
}

// Google Gemini (Free tier: 15 requests per minute)
async function generateWithGemini(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error(
      "GOOGLE_GEMINI_API_KEY is not set. Get a free key at https://makersuite.google.com/app/apikey"
    );
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  // Use gemini-1.5-flash for better performance and lower cost (still free tier)
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
    },
  });

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    // Provide helpful error messages
    if (error.message?.includes("API_KEY")) {
      throw new Error(
        "Invalid Gemini API key. Please check your GOOGLE_GEMINI_API_KEY."
      );
    }
    if (
      error.message?.includes("quota") ||
      error.message?.includes("rate limit")
    ) {
      throw new Error(
        "Gemini API rate limit reached. Free tier allows 15 requests per minute."
      );
    }
    throw error;
  }
}

// Ollama (Local, completely free)
async function generateWithOllama(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3";

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: fullPrompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response || "";
}

// OpenAI (paid, but included for completeness)
async function generateWithOpenAI(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      ...(systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }]
        : []),
      { role: "user" as const, content: prompt },
    ],
  });

  return response.choices[0]?.message?.content || "";
}

// Anthropic (paid, but included for completeness)
async function generateWithAnthropic(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const { Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    ...(systemPrompt ? { system: systemPrompt } : {}),
  });

  return response.content[0]?.type === "text" ? response.content[0].text : "";
}

export async function generateWithAI(
  provider: AIProvider,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  switch (provider) {
    case "demo":
      // For demo mode, return a simple response
      return JSON.stringify(await generateDemoTasks(prompt));

    case "gemini":
      return await generateWithGemini(prompt, systemPrompt);

    case "ollama":
      return await generateWithOllama(prompt, systemPrompt);

    case "openai":
      return await generateWithOpenAI(prompt, systemPrompt);

    case "anthropic":
      return await generateWithAnthropic(prompt, systemPrompt);

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
