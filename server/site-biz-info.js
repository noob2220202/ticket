// 서버는 도메인이 아니라 PORT로 사이트를 구분합니다(ecosystem.config.js 참고).
// js/site-config.js(브라우저용)와 같은 역할을, 지급내역서(PDF)를 만드는
// server/render-invoice.js에서 쓸 수 있도록 PORT 기준으로 제공합니다.
// 두 파일의 내용은 같이 맞춰야 합니다 — 한쪽만 고치면 화면/PDF 상호가 어긋납니다.
const DEFAULT_BIZ = {
  bizName: '복드림 상품권',
  bizRegNo: '623-70-00295',
  bizAddress: '서울특별시 성동구 천호대로 430, 1층 103호(용답동)',
};

// PORT -> 오버라이드(사업자등록증이 따로 있는 사이트만 등록). 지금은 전부 기본값.
// 예: 9025: { bizName: '...', bizRegNo: '...', bizAddress: '...' },
const BIZ_BY_PORT = {};

function getBizInfo() {
  const override = BIZ_BY_PORT[process.env.PORT];
  return Object.assign({}, DEFAULT_BIZ, override || {});
}

module.exports = { getBizInfo };
