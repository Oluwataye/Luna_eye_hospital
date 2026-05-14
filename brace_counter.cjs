const fs = require('fs');

function countBraces(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let openBraces = 0;
  let closeBraces = 0;
  let openParens = 0;
  let closeParens = 0;
  let openBrackets = 0;
  let closeBrackets = 0;

  let inString = false;
  let stringChar = '';
  let escape = false;
  let inComment = false;
  let inBlockComment = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i+1];

    if (escape) {
      escape = false;
      continue;
    }

    if (inString) {
      if (char === '\\') {
        escape = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (inComment) {
      if (char === '\n') {
        inComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') openBraces++;
    if (char === '}') closeBraces++;
    if (char === '(') openParens++;
    if (char === ')') closeParens++;
    if (char === '[') openBrackets++;
    if (char === ']') closeBrackets++;
  }

  console.log(`Braces: { ${openBraces}, } ${closeBraces} (Net: ${openBraces - closeBraces})`);
  console.log(`Parens: ( ${openParens}, ) ${closeParens} (Net: ${openParens - closeParens})`);
  console.log(`Brackets: [ ${openBrackets}, ] ${closeBrackets} (Net: ${openBrackets - closeBrackets})`);
}

countBraces('server/index.js');
