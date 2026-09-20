import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { LinkButton, Chip } from "@/components/ui";
import { IconWarn } from "@/components/icons";

const EXPECT = [
  { n: "01", title: "No rankings, no scores", body: "Every number reads “mentioned in 3 of 13 answers”. We never guarantee placement." },
  { n: "02", title: "Answers vary", body: "By platform, wording, location, and time. We date every answer and keep the history." },
  { n: "03", title: "API, not the app", body: "We collect through each platform’s official API. It is related to, but not the same as, what a person sees in the app." },
];

const GET = [
  { n: "01", title: "Real, dated answers with sources", body: "The full text of what each assistant said, when it said it, and every link it used. Your name highlighted wherever it appears." },
  { n: "02", title: "Who appears, and who does not", body: "Other businesses named in the answers, counted once per answer, each backed by a quoted excerpt you can read." },
  { n: "03", title: "Three actions with wording to paste", body: "Prioritized, with the evidence behind each one, the effort involved, and suggested text you can copy into your website editor." },
];

const STEPS = [
  "Describe your business: name, website, city, services.",
  "Review the 8 to 12 questions we suggest. Edit or add your own.",
  "Run a check. It takes a minute or two.",
  "Read your report and three actions.",
  "Check again later and compare.",
];

const FAQ = [
  { q: "Which assistants do you check?", a: "Claude and Perplexity today, through their official APIs. More as their APIs allow location context." },
  { q: "What does “mentioned” mean?", a: "Your business name appears anywhere in the answer. “Recommended” means it was presented as an option. “Cited” means your website was among the sources." },
  { q: "Why do results change?", a: "Assistants answer differently depending on wording, location, and time. That is why we date every answer and only compare checks with the same setup." },
  { q: "Is my data shared?", a: "No. We store your business details, the answers we collect, and an audit of your own public site. Nothing else." },
  { q: "How much does it cost?", a: "Free during the trial period." },
];

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="flex flex-1 flex-col">
      <nav aria-label="Site" className="row h-14 gap-4 border-b border-line px-5 text-sm sm:h-16 sm:gap-7 sm:px-16">
        <span className="mr-auto text-[16px] font-semibold tracking-tight">Mentioned</span>
        <a href="#how-it-works" className="m2 hidden sm:inline">How it works</a>
        <a href="#faq" className="m2 hidden sm:inline">Questions</a>
        <a href="#faq" className="m2 hidden sm:inline">Pricing</a>
        <Link href="/login" className="m2 hidden sm:inline">Sign in</Link>
        <LinkButton href="/signup" size="sm">Create an account</LinkButton>
      </nav>

      <section className="relative px-5 pb-12 pt-14 sm:px-16 sm:pb-24 sm:pt-[120px]">
        <div className="dots pointer-events-none absolute inset-0 hidden sm:block" aria-hidden />
        <div className="relative">
          <span className="chip mb-7 hidden sm:inline-flex"><span className="inline-block h-1.5 w-1.5 rounded-full bg-good" />Free during the trial period</span>
          <h1 className="grad max-w-[860px] text-[40px] leading-[1.08] tracking-[-0.04em] sm:text-[76px] sm:leading-[1.02] sm:tracking-[-0.05em]" style={{ textWrap: "pretty" }}>Do AI assistants mention your business?</h1>
          <p className="m2 mt-5 max-w-[640px] text-[16px] leading-relaxed sm:mt-7 sm:text-[20px]">We ask the assistants the questions your customers ask, show you the actual answers and the sources they cite, tell you who else appears, and give you three things to do about it.</p>
          <div className="mt-7 flex flex-col gap-2.5 sm:mt-9 sm:flex-row"><LinkButton href="/signup">Create an account</LinkButton><LinkButton href="/login" variant="secondary">Sign in</LinkButton></div>
          <div className="row mt-10 hidden gap-5 text-[13px] sm:flex"><span className="m3">Checks</span><span className="chip chip-fg">Claude · API</span><span className="chip chip-fg">Perplexity · API</span></div>
        </div>
      </section>

      <section aria-label="What to expect" className="border-y border-line bg-bg2 px-5 py-10 sm:px-16 sm:py-16">
        <div className="k mb-6 sm:mb-8">What to expect, before you sign up</div>
        <div className="grid gap-6 sm:grid-cols-3 sm:gap-12">
          {EXPECT.map((e) => (
            <div key={e.n}>
              <div className="k mb-3 hidden sm:block">{e.n}</div>
              <h2 className="text-[20px] leading-tight sm:text-[24px]">{e.title}</h2>
              <p className="m2 mt-2 text-[15px] leading-relaxed sm:mt-3">{e.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-6 pt-12 sm:px-16 sm:pb-16 sm:pt-24">
        <div className="k mb-4 sm:mb-6">What you get</div>
        <div className="grid overflow-hidden rounded-lg border border-line sm:grid-cols-3">
          {GET.map((g, i) => (
            <div key={g.n} className={`p-5 sm:p-8 ${i < 2 ? "border-b border-line sm:border-b-0 sm:border-r" : ""}`}>
              <div className="m2 font-mono text-[12px] sm:text-[13px]">{g.n}</div>
              <h2 className="mt-2 text-[18px] sm:mt-4 sm:text-[20px]">{g.title}</h2>
              <p className="m2 mt-1.5 text-[14px] leading-relaxed sm:mt-2.5 sm:text-[15px]">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="grid items-center gap-10 px-5 pb-12 pt-6 sm:px-16 sm:pb-24 sm:pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div>
          <div className="k mb-4">How it works</div>
          <h2 className="text-[26px] leading-[1.15] tracking-[-0.03em] sm:text-[32px]">About ten minutes the first time. Three the next.</h2>
          <ol className="mt-6 flex list-none flex-col p-0 text-[15px] leading-relaxed sm:mt-7">
            {STEPS.map((s, i) => (
              <li key={i} className={`rowline flex items-start gap-5 py-3 ${i === STEPS.length - 1 ? "border-b border-line" : ""}`}>
                <span className="m2 w-6 pt-0.5 font-mono text-[13px]">{i + 1}</span>{s}
              </li>
            ))}
          </ol>
        </div>
        <figure className="m-0 flex flex-col gap-2.5">
          <div className="row flex-wrap gap-2.5"><Chip tone="sample">Sample data</Chip><span className="dt">Sample report for a fictional bakery. Not a real customer&apos;s result.</span></div>
          <div className="win">
            <div className="winbar"><i /><i /><i /><span className="winurl">mentioned.example/dashboard</span></div>
            <div className="flex flex-col gap-4 p-4 sm:p-6">
              <div className="row justify-between"><span className="text-[16px] font-semibold tracking-tight">Rosewood Bakery</span><span className="dt hidden sm:inline">Checked Sep 12, 2026, 8:10 AM · Claude, Perplexity</span></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5"><span className="k">Do I appear?</span><span className="text-[20px] font-semibold leading-tight tracking-tight sm:text-[22px]">Mentioned in 5 of 12 answers</span><span className="m2 text-[13px]">Recommended in 2 of 12 · Website cited in 0 of 12</span></div>
                <div className="flex flex-col gap-2 text-[12px]"><span className="k">Who else appears?</span>
                  {[["Crumb & Co.", 75, "9 of 12", false], ["Millstone Bread", 50, "6 of 12", false], ["Rosewood (you)", 42, "5 of 12", true]].map(([name, w, n, you]) => (
                    <div key={String(name)} className="row gap-2"><span className="w-[110px] shrink-0">{name}</span><span className={`bar ${you ? "you" : ""}`}><i style={{ width: `${w}%` }} /></span><span className="m2 whitespace-nowrap">{n}</span></div>
                  ))}
                </div>
              </div>
              <div className="rowline flex flex-col gap-2 pt-3.5 text-[13px]"><span className="k">What should I do next?</span><span className="row gap-2">1 · Put your address and hours on every page <span className="chip">effort: low</span></span><span className="row gap-2">2 · Name your neighborhood on the homepage <span className="chip">effort: low</span></span></div>
            </div>
          </div>
        </figure>
      </section>

      <section id="faq" className="grid gap-6 border-y border-line bg-bg2 px-5 py-10 sm:px-16 sm:py-20 lg:grid-cols-[320px_1fr] lg:gap-20">
        <div><div className="k mb-4">Questions</div><h2 className="text-[24px] tracking-[-0.03em] sm:text-[28px]">Plain answers</h2></div>
        <dl className="m-0 flex flex-col text-[15px] leading-relaxed">
          {FAQ.map((f, i) => (
            <div key={f.q} className={`rowline py-4 sm:py-[18px] ${i === FAQ.length - 1 ? "border-b border-line" : ""}`}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="m2 ml-0 mt-1">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="relative px-5 py-12 sm:px-16 sm:py-24">
        <div className="dots dots-up pointer-events-none absolute inset-0 hidden sm:block" aria-hidden />
        <div className="relative">
          <h2 className="grad max-w-[680px] text-[26px] leading-[1.15] tracking-[-0.035em] sm:text-[44px] sm:leading-[1.05] sm:tracking-[-0.045em]">See what the assistants say about you.</h2>
          <p className="m2 mt-4 max-w-[560px] text-[15px] leading-relaxed sm:mt-5 sm:text-[17px]">Create an account, describe your business, and run your first check in about ten minutes.</p>
          <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row"><LinkButton href="/signup">Create an account</LinkButton><LinkButton href="/login" variant="secondary">Sign in</LinkButton></div>
        </div>
      </section>

      <footer className="m3 flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-line px-5 py-6 text-[13px] leading-relaxed sm:px-16 sm:py-8">
        <span className="font-semibold text-fg">Mentioned</span>
        <a href="mailto:hello@mentioned.example" className="m2">hello@mentioned.example</a>
        <span className="min-w-[200px] flex-1">We only store your business details, the answers we collect, and an audit of your own public site.</span>
        <span className="sr-only"><IconWarn /></span>
      </footer>
    </div>
  );
}
