const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');

const SIGNATURE_HTML = (nombre, apellidos, cargo) => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>* { margin:0; padding:0; box-sizing:border-box; } body { background:white; width:620px; }</style>
</head>
<body>
<table style="table-layout:fixed;border-collapse:collapse;width:600px;font-family:Montserrat,Arial,sans-serif;">
  <tbody>
    <tr>
      <td style="width:100px;padding-right:10px;">
        <img src="https://i.ibb.co/YT2xt5bK/ROCKIN-2026.gif" width="100" style="display:block;border:0;max-width:100px;" />
      </td>
      <td style="width:300px;padding:0;text-align:left;vertical-align:middle;">
        <div style="font-size:24px;font-weight:600;line-height:1.4;color:#111;">${nombre} ${apellidos}</div>
        <div style="font-size:12px;font-weight:400;text-transform:uppercase;letter-spacing:3px;display:inline-block;background:linear-gradient(to right,#2de2fb,#3be692);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${cargo}</div>
      </td>
      <td style="width:1px;padding:0;">
        <table style="width:1px;border-collapse:collapse;">
          <tr><td style="width:1px;background:linear-gradient(to bottom,#2de2fb,#3be692);height:120px;"></td></tr>
        </table>
      </td>
      <td style="width:200px;padding:0 0 0 40px;text-align:left;">
        <table style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:20px;"><img src="https://i.imgur.com/hCYpS53.png" alt="Google Partner" width="80" /></td>
            <td><img src="https://i.imgur.com/9EtzHgO.png" alt="HubSpot Partner" width="80" /></td>
            <td><img src="https://i.ibb.co/93B8ccgn/Meta-Certified.png" alt="Meta Certified" width="80"/></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td colspan="4" style="padding-top:10px;font-size:9px;line-height:12px;color:#888;">
        <p style="margin:0;">© ROCKIN MEDIA, S.L. | B87928743 – Calle de Marcenado 37, 28002, Madrid | <a href="https://rockinmedia.es/aviso-legal" style="color:#3046ed;">Aviso legal</a></p>
      </td>
    </tr>
  </tbody>
</table>
</body>
</html>`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { nombre, apellidos, cargo } = body;
  if (!nombre || !apellidos || !cargo) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan campos' }) };
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 640, height: 400 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(SIGNATURE_HTML(nombre, apellidos, cargo), { waitUntil: 'networkidle0', timeout: 20000 });
    const height = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 640, height: Math.max(height, 200) });
    const screenshot = await page.screenshot({ type: 'png' });
    await browser.close();
    browser = null;

    const img = await loadImage(screenshot);
    const encoder = new GIFEncoder(img.width, img.height);
    const chunks = [];
    encoder.createReadStream().on('data', chunk => chunks.push(chunk));
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(0);
    encoder.setQuality(5);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    encoder.addFrame(ctx);
    encoder.finish();

    await new Promise(resolve => setTimeout(resolve, 200));
    const gifBuffer = Buffer.concat(chunks);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': `attachment; filename="firma-${nombre}-${apellidos}.gif"`,
      },
      body: gifBuffer.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error generando el GIF', detail: err.message }) };
  }
};
