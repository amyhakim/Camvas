import assert from 'node:assert/strict';

const base = process.env.SHOWCAM_URL || 'http://localhost:3000';
const response = await fetch(new URL('/design-system', base));
assert.equal(response.status, 404, 'The style guide route must not be public');
console.log('Style guide route is not public.');
