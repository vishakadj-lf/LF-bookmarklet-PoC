(function(){
  'use strict';

  const TAG = '[LF Extractor]';
  const pdfjsCdn = 'https://mozilla.github.io/pdf.js/build/pdf.js';
  const pdfjsWorkerCdn = 'https://mozilla.github.io/pdf.js/build/pdf.worker.js';

  if (window.__LF_PDF_EXTRACTOR_RUNNING__) {
    console.log(TAG, 'already running');
    return;
  }
  window.__LF_PDF_EXTRACTOR_RUNNING__ = true;

  const ui = (() => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:360px;max-width:92vw;background:#111;color:#fff;border-radius:8px;border:1px solid rgba(255,255,255,.1);box-shadow:0 8px 24px rgba(0,0,0,.5);font:13px/1.4 system-ui,Segoe UI,Roboto,Arial,sans-serif;overflow:hidden';
    box.innerHTML = '<div style="padding:10px 12px;background:#1b1b1b;border-bottom:1px solid rgba(255,255,255,.08);font-weight:600">LF PDF Extractor</div><div id="lf-body" style="padding:12px;max-height:55vh;overflow:auto;white-space:pre-wrap;word-break:break-word">Startingâ€¦</div><div style="padding:10px 12px;background:#1b1b1b;border-top:1px solid rgba(255,255,255,.08);text-align:right"><button id="lf-close" style="appearance:none;background:#2b6cb0;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer">Close</button></div>';
    document.documentElement.appendChild(box);
    box.querySelector('#lf-close').onclick = () => { try{box.remove();}catch{} window.__LF_PDF_EXTRACTOR_RUNNING__ = false; };
    const body = box.querySelector('#lf-body');
    return {
      set: (html)=>{ body.innerHTML = html; },
      append: (html)=>{ body.insertAdjacentHTML('beforeend', html); }
    };
  })();

  const fail = (msg, err) => { console.error(TAG, msg, err||''); ui.set(msg + (err? ('\n'+(err.message||String(err))) : '')); window.__LF_PDF_EXTRACTOR_RUNNING__=false; };
  const log = (...a)=>console.log(TAG, ...a);

  function detectPdfUrl() {
    if (/\.pdf(\?|#|$)/i.test(location.href)) return location.href;
    const els = [...document.querySelectorAll('embed,object,iframe')];
    for (const el of els) {
      const t = (el.type||'').toLowerCase();
      const src = el.getAttribute('src') || el.getAttribute('data') || '';
      if (t.includes('application/pdf')) return new URL(src, location.href).toString();
      if (/\.pdf(\?|#|$)/i.test(src)) return new URL(src, location.href).toString();
    }
    return null;
  }

  async function loadScript(url) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + url));
      (document.head || document.documentElement).appendChild(s);
    });
  }

  async function fetchAsArrayBuffer(url) {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.arrayBuffer();
  }

  async function extractFirst5PagesText(pdfData) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('pdfjsLib not available');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerCdn;
    const task = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await task.promise;
    const total = pdf.numPages;
    const upto = Math.min(5, total);
    const pages = [];
    for (let i = 1; i <= upto; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(it => it.str).join(' ');
      pages.push(text);
    }
    return pages.join('\n\n--- Page Break ---\n\n');
  }

  (async () => {
    try {
      ui.set('Loading PDF.jsâ€¦');
      if (!window.pdfjsLib) {
        await loadScript(pdfjsCdn);
      }
      if (!window.pdfjsLib) throw new Error('PDF.js failed to load');

      ui.set('Detecting PDFâ€¦');
      const pdfUrl = detectPdfUrl();
      if (!pdfUrl) {
        ui.set('No PDF detected on this page. Open a PDF tab or embed and retry.');
        window.__LF_PDF_EXTRACTOR_RUNNING__ = false;
        return;
      }
      log('PDF URL:', pdfUrl);

      ui.set('Fetching PDFâ€¦');
      const data = await fetchAsArrayBuffer(pdfUrl);

      ui.set('Extracting text (first 5 pages)â€¦');
      const text = await extractFirst5PagesText(data);

      ui.set('Extraction complete. Showing first 5 pages text.\n\n');
      ui.append(text || '(No text extracted)');
    } catch (e) {
      fail('Extraction error', e);
    }
  })();

})();
