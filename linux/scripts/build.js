const path = require('path');
const fs = require('fs-extra');
const { build } = require('../../buildCommon.js');

build({
  separator: "/",
  cliExt: null,
  findFreePort: "find_free_port.sh",
  binSrcSuffix: "",
  binDest: "server.bin",
  writeScripts: ({ OS_BUILD_RESOURCES, BUILD_DIR, FILE_APP_NAME }) => {
    fs.copySync(path.join(OS_BUILD_RESOURCES, "appLauncher.bsh"), path.join(BUILD_DIR, FILE_APP_NAME));
  },
  readmeReplace: (readMe, { APP_NAME, APP_VERSION }) =>
    readMe.replace(/%%APP_NAME%%/g, APP_NAME).replace(/%%APP_VERSION%%/g, APP_VERSION),
  copyIcon: null,
  postProcess: null,
});
