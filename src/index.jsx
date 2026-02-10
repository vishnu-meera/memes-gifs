import { h, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import './styles/main.css';

// ============================================
// CONFIG
// ============================================
const SUBREDDITS = ['ProgrammerHumor', 'programmingmemes', 'softwaregore', 'techhumor', 'coding'];

// Progressive fetch strategy: 10 → 100 → 200 → 400 (4 requests max)
const FETCH_SCHEDULE = [
  { count: 10, triggerAt: 0 },      // First request: 10 memes
  { count: 100, triggerAt: 7 },     // When user reaches 7, fetch 100 more
  { count: 200, triggerAt: 75 },    // When user reaches 75, fetch 200 more
  { count: 400, triggerAt: 175 }    // When user reaches 175, fetch 400 more (final)
];

// Fix camelCase titles
const fixTitle = (title) => {
  if (!title) return '';
  return title
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
};

// ============================================
// STORE
// ============================================
const store = {
  memes: [],
  loading: false,
  listeners: new Set(),
  seenIds: new Set(),
  fetchIndex: 0, // Track which fetch we're on (0-3)

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  notify() {
    this.listeners.forEach(fn => fn());
  },

  randomSub() {
    return SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];
  },

  // Check if we should trigger next fetch based on current viewed index
  shouldFetch(viewedIndex) {
    if (this.fetchIndex >= FETCH_SCHEDULE.length) return false; // All 4 fetches done
    if (this.loading) return false;

    const nextFetch = FETCH_SCHEDULE[this.fetchIndex];
    return viewedIndex >= nextFetch.triggerAt;
  },

  async fetchFromApi(subreddit, count) {
    // meme-api.com limits to 50 per request, so we may need multiple calls
    const maxPerRequest = 50;
    const allMemes = [];
    let remaining = count;

    while (remaining > 0) {
      const batchSize = Math.min(remaining, maxPerRequest);
      const url = `https://meme-api.com/gimme/${subreddit}/${batchSize}`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        if (data.memes) {
          allMemes.push(...data.memes);
        }
        remaining -= batchSize;
      } catch (e) {
        console.warn(`Fetch failed for ${subreddit}:`, e);
        break;
      }
    }

    return allMemes;
  },

  async fetchBatch() {
    if (this.fetchIndex >= FETCH_SCHEDULE.length) return; // Max 4 requests
    if (this.loading) return;

    const { count } = FETCH_SCHEDULE[this.fetchIndex];
    this.loading = true;
    this.notify();

    console.log(`Fetch #${this.fetchIndex + 1}: Requesting ${count} memes`);

    const allPosts = [];

    // Fetch from multiple subreddits for variety
    const subsToFetch = this.fetchIndex === 0 ? 2 : 5;
    const perSub = Math.ceil(count / subsToFetch);

    const fetches = [];
    for (let i = 0; i < subsToFetch; i++) {
      fetches.push(this.fetchFromApi(this.randomSub(), perSub));
    }

    const results = await Promise.all(fetches);
    results.forEach(memes => allPosts.push(...memes));

    // Filter and dedupe
    const newMemes = allPosts
      .filter(p => !p.nsfw && !this.seenIds.has(p.postLink))
      .map(p => ({
        id: p.postLink,
        title: p.title,
        url: p.url,
        source: `r/${p.subreddit}`,
        upvotes: p.ups,
        isGif: p.url?.includes('.gif'),
      }))
      .filter(p => p.url);

    // Mark as seen
    newMemes.forEach(p => this.seenIds.add(p.id));

    // Shuffle for randomness
    this.shuffle(newMemes);

    // Take only what we need
    const toAdd = newMemes.slice(0, count);
    this.memes.push(...toAdd);

    console.log(`Fetch #${this.fetchIndex + 1} complete: Added ${toAdd.length} memes. Total: ${this.memes.length}`);

    this.fetchIndex++;
    this.loading = false;
    this.notify();
  },

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
};

// ============================================
// MEME CARD COMPONENT
// ============================================
const MemeCard = ({ meme, index, onVisible }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef();

  // Intersection observer to detect when card is visible
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible?.(index);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  if (error) {
    return (
      <div class="meme-slide" ref={ref}>
        <div class="meme-card meme-card--error">
          <span>Failed to load</span>
        </div>
      </div>
    );
  }

  return (
    <div class="meme-slide" ref={ref}>
      <div class="meme-card">
        <h2 class="meme-card__title">{fixTitle(meme.title)}</h2>

        <div class="meme-card__image-wrap">
          {!loaded && (
            <div class="meme-card__skeleton">
              <div class="spinner" />
            </div>
          )}
          <img
            src={meme.url}
            alt=""
            class={`meme-card__image ${loaded ? 'loaded' : ''}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
          {meme.isGif && <span class="meme-card__gif-badge">GIF</span>}
        </div>

        <div class="meme-card__meta">
          <span class="meme-card__source">{meme.source}</span>
          <span class="meme-card__upvotes">⬆ {meme.upvotes > 999 ? (meme.upvotes/1000).toFixed(1)+'k' : meme.upvotes}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// APP
// ============================================
const App = () => {
  const [, refresh] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    store.fetchBatch(); // Initial fetch (10 memes)
    return store.subscribe(() => refresh(n => n + 1));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Check if we should fetch more when user views a meme
  const handleVisible = (index) => {
    if (store.shouldFetch(index)) {
      store.fetchBatch();
    }
  };

  if (store.memes.length === 0) {
    return (
      <div class="app">
        <div class="loading-full">
          <div class="spinner" />
          <span>{store.loading ? 'Loading...' : 'No memes found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div class="app">
      <header class="header">
        <div class="header__logo">
          <span class="header__icon">&lt;/&gt;</span>
          <span>DevMemes</span>
        </div>
        <button class="header__theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      <main class="feed">
        {store.memes.map((meme, i) => (
          <MemeCard
            key={meme.id}
            meme={meme}
            index={i}
            onVisible={handleVisible}
          />
        ))}

        {store.loading && (
          <div class="meme-slide meme-slide--loading">
            <div class="spinner" />
          </div>
        )}
      </main>
    </div>
  );
};

render(<App />, document.getElementById('root'));
