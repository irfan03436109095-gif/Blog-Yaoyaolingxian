/* 首页原文随静态模板输出；本地增强排版，无管理接口调用。 */
(() => {
  const source = document.querySelector('[data-feature-source]');
  if (!source || typeof window.markdownit !== 'function' || !window.DOMPurify?.isSupported) return;
  const original = source.textContent;
  const base = new URL(source.dataset.articleUrl, document.baseURI).href;
  const home = document.querySelector('.brand[href]')?.href || document.baseURI;
  const safeURL = (value, context = base, protocols = ['http:', 'https:']) => {
    try {
      if (!value?.trim()) return '';
      const url = new URL(value, context);
      return protocols.includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const mediaURL = (value, context = base) => {
    const path = value?.trim().match(/^\/?assets\/media\/(.+)$/);
    return safeURL(path ? new URL('assets/media/' + path[1], home).href : value, context);
  };
  let publishedImages;
  function resolvePublishedImages() {
    if (publishedImages) return publishedImages;
    publishedImages = (async () => {
      // 仅在内部素材或图片失效时，从同源公开文章读取系统已解析的图片。
      if (location.origin === 'null' || new URL(base).origin !== location.origin) return [];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(base, { credentials: 'omit', signal: controller.signal, headers: { Accept: 'text/html' } });
        if (!response.ok || new URL(response.url).origin !== location.origin) return [];
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const body = doc.querySelector('article[data-pagefind-body] > .prose');
        return body ? [...body.querySelectorAll('img')].map(img => ({ src: mediaURL(img.getAttribute('src'), response.url), alt: img.getAttribute('alt') || '' })) : [];
      } catch { return []; }
      finally { clearTimeout(timer); }
    })();
    return publishedImages;
  }
  try {
    const parser = window.markdownit({ html: true, linkify: false, typographer: false });
    const fragment = window.DOMPurify.sanitize(parser.render(original), {
      RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','b','i','s','del','blockquote','ul','ol','li','pre','code','a','img','figure','figcaption','table','thead','tbody','tfoot','tr','th','td','div','span','sup','sub','kbd','details','summary'],
      ALLOWED_ATTR: ['href','src','alt','title','width','height','start','colspan','rowspan','data-src','id'],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false
    });
    const anchors = new Map();
    let count = 0;
    fragment.querySelectorAll('[id],h1,h2,h3,h4,h5,h6').forEach(node => {
      const id = 'featured-section-' + (++count);
      if (node.id) anchors.set(node.id, id);
      anchors.set(node.textContent.trim().toLowerCase().replace(/\s+/g, '-'), id);
      node.id = id;
      if (/^H[1-6]$/.test(node.tagName)) {
        const heading = document.createElement('h' + Math.min(6, Math.max(3, Number(node.tagName[1]) + 1)));
        heading.id = id;
        heading.append(...node.childNodes);
        node.replaceWith(heading);
      }
    });
    fragment.querySelectorAll('a[href]').forEach(link => {
      const raw = link.getAttribute('href');
      let anchor = '';
      try { anchor = raw.startsWith('#') ? anchors.get(decodeURIComponent(raw.slice(1))) : ''; } catch {}
      if (anchor) { link.setAttribute('href', '#' + anchor); return; }
      const internal = /^\/(?:posts|p|categories|tags|search|page)(?:\/|$)/.test(raw) || raw === '/';
      const url = safeURL(internal ? new URL(raw.slice(1), home).href : raw, base, ['http:', 'https:', 'mailto:', 'tel:']);
      if (!url) { link.replaceWith(...link.childNodes); return; }
      link.href = url;
      link.rel = 'noopener noreferrer';
    });
    fragment.querySelectorAll('img').forEach((img, index) => {
      const direct = mediaURL(img.getAttribute('src') || img.getAttribute('data-src'));
      img.removeAttribute('data-src');
      // 有效尺寸保留占位比例，避免图片加载后推开读到的位置。
      for (const dimension of ['width', 'height']) {
        if (!/^[1-9]\d{0,5}$/.test(img.getAttribute(dimension) || '')) img.removeAttribute(dimension);
      }
      img.loading = 'lazy';
      img.decoding = 'async';
      let attempted = false;
      const unavailable = () => {
        const link = document.createElement('a');
        link.className = 'feature-image-fallback';
        link.href = base;
        link.textContent = (img.alt ? img.alt + ' · ' : '') + '查看原文图片';
        img.replaceWith(link);
      };
      const recover = async () => {
        if (attempted) { unavailable(); return; }
        attempted = true;
        const images = await resolvePublishedImages();
        const matches = img.alt ? images.filter(item => item.alt === img.alt) : [];
        const candidate = matches.length === 1 ? matches[0] : images[index];
        if (candidate?.src && candidate.src !== direct) img.src = candidate.src;
        else unavailable();
      };
      img.addEventListener('error', recover);
      if (direct) img.src = direct;
      else { img.removeAttribute('src'); recover(); }
    });
    source.replaceChildren(fragment);
    source.classList.add('is-rendered');
    setupDirectory();
    setupCodeCopy();
  } catch {
    source.textContent = original;
  }

  function setupDirectory() {
    const directory = document.querySelector('[data-feature-directory]');
    const navigation = directory?.querySelector('[data-feature-toc]');
    if (!navigation) return;
    const headings = [...source.querySelectorAll('h3')];
    if (headings.length < 2) return;
    const links = document.createDocumentFragment();
    headings.forEach(heading => {
      heading.tabIndex = -1;
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent;
      links.append(link);
    });
    navigation.replaceChildren(links);
    directory.querySelector('[data-feature-section-count]').textContent = headings.length + ' 个章节';
    directory.hidden = false;
    navigation.addEventListener('click', event => {
      if (event.target.closest('a') && matchMedia('(max-width: 760px)').matches) directory.open = false;
    });
  }

  // 基础脚本在 Markdown 增强前运行，首页新生成的代码块在这里补齐复制按钮。
  function setupCodeCopy() {
    source.querySelectorAll('pre').forEach(block => {
      if (!block.querySelector('code') || block.querySelector('.code-copy')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = '复制';
      button.setAttribute('aria-label', '复制这段代码');
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(block.querySelector('code').textContent);
          button.textContent = '已复制';
          setTimeout(() => { button.textContent = '复制'; }, 1500);
        } catch { button.textContent = '请手动复制'; }
      });
      block.append(button);
    });
  }
})();
