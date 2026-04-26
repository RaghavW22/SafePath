EMAIL_TEMPLATE = """
<html><body style="font-family:Arial,sans-serif;background:#060e1a;color:#fff;padding:0;margin:0;">
  <div style="max-width:600px;margin:20px auto;background:#112240;border-radius:24px;overflow:hidden;border:1px solid #1e293b;">
    <div style="background:#1e3a8a;padding:20px;text-align:center;">
       <h2 style="color:#60a5fa;margin:0;letter-spacing:2px;font-size:18px;">SAFEPATH MEDICAL CENTER</h2>
    </div>
    <img src="cid:facility_banner" alt="Hospital Facility" style="width:100%;height:240px;object-fit:cover;">
    <div style="padding:40px;">
      <h1 style="color:#fff;font-size:32px;margin:0 0 12px;font-weight:800;">Welcome, {guest_name}</h1>
      <p style="color:#94a3b8;font-size:16px;line-height:1.6;margin:0 0 24px;">
        You are registered in <b style="color:#60a5fa;">Unit {room}</b>. 
        At SafePath, your safety is our absolute priority. We have generated a 
        <b>Personalised Emergency Dashboard</b> specifically for your location.
      </p>
      
      <div style="text-align:center;background:#0a192f;border-radius:20px;padding:32px;margin:30px 0;border:1px dashed #3b82f6;">
        <p style="color:#e2e8f0;font-size:15px;margin:0 0 20px;font-weight:600;">ACCESS YOUR SAFETY DASHBOARD</p>
        <img src="cid:qr_code" alt="QR Code" style="width:220px;height:220px;border-radius:12px;border:4px solid #fff;">
        <p style="color:#64748b;font-size:12px;margin:20px 0 0;">
          Click below if QR doesn't load:<br>
          <a href="{login_url}" style="color:#60a5fa;text-decoration:none;font-weight:bold;">{login_url}</a>
        </p>
      </div>

      <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="color:#ef4444;font-size:14px;margin:0 0 8px;">🚨 EMERGENCY PROTOCOL</h3>
        <ul style="color:#94a3b8;font-size:13px;margin:0;padding-left:20px;line-height:1.5;">
          <li>Follow the glowing green path on your digital map.</li>
          <li>In case of fire, use the nearest stairwell (Shafts A-D).</li>
          <li>Press the SOS button in your dashboard for immediate assistance.</li>
        </ul>
      </div>

      <p style="color:#475569;font-size:12px;text-align:center;border-top:1px solid #1e293b;padding-top:20px;margin-top:32px;">
        © 2026 SafePath AI · Hospital Emergency Management Ecosystem<br>
        Democratizing Safety through Technology
      </p>
    </div>
  </div>
</body></html>
"""
