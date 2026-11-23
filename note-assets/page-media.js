const imageCache = new Map();
let database;
let pdfWorker;
function loadPdfWorker() {
  if (!pdfWorker) {
    pdfWorker = Promise.all([0, 1, 2].map(async (index) => {
      const response = await fetch(new URL('./vendor/pdfjs/worker-part-' + index + '.txt', import.meta.url));
      if (!response.ok) throw Error('PDF 처리 파일을 불러오지 못했어요.');
      return response.text();
    })).then((parts) => new Promise((resolve, reject) => {
      const source = parts.join('') + '\nself.postMessage({noteWorkerReady:true});';
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      let worker;
      const cleanup = () => { clearTimeout(timer); URL.revokeObjectURL(url); };
      const fail = () => {
        cleanup();
        worker?.terminate();
        reject(Error('이 브라우저에서 PDF 처리를 시작하지 못했어요.'));
      };
      const timer = setTimeout(fail, 12000);
      try {
        worker = new Worker(url, { type: 'module' });
        const ready = (event) => {
          if (event.data?.noteWorkerReady !== true) return;
          cleanup();
          worker.removeEventListener('message', ready);
          worker.removeEventListener('error', fail);
          resolve(worker);
        };
        worker.addEventListener('message', ready);
        worker.addEventListener('error', fail);
      } catch { fail(); }
    })).catch((error) => {
      pdfWorker = null;
      throw error;
    });
  }
  return pdfWorker;
}
const pdfBinaryFiles = new Map();
function loadPdfBinaryData(filename) {
  if (!pdfBinaryFiles.has(filename)) {
    const data = fetch(new URL('./vendor/pdfjs/' + filename, import.meta.url)).then((response) => {
      if (!response.ok) throw Error('PDF 글꼴 자료를 불러오지 못했어요.');
      return response.json();
    }).catch((error) => {
      pdfBinaryFiles.delete(filename);
      throw error;
    });
    pdfBinaryFiles.set(filename, data);
  }
  return pdfBinaryFiles.get(filename);
}
class PackedBinaryDataFactory {
  async fetch({ kind, filename }) {
    const folder = { cMapUrl: 'cmaps', standardFontDataUrl: 'standard_fonts', wasmUrl: 'wasm' }[kind];
    const key = folder + '/' + filename;
    const index = await loadPdfBinaryData('binary-index.json');
    if (!index[key]) throw Error('필요한 PDF 글꼴 자료를 찾을 수 없어요.');
    const data = await loadPdfBinaryData(index[key]);
    return Uint8Array.from(atob(data[key]), (character) => character.charCodeAt(0));
  }
}
function checkCancellation(signal) {
  if (signal.aborted) throw signal.reason || Error('작업을 취소했어요.');
}
function openAssets() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('jeongi-note-assets', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('pages');
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = null; };
        resolve(db);
      };
      request.onerror = () => reject(new Error('이 브라우저의 자료 저장소를 열 수 없어요.', { cause: request.error }));
      request.onblocked = () => reject(Error('다른 종이노트 탭을 닫고 자료를 다시 넣어 주세요.'));
    }).catch((error) => {
      database = null;
      throw error;
    });
  }
  return database;
}
export async function assetBlob(key) {
  const db = await openAssets();
  return new Promise((resolve, reject) => {
    const request = db.transaction('pages').objectStore('pages').get(key);
    request.onsuccess = () => {
      if (request.result instanceof Blob) resolve(request.result);
      else reject(new Error('이 페이지의 원본 자료를 찾을 수 없어요.'));
    };
    request.onerror = () => reject(request.error);
  });
}
export async function updateAssets({ entries = [], remove = [] }) {
  if (!entries.length && !remove.length) return;
  const db = await openAssets();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('pages', 'readwrite');
    const store = tx.objectStore('pages');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error ?? Error('자료 저장을 취소했어요.'));
    for (const [key, blob] of entries) store.put(blob, key);
    for (const key of remove) store.delete(key);
  });
  for (const key of remove) imageCache.delete(key);
}
async function decodeImage(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob); }
    catch { /* Some image formats are supported only through the image element. */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error('이미지를 열 수 없어요.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function imageFor(key) {
  let loading = imageCache.get(key);
  if (!loading) {
    loading = assetBlob(key).then(decodeImage).catch((error) => {
      if (imageCache.get(key) === loading) imageCache.delete(key);
      throw error;
    });
    if (imageCache.size >= 6) imageCache.delete(imageCache.keys().next().value);
    imageCache.set(key, loading);
  }
  return loading;
}
export function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(Error('페이지 그림을 만들지 못했어요.')), type, quality);
  });
}
function requireSpace(sourceWidth, sourceHeight, maxWidth, maxHeight) {
  if (!(sourceWidth > 0 && sourceHeight > 0 && Number.isFinite(sourceWidth + sourceHeight))) {
    throw Error('페이지 크기를 읽을 수 없어요.');
  }
  return Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
}
export async function photoRaster(file, sheetWidth, sheetHeight) {
  if (file.size > 25 * 1024 * 1024) throw Error('사진 한 장은 25MB까지 넣을 수 있어요.');
  const head = new Uint8Array(await file.slice(0, 48).arrayBuffer());
  const [a,b,c,d,e,f,g,h] = head;
  const header = String.fromCharCode(...head);
  const jpeg = a === 255 && b === 216 && c === 255;
  const png = a === 137 && b === 80 && c === 78 && d === 71 && e === 13 && f === 10 && g === 26 && h === 10;
  const webp = header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
  const gifOrBmp = header.startsWith('GIF87a') || header.startsWith('GIF89a') || header.startsWith('BM');
  const heifOrAvif = header.slice(4, 8) === 'ftyp' && /avif|avis|heic|heix|hevc|hevx|mif1|msf1/.test(header.slice(8));
  if (!jpeg && !png && !webp && !gifOrBmp && !heifOrAvif) throw Error('JPG, PNG, WebP 등 사진 파일을 선택해 주세요.');
  let src;
  try { src = await decodeImage(file); }
  catch {
    throw Error(heifOrAvif ? '이 브라우저가 이 사진 형식을 열 수 없어요. JPG나 PNG로 변환한 뒤 넣어 주세요.' :
      '사진을 열 수 없어요. 파일이 정상인지 확인해 주세요.');
  }
  const sourceWidth = src.naturalWidth ?? src.width;
  const sourceHeight = src.naturalHeight ?? src.height;
  const scale = Math.min(1, requireSpace(sourceWidth, sourceHeight, sheetWidth * 2, sheetHeight * 2));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  src.close?.();
  return canvasBlob(canvas, 'image/jpeg', .9);
}
export function parsePageRange(value, numPages, maximum = 100) {
  const text = String(value ?? '').trim().replace(/[–—−~～－]/g, '-').replace(/，/g, ',');
  if (!text || text === '전체') {
    if (numPages > maximum) throw Error(`PDF는 한 번에 ${maximum}쪽까지 넣을 수 있어요. 자료 넣기 → PDF를 현재 노트에 추가에서 가져올 쪽을 골라 주세요.`);
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }
  if (text.length > 2000) throw Error('가져올 쪽 범위를 짧게 입력해 주세요.');
  const selected = new Set();
  for (const part of text.split(',')) {
    const match = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) throw Error('쪽 범위는 1-3, 5처럼 입력해 주세요.');
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > numPages) {
      throw Error(`이 PDF의 1쪽부터 ${numPages}쪽 사이에서 골라 주세요.`);
    }
    for (let page = first; page <= last; page++) {
      selected.add(page);
      if (selected.size > maximum) throw Error(`PDF는 한 번에 ${maximum}쪽까지 넣을 수 있어요.`);
    }
  }
  return [...selected].sort((a, b) => a - b);
}
export async function pdfRasters(file, sheetWidth, sheetHeight, progress, signal) {
  return (await selectedPdfRasters(file, sheetWidth, sheetHeight, progress, signal)).images;
}
export async function selectedPdfRasters(file, sheetWidth, sheetHeight, progress, signal, range = '') {
  if (file.size > 60 * 1024 * 1024) throw Error('PDF 한 파일은 60MB까지 넣을 수 있어요.');
  let pdfjs;
  try { pdfjs = await import('./vendor/pdfjs/pdf.min.js'); }
  catch (cause) { throw new Error('PDF를 읽는 기능을 불러오지 못했어요. 종이노트를 새로고침해 주세요.', { cause }); }
  const base = new URL('./vendor/pdfjs/', import.meta.url);
  pdfjs.GlobalWorkerOptions.workerPort = await loadPdfWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  checkCancellation(signal);
  const task = pdfjs.getDocument({
    data,
    cMapUrl: new URL('cmaps/', base).href,
    cMapPacked: true,
    useWorkerFetch: false,
    BinaryDataFactory: PackedBinaryDataFactory,
    standardFontDataUrl: new URL('standard_fonts/', base).href,
    wasmUrl: new URL('wasm/', base).href,
    isEvalSupported: false,
    enableXfa: false,
    stopAtErrors: true,
    canvasMaxAreaInBytes: 32 * 1024 * 1024
  });
  let render;
  const abort = () => {
    render?.cancel();
    task.destroy().catch(() => {});
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    const pageNumbers = parsePageRange(range, pdf.numPages);
    const pages = [];
    const canvas = document.createElement('canvas');
    for (const [index, pageNumber] of pageNumbers.entries()) {
      checkCancellation(signal);
      progress(index, pageNumbers.length, '쪽');
      const page = await pdf.getPage(pageNumber);
      const size = page.getViewport({ scale: 1 });
      const scale = requireSpace(size.width, size.height, sheetWidth * 2, sheetHeight * 2);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      render = page.render({ canvas, viewport, background: '#fff' });
      await render.promise;
      render = null;
      checkCancellation(signal);
      pages.push(await canvasBlob(canvas, 'image/jpeg', .92));
      page.cleanup();
      progress(index + 1, pageNumbers.length, '쪽');
    }
    return { images: pages, pageNumbers };
  } catch (error) {
    if (error?.name === 'PasswordException') throw Error('암호가 걸린 PDF예요. 잠금을 해제한 파일을 선택해 주세요.');
    if (['InvalidPDFException', 'UnknownErrorException', 'FormatError'].includes(error?.name)) {
      throw Error('PDF를 읽을 수 없어요. 파일이 정상인지 확인해 주세요.');
    }
    if (error?.name === 'Error' && /worker/i.test(error.message)) {
      throw new Error('이 브라우저에서 PDF 처리를 시작하지 못했어요. Chrome이나 삼성 인터넷에서 종이노트를 열어 주세요.', { cause: error });
    }
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    await task.destroy().catch(() => {});
  }
}
export async function noteAsPdf(title, pages, render, progress, signal) {
  const { PDFDocument, PageSizes } = await import('./vendor/pdf-lib/pdf-lib.min.js');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const [paperWidth, paperHeight] = PageSizes.A4;
  for (const [index, page] of pages.entries()) {
    checkCancellation(signal);
    progress(index, pages.length, '쪽');
    const image = await render(page);
    const jpeg = await canvasBlob(image, 'image/jpeg', .92);
    const embedded = await pdf.embedJpg(await jpeg.arrayBuffer());
    const scale = requireSpace(image.width, image.height, paperWidth - 36, paperHeight - 36);
    const renderWidth = image.width * scale;
    const renderHeight = image.height * scale;
    pdf.addPage(PageSizes.A4).drawImage(embedded, {
      x: (paperWidth - renderWidth) / 2, y: (paperHeight - renderHeight) / 2,
      width: renderWidth, height: renderHeight
    });
    progress(index + 1, pages.length, '쪽');
  }
  checkCancellation(signal);
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}

