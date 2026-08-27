/**
 * PDF generation handlers:
 * - This module depends on features/firefox.js — it launches the downloaded Firefox engine via Puppeteer.
 * - If an app omits Puppeteer/Firefox, then omit this module too.
 */
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const { env } = require('../config/paths');
const { isFirefoxInstalled, getFirefoxExecutablePath } = require('./firefox');

function registerPdfHandlers() {
  ipcMain.handle("generate-pdf-temp", async (event, uuid) => {
    // Ensure Firefox is installed before attempting PDF generation
    if (!isFirefoxInstalled()) {
      throw new Error(
        "Firefox browser engine is not installed. Please download it first.",
      );
    }

    const browser = await puppeteer.launch({
      headless: true,
      browser: "firefox",
      // args: ["-safe-mode"],
      executablePath: getFirefoxExecutablePath(),
      extraPrefsFirefox: {
        "browser.startup.page": 1,
        "print.always_print_silent": true, // skip print dialog
        "print.show_print_progress": false, // disable progress UI
        "pdfjs.disabled": true, // don't intercept with PDF.js
      },
      protocolTimeout: 900000,
      timeout: 900000,
    });

    // const result = await dialog.showSaveDialog();

    const page = await browser.newPage();
    page.setDefaultTimeout(900000);
    page.setDefaultNavigationTimeout(900000);

    // Fetch HTML from temp storage
    await page.goto(`http://127.0.0.1:${env.ROCKET_PORT}/api/temp/html/${uuid}`, {
      waitUntil: "networkidle0",
    });

    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let lastHeight = 0;
        const check = setInterval(() => {
          window.scrollTo(0, document.body.scrollHeight);
          if (document.body.scrollHeight === lastHeight) {
            clearInterval(check);
            resolve();
          }
          lastHeight = document.body.scrollHeight;
        }, 400);
      });
    });

    // await page.waitForSelector("#print-ready-marker");

    // Generate PDF buffer directly
    const pdfBuffer = await page.pdf({
      format: "A3",
      printBackground: true,
      timeout: 900000, // 15 minutes
    });

    // Create multipart form
    const formData = new FormData();
    const blob = new Blob([pdfBuffer], {
      type: "application/pdf",
    });
    formData.append("file", blob, "document.pdf");

    // Upload PDF to temp endpoint
    const uploadResponse = await fetch(
      `http://127.0.0.1:${env.ROCKET_PORT}/api/temp/bytes`,
      {
        method: "POST",
        body: formData,
      },
    );

    const uploadResult = await uploadResponse.json();
    // returns { uuid: "..." }

    // await browser.close();

    return JSON.parse(JSON.stringify(uploadResult.uuid));
  });

  ipcMain.handle("generate-pdf-final", async (event, uuid) => {
    const response = await fetch(
      `http://127.0.0.1:${env.ROCKET_PORT}/api/temp/bytes/${uuid}`,
      {
        method: "GET",
      }
    );

    // Convert response to binary data
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get Downloads folder
    const downloadsPath = app.getPath("downloads");

    // Create file name
    const filePath = path.join(downloadsPath, `document-${uuid}.pdf`);

    // Write file
    fs.writeFileSync(filePath, buffer);

    return filePath;
  });
}

module.exports = { registerPdfHandlers };
