import * as cheerio from 'cheerio';

/** Elements that carry navigation chrome or non-content, never admissions facts. */
const NOISE = 'script, style, noscript, svg, iframe, template, nav, footer';

const BLOCK = 'p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, td, th, dt, dd';

/** Marks a block boundary; source newlines are just whitespace and must not split a sentence. */
const BREAK = '\u0001';

/**
 * Reduce a page to stable, line-oriented text so that two fetches of an
 * unchanged page compare equal and a real edit produces a small line diff.
 *
 * One block of visible text per line, whitespace collapsed, consecutive
 * duplicates dropped. `header` is deliberately kept: many school sites put
 * their announcement banner there.
 */
export function htmlToLines(html: string): string[] {
  const $ = cheerio.load(html);
  $(NOISE).remove();
  // Text nodes of adjacent blocks would otherwise be glued together.
  $('br').replaceWith(BREAK);
  $(BLOCK).each((_, el) => {
    $(el).append(BREAK).prepend(BREAK);
  });

  const lines: string[] = [];
  for (const raw of $('body').text().split(BREAK)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line === '' || line === lines[lines.length - 1]) continue;
    lines.push(line);
  }
  return lines;
}
