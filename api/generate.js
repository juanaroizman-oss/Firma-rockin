const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { GifEncoder } = require('@skylix-dev/gif-encoder');

const SIGNATURE_HTML = (nombre, apellidos, cargo) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; width: 620px; }
</style>
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
      <td colspan="4" style="padding-top:10px;font-size:9px;line-height:12px;color:#888;text-align:left;">
        <p style="margin:0;text-align:justify;">
          La información contenida en este mensaje y/o archivo(s) adjunto(s) enviada es confidencial/privilegiada y está destinada a ser leída solo por la(s) persona(s) que va dirigida. Le recordamos que sus datos personales, dirección de correo electrónico, recabados del propio interesado, han sido incorporados en el sistema de tratamiento de ROCKIN MEDIA, para el envío de comunicaciones ordinarias, así como sobre nuestros productos y servicios y se conservarán mientras exista un interés mutuo para ello o subsista la base legitimadora para dicho tratamiento según información facilitada previamente. Los datos se conservarán durante no más tiempo del necesario para mantener el fin del tratamiento y no serán comunicados a terceros, salvo obligación legal. Y de conformidad con el Reglamento (UE) núm. 2016/679, General de Protección de Datos y la LO 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales, puede ejercer de forma totalmente gratuita los derechos de acceso, información, rectificación, supresión y olvido, limitación del tratamiento, oposición, portabilidad y a no ser objeto de decisiones individuales automatizadas enviando un e-mail a rafa@rockinmedia.es. Si usted lee este mensaje y no es el destinatario señalado, el empleado o el agente responsable de entregar el mensaje al destinatario, o ha recibido esta comunicación por error, le informamos que está totalmente prohibida y puede ser ilegal cualquier divulgación o reproducción de esta comunicación y le rogamos que nos lo notifique inmediatamente y nos devuelva el mensaje original a la dirección arriba mencionada. Gracias.
          <br><br>Si no desea recibir información por correo electrónico nos lo puede notificar en esta misma dirección.<br><br>
          © Responsable: ROCKIN MEDIA, S.L. | <a href="https://rockinmedia.es/aviso-legal" style="color:#3046ed;text-decoration:underline;">Aviso legal</a> | B87928743 – Calle de Marcenado 37, 28002, Madrid
        </p>
      </td>
    </tr>
  </tbody>
</table>
</body>
</html>`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nombre, apellidos, cargo } = req.body;

  if (!nombre || !apellidos || !cargo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 640, height: 300 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(SIGNATURE_HTML(nombre, apellidos, cargo), {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    // Get actual content height
    const height = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 640, height: Math.max(height, 200) });

    // Capture multiple frames for GIF (simulating logo GIF animation)
    const frames = [];
    const frameCount = 10;
    for (let i = 0; i < frameCount; i++) {
      await new Promise(r => setTimeout(r, 100));
      const screenshot = await page.screenshot({ type: 'png' });
      frames.push(screenshot);
    }

    await browser.close();

    // Encode frames as GIF using gif-encoder
    const { createCanvas, loadImage } = require('canvas');
    const GIFEncoder = require('gifencoder');

    const firstImg = await loadImage(frames[0]);
    const w = firstImg.width;
    const h = firstImg.height;

    const encoder = new GIFEncoder(w, h);
    const chunks = [];
    encoder.createReadStream().on('data', chunk => chunks.push(chunk));

    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(100);
    encoder.setQuality(10);

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    for (const frameBuffer of frames) {
      const img = await loadImage(frameBuffer);
      ctx.drawImage(img, 0, 0);
      encoder.addFrame(ctx);
    }

    encoder.finish();

    const gifBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Disposition', `attachment; filename="firma-${nombre}-${apellidos}.gif"`);
    res.send(gifBuffer);

  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).json({ error: 'Error generando el GIF', detail: err.message });
  }
};
