const path = require('node:path');
const createJiti = require('jiti');

const jiti = createJiti(__dirname);
jiti(path.join(__dirname, 'credit-system.test.ts'));
