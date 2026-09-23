// 도메인(호스트명)별로 달라지는 사업자 정보를 적용합니다.
// 같은 코드베이스를 여러 도메인에서 서빙할 때, 표시되는 대표자명 등을
// 호스트명에 맞춰 바꿉니다. 매칭되는 항목이 없으면 HTML의 기본값을 유지합니다.
(function () {
  var SITE_CONFIG = {
    'bokdreamticket.store': { owner: '김상현', phone: '010-6497-7010' },
    'ticketbokdream.shop': { owner: '양동헌', phone: '010-8113-7635' },
    // 복드림.store (한글 도메인) — 브라우저는 punycode(xn--) 형태로 전달하지만
    // 두 표기 모두 등록해 둡니다.
    'xn--hy1bm6gx4c.store': { owner: '김상현', phone: '010-6497-7010' },
    '복드림.store': { owner: '김상현', phone: '010-6497-7010' },
  };

  var host = window.location.hostname.replace(/^www\./, '');
  var cfg = SITE_CONFIG[host];
  if (!cfg) return;

  if (cfg.owner) {
    var ownerEl = document.getElementById('bizOwner');
    if (ownerEl) ownerEl.textContent = cfg.owner;
  }

  if (cfg.phone) {
    var phoneRe = /\d{2,3}-\d{3,4}-\d{4}/;
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.setAttribute('href', 'tel:' + cfg.phone);
      a.childNodes.forEach(function (node) {
        if (node.nodeType === 3 && phoneRe.test(node.nodeValue)) {
          node.nodeValue = node.nodeValue.replace(phoneRe, cfg.phone);
        }
      });
    });
  }
})();
