# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from datetime import datetime
import os
import uuid
from deep_translator import GoogleTranslator
import google.generativeai as genai
from dotenv import load_dotenv
from firebase_helper import db_firestore
from firebase_admin import firestore

load_dotenv()

GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

app = Flask(__name__)
CORS(app)

from email_templates import EMAIL_TEMPLATE

# Legacy database handlers removed to ensure cloud-only storage

def init_db():
    if not db_firestore:
        print("CRITICAL: Firestore not initialized. App cannot run in cloud-only mode.")
        return

    try:
        # Bootstrap rooms if they don't exist in Firestore
        rooms_ref = db_firestore.collection('rooms')
        # Check if rooms collection has any documents
        if len(list(rooms_ref.limit(1).stream())) == 0:
            print("Bootstrapping rooms in Firestore...")
            for f in range(1, 4):
                for r in range(1, 11):
                    r_num = f * 100 + r
                    rooms_ref.document(str(r_num)).set({
                        'room_number': r_num,
                        'floor': f,
                        'status': 'available',
                        'guest_name': None,
                        'language': None,
                        'checkin_datetime': None
                    })
        
        # Bootstrap admin staff if missing
        staff_ref = db_firestore.collection('staff')
        if not staff_ref.document('admin').get().exists:
            staff_ref.document('admin').set({
                'staff_id': 'admin',
                'name': 'Admin',
                'pin': 'admin123',
                'role': 'admin'
            })
        print("Firestore initialization complete.")
    except Exception as e:
        print(f"Firestore bootstrap error: {e}")


# ─── Rooms ────────────────────────────────────────────────────────────────────

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    if not db_firestore: return jsonify([])
    docs = db_firestore.collection('rooms').stream()
    rooms = []
    for doc in docs:
        rooms.append(doc.to_dict())
    rooms.sort(key=lambda x: x['room_number'])
    return jsonify(rooms)


# ─── Staff: Register Guest & Generate QR ─────────────────────────────────────

