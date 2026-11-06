import type { ModelCatalog } from "./local-models";
export type Resource = {
  id: string;
  title: string;
  author: string;
  subjects: string[];
  fiction: boolean;
  catalogVersion?: number;
  subjectsEdited?: boolean;
  modelCatalog?: ModelCatalog;
  classificationStatus?: "pending" | "complete" | "failed";
  color: string;
  design: number;
  pages: number;
  added: number;
  cover?: string;
  data?: ArrayBuffer;
  texts?: string[];
};
export const samples: Resource[] = [
  {
    id: "s1",
    title: "The Architecture of Intelligence",
    author: "Elena Voss",
    subjects: ["Machine Learning", "Computer Science"],
    fiction: false,
    color: "#b6b9a5",
    design: 0,
    pages: 324,
    added: 1,
  },
  {
    id: "s2",
    title: "A Brief History of Almost Everything",
    author: "Samuel Reed",
    subjects: ["Science", "History"],
    fiction: false,
    color: "#be744d",
    design: 1,
    pages: 416,
    added: 2,
  },
  {
    id: "s3",
    title: "Thinking in Systems",
    author: "Mara Ellis",
    subjects: ["Science", "Philosophy"],
    fiction: false,
    color: "#77978e",
    design: 2,
    pages: 218,
    added: 3,
  },
  {
    id: "s4",
    title: "The Shape of Mathematics",
    author: "Oliver Chen",
    subjects: ["Mathematics", "Science"],
    fiction: false,
    color: "#8e91af",
    design: 3,
    pages: 288,
    added: 4,
  },
  {
    id: "s5",
    title: "Beyond the Human",
    author: "Ada Laurent",
    subjects: ["Fiction", "Artificial Intelligence"],
    fiction: true,
    color: "#a18b70",
    design: 4,
    pages: 356,
    added: 5,
  },
  {
    id: "s6",
    title: "The Art of Paying Attention",
    author: "James Alder",
    subjects: ["Philosophy", "Psychology"],
    fiction: false,
    color: "#b4a18d",
    design: 5,
    pages: 192,
    added: 6,
  },
  {
    id: "s7",
    title: "Learning from Data",
    author: "Nadia Park",
    subjects: ["Machine Learning", "Mathematics"],
    fiction: false,
    color: "#a07769",
    design: 2,
    pages: 462,
    added: 7,
  },
  {
    id: "s8",
    title: "A Field Guide to the Cosmos",
    author: "Theo Morgan",
    subjects: ["Science", "Astronomy"],
    fiction: false,
    color: "#657f9c",
    design: 1,
    pages: 280,
    added: 8,
  },
];
export const subjects = [
  "Machine Learning",
  "Science",
  "Philosophy",
  "Mathematics",
  "Computer Science",
  "History",
  "Fiction",
];
export async function db(
  action: "get" | "put" | "delete" | "has",
  value?: Resource | string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("speculib", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("books", { keyPath: "id" });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const d = req.result;
      const tx = d.transaction(
        "books",
        action === "get" || action === "has" ? "readonly" : "readwrite",
      );
      const s = tx.objectStore("books");
      const r =
        action === "get"
          ? s.getAll()
          : action === "has"
            ? s.getKey(value as string)
            : action === "put"
              ? s.put(value)
              : s.delete(value as string);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      tx.oncomplete = () => d.close();
    };
  });
}
export function inferSubjects(text: string) {
  const rules: Record<string, RegExp> = {
    "Machine Learning":
      /machine learning|neural network|deep learning|training data/i,
    "Computer Science": /software|programming|algorithm|computer science/i,
    Science: /physics|biology|chemistry|scientific|proton/i,
    Mathematics: /mathematics|calculus|algebra|statistics/i,
    History: /historical|history|civilization/i,
    Philosophy: /philosophy|ethics|epistemology/i,
    Cooking: /recipe|cooking|ingredients|cuisine/i,
  };
  return Object.entries(rules)
    .filter(([, r]) => r.test(text))
    .map(([s]) => s);
}
