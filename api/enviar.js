// Recibe el formulario y te envía la factura por email (servicio Resend).
// Variables de entorno en Vercel: RESEND_API_KEY y EMAIL_DESTINO (tu correo).
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

  const esc = s => String(s).replace(/[<>&]/g, '');
  const com = String(d.comercial || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);   // código del comercial (?c=ana)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'WIWI Energía <onboarding@resend.dev>',   // cámbialo al verificar tu dominio
      to: [process.env.EMAIL_DESTINO],
      reply_to: d.email,
      subject: `Nueva factura: ${esc(d.nombre)} (${esc(d.tipo)})` + (com ? ` [${com}]` : ''),
      html: `<p>Nombre: ${esc(d.nombre)}<br>Tipo: ${esc(d.tipo)}<br>Correo: ${esc(d.email)}<br>Teléfono: ${esc(d.tel)}<br>Comercial: ${com || 'directo'}</p><p>Consentimiento aceptado: sí</p>`,
      attachments: [{ filename: esc(d.archivo.nombre), content: d.archivo.contenido }]
    })
  });
  if (r.ok) return res.status(200).json({ ok: true });
  const detalle = await r.text();
  console.error('Resend respondió ' + r.status + ': ' + detalle.slice(0, 500));   // aquí verás el motivo real
  return res.status(502).json({ error: 'Error de envío' });
}
