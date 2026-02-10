// Netlify serverless function to proxy Reddit API requests
// This avoids CORS issues when fetching from the browser

export async function handler(event) {
  const { subreddit, limit, after } = event.queryStringParameters || {};

  if (!subreddit) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing subreddit parameter' })
    };
  }

  const url = `https://www.reddit.com/r/${subreddit}/.json?limit=${limit || 15}${after ? `&after=${after}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DevMemes/1.0 (stackoflols.dev)'
      }
    });

    if (!response.ok) {
      throw new Error(`Reddit returned ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Reddit fetch error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch from Reddit' })
    };
  }
}
