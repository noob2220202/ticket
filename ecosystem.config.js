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
      // 지급내역(payouts) 데이터는 사이트(PORT)별로 완전히 분리됩니다
      // (data/payouts-<PORT>.db, server/db.js 참고). 복드림.store(9016)가
      // 기존에 모여 있던 데이터를 그대로 이어받았고, 나머지는 빈 DB로 시작합니다.
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
    {
      // 사이트 6: bokdream1.store (대표자 이승우)
      name: "bokdream-ticket-shop-6",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9019 },
    },
    {
      // 사이트 7: 1.bokdreamticket.store (대표자 하석태, 010-5565-9634)
      name: "bokdream-ticket-shop-7",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9020 },
    },
    {
      // 사이트 8: 2.bokdreamticket.store (대표자 김택현, 010-4201-5455)
      name: "bokdream-ticket-shop-8",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9021 },
    },
    {
      // 사이트 9: 4.bokdreamticket.store (대표자 조광연, 010-5620-9257)
      name: "bokdream-ticket-shop-9",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9022 },
    },
    {
      // 사이트 10: 5.bokdreamticket.store (대표자 양정수, 010-8209-5136)
      name: "bokdream-ticket-shop-10",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9023 },
    },
    {
      // 사이트 11: ticketbokdream.store (대표자 정대원, 010-2657-4587)
      name: "bokdream-ticket-shop-11",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9024 },
    },
    {
      // 사이트 12: bok-dreamticket.store (대표자 양정수, 010-8209-5136)
      name: "bokdream-ticket-shop-12",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9025 },
    },
    {
      // 사이트 13: bokdream-ticket.shop (대표자 김민정, 010-6629-3110)
      name: "bokdream-ticket-shop-13",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9026 },
    },
    {
      // 사이트 14: no1.bokdream.store (대표자 이승진, 010-8120-0262)
      name: "bokdream-ticket-shop-14",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9027 },
    },
    {
      // 사이트 15: bok-dream.store (대표자 정연재, 010-7560-8253)
      name: "bokdream-ticket-shop-15",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9029 },
    },
    {
      // 사이트 16: tm-ticket.store (TM 상품권, 대표자 장규원, 010-8173-4772)
      // 복드림이 아닌 별도 상호. 화면은 js/site-config.js, PDF는 server/site-biz-info.js.
      name: "bokdream-ticket-shop-16",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9030 },
    },
    {
      // 사이트 17: no1.ticketbokdream.shop ((주)에스에스에프앤비, 대표자 최봄, 전화번호 미노출)
      name: "bokdream-ticket-shop-17",
      script: "server/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 9031 },
    },
  ],
};
