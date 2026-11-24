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
    'bokdream.store': { owner: '황보경애', phone: '010-5746-1721' },
    'bokdream1.store': { owner: '이승우', phone: '010-8140-3019' },
    '1.bokdreamticket.store': { owner: '하석태', phone: '010-5565-9634' },
    '2.bokdreamticket.store': { owner: '김택현', phone: '010-4201-5455' },
    '4.bokdreamticket.store': { owner: '조광연', phone: '010-5620-9257' },
    '5.bokdreamticket.store': { owner: '양정수', phone: '010-8209-5136' },
    'ticketbokdream.store': { owner: '정대원', phone: '010-2657-4587' },
    'bok-dreamticket.store': { owner: '양정수', phone: '010-8209-5136' },
    'bokdream-ticket.shop': { owner: '김민정', phone: '010-6629-3110' },
    'no1.bokdream.store': { owner: '이승진', phone: '010-8120-0262' },
    'bok-dream.store': { owner: '정연재', phone: '010-7560-8253' },
    // 상호 자체가 다른 사이트(복드림이 아닌 별도 사업자). bizName을 주면 화면의
    // "복드림 상품권" 문구(로고·제목·푸터·저작권)가 전부 이 상호로 바뀝니다.
    'tm-ticket.store': {
      owner: '장규원', phone: '010-8173-4772',
      bizName: 'TM 상품권', bizRegNo: '551-98-00301', bizAddress: '서울특별시 구로구 새말로 97',
    },
    // 사이트 18: TM 상품권 서브도메인, 대표자 김요한
    'no1.tm-ticket.store': {
      owner: '김요한', phone: '010-2623-5643',
      bizName: 'TM 상품권', bizRegNo: '551-98-00301', bizAddress: '서울특별시 구로구 새말로 97',
    },
    // 사이트 17: (주)에스에스에프앤비, 대표자 최봄(전화번호 미노출)
    'no1.ticketbokdream.shop': {
      owner: '최봄', hidePhone: true,
      bizName: '(주)에스에스에프앤비', bizRegNo: '478-88-03080', bizAddress: '경기도 양주시 옥정동로5바길 16(옥정동)',
    },
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

  // 상호가 기본값(복드림 상품권)과 다르면 페이지 곳곳에 하드코딩된 상호 문구와
  // 문서 제목/설명의 기본 주소도 함께 바꿉니다.
  if (resolved.bizName !== DEFAULT_BIZ.bizName) {
    var swap = function (text) {
      return text.split(DEFAULT_BIZ.bizName).join(resolved.bizName)
        .split('복드림').join(resolved.bizName.replace(/\s*상품권$/, ''));
    };
    document.title = swap(document.title);
    var desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute('content', swap(desc.getAttribute('content'))
        .split('서울특별시 성동구 천호대로 430').join(resolved.bizAddress));
    }
    // 로고 아이콘 글자("복")도 새 상호의 첫 글자로.
    document.querySelectorAll('.logo-mark').forEach(function (el) {
      var mark = resolved.bizName.replace(/\(주\)|주식회사/g, '').trim().split(' ')[0];
      el.textContent = mark.length > 2 ? mark.charAt(0) : mark;
    });
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.indexOf('복드림') !== -1) node.nodeValue = swap(node.nodeValue);
    }
  }

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
