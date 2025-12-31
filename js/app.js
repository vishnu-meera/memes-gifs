/* ============================================
   MAIN APP - Meme API Integration
   Fetches real memes from programming subreddits
   ============================================ */

class MemeApp {
    constructor() {
        this.feed = null;
        this.loadingIndicator = null;
        this.endMessage = null;
        this.isLoading = false;
        this.hasMore = true;
        
        // Meme API configuration (uses Reddit data via proxy - no CORS issues)
        this.subreddits = [
            'ProgrammerHumor',
            'programmingmemes', 
            'codingmemes'
        ];
        this.currentSubredditIndex = 0;
        this.seenIds = new Set(); // Prevent duplicates
        this.failedAttempts = 0;
        this.maxFailedAttempts = 3;
        
        // Dynamic initial load based on screen size
        this.itemsPerPage = this.calculateItemsPerPage();
        
        this.init();
    }

    // Calculate how many memes to load based on screen height
    calculateItemsPerPage() {
        const screenHeight = window.innerHeight;
        const cardEstimatedHeight = 600;
        const cardsPerScreen = Math.ceil(screenHeight / cardEstimatedHeight);
        const items = Math.max(6, Math.min(20, cardsPerScreen * 2.5));
        
        console.log(`Screen height: ${screenHeight}px, Loading ${Math.floor(items)} items per page`);
        return Math.floor(items);
    }

    // Initialize app
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    // Setup after DOM is ready
    setup() {
        this.feed = document.getElementById('feed');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.endMessage = document.getElementById('endMessage');
        
        // Show initial loading skeletons
        this.showSkeletons(this.itemsPerPage);
        
        // Setup infinite scroll
        this.setupInfiniteScroll();
        
        // Setup reload button
        this.setupReloadButton();
        
        // Load initial memes
        this.loadInitialMemes();
        
        // Handle window resize
        window.addEventListener('resize', this.debounce(() => {
            this.itemsPerPage = this.calculateItemsPerPage();
        }, 250));
    }

    // Show loading skeletons
    showSkeletons(count) {
        this.feed.innerHTML = '';
        
        for (let i = 0; i < count; i++) {
            const skeleton = this.createSkeleton();
            this.feed.appendChild(skeleton);
        }
    }

    // Create skeleton card
    createSkeleton() {
        const card = document.createElement('div');
        card.className = 'skeleton-card';
        
        card.innerHTML = `
            <div class="skeleton-header">
                <div class="skeleton-title"></div>
                <div class="skeleton-source"></div>
            </div>
            <div class="skeleton-image"></div>
            <div class="skeleton-footer">
                <div class="skeleton-meta"></div>
            </div>
        `;
        
        return card;
    }

