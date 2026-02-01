import { h, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import './styles/main.css';

// ============================================
// CONFIG
// ============================================
const SUBREDDITS = ['ProgrammerHumor', 'programmingmemes', 'softwaregore', 'techhumor', 'coding'];
const INITIAL_FETCH = 5;
const BATCH_SIZE = 5;

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
  cursors: {},

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

  async fetchBatch(count) {
    if (this.loading) return;
    this.loading = true;
    this.notify();

    const sub = this.randomSub();
    const cursor = this.cursors[sub] || '';

    try {
      const url = `https://www.reddit.com/r/${sub}/.json?limit=${count + 10}${cursor ? `&after=${cursor}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.data?.after) {
        this.cursors[sub] = json.data.after;
      }

      const posts = (json.data?.children || [])
        .map(c => c.data)
        .filter(p => !p.over_18 && !p.stickied && this.hasImage(p))
        .filter(p => !this.seenIds.has(p.id))
        .slice(0, count)
        .map(p => ({
          id: p.id,
          title: p.title,
          url: this.getImageUrl(p),
          source: `r/${p.subreddit}`,
          upvotes: p.ups,
          isGif: p.url?.includes('.gif'),
        }))
        .filter(p => p.url);

      posts.forEach(p => this.seenIds.add(p.id));
      this.shuffle(posts);
      this.memes.push(...posts);

    } catch (e) {
      console.warn('Fetch failed:', e);
    }

    this.loading = false;
    this.notify();
  },

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  },

  hasImage(p) {
    const url = p.url || '';
    return url.match(/\.(jpg|jpeg|png|gif|webp)/i) ||
           url.includes('i.redd.it') ||
           p.post_hint === 'image';
  },

  getImageUrl(p) {
    const decode = s => s?.replace(/&amp;/g, '&');
    if (p.url?.match(/\.(jpg|jpeg|png|gif|webp)/i)) return decode(p.url);
    if (p.url?.includes('i.redd.it')) return decode(p.url);
    if (p.preview?.images?.[0]?.source?.url) return decode(p.preview.images[0].source.url);
    return null;
  }
};

// ============================================
// MEME CARD COMPONENT
// ============================================
const MemeCard = ({ meme, onVisible }) => {
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
          onVisible?.();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (error) {
    return (
      <div class="meme-slide" ref={ref}>
        <div class="meme-card meme-card--error">
          <span>😕 Failed to load</span>
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
    store.fetchBatch(INITIAL_FETCH);
    return store.subscribe(() => refresh(n => n + 1));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load more when near end
  const handleVisible = (index) => {
    if (index >= store.memes.length - 2 && !store.loading) {
      store.fetchBatch(BATCH_SIZE);
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
            onVisible={() => handleVisible(i)}
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
