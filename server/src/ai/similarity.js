// Local text similarity (TF-IDF + cosine). No network, no API quota, no external service.
// It finds issues that SHARE VOCABULARY with a draft; it cannot know whether two reports describe the same
// defect, so callers present results as "similar issues", never as confirmed duplicates.

const STOP_WORDS = new Set(`a about after again all also am an and any are as at be because been but by can cannot cant could did do does doesnt dont
for from get gets got had has have having he her here him his how i if in into is isnt it its just me more most my no not now of off on once only
or other our out over own same she should so some such than that the their them then there these they this those through to too under until up
us very was we were what when where which while who why will with without would you your still seems seem try tried trying see seen
please issue bug problem`.split(/\s+/));

function stem(token) {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

// Returns [{ stem, word }] so results can show the reader's own words instead of stems.
export function tokenize(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  return words.filter((w) => w.length > 1 && !STOP_WORDS.has(w)).map((w) => ({ stem: stem(w), word: w }));
}

// Title words count three times: a title is a tight summary of the problem.
function termFrequencies({ title, description }) {
  const tf = new Map();
  const add = (tokens, weight) => tokens.forEach(({ stem: s }) => tf.set(s, (tf.get(s) || 0) + weight));
  add(tokenize(title), 3);
  add(tokenize(description), 1);
  return tf;
}

const labelFor = (score) => (score >= 0.6 ? 'Very similar' : score >= 0.4 ? 'Similar' : 'Somewhat similar');

/**
 * @param {{title:string, description:string}} query
 * @param {Array<{_id:any,title:string,description:string}>} docs candidate issues (already access-checked)
 * @param {{threshold?:number, limit?:number, minSharedTerms?:number}} opts
 */
export function rankSimilar(query, docs, { threshold = 0.25, limit = 5, minSharedTerms = 2 } = {}) {
  const qTf = termFrequencies(query);
  if (qTf.size === 0 || docs.length === 0) return [];
  const display = new Map();
  [...tokenize(query.title), ...tokenize(query.description)].forEach(({ stem: s, word }) => { if (!display.has(s)) display.set(s, word); });

  const docTfs = docs.map(termFrequencies);
  const df = new Map();
  docTfs.forEach((tf) => tf.forEach((_c, term) => df.set(term, (df.get(term) || 0) + 1)));
  const N = docs.length;
  const idf = (term) => Math.log((N + 1) / ((df.get(term) || 0) + 1)) + 1;
  const weight = (count, term) => (1 + Math.log(count)) * idf(term);

  const qW = new Map([...qTf].map(([t, c]) => [t, weight(c, t)]));
  const qNorm = Math.sqrt([...qW.values()].reduce((s, w) => s + w * w, 0));
  // A draft with very few meaningful words can legitimately match on one.
  const needShared = Math.min(minSharedTerms, qTf.size);

  const results = [];
  docs.forEach((doc, i) => {
    const dW = new Map([...docTfs[i]].map(([t, c]) => [t, weight(c, t)]));
    const dNorm = Math.sqrt([...dW.values()].reduce((s, w) => s + w * w, 0));
    if (!dNorm) return;
    let dot = 0;
    const shared = [];
    qW.forEach((w, term) => {
      const dw = dW.get(term);
      if (dw) { dot += w * dw; shared.push({ term, contribution: w * dw }); }
    });
    if (shared.length < needShared) return;
    const score = dot / (qNorm * dNorm);
    if (score < threshold) return;
    shared.sort((a, b) => b.contribution - a.contribution);
    results.push({ doc, score, matchedTerms: shared.slice(0, 5).map((s) => display.get(s.term) || s.term) });
  });

  return results
    .sort((a, b) => b.score - a.score || String(b.doc.createdAt || '').localeCompare(String(a.doc.createdAt || '')))
    .slice(0, limit)
    .map((r) => ({ ...r, score: Math.round(r.score * 100) / 100, label: labelFor(r.score) }));
}
