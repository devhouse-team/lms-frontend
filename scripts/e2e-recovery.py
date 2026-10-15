"""
End-to-end check for spec/features/account-recovery.md: forgot password, reset, email verification.

Same setup as scripts/e2e-smoke.py (local backend with Mailpit, this app on FE_URL against it).
Uses 1 registration and 2 reset requests of the per-IP hourly limits (5 each). Never point it at production.
"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

API = os.environ.get('API_URL', 'http://localhost:8000/api/v1')
FE = os.environ.get('FE_URL', 'http://localhost:3123')
MAIL = os.environ.get('MAILPIT_URL', 'http://localhost:8025')
if 'api.devhouse.kz' in API or 'lms.devhouse.kz' in FE:
    sys.exit('Refusing to run against production')
RUN = str(int(time.time()))[-6:]
failed = 0


def call(url, method='GET', body=None, cookie=None):
    h = {'Content-Type': 'application/json'} if body is not None else {}
    if cookie:
        h['Cookie'] = cookie
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        res = urllib.request.urlopen(r)
        raw = res.read()
        return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:300]


def ok(cond, label, extra=''):
    global failed
    print(('PASS ' if cond else 'FAIL ') + label + ('' if cond else f'  {str(extra)[:400]}'))
    failed += not cond


def mail_link(to, path, after):
    """Newest email to `to` received after `after` that contains a link to `path`; returns the token"""
    for _ in range(20):
        msgs = call(MAIL + '/api/v1/messages')[1]['messages']
        for m in msgs:
            if any(t['Address'] == to for t in m['To']) and m['Created'] >= after:
                text = call(f"{MAIL}/api/v1/message/{m['ID']}")[1]['Text']
                found = re.search(re.escape(path) + r'\?token=(\S+)', text)
                if found:
                    return urllib.parse.unquote(found.group(1))
        time.sleep(0.5)
    return None


def login(user, password):
    return call(FE + '/api/auth/login', 'POST', {'login': user, 'password': password})


user, email = f'rec{RUN}', f'rec{RUN}@example.com'
old_pw, new_pw = 'Old-pass-123!', 'New-pass-456!'
start = time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(time.time() - 2))

s, r = call(API + '/auth/register', 'POST', {'name': 'Recovery Test', 'username': user, 'email': email, 'password': old_pw})
ok(s == 202, 'register a test account on the API', r)

# Verification link from the registration email
vtoken = mail_link(email, '/verify-email', start)
ok(vtoken is not None, 'registration email links to /verify-email?token=')
s, r = call(FE + '/api/auth/verify', 'POST', {'token': vtoken or 'x'})
ok(s == 200, 'valid verification token confirms the email', r)
s, r = call(FE + '/api/auth/verify', 'POST', {'token': vtoken or 'x'})
ok(s in (400, 422), 'a used verification token is refused', r)
s, r = call(FE + '/api/auth/verify', 'POST', {'token': 'bogus'})
ok(s in (400, 422), 'a bogus verification token is refused', r)

# Forgot password: same answer for known and unknown emails
s_known, r_known = call(FE + '/api/auth/forgot', 'POST', {'email': email})
s_unknown, r_unknown = call(FE + '/api/auth/forgot', 'POST', {'email': f'nobody{RUN}@example.com'})
ok(s_known == 200 and (s_known, r_known) == (s_unknown, r_unknown), 'forgot answers the same for known and unknown emails', (r_known, r_unknown))
s, r = call(FE + '/api/auth/forgot', 'POST', {'email': 'not-an-email'})
ok(s == 400, 'forgot rejects a malformed email before calling the API', r)

rtoken = mail_link(email, '/reset-password', start)
ok(rtoken is not None, 'reset email links to /reset-password?token=')

s, r = call(FE + '/api/auth/reset', 'POST', {'token': rtoken or 'x', 'password': 'nouppercase-123!'})
field = ((r or {}).get('data') or {}).get('details', {}).get('fields', []) if isinstance(r, dict) else []
ok(s == 422 and any(f['loc'][1] == 'new_password' for f in field), 'a policy-breaking password gets a 422 with a new_password message', r)
s, r = call(FE + '/api/auth/reset', 'POST', {'token': rtoken or 'x', 'password': new_pw})
ok(s == 200, 'the same link still works after the policy rejection', r)

s, r = login(user, new_pw)
ok(s == 200, 'sign in with the new password', r)
s, r = login(user, old_pw)
ok(s == 401, 'the old password no longer works', r)
s, r = call(FE + '/api/auth/reset', 'POST', {'token': rtoken or 'x', 'password': 'Another-pass-789!'})
ok(s == 400, 'a used reset token is refused (invalid-link state)', r)

print('\nFAILURES:', failed)
sys.exit(1 if failed else 0)
