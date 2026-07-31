import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as cheerio from 'cheerio';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  const urlParam = req.query.url as string;
  
  if (!urlParam) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }
  
  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch (err) {
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      // If it's an image, video, etc., just return basic info
      res.json({
        title: targetUrl.hostname,
        description: `File type: ${contentType}`,
        image: contentType.startsWith('image/') ? targetUrl.toString() : ''
      });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const htmlTitle = $('title').first().text();
    
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const twitterDesc = $('meta[name="twitter:description"]').attr('content');
    const htmlMetaDesc = $('meta[name="description"]').attr('content');

    const ogImage = $('meta[property="og:image"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');

    // YouTube specific
    let ytTitle = '';
    if (targetUrl.hostname.includes('youtube.com') || targetUrl.hostname.includes('youtu.be')) {
      ytTitle = $('meta[name="title"]').attr('content') || '';
    }

    const title = ytTitle || ogTitle || twitterTitle || htmlTitle || targetUrl.hostname;
    const description = ogDesc || twitterDesc || htmlMetaDesc || '';
    let image = ogImage || twitterImage || '';

    // Handle relative images
    if (image && !image.startsWith('http')) {
      if (image.startsWith('/')) {
        image = `${targetUrl.protocol}//${targetUrl.host}${image}`;
      } else {
        image = `${targetUrl.protocol}//${targetUrl.host}/${image}`;
      }
    }

    res.json({
      title: title.trim(),
      description: description.trim(),
      image: image.trim()
    });

  } catch (err: any) {
    // If it timeouts or fails, fail gracefully and return empty strings so the client doesn't crash
    res.json({
      title: '',
      description: '',
      image: ''
    });
  }
});

export default router;
