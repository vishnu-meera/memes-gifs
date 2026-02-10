// Netlify serverless function to proxy Reddit API requests
const https = require('https');

const fetchReddit = (url) => {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DevMemes/1.0; +https://stackoflols.dev)',
        'Accept': 'application/json'
      }
    };

    const makeRequest = (requestUrl) => {
      https.get(requestUrl, options, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (res.headers.location) {
            makeRequest(res.headers.location);
            return;
          }
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: data,
            contentType: res.headers['content-type']
          });
        });
      }).on('error', reject);
    };

    makeRequest(url);
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

  // Use oauth.reddit.com which is more reliable for API access
  const url = `https://www.reddit.com/r/${subreddit}.json?limit=${limit || 15}&raw_json=1${after ? `&after=${after}` : ''}`;

  try {
    const { status, data, contentType } = await fetchReddit(url);

    // Check if we got JSON
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response:', contentType, data.substring(0, 500));
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'Reddit returned non-JSON response',
          contentType: contentType,
          preview: data.substring(0, 200)
        })
      };
    }

    if (status !== 200) {
      return {
        statusCode: status,
        body: JSON.stringify({ error: `Reddit returned ${status}` })
      };
    }

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      console.error('JSON parse error:', e.message, data.substring(0, 500));
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Failed to parse Reddit response' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(parsed)
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
