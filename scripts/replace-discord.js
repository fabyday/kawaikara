const fs = require('fs');
const path = require('path');
require('dotenv').config(); // .env 파일에서 환경 변수를 로드

// 치환할 파일 경로
const filePath = process.argv[2]; // 파일 경로는 명령행 인자로 받기

// 파일 경로가 제공되지 않으면 에러 출력
if (!filePath) {
  console.log('Usage: node replace-env-vars.js <file-path>');
  process.exit(1);
}

// 파일 경로가 존재하는지 확인
if (!fs.existsSync(filePath)) {
  console.log(`The file ${filePath} does not exist.`);
  process.exit(1);
}

// 치환할 특정 환경 변수 리스트
const envVariablesToReplace = [
  'DISCORD_APP_ID',
  'DISCORD_PUB_KEY'
];

// 환경 변수를 찾아서 치환하는 함수
const replaceEnvVars = (content) => {
  envVariablesToReplace.forEach((key) => {
    if (process.env[key]) {
      
      const regex = new RegExp(`\\process.env.${key}`, 'g'); // ${KEY} 형식
      content = content.replace(regex, `"${process.env[key]}"`);
    }
  });

  return content;
};

// 파일 읽기
let content = fs.readFileSync(filePath, 'utf8');

// 환경 변수 치환
content = replaceEnvVars(content);

// 치환된 내용을 파일에 덮어쓰기
fs.writeFileSync(filePath, content, 'utf8');
console.log(`Successfully replaced environment variables in ${filePath}`);
