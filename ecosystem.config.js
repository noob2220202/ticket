module.exports = {
  apps: [
    {
      // 사이트 1: bokdreamticket.store (대표자 송은영, 이추봉)
      name: "bokdream-ticket-shop",
      script: "npx",
      args: "serve -s . -l 9011",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
    },
    {
      // 사이트 2: ticketbokdream.shop (대표자 양동헌)
      // 같은 정적 파일을 다른 포트로 서빙합니다. 대표자명은
      // js/site-config.js 가 접속 도메인에 맞춰 표시합니다.
      name: "bokdream-ticket-shop-2",
      script: "npx",
      args: "serve -s . -l 9015",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
    },
  ],
};
