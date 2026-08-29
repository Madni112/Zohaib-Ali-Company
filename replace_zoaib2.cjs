const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    // Fix missing ampersand
    content = content.replace(/Zoaib Ali Company/g, 'Zoaib Ali & Company');
    content = content.replace(/zoaib ali company/g, 'zoaib ali & company');
    content = content.replace(/ZOAIB ALI COMPANY/g, 'ZOAIB ALI & COMPANY');
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }
}

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            walk(file);
        } else {
            if(file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
                replaceInFile(file);
            }
        }
    });
}

walk('c:/Users/user/Downloads/Zohaib Ali Company/src');
console.log('Done');
