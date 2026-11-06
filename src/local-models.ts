export type ModelSettings = {
  librarianModel: string;
  categorizerModel: string;
};
export type ModelCatalog = {
  model: string;
  subjects: string[];
  keywords: string[];
  summary: string;
  domain: string;
  documentType: string;
  fiction: "fiction" | "nonfiction" | "unknown";
  needsUser: boolean;
  evidence: { page: number; quote: string }[];
};
export type ModelPlan = {
  queries: string[];
  fiction: "fiction" | "nonfiction" | "both";
  domain: string;
  clarification: string;
};
export type ModelCandidate = {
  id: string;
  title: string;
  subjects: string[];
  summary?: string;
  domain?: string;
  fiction: boolean;
  passages: { page: number; excerpt: string }[];
};
export type OllamaModel = {
  name: string;
  size: number;
  parameters: string;
  capabilities: string[];
};
export type ModelConnection = {
  connected: boolean;
  models: OllamaModel[];
  settings: ModelSettings;
  error: string;
};
export type AgentMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
  tool_calls?: {
    type: string;
    function: { name: string; arguments: Record<string, unknown> };
  }[];
};
export interface LocalModels {
  agentStep(
    input: { messages: AgentMessage[] },
    key: string,
  ): Promise<AgentMessage>;
  settings(): Promise<ModelSettings>;
  list(): Promise<ModelConnection>;
  save(settings: ModelSettings): Promise<ModelSettings>;
  plan(
    input: {
      question: string;
      history: { role: string; text: string }[];
      catalog: {
        id: string;
        title: string;
        subjects: string[];
        summary?: string;
        domain?: string;
      }[];
    },
    key: string,
  ): Promise<ModelPlan>;
  classify(
    input: {
      title: string;
      author: string;
      pages: { page: number; text: string }[];
    },
    key: string,
  ): Promise<ModelCatalog>;
  answer(
    input: { question: string; candidates: ModelCandidate[] },
    key: string,
  ): Promise<{
    answer: string;
    resourceIds: string[];
    sources: { id: string; page: number }[];
  }>;
  cancel(key: string): Promise<void>;
}
declare global {
  interface Window {
    localModels?: LocalModels;
  }
}
