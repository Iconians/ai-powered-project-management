import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = "demo" | "gemini" | "ollama" | "openai" | "anthropic";

function generateDemoTasks(description: string) {
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

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

async function generateWithGemini(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error(
      "GOOGLE_GEMINI_API_KEY is not set. Get a free key at https://makersuite.google.com/app/apikey"
    );
  }

  // Validate API key format (Gemini keys typically start with "AIza")
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY.trim();
  if (!apiKey.startsWith("AIza") && apiKey.length < 30) {
    throw new Error(
      "Invalid Gemini API key format. Please check your GOOGLE_GEMINI_API_KEY. Get a free key at https://makersuite.google.com/app/apikey"
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Try different model names in order of preference
  // Note: For v1beta API, use model names without version suffixes
  const modelNames = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-pro",
  ];

  let lastError: Error | null = null;
  
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        },
      });

      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;
      
      // If it's a model not found error, try the next model
      if (errorMessage.includes("not found") || errorMessage.includes("404")) {
        console.warn(`Model ${modelName} not available, trying next...`);
        continue;
      }
      
      // For other errors, break and handle them
      break;
    }
  }

  // If we get here, all models failed
  if (lastError) {
    const errorMessage = lastError.message;
    
    // Check if it's an API key issue
    if (errorMessage.includes("API_KEY") || errorMessage.includes("401") || errorMessage.includes("403")) {
      throw new Error(
        "Invalid or missing Gemini API key. Please check your GOOGLE_GEMINI_API_KEY environment variable. Get a free key at https://makersuite.google.com/app/apikey"
      );
    }
    
    // Check if it's a quota/rate limit issue
    if (errorMessage.includes("quota") || errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      throw new Error(
        "Gemini API rate limit reached. Free tier allows 15 requests per minute. Please wait and try again."
      );
    }
    
    // Check if all models are not found (likely API key or endpoint issue)
    if (errorMessage.includes("not found") || errorMessage.includes("404")) {
      throw new Error(
        `Gemini API models not available. This could mean:\n` +
        `1. Your API key is invalid or expired\n` +
        `2. The API endpoint is incorrect\n` +
        `3. Your API key doesn't have access to these models\n\n` +
        `Please verify your GOOGLE_GEMINI_API_KEY at https://makersuite.google.com/app/apikey\n` +
        `Original error: ${errorMessage}`
      );
    }
    
    throw new Error(
      `Gemini API error: ${errorMessage}. Please check your API key and model availability.`
    );
  }
  
  // If we get here, all models failed and no error was thrown
  throw new Error(
    "All Gemini models failed. Please check your API key and try again."
  );
}

async function generateWithOllama(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const rawOllamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  let ollamaUrl: string;

  try {
    const url = new URL(rawOllamaUrl);

    const hostname = url.hostname.toLowerCase();
    const allowedHosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];

    const isLocalhost = allowedHosts.includes(hostname);
    const isPrivateIP = /^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\./.test(
      hostname
    );

    if (!isLocalhost && !isPrivateIP) {
      throw new Error(
        "OLLAMA_URL must be localhost or private network address"
      );
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("OLLAMA_URL must use http or https protocol");
    }

    ollamaUrl = rawOllamaUrl;
  } catch (error) {
    console.error("Invalid OLLAMA_URL:", error);
    throw new Error(
      "Invalid OLLAMA_URL configuration. Must be a valid localhost or private network URL."
    );
  }

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
