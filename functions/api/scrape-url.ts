// Cloudflare Pages Function for Web Scraping
// This replaces app/api/scrape-url/route.ts

// Note: Puppeteer doesn't work in Cloudflare Workers
// We'll use Cloudflare's Browser Rendering API or a simpler fetch approach

interface Env {
  // Add any required environment variables
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request } = context;

  try {
    const { url } = await request.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the webpage content
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Extract basic information using regex (simple approach)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    const descriptionMatch = html.match(/<meta[^>]*name=[\"']description[\"'][^>]*content=[\"']([^\"']+)[\"']/i);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Extract CSS styles
    const cssMatches = html.match(/<style[^>]*>([^<]*)<\/style>/gi) || [];
    const inlineCss = cssMatches.map(match => {
      const cssContent = match.replace(/<\/?style[^>]*>/gi, '');
      return cssContent;
    }).join('\\n');

    // Extract external CSS links
    const cssLinks = [];
    const linkMatches = html.match(/<link[^>]*rel=[\"']stylesheet[\"'][^>]*>/gi) || [];
    for (const linkMatch of linkMatches) {
      const hrefMatch = linkMatch.match(/href=[\"']([^\"']+)[\"']/i);
      if (hrefMatch) {
        cssLinks.push(hrefMatch[1]);
      }
    }

    // Try to fetch external CSS (first few only to avoid timeout)
    let externalCss = '';
    for (let i = 0; i < Math.min(cssLinks.length, 3); i++) {
      try {
        let cssUrl = cssLinks[i];
        if (cssUrl.startsWith('/')) {
          cssUrl = `${targetUrl.origin}${cssUrl}`;
        } else if (!cssUrl.startsWith('http')) {
          cssUrl = `${targetUrl.origin}/${cssUrl}`;
        }
        
        const cssResponse = await fetch(cssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Open-Lovable/1.0)' }
        });
        
        if (cssResponse.ok) {
          const cssContent = await cssResponse.text();
          externalCss += `\\n/* From ${cssUrl} */\\n${cssContent}\\n`;
        }
      } catch (error) {
        console.error(`Failed to fetch CSS ${cssLinks[i]}:`, error);
      }
    }

    // Extract colors from CSS
    const allCss = inlineCss + externalCss;
    const colors = extractColors(allCss);

    // Extract meta tags
    const metaTags: { [key: string]: string } = {};
    const metaMatches = html.match(/<meta[^>]*>/gi) || [];
    for (const metaMatch of metaMatches) {
      const nameMatch = metaMatch.match(/name=[\"']([^\"']+)[\"']/i);
      const contentMatch = metaMatch.match(/content=[\"']([^\"']+)[\"']/i);
      if (nameMatch && contentMatch) {
        metaTags[nameMatch[1]] = contentMatch[1];
      }
    }

    const scrapedData = {
      url: targetUrl.toString(),
      title,
      description,
      meta: metaTags,
      css: {
        inline: inlineCss,
        external: externalCss,
        links: cssLinks
      },
      colors: Array.from(colors),
      timestamp: new Date().toISOString(),
      // Note: No screenshot available without browser automation
      screenshot: null,
      content: {
        length: html.length,
        hasImages: html.includes('<img'),
        hasVideo: html.includes('<video'),
        hasForms: html.includes('<form'),
        hasCanvas: html.includes('<canvas')
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: scrapedData
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('Scrape URL error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to scrape URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function extractColors(css: string): Set<string> {
  const colors = new Set<string>();
  
  // Match hex colors
  const hexMatches = css.match(/#([a-f0-9]{3}|[a-f0-9]{6})/gi) || [];
  hexMatches.forEach(color => colors.add(color.toLowerCase()));
  
  // Match rgb colors
  const rgbMatches = css.match(/rgb\\s*\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*\\)/gi) || [];
  rgbMatches.forEach(color => colors.add(color.toLowerCase()));
  
  // Match rgba colors
  const rgbaMatches = css.match(/rgba\\s*\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*[\\d.]+\\s*\\)/gi) || [];
  rgbaMatches.forEach(color => colors.add(color.toLowerCase()));
  
  // Match named colors (common ones)
  const namedColors = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'gray', 'grey', 'navy', 'teal', 'lime', 'cyan', 'magenta'
  ];
  
  const lowerCss = css.toLowerCase();
  namedColors.forEach(color => {
    if (lowerCss.includes(color)) {
      colors.add(color);
    }
  });
  
  return colors;
}

// Handle CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}