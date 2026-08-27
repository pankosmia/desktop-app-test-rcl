#!/usr/bin/env zsh

# Run from pankosmia\[this-repo's-name]\macos\scripts directory by:  ./build_viewer.zsh
# Or force a full install with: ./build_viewer.zsh -f

source ../../app_config.env

FORCE_FULL_INSTALL=false
if [[ "${1:-}" == "-f" ]]; then
    FORCE_FULL_INSTALL=true
fi

ELECTRON_VER="../viewer/project/payload/${APP_NAME}.app/Contents/electron/version"
EXPECTED="37.1.0"

# A full install will also install, or re-install, Electronite.
fullInstall=$FORCE_FULL_INSTALL

if [ "$fullInstall" != true ]; then
    if [ -f "$ELECTRON_VER" ]; then
        content="$(tr -d '\r\n' < "$ELECTRON_VER")"
        if [ "$content" = "$EXPECTED" ]; then
            echo "The installed viewer Electronite version is $content, which is correct."
            echo "No download is needed. Everything else will be updated."
            fullInstall=false
        else
            echo "The installed viewer Electronite version is $content, however we are not using $EXPECTED. Please wait for the download and upgrade that will follow..."
            fullInstall=true
        fi
    else
        echo "A full viewer install will follow, including download of Electronite. Please wait patiently..."
        fullInstall=true
    fi
else
    echo "-f flag detected."
    echo "A full viewer install will follow, including download of Electronite. Please wait patiently..."
fi

TEMP_DIR="../viewer"
if [ "$fullInstall" = true ] && [ -d "$TEMP_DIR" ]; then
    echo "Deleting previous viewer build..."
    rm -rf "$TEMP_DIR"
fi

if [ "$fullInstall" = true ]; then
    echo "********************************************************************"
    echo "\"Getting Electron release\" downloads an approximately 120 MB file."
    echo "Please wait patiently for the download process to complete..."
    echo "********************************************************************"
    ../install/makeAllInstallsElectronite.sh -d -f
else
    ../install/makeAllInstallsElectronite.sh -d
fi
