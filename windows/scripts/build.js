const path = require('path');
const fs = require('fs-extra');
const { build } = require('../../buildCommon.js');

build({
  separator: "\\",
  cliExt: "bat",
  findFreePort: "find_free_port.bat",
  binSrcSuffix: ".exe",
  binDest: "server.exe",
  writeScripts: ({ OS_BUILD_RESOURCES, BUILD_DIR, FILE_APP_NAME, CLI_EXT }) => {
    fs.copySync(path.join(OS_BUILD_RESOURCES, "appLauncher.bat"), path.join(BUILD_DIR, FILE_APP_NAME + "." + CLI_EXT));
  },
  readmeReplace: (readMe, { APP_NAME, CLI_EXT, APP_VERSION }) =>
    readMe
      .replace(/%%APP_NAME%%/g, APP_NAME)
      .replace(/%%CLI_EXT%%/g, CLI_EXT)
      .replace(/%%APP_VERSION%%/g, APP_VERSION),
  copyIcon: ({ BUILD_DIR }) => {
    const ICON_ICO = "../../globalBuildResources/icon.ico";
    if (ICON_ICO) { fs.copySync(path.resolve(ICON_ICO), path.join(BUILD_DIR, "icon.ico")); }
  },
  postProcess: ({ BUILD_DIR, spec }) => {
    const fixWindowsUtf8 = (srcFilePath, destFilePath) => {
      fs.readFile(srcFilePath, 'utf8', (err, data) => {
        if (err) { console.error('Error reading file:', err); return; }
        const correctedContent = data.replace(/âˆž/g, '∞');
        fs.writeFile(destFilePath, correctedContent, 'utf8', () => {});
      });
    };
    const PAGED_JS = path.resolve(spec['lib'][0]['src'] + '/pdf/paged.polyfill.js');
    fixWindowsUtf8(PAGED_JS, BUILD_DIR + '/lib/' + spec['lib'][0]['targetName'] + '/pdf/paged.polyfill.js');
  },
});
