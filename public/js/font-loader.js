(function () {
  var link = document.getElementById('pretendardFont');
  if (!link) return;

  var applied = false;
  function applyFont() {
    if (applied) return;
    applied = true;
    link.media = 'all';
  }

  link.addEventListener('load', applyFont);
  // Don't let a slow or blocked font CDN hold the page hostage - fall back to
  // system fonts and swap in Pretendard whenever (if ever) it arrives.
  setTimeout(applyFont, 3000);
})();
