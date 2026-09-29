module.exports = {
  apps: [
    {
      // 사이트 1: bokdreamticket.store (대표자 김상현)
      name: "bokdream-ticket-shop",
      script: "npx",
      args: "serve . -l 9011",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
    },
    {
      // 사이트 2: ticketbokdream.shop (대표자 양동헌)
      // 같은 정적 파일을 다른 포트로 서빙합니다. 대표자명/연락처는
      // js/site-config.js 가 접속 도메인에 맞춰 표시합니다.
      name: "bokdream-ticket-shop-2",
      script: "npx",
      args: "serve . -l 9015",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
    },
    {
      // 사이트 3: 복드림.store (대표자 김상현)
      name: "bokdream-ticket-shop-3",
      script: "npx",
      args: "serve . -l 9016",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
    },
    {
      // 사이트 4: bokdreamticket.shop (대표자 박성현, 전화번호 미노출)
      name: "bokdream-ticket-shop-4",
      script: "npx",
      args: "serve . -l 9017",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
    },
  ],
};
