/** Mini “internet” for demos — interconnected HTTP pages (mock crawl). */

export interface MockPage {
  html: string;
}

export const MOCK_PAGES: Record<string, MockPage> = {
  "http://news.example.com/": {
    html: `<!DOCTYPE html><html><head><title>News Home</title>
<script>track()</script><style>.x{color:red}</style></head>
<body>
  <h1>Breaking News</h1>
  <p>Apple stock rises after banana shortage ends worldwide.</p>
  <a href="http://news.example.com/tech">Tech</a>
  <a href="http://wiki.example.com/apple">Apple wiki</a>
</body></html>`,
  },
  "http://news.example.com/tech": {
    html: `<!DOCTYPE html><html><body>
  <h1>Technology</h1>
  <p>Distributed systems power modern search engines and crawlers.</p>
  <a href="http://news.example.com/">Home</a>
  <a href="http://blog.example.com/spark">Spark indexing</a>
</body></html>`,
  },
  "http://wiki.example.com/apple": {
    html: `<!DOCTYPE html><html><body>
  <h1>Apple (fruit)</h1>
  <p>An apple is a round fruit. Banana is a tropical fruit.</p>
  <a href="http://wiki.example.com/banana">Banana</a>
</body></html>`,
  },
  "http://wiki.example.com/banana": {
    html: `<!DOCTYPE html><html><body>
  <h1>Banana</h1>
  <p>Bananas are rich in potassium. Often paired with apple in recipes.</p>
  <a href="http://wiki.example.com/apple">Apple</a>
</body></html>`,
  },
  "http://blog.example.com/spark": {
    html: `<!DOCTYPE html><html><body>
  <h1>Batch indexing with Spark</h1>
  <p>Read zip batches from S3, strip script and style tags, tokenize, update inverted index.</p>
  <a href="http://news.example.com/tech">Back to tech news</a>
</body></html>`,
  },
};

export const SEED_URLS = ["http://news.example.com/"];
