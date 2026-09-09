// 도메인(호스트명)별로 달라지는 사업자 정보를 적용합니다.
// 같은 코드베이스를 여러 도메인에서 서빙할 때, 표시되는 대표자명 등을
// 호스트명에 맞춰 바꿉니다. 매칭되는 항목이 없으면 HTML의 기본값을 유지합니다.
(function () {
  var SITE_CONFIG = {
    'bokdreamticket.store': { owner: '송은영, 이추봉' },
    'ticketbokdream.shop': { owner: '양동헌' },
  };

  var host = window.location.hostname.replace(/^www\./, '');
  var cfg = SITE_CONFIG[host];
  if (!cfg) return;

  if (cfg.owner) {
    var ownerEl = document.getElementById('bizOwner');
    if (ownerEl) ownerEl.textContent = cfg.owner;
  }
})();
