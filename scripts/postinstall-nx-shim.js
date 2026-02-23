const fs = require('fs');
const path = require('path');

const shimPath = path.join(__dirname, '..', 'node_modules', 'nx', 'index.js');
const shimContent = '"use strict";\n\nrequire("./bin/nx.js");\n';

try {
  fs.mkdirSync(path.dirname(shimPath), { recursive: true });
  fs.writeFileSync(shimPath, shimContent, 'utf8');
} catch (error) {
  console.error('Failed to write Nx shim:', error);
  process.exit(1);
}
