import { describe, it, expect } from "vitest";
import { parseGeminiAnswer, localizedQuestion } from "@/lib/platforms/gemini";
import { parseExtractionJson } from "@/lib/analyze/jsonExtractors";
import { PlatformError } from "@/lib/platforms/types";

describe("gemini adapter parsing", () => {
  it("reads text and url_citation annotations from the documented interactions shape", () => {
    const out = parseGeminiAnswer({
      model: "gemini-2.5-flash",
      steps: [
        { type: "thought" },
        { type: "google_search_call", arguments: { queries: ["dentist springfield"] } },
        { type: "google_search_result", result: [] },
        { type: "model_output", content: [{ type: "text", text: "Try Putman Dental in Springfield.", annotations: [{ type: "url_citation", url: "https://reviews.example/putman", title: "Putman Dental reviews", start_index: 0, end_index: 20 }, { type: "other", url: "https://ignored.example" }] }] },
      ],
    });
    expect(out.answerText).toBe("Try Putman Dental in Springfield.");
    expect(out.citations).toEqual([{ url: "https://reviews.example/putman", title: "Putman Dental reviews" }]);
    expect(out.model).toBe("gemini-2.5-flash");
  });
  it("rejects a response that does not match the shape", () => {
    expect(() => parseGeminiAnswer({ steps: "nope" })).toThrow(PlatformError);
  });
  it("adds the location to the question only when the city is not already in it", () => {
    const location = { city: "Springfield", region: "Illinois", country: "US" };
    expect(localizedQuestion({ question: "Who is a good dentist in Springfield?", location })).toBe("Who is a good dentist in Springfield?");
    expect(localizedQuestion({ question: "Who is a good dentist near me?", location })).toBe("Who is a good dentist near me? (I am in Springfield, Illinois, US.)");
  });
});

describe("JSON extractor parsing", () => {
  it("accepts plain and fenced JSON and rejects invalid output", () => {
    const good = '{"businesses":[{"name":"Acme Plumbing","stance":"positive","evidence":"Try Acme Plumbing."}]}';
    expect(parseExtractionJson(good).businesses[0].name).toBe("Acme Plumbing");
    expect(parseExtractionJson("```json\n" + good + "\n```").businesses.length).toBe(1);
    expect(parseExtractionJson("Sure! Here you go: " + good).businesses.length).toBe(1);
    expect(() => parseExtractionJson("no json here")).toThrow();
    expect(() => parseExtractionJson('{"businesses":[{"name":"X","stance":"maybe","evidence":"Y"}]}')).toThrow();
  });
});
