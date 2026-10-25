module.exports = {
  apps: [
    {
      // 사이트 1: bokdreamticket.store (대표자 김상현)
      name: "bokdream-ticket-shop",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9011 },
    },
    {
      // 사이트 2: ticketbokdream.shop (대표자 양동헌)
      // 같은 정적 파일을 다른 포트로 서빙합니다. 대표자명/연락처는
      // js/site-config.js 가 접속 도메인에 맞춰 표시합니다.
      // 지급내역(payouts) 데이터는 5개 프로세스가 모두 같은
      // data/payouts.db 파일을 공유합니다(server/db.js 참고).
      name: "bokdream-ticket-shop-2",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9015 },
    },
    {
      // 사이트 3: 복드림.store (대표자 김상현)
      name: "bokdream-ticket-shop-3",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9016 },
    },
    {
      // 사이트 4: bokdreamticket.shop (대표자 박성현, 전화번호 미노출)
      name: "bokdream-ticket-shop-4",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9017 },
    },
    {
      // 사이트 5: bokdream.store (대표자 황보경애)
      name: "bokdream-ticket-shop-5",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9018 },
    },
  ],
};
