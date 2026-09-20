import * as cheerio from "cheerio";

export interface ParsedPage {
  url: string;
  title: string;
  metaDescription: string;
  h1: string[];
  text: string;
  links: string[];
  telLinks: string[];
  mailtoLinks: string[];
  jsonLd: unknown[];
  hasViewportMeta: boolean;
}

/** Parses untrusted HTML into plain data. Nothing here is executed or trusted. */
export function parsePage(url: string, html: string): ParsedPage {
  const $ = cheerio.load(html);
  $("script:not([type='application/ld+json']), style, noscript, svg, iframe").remove();
  const jsonLd: unknown[] = [];
  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).text();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) jsonLd.push(...parsed);
      else jsonLd.push(parsed);
    } catch {
      // ignore malformed JSON-LD; the audit reports it as missing structured data
    }
  });
  const links: string[] = [];
  const telLinks: string[] = [];
  const mailtoLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;
    if (href.toLowerCase().startsWith("tel:")) telLinks.push(href.slice(4));
    else if (href.toLowerCase().startsWith("mailto:")) mailtoLinks.push(href.slice(7));
    else {
      try {
        links.push(new URL(href, url).toString());
      } catch {
        // skip unparsable hrefs
      }
    }
  });
  // Block-level elements are glued together by .text(); add separators so
  // "5pm</p><a>Contact" does not become "5pmContact".
  $("body").find("p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, br, td, th, tr, section, article, header, footer, nav, address, a, span, dd, dt, blockquote, pre, hr").each((_, el) => {
    $(el).after(" ");
  });
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return {
    url,
    title: $("title").first().text().trim(),
    metaDescription: ($("meta[name='description']").attr("content") ?? "").trim(),
    h1: $("h1").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean),
    text,
    links,
    telLinks,
    mailtoLinks,
    jsonLd,
    hasViewportMeta: $("meta[name='viewport']").length > 0,
  };
}
