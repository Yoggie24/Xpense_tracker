const fs = require('fs');

let html = fs.readFileSync('0Ref/0ref.html', 'utf-8');
const scriptMatch = html.match(/<script>\s*(document\.addEventListener\('DOMContentLoaded'[\s\S]*?)<\/script>/);

if (!scriptMatch) {
    console.error("Could not find script block!");
    process.exit(1);
}

let scriptContent = scriptMatch[1];

// We need to heavily rewrite this JS content to work with local storage instead of fetching directly from WEB_APP_URL.
// It's probably easier to completely overwrite the file with our own logic based on their new UI structure.
// I will just save the extracted script as a reference to build_script_ref.js
fs.writeFileSync('build_script_ref.js', scriptContent);
console.log('Saved build_script_ref.js');
