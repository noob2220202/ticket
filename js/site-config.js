// 도메인(호스트명)별로 달라지는 사업자 정보를 적용합니다.
// 같은 코드베이스를 여러 도메인에서 서빙할 때, 표시되는 상호/대표자/
// 사업자등록번호/주소/연락처를 호스트명에 맞춰 바꿉니다. 매칭되는 항목이
// 없으면 기본값(복드림 상품권)을 유지합니다.
//
// window.BOKDREAM_BIZ_INFO 로 항상 "이 도메인에 적용되는 최종 사업자 정보"를
// 전역에 노출합니다. index.html의 푸터뿐 아니라, admin.html에 이 스크립트를
// 먼저 불러두면 js/admin-payouts.js의 지급내역서(PDF) 상단에도 같은 정보를
// 그대로 씁니다(관리자 페이지에는 .biz-info 같은 DOM이 없어서 아래 DOM 갱신
// 부분은 조용히 건너뜁니다).
(function () {
  var DEFAULT_BIZ = {
    bizName: '복드림 상품권',
    bizRegNo: '623-70-00295',
    bizAddress: '서울특별시 성동구 천호대로 430, 1층 103호(용답동)',
  };

  var SITE_CONFIG = {
    'bokdreamticket.store': { owner: '김상현', phone: '010-6497-7010' },
    'ticketbokdream.shop': { owner: '양동헌', phone: '010-8113-7635' },
    // 복드림.store (한글 도메인) — 브라우저는 punycode(xn--) 형태로 전달하지만
    // 두 표기 모두 등록해 둡니다.
    'xn--hy1bm6gx4c.store': { owner: '김상현', phone: '010-6497-7010' },
    '복드림.store': { owner: '김상현', phone: '010-6497-7010' },
    // 전화번호를 아예 노출하지 않는 도메인은 phone 대신 hidePhone을 씁니다.
    'bokdreamticket.shop': { owner: '박성현', hidePhone: true },
    'bokdream.store': { owner: '황보경애', phone: '010-6266-6699' },
    'bokdream1.store': { owner: '이승우', phone: '010-8140-3019' },
    '1.bokdreamticket.store': { owner: '하석태', phone: '010-5565-9634' },
    '2.bokdreamticket.store': { owner: '김택현', phone: '010-4201-5455' },
    '4.bokdreamticket.store': { owner: '조광연', phone: '010-5620-9257' },
    '5.bokdreamticket.store': { owner: '양정수', phone: '010-8209-5136' },
    'ticketbokdream.store': { owner: '정대원', phone: '010-2657-4587' },
    'bok-dreamticket.store': { owner: '양정수', phone: '010-8209-5136' },
    'bokdream-ticket.shop': { owner: '김민정', phone: '010-6629-3110' },
    'no1.bokdream.store': { owner: '이승진', phone: '010-8120-0262' },
    // 사이트별로 상호/사업자등록번호/주소가 다르면 bizName/bizRegNo/bizAddress를
    // 추가하면 됩니다(server/site-biz-info.js에도 같은 값을 PORT 기준으로 넣어야
    // 지급내역서 PDF에도 반영됩니다).
  };

  var host = window.location.hostname.replace(/^www\./, '');
  var cfg = SITE_CONFIG[host] || {};

  var resolved = {
    owner: cfg.owner || null,
    phone: cfg.hidePhone ? null : (cfg.phone || null),
    hidePhone: Boolean(cfg.hidePhone),
    bizName: cfg.bizName || DEFAULT_BIZ.bizName,
    bizRegNo: cfg.bizRegNo || DEFAULT_BIZ.bizRegNo,
    bizAddress: cfg.bizAddress || DEFAULT_BIZ.bizAddress,
  };
  window.BOKDREAM_BIZ_INFO = resolved;

  if (!SITE_CONFIG[host]) return; // 매칭 안 되면 HTML 기본값 그대로 두고 끝.

  var nameEl = document.getElementById('bizName');
  if (nameEl) nameEl.textContent = resolved.bizName;

  var regNoEl = document.getElementById('bizRegNo');
  if (regNoEl) regNoEl.textContent = resolved.bizRegNo;

  var addressEl = document.getElementById('bizAddress');
  if (addressEl) addressEl.textContent = resolved.bizAddress;

  if (cfg.owner) {
    var ownerEl = document.getElementById('bizOwner');
    if (ownerEl) ownerEl.textContent = cfg.owner;

    var privacyEl = document.getElementById('bizPrivacyOfficer');
    if (privacyEl) privacyEl.textContent = cfg.owner;
  }

  if (cfg.hidePhone) {
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.remove();
    });
    document.querySelectorAll('.biz-info > div').forEach(function (row) {
      var dt = row.querySelector('dt');
      if (dt && dt.textContent.trim() === '연락처') {
        row.remove();
      }
    });
  } else if (cfg.phone) {
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
