const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const root = 'tools/ios-shell/LisaPhone/';

test('原生壳实际使用的 plist 同时声明收音与语音识别权限', () => {
  const project = fs.readFileSync(root + 'LisaPhone.xcodeproj/project.pbxproj', 'utf8');
  const paths = [...project.matchAll(/\bINFOPLIST_FILE = ([^;]+);/g)].map(m => m[1]);
  assert.ok(paths.length >= 2, 'Debug/Release 都需检查');
  for (const file of new Set(paths)) {
    const plist = fs.readFileSync(root + file, 'utf8');
    for (const key of ['NSMicrophoneUsageDescription', 'NSSpeechRecognitionUsageDescription']) {
      assert.match(plist, new RegExp('<key>' + key + '</key>\\s*<string>[^<]+</string>'));
    }
    if (process.platform === 'darwin') execFileSync('plutil', ['-lint', root + file]);
  }
});
