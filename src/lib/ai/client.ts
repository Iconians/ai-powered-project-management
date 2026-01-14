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

  // Marketing & Campaigns
  if (keywords.includes("marketing") || keywords.includes("campaign") || keywords.includes("promotion")) {
    tasks.push(
      {
        title: "Define target audience and personas",
        description: "Research and document primary customer segments and their characteristics",
        priority: "HIGH",
        estimatedHours: 6,
      },
      {
        title: "Develop campaign messaging",
        description: "Create key messages and value propositions for the campaign",
        priority: "HIGH",
        estimatedHours: 8,
      },
      {
        title: "Design marketing materials",
        description: "Create visuals, graphics, and promotional content",
        priority: "MEDIUM",
        estimatedHours: 12,
      },
      {
        title: "Plan distribution channels",
        description: "Identify and schedule social media, email, and advertising channels",
        priority: "MEDIUM",
        estimatedHours: 6,
      },
      {
        title: "Set up tracking and analytics",
        description: "Implement metrics tracking and reporting dashboards",
        priority: "MEDIUM",
        estimatedHours: 4,
      },
      {
        title: "Launch and monitor campaign",
        description: "Execute campaign and track performance metrics",
        priority: "HIGH",
        estimatedHours: 8,
      }
    );
  } 
  // Events
  else if (keywords.includes("event") || keywords.includes("conference") || keywords.includes("meeting") || keywords.includes("workshop")) {
    tasks.push(
      {
        title: "Define event objectives and goals",
        description: "Establish clear success metrics and desired outcomes",
        priority: "HIGH",
        estimatedHours: 4,
      },
      {
        title: "Select venue and date",
        description: "Research and book appropriate location with required amenities",
        priority: "HIGH",
        estimatedHours: 6,
      },
      {
        title: "Create event budget",
        description: "Estimate costs for venue, catering, speakers, and materials",
        priority: "HIGH",
        estimatedHours: 4,
      },
      {
        title: "Plan agenda and schedule",
        description: "Develop detailed timeline with sessions, breaks, and activities",
        priority: "MEDIUM",
        estimatedHours: 6,
      },
      {
        title: "Coordinate speakers and vendors",
        description: "Confirm participants, arrange contracts, and logistics",
        priority: "MEDIUM",
        estimatedHours: 8,
      },
      {
        title: "Promote and manage registrations",
        description: "Create registration system and marketing materials",
        priority: "MEDIUM",
        estimatedHours: 8,
      },
      {
        title: "Prepare materials and supplies",
        description: "Order name tags, handouts, signage, and equipment",
        priority: "LOW",
        estimatedHours: 6,
      }
    );
  }
  // Product Launch
  else if (keywords.includes("product launch") || keywords.includes("launch product") || keywords.includes("new product")) {
    tasks.push(
      {
        title: "Conduct market research",
        description: "Analyze market demand, competition, and customer needs",
        priority: "HIGH",
        estimatedHours: 12,
      },
      {
        title: "Develop product positioning",
        description: "Define unique value proposition and target market",
        priority: "HIGH",
        estimatedHours: 6,
      },
      {
        title: "Create marketing strategy",
        description: "Plan launch campaign, pricing, and distribution channels",
        priority: "HIGH",
        estimatedHours: 10,
      },
      {
        title: "Develop sales materials",
        description: "Create product sheets, presentations, and training materials",
        priority: "MEDIUM",
        estimatedHours: 8,
      },
      {
        title: "Plan launch event or announcement",
        description: "Organize press release, demo, or launch event",
        priority: "MEDIUM",
        estimatedHours: 8,
      },
      {
        title: "Train sales and support teams",
        description: "Educate teams on product features and customer questions",
        priority: "MEDIUM",
        estimatedHours: 6,
      }
    );
  }
  // Operations & Process Improvement
  else if (keywords.includes("process") || keywords.includes("operations") || keywords.includes("workflow") || keywords.includes("improve")) {
    tasks.push(
      {
        title: "Map current process",
        description: "Document existing workflow, steps, and pain points",
        priority: "HIGH",
        estimatedHours: 8,
      },
      {
        title: "Identify improvement opportunities",
        description: "Analyze bottlenecks, inefficiencies, and areas for optimization",
        priority: "HIGH",
        estimatedHours: 6,
      },
      {
        title: "Design improved process",
        description: "Create new workflow with streamlined steps and automation",
        priority: "HIGH",
        estimatedHours: 10,
      },
      {
        title: "Get stakeholder approval",
        description: "Present proposal and gather feedback from key stakeholders",
        priority: "MEDIUM",
        estimatedHours: 4,
      },
      {
        title: "Implement changes",
        description: "Roll out new process with training and documentation",
        priority: "MEDIUM",
        estimatedHours: 12,
      },
      {
        title: "Monitor and measure results",
        description: "Track metrics and gather feedback to ensure improvements",
        priority: "LOW",
        estimatedHours: 4,
      }
    );
  }
  // HR & Training
  else if (keywords.includes("training") || keywords.includes("onboarding") || keywords.includes("hr") || keywords.includes("employee")) {
    tasks.push(
      {
        title: "Assess training needs",
        description: "Identify skills gaps and learning objectives",
        priority: "HIGH",
        estimatedHours: 6,
      },
      {
        title: "Develop training curriculum",
        description: "Create learning modules, materials, and assessments",
        priority: "HIGH",
        estimatedHours: 12,
      },
      {
        title: "Design training materials",
        description: "Create presentations, handouts, videos, and exercises",
        priority: "MEDIUM",
        estimatedHours: 10,
      },
      {
        title: "Schedule training sessions",
        description: "Coordinate dates, times, and participant availability",
        priority: "MEDIUM",
        estimatedHours: 4,
      },
      {
        title: "Deliver training program",
        description: "Conduct sessions and facilitate learning activities",
        priority: "HIGH",
        estimatedHours: 8,
      },
      {
        title: "Evaluate effectiveness",
        description: "Gather feedback and measure learning outcomes",
        priority: "LOW",
        estimatedHours: 4,
      }
    );
  }
  // Website/Web Development (keep for technical users)
  else if (keywords.includes("website") || keywords.includes("web")) {
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
    // Generic fallback for any other project type
    tasks.push(
      {
        title: "Define project scope and objectives",
        description: "Clarify goals, deliverables, and success criteria",
        priority: "HIGH",
        estimatedHours: 4,
      },
      {
        title: "Research and planning",
        description: "Gather information, analyze requirements, and create project plan",
        priority: "HIGH",
        estimatedHours: 8,
      },
      {
        title: "Execute core activities",
        description: "Implement main project work and deliverables",
        priority: "HIGH",
        estimatedHours: 16,
      },
      {
        title: "Review and quality check",
        description: "Validate deliverables meet requirements and standards",
        priority: "MEDIUM",
        estimatedHours: 6,
      },
      {
        title: "Finalize and deliver",
        description: "Complete remaining tasks and present final results",
        priority: "MEDIUM",
        estimatedHours: 4,
      },
      {
        title: "Documentation and handoff",
        description: "Create documentation and transfer knowledge to stakeholders",
        priority: "LOW",
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
