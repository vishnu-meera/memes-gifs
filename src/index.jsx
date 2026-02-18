import { h, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import './styles/main.css';

// Fix camelCase titles
const fixTitle = (title) => {
  if (!title) return '';
  return title
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
};

// ============================================
// CONFIG
// ============================================
const SUBREDDITS = ['shittyprogramming', 'technope','linuxmemes', 'programmerHumor', 'programmingmemes', 'softwaregore', 'techhumor'];

// ============================================
// STORE
// ============================================
const store = {
  memes: [],
  loading: false,
  listeners: new Set(),
  seenIds: new Set(),
  phase: 0, // 0 = initial (5 each), 1 = bulk (100 each), 2 = done

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  notify() {
    this.listeners.forEach(fn => fn());
  },

  addMemes(newMemes) {
    // Filter, dedupe, and add
    const filtered = newMemes
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

    filtered.forEach(p => this.seenIds.add(p.id));
    this.memes.push(...filtered);
    this.notify();
  },

  // Phase 1: Get 2 from each subreddit IN PARALLEL
  async fetchInitial() {
    if (this.phase !== 0) return;
    this.loading = true;
    this.notify();

    // Fire ALL requests at once
    const fetches = SUBREDDITS.map(sub =>
      fetch(`https://meme-api.com/gimme/${sub}/1`)
        .then(res => res.json())
        .then(data => {
          if (data.memes) {
            this.addMemes(data.memes);
            this.loading = false; // Hide loader as soon as ANY memes arrive
          }
        })
        .catch(e => console.warn(`Failed: ${sub}`, e))
    );

    // Don't block - let rest load in background
    Promise.all(fetches).then(() => {
      this.phase = 1;
      this.notify();
    });
  },

  // Phase 2: Get 100 from each subreddit (triggered at meme 20)
  async fetchBulk() {
    if (this.phase !== 1) return;
    this.loading = true;
    this.phase = 2; // Mark as done to prevent re-trigger
    this.notify();

    // Fetch all in parallel
    const fetches = SUBREDDITS.map(async (sub) => {
      try {
        // meme-api.com max is 50, so we need 2 requests per sub
        const [res1] = await Promise.all([
          fetch(`https://meme-api.com/gimme/${sub}/50`)
        ]);
        const [data1] = await Promise.all([res1.json()]);
        return [...(data1.memes || [])];
      } catch (e) {
        console.warn(`Failed to fetch from ${sub}:`, e);
        return [];
      }
    });

    const results = await Promise.all(fetches);
    const allMemes = results.flat();

    // Shuffle for variety
    for (let i = allMemes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allMemes[i], allMemes[j]] = [allMemes[j], allMemes[i]];
    }

    this.addMemes(allMemes);

    this.loading = false;
    this.notify();
  },

  // Check if we should trigger bulk fetch
  checkTrigger(viewedIndex) {
    if (this.phase === 1 && viewedIndex >= 4) {
      this.fetchBulk();
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
    store.fetchInitial();
    return store.subscribe(() => refresh(n => n + 1));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleVisible = (index) => {
    store.checkTrigger(index);
  };

  if (store.memes.length === 0) {
    return (
      <div class="app">
        <div class="loading-full">
          <div class="spinner" />
          <span>Loading...</span>
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
          <MemeCard key={meme.id} meme={meme} index={i} onVisible={handleVisible} />
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
