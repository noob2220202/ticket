module.exports = {
  apps: [
    {
      name: "bokdream-ticket-shop",
      // 정적 사이트이므로 next 대신 정적 파일 서버(serve)를 사용합니다.
      // 사전 설치: npm i -g serve  (또는 npx가 자동으로 내려받음)
      script: "npx",
      args: "serve -s . -l 9011",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
    },
  ],
};
