// Print-style pagination for the resume sheet (#68). Plain DOM, no React,
// no imports: the fixture script bundles this same file into static HTML,
// so what the preview reports is what headless Chrome prints.
//
// Print keeps every item (`article`, card, entry, header block) whole and
// keeps a section heading with the block after it (see the @media print
// rules in resume.css). A continuous height therefore under-counts pages:
// the gap left when a block is pushed to the next page adds up. This walks
// the unbreakable blocks in document order per flow (the modern template's
// two columns fragment independently) and pushes a block that straddles a
// page boundary to the next page, exactly like the printer does.

/** Unbreakable blocks, in the same terms as the print stylesheet. */
export const PB_BLOCK_SELECTOR = [
  "article",
  ".r-academic__entry",
  ".r-modern__side-list > li",
  ".r-modern__ident",
  ".r-modern__contact",
  ".r-classic__head",
  ".r-margin__head",
  ".r-founder__head",
  ".r-academic__head",
  ".r-creative__band",
  ".r-creative__summary",
  ".r-text",
].join(", ");
/** Headings: kept with the next block. */
export const PB_HEAD_SELECTOR = ".r-h, .r-classic__h, .r-academic__h, .r-margin__h";
/** Independent fragmentation flows (columns); everything else is the root flow. */
export const PB_FLOW_SELECTOR = "[data-flow]";

export type PageBreak = { at: number; page: number };
export type Pagination = { pages: number; breaks: PageBreak[]; height: number };

type Atom = { top: number; bottom: number; head: boolean };

/**
 * Simulate print pagination of `sheet` for a page height of `pageH` CSS px.
 * Coordinates are measured with getBoundingClientRect and normalised back
 * to the sheet's own unscaled space, so it works inside the zoomed body and
 * under the preview's transform. Returns the page count, the positions
 * (in unshifted sheet coordinates) where a page starts, and the total
 * height after the pushes.
 */
export function simulatePagination(sheet: HTMLElement, pageH: number): Pagination {
  const sheetRect = sheet.getBoundingClientRect();
  const unscaled = sheet.offsetHeight;
  if (!sheetRect.height || !unscaled) return { pages: 1, breaks: [], height: unscaled };
  const k = unscaled / sheetRect.height; // undo any ancestor transform/zoom
  const rel = (el: Element): [number, number] => {
    const r = el.getBoundingClientRect();
    return [(r.top - sheetRect.top) * k, (r.bottom - sheetRect.top) * k];
  };

  // group atoms by flow (nearest [data-flow] ancestor, else the sheet)
  const flows = new Map<Element, Atom[]>();
  const flowOf = (el: Element) => el.closest(PB_FLOW_SELECTOR) ?? sheet;
  const push = (el: Element, head: boolean) => {
    const [top, bottom] = rel(el);
    if (bottom - top <= 0) return;
    const list = flows.get(flowOf(el)) ?? [];
    list.push({ top, bottom, head });
    flows.set(flowOf(el), list);
  };
  sheet.querySelectorAll(PB_BLOCK_SELECTOR).forEach((el) => {
    // nested blocks (an article inside another) count once, at the outer
    // level; the sheet itself is an <article>, so stop there
    const outer = el.parentElement?.closest(PB_BLOCK_SELECTOR);
    if (outer && outer !== sheet && sheet.contains(outer)) return;
    push(el, false);
  });
  sheet.querySelectorAll(PB_HEAD_SELECTOR).forEach((el) => push(el, true));

  // Print drops the sheet's min-height, so the printed height is the last
  // content bottom plus the bottom margin — not the on-screen offsetHeight
  // (which includes the empty rest of a short sheet).
  const cs = getComputedStyle(sheet);
  const mm = parseFloat(cs.getPropertyValue("--r-pad")) || 0; // "10mm" → 10
  // plus a few px of slack: print snaps line boxes to whole layout units, so
  // a two-page sheet comes out a handful of px taller than the screen says.
  // Erring long only costs one more tightening step; erring short prints a
  // blank page.
  const PRINT_SLACK = 12;
  const padBottom = Math.max(parseFloat(cs.paddingBottom) || 0, mm * 3.7795) + PRINT_SLACK;
  let maxBottom = 0;
  let maxShift = 0;
  const breaks: PageBreak[] = [];
  let maxPages = 1;
  flows.forEach((atoms) => {
    atoms.sort((a, b) => a.top - b.top || a.bottom - b.bottom);
    // the sheet's bottom margin has no break opportunity inside it, so the
    // printer keeps it with the last block: that block needs room for both
    const flowEnd = atoms.reduce((m, a) => Math.max(m, a.bottom), 0);
    let shift = 0;
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      // a heading travels with the block after it
      const next = a.head ? atoms[i + 1] : undefined;
      const extentBottom = next && next.top >= a.top ? Math.max(a.bottom, next.bottom) : a.bottom;
      const size = extentBottom - a.top + (extentBottom >= flowEnd - 0.5 ? padBottom : 0);
      const t = a.top + shift;
      const page = Math.floor(t / pageH);
      const pageEnd = (page + 1) * pageH;
      if (t + size > pageEnd + 0.5 && size <= pageH) {
        // doesn't fit in what's left of this page → starts the next one
        shift += pageEnd - t;
        breaks.push({ at: a.top, page: page + 2 });
      }
    }
    for (const a of atoms) maxBottom = Math.max(maxBottom, a.bottom + shift);
    maxShift = Math.max(maxShift, shift);
    maxPages = Math.max(maxPages, Math.ceil((maxBottom + padBottom - 0.01) / pageH));
  });

  const height = atoms_total(flows) ? maxBottom + padBottom : unscaled;
  const pages = Math.max(1, Math.ceil((height - 0.01) / pageH), maxPages);
  // de-duplicate breaks that land at the same page from different flows:
  // keep the earliest start of each page for the markers
  const byPage = new Map<number, number>();
  for (const b of breaks) byPage.set(b.page, Math.min(byPage.get(b.page) ?? Infinity, b.at));
  return {
    pages,
    breaks: Array.from(byPage, ([page, at]) => ({ page, at })).sort((a, b) => a.page - b.page),
    height,
  };
}

function atoms_total(flows: Map<Element, Atom[]>): number {
  let n = 0;
  flows.forEach((a) => { n += a.length; });
  return n;
}

export type FitOutcome = { step: number; fits: boolean; pagination: Pagination };

/**
 * Walk the fit ladder: apply `data-fit` step by step and stop at the first
 * step whose simulated page count is within the target. `stepCount` is the
 * number of steps in FIT_STEPS. Leaves the chosen step applied.
 */
export function runFit(sheet: HTMLElement, pageH: number, pages: number, stepCount: number): FitOutcome {
  let pagination: Pagination = { pages: 1, breaks: [], height: 0 };
  let step = 0;
  for (step = 0; step < stepCount; step++) {
    sheet.dataset.fit = String(step);
    void sheet.offsetHeight; // force layout at this step
    pagination = simulatePagination(sheet, pageH);
    if (pagination.pages <= pages) return { step, fits: true, pagination };
  }
  return { step: stepCount - 1, fits: false, pagination };
}