    // Fetch memes using the Meme API (CORS-friendly)
    async fetchMemes(subreddit, count = 10) {
        // Using meme-api.com which proxies Reddit and handles CORS
        const url = `https://meme-api.com/gimme/${subreddit}/${count}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching from ${subreddit}:`, error);
            return null;
        }
    }

    // Parse API response
    parseMemes(data, subreddit) {
        if (!data || !data.memes) {
            return [];
        }
        
        const memes = [];
        
        for (const post of data.memes) {
            // Skip if already seen
            if (this.seenIds.has(post.postLink)) {
                continue;
            }
            
            // Skip NSFW
            if (post.nsfw) {
                continue;
            }
            
            this.seenIds.add(post.postLink);
            
            memes.push({
                id: post.postLink,
                title: post.title,
                source: `r/${post.subreddit}`,
                imageUrl: post.url,
                upvotes: post.ups,
                permalink: post.postLink,
                author: post.author
            });
        }
        
        return memes;
    }

    // Load initial memes
    async loadInitialMemes() {
        this.isLoading = true;
        this.failedAttempts = 0;
        
        const allMemes = [];
        
        // Fetch from multiple subreddits for variety
        for (const subreddit of this.subreddits) {
            const data = await this.fetchMemes(subreddit, 10);
            
            if (data) {
                const memes = this.parseMemes(data, subreddit);
                allMemes.push(...memes);
            }
        }
        
        // Shuffle memes for variety
        this.shuffleArray(allMemes);
        
        // Clear skeletons and show memes
        this.feed.innerHTML = '';
        
        if (allMemes.length === 0) {
            this.showError('No memes found. Please try again later.');
            this.isLoading = false;
            return;
        }
        
        // Display memes
        const memesToShow = allMemes.slice(0, this.itemsPerPage);
        memesToShow.forEach(meme => {
            const card = this.createMemeCard(meme);
            this.feed.appendChild(card);
        });
        
        this.isLoading = false;
        console.log(`Loaded ${memesToShow.length} memes`);
    }

    // Create meme card element
    createMemeCard(meme) {
        const card = document.createElement('article');
        card.className = 'meme-card';
        card.setAttribute('data-meme-id', meme.id);
        
        card.innerHTML = `
            <div class="meme-card-header">
                <h2 class="meme-title">${this.escapeHtml(meme.title)}</h2>
                <span class="meme-source">${this.escapeHtml(meme.source)}</span>
            </div>
            <div class="meme-image-container">
                <img 
                    class="meme-image" 
                    data-src="${meme.imageUrl}"
                    alt="${this.escapeHtml(meme.title)}"
                    loading="lazy"
                >
            </div>
            <div class="meme-card-footer">
                <span class="meme-meta">⬆️ ${this.formatNumber(meme.upvotes)}</span>
            </div>
        `;
        
        // Setup lazy loading for image
        this.setupLazyLoad(card);
        
        // Make card clickable to open original post
        card.addEventListener('click', () => {
            window.open(meme.permalink, '_blank', 'noopener');
        });
        card.style.cursor = 'pointer';
        
        return card;
    }

    // Setup lazy loading for images
    setupLazyLoad(card) {
        const img = card.querySelector('.meme-image');
        
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const image = entry.target;
                        image.src = image.dataset.src;
                        
                        image.onload = () => {
                            image.classList.add('loaded');
                        };
                        
                        observer.unobserve(image);
                    }
                });
            }, {
                rootMargin: '50px'
            });
            
            observer.observe(img);
        } else {
            // Fallback for older browsers
            img.src = img.dataset.src;
            img.classList.add('loaded');
        }
    }

    // Setup infinite scroll
    setupInfiniteScroll() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.isLoading && this.hasMore) {
                        this.loadMore();
                    }
                });
            }, {
                rootMargin: '200px'
            });
            
            observer.observe(this.loadingIndicator);
        } else {
            // Fallback: scroll event
            window.addEventListener('scroll', this.debounce(() => {
                if (this.isNearBottom() && !this.isLoading && this.hasMore) {
                    this.loadMore();
                }
            }, 200));
        }
    }

    // Load more memes
    async loadMore() {
        if (this.isLoading || !this.hasMore) return;
        
        this.isLoading = true;
        this.loadingIndicator.classList.add('active');
        
        try {
            // Rotate through subreddits for variety
            const subreddit = this.subreddits[this.currentSubredditIndex];
            const data = await this.fetchMemes(subreddit, this.itemsPerPage);
            
            if (data) {
                const memes = this.parseMemes(data, subreddit);
                
                if (memes.length > 0) {
                    memes.forEach(meme => {
                        const card = this.createMemeCard(meme);
                        this.feed.appendChild(card);
                    });
                    
                    this.failedAttempts = 0;
                    console.log(`Loaded ${memes.length} more memes from r/${subreddit}`);
                } else {
                    this.failedAttempts++;
                }
            } else {
                this.failedAttempts++;
            }
            
            // Rotate to next subreddit
            this.currentSubredditIndex = (this.currentSubredditIndex + 1) % this.subreddits.length;
            
            // Stop if too many failed attempts
            if (this.failedAttempts >= this.maxFailedAttempts) {
                this.hasMore = false;
                this.endMessage.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Error loading more memes:', error);
            this.failedAttempts++;
        }
        
        this.isLoading = false;
        this.loadingIndicator.classList.remove('active');
    }

    // Setup reload button
    setupReloadButton() {
        const reloadBtn = document.getElementById('reloadBtn');
        
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => {
                // Reset and reload
                this.hasMore = true;
                this.currentSubredditIndex = 0;
                this.seenIds.clear();
                this.failedAttempts = 0;
                this.endMessage.style.display = 'none';
                this.feed.innerHTML = '';
                this.showSkeletons(this.itemsPerPage);
                this.loadInitialMemes();
            });
        }
    }

    // Show error message
    showError(message) {
        this.feed.innerHTML = `
            <div class="error-message">
                <p>😅 ${message}</p>
                <button class="btn-reload" onclick="window.memeApp.reloadFeed()">
                    Try Again
                </button>
            </div>
        `;
    }

    // Public reload method
    reloadFeed() {
        this.hasMore = true;
        this.currentSubredditIndex = 0;
        this.seenIds.clear();
        this.failedAttempts = 0;
        this.endMessage.style.display = 'none';
        this.feed.innerHTML = '';
        this.showSkeletons(this.itemsPerPage);
        this.loadInitialMemes();
    }

    // Shuffle array (Fisher-Yates)
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Check if user is near bottom
    isNearBottom() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        return scrollTop + windowHeight >= documentHeight - 400;
    }

    // Utility: Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Utility: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Utility: Format numbers (1000 -> 1k)
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }
}

// Initialize app
const app = new MemeApp();

// Export for debugging
window.memeApp = app;
