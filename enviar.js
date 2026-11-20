// Recibe el formulario, te envía la factura por email (servicio Resend) y responde al cliente.
// Variables de entorno en Vercel:
//   RESEND_API_KEY  -> tu clave de Resend
//   EMAIL_DESTINO   -> tu correo (donde recibes las facturas)
//   EMAIL_FROM      -> (opcional) remitente con tu dominio verificado en Resend.
//                      Ejemplo: WIWI Energía <info@wiwienergia.es>
//                      Si no existe, no se envía el correo automático al cliente.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const d = req.body || {};
  if (d.web) return res.status(200).json({ ok: true });          // antispam: campo oculto
  if (!d.consentimiento || !d.nombre || !d.email || !d.archivo?.contenido)
    return res.status(400).json({ error: 'Datos incompletos' });
  if (!/\.pdf$/i.test(d.archivo.nombre || '') || d.archivo.contenido.length > 4.2e6)
    return res.status(400).json({ error: 'Archivo no válido' });

  // Comprobación de las variables (el aviso sale en los Registros de Vercel, nunca la clave)
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_DESTINO) {
    console.error('Faltan variables de entorno: RESEND_API_KEY=' + !!process.env.RESEND_API_KEY + ' EMAIL_DESTINO=' + !!process.env.EMAIL_DESTINO);
    return res.status(500).json({ error: 'Configuración incompleta' });
  }

  const esc = s => String(s).replace(/[<>&"]/g, '');
  const com = String(d.comercial || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);   // código del comercial (?c=ana)
  const FROM = process.env.EMAIL_FROM || 'WIWI Energía <onboarding@resend.dev>';
  const headers = { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' };

  // 1) Correo para ti, con la factura adjunta
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: FROM,
      to: [process.env.EMAIL_DESTINO],
      reply_to: d.email,
      subject: `Nueva factura: ${esc(d.nombre)} (${esc(d.tipo)})` + (com ? ` [${com}]` : ''),
      html: `<p>Nombre: ${esc(d.nombre)}<br>Tipo: ${esc(d.tipo)}<br>Correo: ${esc(d.email)}<br>Teléfono: ${esc(d.tel)}<br>Comercial: ${com || 'directo'}</p><p>Consentimiento aceptado: sí</p>`,
      attachments: [{ filename: esc(d.archivo.nombre), content: d.archivo.contenido }]
    })
  });
  if (!r.ok) {
    const detalle = await r.text();
    console.error('Resend respondió ' + r.status + ': ' + detalle.slice(0, 500));   // aquí verás el motivo real
    return res.status(502).json({ error: 'Error de envío' });
  }

  // 2) Correo automático de confirmación para el cliente (solo si hay dominio verificado).
  //    Si falla, el cliente no ve ningún error: su factura ya está recibida.
  if (process.env.EMAIL_FROM) {
    try {
      const nombre = esc(d.nombre);
      const texto =
`Hola ${nombre},

Gracias por confiar en WIWI Energía. Hemos recibido tu factura correctamente.

¿Por qué 24-48 horas?
Porque estudiamos cada factura con detalle (consumo, potencia y contrato actual) y buscamos, entre las ofertas de más de 50 comercializadoras, las que mejor encajan con tu caso. Trabajamos para autónomos, pymes y profesionales, y también para particulares.

¿Quiénes somos?
Somos asesores energéticos. No somos una comercializadora: no te vendemos la luz, te ayudamos a comparar y entender las ofertas del mercado para que elijas con información. Somos Wiwi Soluciones Enycomblock 3.0 S.L., con sede en Sant Cugat del Vallès (Barcelona).

¿Qué pasa ahora?
Te enviaremos las ofertas por este correo o por teléfono. Tú decides si alguna te interesa, sin compromiso.

Un detalle útil: las facturas se estudian por punto de suministro (CUPS). Si tienes más de un CUPS, respóndenos a este correo adjuntando una factura de cada uno.

Tus datos: usamos tu factura solo para preparar tu oferta. Puedes ejercer tus derechos (acceso, rectificación, supresión y otros) respondiendo a este correo.

Un saludo,
Equipo WIWI Energía
wiwienergia.es`;
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f1a12;line-height:1.55;font-size:15px">
<h2 style="margin:0 0 12px;font-size:20px">Hemos recibido tu factura</h2>
<p>Hola ${nombre},</p>
<p>Gracias por confiar en <b>WIWI Energía</b>. Hemos recibido tu factura correctamente.</p>
<p><b>¿Por qué 24-48 horas?</b><br>Porque estudiamos cada factura con detalle (consumo, potencia y contrato actual) y buscamos, entre las ofertas de más de 50 comercializadoras, las que mejor encajan con tu caso. Trabajamos para autónomos, pymes y profesionales, y también para particulares.</p>
<p><b>¿Quiénes somos?</b><br>Somos asesores energéticos. No somos una comercializadora: no te vendemos la luz, te ayudamos a comparar y entender las ofertas del mercado para que elijas con información. Somos Wiwi Soluciones Enycomblock 3.0 S.L., con sede en Sant Cugat del Vallès (Barcelona).</p>
<p><b>¿Qué pasa ahora?</b><br>Te enviaremos las ofertas por este correo o por teléfono. Tú decides si alguna te interesa, sin compromiso.</p>
<p><b>Un detalle útil:</b> las facturas se estudian por punto de suministro (CUPS). Si tienes más de un CUPS, respóndenos a este correo adjuntando una factura de cada uno.</p>
<p style="color:#4a5a4f;font-size:13px">Tus datos: usamos tu factura solo para preparar tu oferta. Puedes ejercer tus derechos (acceso, rectificación, supresión y otros) respondiendo a este correo.</p>
<p>Un saludo,<br><b>Equipo WIWI Energía</b><br><a href="https://wiwienergia.es" style="color:#1d6fdc">wiwienergia.es</a></p>
</div>`;
      const r2 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: FROM,
          to: [d.email],
          reply_to: process.env.EMAIL_DESTINO,
          subject: 'Hemos recibido tu factura · WIWI Energía',
          html,
          text: texto
        })
      });
      if (!r2.ok) console.error('Correo al cliente: Resend respondió ' + r2.status + ': ' + (await r2.text()).slice(0, 300));
    } catch (e) {
      console.error('Correo al cliente: error ' + e.message);
    }
  }
  return res.status(200).json({ ok: true });
}
