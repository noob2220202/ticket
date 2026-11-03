// 지급내역 마이그레이션 스크립트에서 공통으로 쓰는 핀번호 생성기.
//
// 2026-11-03부로 신규 생성 핀번호는 12자리(4-4-4)로 바뀌었습니다
// (기존에 이미 만들어진 16자리 핀번호는 그대로 두고, 앞으로 새로 만드는
// 건만 적용). 맨 앞 4자리는 기존과 동일하게 9001~9009 중 하나입니다.
//
// 사용: const { makePinGenerator } = require('./lib/pins');
//       const generatePin = makePinGenerator(usedPinsSet);
//       const pin = generatePin(); // 예: "900512348765"
const PREFIXES = ['9001', '9002', '9003', '9004', '9005', '9006', '9007', '9008', '9009'];

function randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i += 1) s += Math.floor(Math.random() * 10);
  return s;
}

// usedPins: 전체 DB(기존 16자리 포함)에서 이미 쓰인 핀번호 Set. 새로 만드는
// 12자리 핀이 우연히 그 문자열과 겹치는 일은 사실상 없지만(길이가 다름),
// 같은 실행 내에서 새로 만든 핀끼리 겹치지 않도록 계속 추가해가며 검사합니다.
function makePinGenerator(usedPins) {
  return function generatePin() {
    let pin;
    do {
      pin = PREFIXES[Math.floor(Math.random() * PREFIXES.length)] + randomDigits(4) + randomDigits(4);
    } while (usedPins.has(pin));
    usedPins.add(pin);
    return pin;
  };
}

module.exports = { makePinGenerator };
