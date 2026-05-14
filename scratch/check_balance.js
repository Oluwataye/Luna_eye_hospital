
import fs from 'fs';

const content = fs.readFileSync('c:/Users/HP/Documents/Luna Eyes Hospital/src/pages/Procurement.tsx', 'utf8');

function checkBalance(text) {
    let divCount = 0;
    let braceCount = 0;
    let parenCount = 0;
    
    // Simple regex for tags and braces
    const tokens = text.match(/<div|<\/div>|\{|\}|\(|\)/g);
    
    if (!tokens) return "No tokens found";
    
    tokens.forEach(token => {
        if (token === '<div') divCount++;
        if (token === '</div>') divCount--;
        if (token === '{') braceCount++;
        if (token === '}') braceCount--;
        if (token === '(') parenCount++;
        if (token === ')') parenCount--;
        
        if (divCount < 0) console.log("Unmatched </div> found");
        if (braceCount < 0) console.log("Unmatched } found");
        if (parenCount < 0) console.log("Unmatched ) found");
    });
    
    return { divCount, braceCount, parenCount };
}

console.log(checkBalance(content));
