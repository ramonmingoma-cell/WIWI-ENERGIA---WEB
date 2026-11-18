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

  const esc = s => String(s).replace(/[<>&]/g, '');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'WIWI Energía <onboarding@resend.dev>',   // cámbialo al verificar tu dominio
      to: [process.env.EMAIL_DESTINO],
      reply_to: d.email,
      subject: `Nueva factura: ${esc(d.nombre)} (${esc(d.tipo)})`,
      html: `<p><b>${esc(d.nombre)}</b> (${esc(d.tipo)})<br>${esc(d.email)} · ${esc(d.tel)}</p><p>Consentimiento aceptado: sí</p>`,
      attachments: [{ filename: esc(d.archivo.nombre), content: d.archivo.contenido }]
    })
  });
  return r.ok ? res.status(200).json({ ok: true }) : res.status(502).json({ error: 'Error de envío' });
}
