// ===== LIGHTBOX.JS =====

let lightboxImages = [];
let lightboxIndex = 0;
let lightboxScale = 1;

function openLightbox(src, alt) {
  // Collect all images from preview
  const preview = document.getElementById('markdownPreview');
  if (preview) {
    lightboxImages = Array.from(preview.querySelectorAll('img')).map(img => ({
      src: img.src, alt: img.alt || ''
    }));
  } else {
    lightboxImages = [{ src, alt: alt || '' }];
  }
  lightboxIndex = lightboxImages.findIndex(i => i.src === src);
  if (lightboxIndex < 0) lightboxIndex = 0;
  lightboxScale = 1;
  showLightboxImage();
  document.getElementById('lightbox').style.display = 'flex';
  document.addEventListener('keydown', lightboxKeyHandler);
}

function showLightboxImage() {
  const img = lightboxImages[lightboxIndex];
  if (!img) return;
  const el = document.getElementById('lightboxImg');
  const caption = document.getElementById('lbCaption');
  const download = document.getElementById('lbDownload');
  el.src = img.src;
  el.alt = img.alt;
  el.style.transform = `scale(${lightboxScale})`;
  if (caption) caption.textContent = img.alt || '';
  if (download) {
    download.href = img.src;
    download.setAttribute('download', img.alt || 'image');
  }
  // Show/hide nav buttons
  document.querySelector('.lb-prev').style.visibility = lightboxIndex > 0 ? 'visible' : 'hidden';
  document.querySelector('.lb-next').style.visibility = lightboxIndex < lightboxImages.length - 1 ? 'visible' : 'hidden';
}

function lightboxNav(dir) {
  lightboxIndex = Math.max(0, Math.min(lightboxImages.length - 1, lightboxIndex + dir));
  lightboxScale = 1;
  showLightboxImage();
}

function lightboxZoom(factor) {
  lightboxScale = Math.max(0.2, Math.min(5, lightboxScale * factor));
  const el = document.getElementById('lightboxImg');
  if (el) el.style.transform = `scale(${lightboxScale})`;
}

function closeLightbox(e) {
  if (e && e.target !== document.getElementById('lightbox')) return;
  document.getElementById('lightbox').style.display = 'none';
  document.removeEventListener('keydown', lightboxKeyHandler);
  lightboxImages = [];
}

function lightboxKeyHandler(e) {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
  if (e.key === '+') lightboxZoom(1.2);
  if (e.key === '-') lightboxZoom(0.8);
}
