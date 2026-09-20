import { z } from "zod";
import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import { hasControlChars } from "@/lib/text/clean";
import type { Question } from "./suggest";

export const questionTextSchema = z
  .string()
  .trim()
  .min(8, "Questions need at least 8 characters")
  .max(200, "Questions can be at most 200 characters")
  .refine((s) => !hasControlChars(s), "Questions contain characters we cannot use");

export const questionListSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(40),
      text: questionTextSchema,
      source: z.enum(["suggested", "owner"]),
      intent: z.enum(["discovery", "service", "availability", "price", "comparison", "other"]).optional(),
    }),
  )
  .min(1, "Keep at least one question")
  .max(20, "You can have up to 20 questions");

export interface QuestionSet {
  id: string;
  businessId: string;
  version: number;
  questions: Question[];
  isCurrent: boolean;
  createdAt: string;
}

interface Row {
  id: string;
  business_id: string;
  version: number;
  questions: string;
  is_current: number;
  created_at: string;
}

function toSet(r: Row): QuestionSet {
  return {
    id: r.id,
    businessId: r.business_id,
    version: r.version,
    questions: JSON.parse(r.questions) as Question[],
    isCurrent: r.is_current === 1,
    createdAt: r.created_at,
  };
}

export function getCurrentQuestionSet(db: Db, businessId: string): QuestionSet | null {
  const row = db
    .prepare("SELECT * FROM question_sets WHERE business_id = ? AND is_current = 1")
    .get(businessId) as Row | undefined;
  return row ? toSet(row) : null;
}

export function getQuestionSetById(db: Db, id: string): QuestionSet | null {
  const row = db.prepare("SELECT * FROM question_sets WHERE id = ?").get(id) as Row | undefined;
  return row ? toSet(row) : null;
}

export function newQuestion(text: string, source: Question["source"], intent?: Question["intent"]): Question {
  return { id: newId().slice(-10).toLowerCase(), text: text.trim(), source, ...(intent ? { intent } : {}) };
}

/** Builds the initial suggested set with intents recorded. */
export function suggestedQuestionSet(suggested: Array<{ text: string; intent: Question["intent"] }>): Question[] {
  return suggested.map((s) => newQuestion(s.text, "suggested", s.intent));
}

/** Saves a new version and marks it current. Returns the existing version when nothing changed. */
export function saveQuestionSet(db: Db, businessId: string, questions: Question[]): QuestionSet {
  const current = getCurrentQuestionSet(db, businessId);
  if (current && JSON.stringify(current.questions) === JSON.stringify(questions)) return current;
  const version = (current?.version ?? 0) + 1;
  const ts = nowIso();
  const id = newId();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE question_sets SET is_current = 0, updated_at = ? WHERE business_id = ?").run(ts, businessId);
    db.prepare(
      "INSERT INTO question_sets (id, business_id, version, questions, is_current, created_at, updated_at) VALUES (?,?,?,?,1,?,?)",
    ).run(id, businessId, version, JSON.stringify(questions), ts, ts);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return getQuestionSetById(db, id)!;
}
