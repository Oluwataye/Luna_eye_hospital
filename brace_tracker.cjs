const fs = require('fs');

function trackBraces(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let openBraces = 0;
  let closeBraces = 0;
  let openParens = 0;
  let closeParens = 0;

  let inString = false;
  let stringChar = '';
  let escape = false;
  let inComment = false;
  let inBlockComment = false;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i+1];

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

      if (inComment) continue;

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
    }
    inComment = false; // reset line comment at end of line

    if (openBraces === closeBraces && openParens === closeParens) {
      lastBalancedLine = l + 1;
    }
  }

  console.log(`Final: Braces Net ${openBraces - closeBraces}, Parens Net ${openParens - closeParens}`);
  console.log(`Last fully balanced line: ${lastBalancedLine}`);
}

trackBraces('server/index.js');
