const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    // Replace all casing variations
    content = content.replace(/Zohaib/g, 'Zoaib');
    content = content.replace(/zohaib/g, 'zoaib');
    content = content.replace(/ZOHAIB/g, 'ZOAIB');
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