@app.route('/api/register-guest', methods=['POST'])
def register_guest():
    data = request.get_json(force=True)
    name         = str(data.get('name', '')).strip()
    room_number  = int(data.get('roomNumber', 0))
    language     = str(data.get('language', 'English'))
    email        = str(data.get('email', '')).strip()
    mobile       = str(data.get('mobile', '')).strip()
    guests_count = int(data.get('guestsCount', 1))

    if not name or not email or not mobile or room_number <= 0:
        return jsonify({'error': 'All fields are required.'}), 400

    if not db_firestore:
        return jsonify({'error': 'Cloud storage unavailable'}), 503

    try:
        # Check if room is available
        room_doc = db_firestore.collection('rooms').document(str(room_number)).get()
        if not room_doc.exists:
            return jsonify({'error': f'Room {room_number} does not exist'}), 404
        
        rdata = room_doc.to_dict()
        if rdata.get('status') == 'occupied':
            return jsonify({'error': 'Room is already occupied'}), 409

        token = str(uuid.uuid4())
        now = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')

        checkin_data = {
            'id': token,
            'guest_name': name,
            'room_number': room_number,
            'floor': rdata['floor'],
            'language': language,
            'email': email,
            'mobile': mobile,
            'guests_count': guests_count,
            'qr_token': token,
            'checkin_datetime': now,
            'status': 'active'
        }
        # Save checkin
        db_firestore.collection('checkins').document(token).set(checkin_data)
        
        # Update room
        db_firestore.collection('rooms').document(str(room_number)).set({
            'status': 'occupied',
            'guest_name': name,
            'language': language,
            'checkin_datetime': now
        }, merge=True)

        base_url = request.headers.get('Origin', 'http://localhost:5173')
        send_checkin_notifications(name, room_number, base_url, token, email, mobile)

        return jsonify({'success': True, 'token': token, 'guest': checkin_data}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Guest: Verify QR Token ───────────────────────────────────────────────────

@app.route('/api/guest-by-token/<token>', methods=['GET'])
def guest_by_token(token):
    if not db_firestore:
        return jsonify({'error': 'Cloud storage unavailable'}), 503
    
    doc = db_firestore.collection('checkins').document(token).get()
    if not doc.exists:
        return jsonify({'error': 'Invalid or expired QR code.'}), 404
        
    return jsonify(doc.to_dict())


# ─── Staff: Check-out ─────────────────────────────────────────────────────────

@app.route('/api/checkout', methods=['POST'])
def checkout():
    data = request.get_json(force=True)
    room_number = int(data.get('roomNumber', 0))
    now = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')

    if not db_firestore:
        return jsonify({'error': 'Cloud storage unavailable'}), 503

    try:
        # Find the active checkin for this room
        query = db_firestore.collection('checkins')\
            .where(filter=firestore.FieldFilter('room_number', '==', room_number))\
            .where(filter=firestore.FieldFilter('status', '==', 'active'))\
            .limit(1).stream()
        
        checkin_id = None
        for doc in query:
            checkin_id = doc.id
        
        if not checkin_id:
            return jsonify({'error': 'No active guest found for this room'}), 404

        # 1. Update checkin status
        db_firestore.collection('checkins').document(checkin_id).set({
            'status': 'checked_out',
            'checkout_datetime': now
        }, merge=True)

        # 2. Reset room status
        db_firestore.collection('rooms').document(str(room_number)).set({
            'status': 'available',
            'guest_name': None,
            'language': None,
            'checkin_datetime': None
        }, merge=True)

        return jsonify({'success': True, 'message': 'Checked out successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Guests list ──────────────────────────────────────────────────────────────

@app.route('/api/guests', methods=['GET'])
def get_guests():
    status_filter = request.args.get('status', 'active')
    if not db_firestore: return jsonify([])
    try:
        # Instead of a compound query that requires an index,
        # we order by checkin_datetime here, then filter in python.
        query = db_firestore.collection('checkins').order_by('checkin_datetime', direction=firestore.Query.DESCENDING)
        docs = query.stream()
        results = [doc.to_dict() for doc in docs]
        
        if status_filter != 'all':
            results = [r for r in results if r.get('status') == status_filter]
            
        return jsonify(results)
    except Exception as e:
        print(f"Error fetching guests: {e}")
        return jsonify([])

@app.route('/api/guests/history', methods=['DELETE'])
def clear_guest_history():
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    try:
        docs = db_firestore.collection('checkins').where(filter=firestore.FieldFilter('status', '==', 'checked_out')).stream()
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        return jsonify({'success': True, 'count': count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Stats ────────────────────────────────────────────────────────────────────
@app.route('/api/stats', methods=['GET'])
def get_stats():
    if not db_firestore: return jsonify({'total': 0, 'occupied': 0, 'byFloor': []})
    
    docs = db_firestore.collection('rooms').stream()
    rooms = [doc.to_dict() for doc in docs]
    
    occupied = sum(1 for r in rooms if r.get('status') == 'occupied')
    
    floors = {}
    for r in rooms:
        f = r['floor']
        if f not in floors: floors[f] = {'floor': f, 'total': 0, 'occupied': 0}
        floors[f]['total'] += 1
        if r.get('status') == 'occupied':
            floors[f]['occupied'] += 1
            
    return jsonify({
        'total': len(rooms),
        'occupied': occupied,
        'byFloor': sorted(floors.values(), key=lambda x: x['floor'])
    })

# ─── Alerts ───────────────────────────────────────────────────────────────────

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    if not db_firestore: return jsonify([])
    try:
        from firebase_admin import firestore
        docs = db_firestore.collection('alerts')\
            .order_by('timestamp', direction=firestore.Query.DESCENDING)\
            .limit(50).stream()
        return jsonify([doc.to_dict() for doc in docs])
    except Exception: return jsonify([])

@app.route('/api/alerts', methods=['POST'])
def create_alert():
    data = request.get_json(force=True)
    guest_name = str(data.get('guestName', 'Unknown'))
    room_number = int(data.get('roomNumber', 0))
    floor = int(data.get('floor', 0))
    message = str(data.get('message', ''))
    severity = 1
    now = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    
    if not db_firestore:
        return jsonify({'error': 'Cloud storage unavailable'}), 503

    # Generate a unique ID (Firestore style) or just use timestamp+room
    alert_id = f"{now}-{room_number}"
    
    alert_data = {
        'id': alert_id,
        'guest_name': guest_name,
        'room_number': room_number,
        'floor': floor,
        'severity': severity,
        'message': message,
        'timestamp': now,
        'status': 'active'
    }
    db_firestore.collection('alerts').document(alert_id).set(alert_data)

    # ASYNC Gemini Severity Check
    if GEMINI_KEY:
        def analyze_severity_async(aid, msg):
            try:
                model = genai.GenerativeModel('gemini-flash-latest')
                prompt = f"Analyze emergency message and return exactly one number 1-5. Message: '{msg}'"
                resp = model.generate_content(prompt)
                import re
                m = re.search(r'[1-5]', resp.text)
                if m:
                    db_firestore.collection('alerts').document(aid).set({'severity': int(m.group(0))}, merge=True)
            except: pass
        
        import threading
        threading.Thread(target=analyze_severity_async, args=(alert_id, message)).start()
    
    return jsonify({'success': True, 'id': alert_id, 'severity': severity}), 201

@app.route('/api/alerts/resolved', methods=['DELETE'])
def clear_resolved_alerts():
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    try:
        docs = db_firestore.collection('alerts').where(filter=firestore.FieldFilter('status', '==', 'acknowledged')).stream()
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        return jsonify({'success': True, 'count': count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/alerts/<alert_id>', methods=['PATCH'])
def update_alert(alert_id):
    data = request.get_json(force=True)
    severity = data.get('severity')
    status = data.get('status')
    
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    
    updates = {}
    if severity is not None: updates['severity'] = int(severity)
    if status is not None:   updates['status'] = status
    
    if updates:
        db_firestore.collection('alerts').document(str(alert_id)).set(updates, merge=True)
            
    return jsonify({'success': True})

@app.route('/api/alerts/resolve-by-room', methods=['POST'])
def resolve_alerts_by_room():
    data = request.get_json(force=True)
    room_number = int(data.get('roomNumber', 0))
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    
    try:
        query = db_firestore.collection('alerts')\
            .where(filter=firestore.FieldFilter('room_number', '==', room_number))\
            .where(filter=firestore.FieldFilter('status', '==', 'active'))
        docs = query.stream()
        for doc in docs:
            doc.reference.update({'status': 'acknowledged'})
    except Exception as e:
        print(f"Firestore resolve error: {e}")
    return jsonify({'success': True})

# ─── Broadcasts ───────────────────────────────────────────────────────────────

@app.route('/api/broadcasts', methods=['GET'])
def get_broadcasts():
    lang = request.args.get('language')
    if not db_firestore: return jsonify([])
    
    try:
        docs = db_firestore.collection('broadcasts')\
            .order_by('timestamp', direction=firestore.Query.DESCENDING)\
            .limit(20).stream()
        broadcasts = [doc.to_dict() for doc in docs]
    except: return jsonify([])
    
    lang_map = {
        'English': 'en', 'Hindi': 'hi', 'Spanish': 'es', 'French': 'fr',
        'Arabic': 'ar', 'German': 'de', 'Chinese': 'zh-CN', 'Japanese': 'ja',
        'Russian': 'ru', 'Portuguese': 'pt'
    }
    target_lang = lang_map.get(lang, lang.lower()) if lang else 'en'
    
    if target_lang != 'en' and broadcasts:
        try:
            translator = GoogleTranslator(source='auto', target=target_lang)
            for idx, b in enumerate(broadcasts):
                try:
                    broadcasts[idx]['message'] = translator.translate(b['message'])
                except: pass
        except: pass

    return jsonify(broadcasts)

@app.route('/api/ai/suggest-broadcast', methods=['GET'])
def ai_suggest_broadcast():
    target = request.args.get('target', 'all')
    if GEMINI_KEY:
        try:
            model = genai.GenerativeModel('gemini-flash-latest')
            prompt = f"Write a single sentence emergency broadcast announcement to guests in {target}. Keep it extremely concise, professional, and clear."
            resp = model.generate_content(prompt)
            suggestion = resp.text.strip().replace('"', '')
            return jsonify({'suggestion': suggestion})
        except Exception as e:
            print(f"Broadcast AI Error: {e}")
    return jsonify({'suggestion': f"Attention {target} guests. Please remain calm and proceed to the nearest emergency exit."})

@app.route('/api/broadcasts', methods=['POST'])
def create_broadcast():
    data = request.get_json(force=True)
    target = str(data.get('target', 'all'))
    message = str(data.get('message', ''))
    now = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    
    b_id = f"b-{now}"
    b_data = {'id': b_id, 'target': target, 'message': message, 'timestamp': now}
    db_firestore.collection('broadcasts').document(b_id).set(b_data)
    
    return jsonify({'success': True}), 201

@app.route('/api/broadcasts/<broadcast_id>', methods=['DELETE'])
def delete_broadcast(broadcast_id):
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    db_firestore.collection('broadcasts').document(str(broadcast_id)).delete()
    return jsonify({'success': True})

@app.route('/api/broadcasts', methods=['DELETE'])
def clear_all_broadcasts():
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    try:
        docs = db_firestore.collection('broadcasts').list_documents()
        for doc in docs:
            doc.delete()
    except: pass
    return jsonify({'success': True})

@app.route('/api/clear-trials', methods=['DELETE'])
def clear_trials():
    if not db_firestore:
        return jsonify({'error': 'Cloud storage unavailable'}), 503
    try:
        for coll in ['broadcasts', 'alerts', 'checkins']:
            docs = db_firestore.collection(coll).list_documents()
            for doc in docs:
                doc.delete()
        
        # Reset rooms in Firestore too
        rooms_docs = db_firestore.collection('rooms').list_documents()
        for doc in rooms_docs:
            try:
                r_id = int(doc.id)
            except:
                r_id = 0
            doc.set({
                'status': 'available',
                'guest_name': None,
                'language': None,
                'room_number': r_id
            }, merge=True)
    except Exception as e:
        print(f"Error clearing Firestore: {e}")

    return jsonify({'success': True, 'message': 'All cloud data cleared.'})

# ─── Staff Management ─────────────────────────────────────────────────────────

@app.route('/api/staff/login', methods=['POST'])
def login_staff():
    data = request.get_json(force=True)
    staff_id = str(data.get('staff_id', '')).strip()
    pin = str(data.get('pin', '')).strip()

    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503

    doc = db_firestore.collection('staff').document(staff_id).get()
    if not doc.exists:
        return jsonify({'error': 'Invalid Staff ID'}), 401
    
    sdata = doc.to_dict()
    if str(sdata.get('pin')) != pin:
        return jsonify({'error': 'Invalid PIN'}), 401

    return jsonify({'success': True, 'staff': sdata})

@app.route('/api/staff', methods=['GET'])
def get_staff_list():
    if not db_firestore: return jsonify([])
    docs = db_firestore.collection('staff').stream()
    return jsonify([doc.to_dict() for doc in docs])

@app.route('/api/staff', methods=['POST'])
def add_staff():
    data = request.get_json(force=True)
    sid = str(data.get('staff_id', '')).strip()
    name = str(data.get('name', '')).strip()
    pin = str(data.get('pin', '')).strip()
    role = str(data.get('role', 'staff')).strip()

    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    
    db_firestore.collection('staff').document(sid).set({
        'staff_id': sid, 'name': name, 'pin': pin, 'role': role
    })
    return jsonify({'success': True}), 201

@app.route('/api/staff/<staff_id>', methods=['DELETE'])
def delete_staff(staff_id):
    if staff_id == 'admin': return jsonify({'error': 'Cannot delete admin'}), 403
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    db_firestore.collection('staff').document(staff_id).delete()
    return jsonify({'success': True})

@app.route('/api/resend-email', methods=['POST'])
def resend_email():
    data = request.get_json(force=True)
    room_number = int(data.get('roomNumber', 0))
    
    if not db_firestore: return jsonify({'error': 'Cloud offline'}), 503
    
    try:
        # Find active checkin
        query = db_firestore.collection('checkins')\
            .where(filter=firestore.FieldFilter('room_number', '==', room_number))\
            .where(filter=firestore.FieldFilter('status', '==', 'active'))\
            .limit(1).stream()
        
        guest = None
        for doc in query:
            guest = doc.to_dict()
            
        if not guest:
            return jsonify({'error': 'No active resident found for this unit'}), 404
            
        base_url = request.headers.get('Origin', 'http://localhost:5173')
        send_checkin_notifications(
            guest['guest_name'], 
            guest['room_number'], 
            base_url, 
            guest['qr_token'], 
            guest['email'], 
            guest.get('mobile', '')
        )
        return jsonify({'success': True, 'message': 'Email resent successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import threading
import io

def send_checkin_notifications(guest_name, room, base_url, token, email, mobile):
    login_url = f"{base_url}/guest-login?token={token}"

    def send_real_email():
        my_email = os.environ.get("GMAIL_USER", "raghavw2006@gmail.com")
        my_app_password = os.environ.get("GMAIL_APP_PASSWORD", "unzk mzpe zqsm rjxj").replace(" ", "")

        msg = MIMEMultipart('related')
        msg['From'] = my_email
        msg['To'] = email
        msg['Subject'] = f"Secure Access: SafePath Hospital Safety Guide - Unit {room}"

        html_body = EMAIL_TEMPLATE.format(
            guest_name=guest_name,
            room=room,
            login_url=login_url
        )
        msg.attach(MIMEText(html_body, 'html'))

        # Attach facility banner
        facility_img_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'facility-bg.jpg')
        try:
            with open(facility_img_path, 'rb') as f:
                facility_img = MIMEImage(f.read(), _subtype='jpeg')
                facility_img.add_header('Content-ID', '<facility_banner>')
                facility_img.add_header('Content-Disposition', 'inline', filename='facility.jpg')
                msg.attach(facility_img)
        except Exception as e:
            print(f"Warning: Could not attach facility image: {e}")

        # Generate and attach QR code
        try:
            import qrcode
            qr = qrcode.QRCode(version=2, box_size=10, border=2)
            qr.add_data(login_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="#0a0e1a", back_color="white")
            buf = io.BytesIO()
            qr_img.save(buf, format='PNG')
            buf.seek(0)
            qr_mime = MIMEImage(buf.read(), _subtype='png')
            qr_mime.add_header('Content-ID', '<qr_code>')
            qr_mime.add_header('Content-Disposition', 'inline', filename='qr_code.png')
            msg.attach(qr_mime)
        except Exception as e:
            print(f"Warning: Could not generate QR code: {e}")

        try:
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(my_email, my_app_password)
            server.send_message(msg)
            server.quit()
            print(f"[OK] Email with facility image + QR sent to: {email}", flush=True)
        except Exception as e:
            print(f"[ERROR] Failed to send email: {e}", flush=True)

    if email:
        threading.Thread(target=send_real_email, daemon=True).start()

    print(f"[NOTIFICATION] Check-in processed for {guest_name} (Unit {room}). SMS feature disabled by request.", flush=True)
    print("=" * 50, flush=True)


if __name__ == '__main__':
    init_db()
    print('SafePath Cloud Backend: http://0.0.0.0:5000')
    app.run(debug=True, port=5000, host='0.0.0.0')
