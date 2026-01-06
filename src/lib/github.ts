import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import crypto from "crypto";

const ENCRYPTION_KEY =
  process.env.GITHUB_ENCRYPTION_KEY ||
  process.env.NEXTAUTH_SECRET ||
  "default-key-change-in-production";
const ALGORITHM = "aes-256-cbc";


export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.substring(0, 32), "utf8"),
    iv
  );
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}


export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.substring(0, 32), "utf8"),
    iv
  );
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}


export function getGitHubClient(accessToken: string | null) {
  if (!accessToken) {
    throw new Error("GitHub access token not found");
  }
  const token = decryptToken(accessToken);
  return {
    rest: new Octokit({ auth: token }),
    graphql: graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    }),
  };
}


export async function syncBoardToGitHub(
  _board: { id: string; name: string; description: string | null },
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
  }>,
  githubClient: { rest: Octokit; graphql: typeof graphql },
  repoName: string,
  _projectId: number
) {
  
  

  const [owner, repo] = repoName.split("/");

  
  for (const task of tasks) {
    
    const issueState = task.status === "DONE" ? "closed" : "open";

    
    
    try {
      
      
      await githubClient.rest.issues.create({
        owner,
        repo,
        title: task.title,
        body: task.description || "",
        state: issueState,
      });
    } catch (error) {
      console.error(`Failed to sync task ${task.id} to GitHub:`, error);
    }
  }
}


export async function syncGitHubToBoard(
  githubClient: { rest: Octokit; graphql: typeof graphql },
  repoName: string,
  _boardId: string
) {
  const [owner, repo] = repoName.split("/");

  
  const { data: issues } = await githubClient.rest.issues.listForRepo({
    owner,
    repo,
    state: "all",
  });

  
  return issues.map((issue) => ({
    id: issue.id.toString(),
    title: issue.title,
    description: issue.body || null,
    status: issue.state === "closed" ? "DONE" : "TODO",
    githubIssueNumber: issue.number,
  }));
}
