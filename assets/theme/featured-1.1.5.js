/* 静态首页正文的轻量增强。 */
(() => {
  const source = document.querySelector('[data-feature-source]');
  if (!source) return;
  source.querySelectorAll('h3').forEach((heading,index) => {
    if (!heading.id) heading.id = 'featured-section-' + (index + 1);
  });
  source.querySelectorAll('pre').forEach(block => {
    if (!block.querySelector('code') || block.querySelector('.code-copy')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'code-copy';
    button.textContent = '复制'; button.setAttribute('aria-label','复制这段代码');
    button.addEventListener('click',async () => {
      try {
        await navigator.clipboard.writeText(block.querySelector('code').textContent);
        button.textContent = '已复制';
        setTimeout(() => { button.textContent = '复制'; },1500);
      } catch { button.textContent = '请手动复制'; }
    });
    block.append(button);
  });
})();
