// Netlify serverless function to proxy Reddit API requests
// Uses built-in https module for maximum compatibility

const https = require('https');

const fetchReddit = (url) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'DevMemes/1.0 (stackoflols.dev)'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error('Failed to parse JSON'));
        }
      });
    }).on('error', reject);
  });
};

const handler = async (event) => {
  const { subreddit, limit, after } = event.queryStringParameters || {};

  if (!subreddit) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing subreddit parameter' })
    };
  }

  const url = `https://www.reddit.com/r/${subreddit}/.json?limit=${limit || 15}${after ? `&after=${after}` : ''}`;

  try {
    const { status, data } = await fetchReddit(url);

    if (status !== 200) {
      throw new Error(`Reddit returned ${status}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Reddit fetch error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch from Reddit', details: error.message })
    };
  }
};

module.exports = { handler };
