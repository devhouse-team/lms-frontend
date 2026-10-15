"""
End-to-end smoke test for the acceptance criteria in spec/features/.

Needs a LOCAL backend (../backend: docker compose up, migrations, first superuser) and this app running against it:
  NUXT_API_BASE=http://localhost:8000/api/v1 NUXT_PUBLIC_ROLE_IDS_HEAD=<admin id> NUXT_PUBLIC_ROLE_IDS_MENTOR=<mentor id> npx nuxi dev --port 3123
Then: python3 -I scripts/e2e-smoke.py
Seeds a program, course and lessons straight on the API (no UI for them yet) and drives every role through Nitro.
Creates data on every run; never point it at production.
"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

API = os.environ.get('API_URL', 'http://localhost:8000/api/v1')
FE = os.environ.get('FE_URL', 'http://localhost:3123')
MAIL = os.environ.get('MAILPIT_URL', 'http://localhost:8025')
ENV_FILE = os.environ.get('BACKEND_ENV', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'backend', '.env'))
if 'api.devhouse.kz' in API or 'lms.devhouse.kz' in FE:
    sys.exit('Refusing to run against production')
ENV = dict(l.split('=', 1) for l in open(ENV_FILE).read().splitlines() if '=' in l and not l.startswith('#'))
ADMIN, ADMIN_PW = ENV['ADMIN_USERNAME'], ENV['ADMIN_PASSWORD'].strip().strip('"')
RUN = str(int(time.time()))[-6:]


def req(url, method='GET', body=None, headers=None, opener=None, form=False):
    data = None
    h = dict(headers or {})
    if body is not None:
        data = urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
        h['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        res = (opener or urllib.request.build_opener()).open(r)
        raw = res.read()
        return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:300]


def ok(cond, label, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label + (f'  {extra}' if extra and not cond else ''))
    if not cond:
        ok.failed += 1
ok.failed = 0


class Bff:
    """Keeps the session cookie by hand: the stdlib jar drops Secure cookies over http, browsers don't on localhost"""
    def __init__(self):
        self.cookie = None

    def __call__(self, path, method='GET', body=None):
        data = json.dumps(body).encode() if body is not None else None
        h = {'Content-Type': 'application/json'} if body is not None else {}
        if self.cookie:
            h['Cookie'] = self.cookie
        r = urllib.request.Request(FE + path, data=data, method=method, headers=h)
        try:
            res = urllib.request.urlopen(r)
            status, raw, headers = res.status, res.read(), res.headers
        except urllib.error.HTTPError as e:
            status, raw, headers = e.code, e.read(), e.headers
        for c in headers.get_all('Set-Cookie') or []:
            if c.startswith('nuxt-session='):
                self.cookie = c.split(';', 1)[0]
        try:
            return status, json.loads(raw) if raw else None
        except Exception:
            return status, raw[:300]


# --- direct API seeding (no frontend screens for course authoring) ---
s, tok = req(API + '/auth/token', 'POST', {'username': ADMIN, 'password': ADMIN_PW}, form=True)
assert s == 200, (s, tok)
H = {'Authorization': 'Bearer ' + tok['access_token']}
api = lambda p, m='GET', b=None: req(API + p, m, b, H)

s, prog = api('/programs/', 'POST', {'title': f'Frontend {RUN}', 'slug': f'frontend-{RUN}', 'description': 'e2e', 'is_published': True})
assert s == 201, prog
s, course = api('/courses/', 'POST', {'title': f'React {RUN}', 'slug': f'react-{RUN}', 'description': '', 'is_published': True})
assert s == 201, course
s, mod = api(f"/courses/{course['id']}/modules", 'POST', {'title': 'Week 1', 'position': 1, 'release_offset_days': 0})
assert s == 201, mod
lessons = []
for i in range(3):
    s, l = api(f"/modules/{mod['id']}/lessons", 'POST', {'title': f'Lesson {i + 1}', 'content': {'type': 'text', 'body': 'x'}, 'position': i + 1, 'is_published': True})
    assert s == 201, l
    lessons.append(l)

# Student self-registers (no student invite role yet)
student_u = f'stud{RUN}'
s, r = req(API + '/auth/register', 'POST', {'name': 'Aru Student', 'username': student_u, 'email': f'{student_u}@example.com', 'password': 'Str0ng-pass-123!'})
ok(s == 202, 'student registers on API', r)

# --- head through the BFF ---
head = Bff()
s, r = head('/api/auth/login', 'POST', {'login': ADMIN, 'password': ADMIN_PW})
ok(s == 200 and r['role'] == 'head', 'head login via BFF', r)
s, sess = head('/api/_auth/session')
ok(s == 200 and sess['user']['role'] == 'head' and 'secure' not in sess, 'session exposes user, not tokens', sess)

s, r = head('/api/invites', 'POST', {'email': f'mentor{RUN}@example.com', 'role': 'mentor'})
ok(s == 201 and r['role'] == 'mentor', 'head invites mentor', r)
s, r = head('/api/invites', 'POST', {'email': f'x{RUN}@example.com', 'role': 'mentee'})
ok(s == 422, 'student invite refused without role id', r)

# Mentor accepts from the emailed link (mailpit)
time.sleep(1.5)
msgs = req(MAIL + '/api/v1/messages')[1]['messages']
mid = next(m['ID'] for m in msgs if any(t['Address'] == f'mentor{RUN}@example.com' for t in m['To']))
body = req(f'{MAIL}/api/v1/message/{mid}')[1]['Text']
token = re.search(r'accept-invite\?token=(\S+)', body).group(1)
mentor = Bff()
s, r = mentor('/api/invites/accept', 'POST', {'token': token, 'name': 'Nurzhan Mentor', 'username': f'ment{RUN}', 'password': 'Str0ng-pass-123!'})
ok(s == 200 and r['role'] == 'mentor', 'mentor accepts invite and is signed in', r)
s, r = mentor('/api/invites/accept', 'POST', {'token': token, 'name': 'Again', 'username': f'ment{RUN}b', 'password': 'Str0ng-pass-123!'})
ok(s == 422 and r['statusMessage'] == 'invite_invalid', 'used invite is rejected', r)

s, people = head('/api/people')
ok(s == 200, 'people list', people)
mentor_row = next(p for p in people['people'] if p['username'] == f'ment{RUN}')
student_row = next(p for p in people['people'] if p['username'] == student_u)

s, programs = head('/api/programs')
ok(s == 200 and any(p['id'] == str(prog['id']) for p in programs), 'programs list', programs)

s, c = head('/api/cohorts', 'POST', {'name': f'FE-{RUN}', 'programId': str(prog['id']), 'startAt': time.strftime('%Y-%m-%d', time.gmtime(time.time() - 8 * 86400)), 'totalWeeks': 12, 'mentorId': mentor_row['id']})
ok(s == 201, 'head creates cohort with mentor', c)
cid = c['id']
s, r = head(f'/api/cohorts/{cid}/enrollments', 'POST', {'userId': student_row['id']})
ok(s == 201, 'head enrolls student', r)
s, r = head(f'/api/cohorts/{cid}/enrollments', 'POST', {'userId': student_row['id']})
ok(s == 409, 'duplicate enrollment is a conflict', r)
s, r = api(f"/cohorts/{cid}/courses/{course['id']}", 'PUT', {'start_offset_days': 0})
ok(s in (200, 201), 'attach course (API)', r)

s, roster = head(f'/api/cohorts/{cid}')
ok(s == 200 and roster['mentor'] and roster['mentor']['name'] == 'Nurzhan Mentor' and len(roster['mentees']) == 1 and len(roster['lessons']) == 3, 'cohort roster', roster)
ok(roster['week'] == 2 and roster['totalWeeks'] == 12, 'cohort week maths', (roster['week'], roster['totalWeeks']))

s, r = head('/api/assignments', 'POST', {'lessonId': roster['lessons'][0]['id'], 'title': 'Todo app', 'description': 'Build it', 'dueOffsetDays': 7})
ok(s == 201, 'head attaches assignment to lesson', r)
s, roster = head(f'/api/cohorts/{cid}')
a = roster['assignments'][0] if roster['assignments'] else {}
ok(len(roster['assignments']) == 1 and a.get('dueAt') and roster['lessons'][0]['hasAssignment'] and roster['canEditAssignments'], 'assignment shows on cohort, head can edit', roster['assignments'])
s, r = head(f"/api/assignments/{a['id']}", 'PATCH', {'title': 'Todo app v2', 'description': 'Build it well', 'dueOffsetDays': None})
ok(s == 200, 'edit assignment (no deadline)', r)

s, rows = head('/api/cohorts')
ok(s == 200 and any(r['id'] == cid and r['mentees'] == 1 for r in rows), 'cohorts table', rows)
s, dash = head('/api/dashboard/head')
ok(s == 200 and any(i['email'] == f'mentor{RUN}@example.com' for i in dash['invites']) is False and dash['mentorLoad'], 'head dashboard (accepted invite gone, mentor load)', dash)
s, opts = head('/api/cohorts/options')
ok(s == 200 and any(o['id'] == cid for o in opts), 'cohort options', opts)

# --- student ---
stud = Bff()
s, r = stud('/api/auth/login', 'POST', {'login': f'{student_u}@example.com', 'password': 'Str0ng-pass-123!'})
ok(s == 200 and r['role'] == 'mentee', 'student login by email', r)
s, d = stud('/api/dashboard/mentee')
ok(s == 200 and d['cohort']['name'] == f'FE-{RUN}' and d['mentor']['name'] == 'Nurzhan Mentor', 'student dashboard', d)
s, items = stud('/api/assignments')
ok(s == 200 and len(items) == 1 and items[0]['status'] == 'not_submitted' and 'dueAt' not in items[0], 'student assignment list', items)
aid = items[0]['id']
s, det = stud(f'/api/assignments/{aid}')
ok(s == 200 and det['title'] == 'Todo app v2' and det['mentor']['name'] == 'Nurzhan Mentor', 'student assignment detail', det)
s, r = stud(f'/api/assignments/{aid}/submissions', 'POST', {'url': 'https://github.com/x/todo', 'note': 'first try'})
ok(s == 201, 'student submits', r)
s, r = stud(f'/api/assignments/{aid}/submissions', 'POST', {'url': 'https://github.com/x/todo'})
ok(s == 409, 'second submit while pending is a conflict', r)
s, prof = stud('/api/mentor/profile')
ok(s == 200 and prof['mentor']['name'] == 'Nurzhan Mentor', 'student mentor page', prof)
s, r = stud('/api/cohorts')
ok(s == 403, 'student cannot read head cohorts list', r)

# --- mentor ---
s, md = mentor('/api/dashboard/mentor')
ok(s == 200 and len(md['reviewQueue']) == 1 and md['cohorts'][0]['mentees'], 'mentor dashboard queue', md)
s, rv = mentor('/api/reviews')
ok(s == 200 and len(rv['waiting']) == 1, 'mentor review list', rv)
sid = rv['waiting'][0]['id']
s, det = mentor(f'/api/reviews/{sid}')
ok(s == 200 and det['submission']['url'] == 'https://github.com/x/todo' and det['submission']['note'] == 'first try' and det['assignment']['description'] == 'Build it well', 'mentor review detail', det)
s, r = mentor(f'/api/reviews/{sid}', 'POST', {'verdict': 'changes', 'feedback': 'Add tests'})
ok(s == 200, 'mentor requests changes', r)
s, r = mentor(f'/api/reviews/{sid}', 'POST', {'verdict': 'accepted'})
ok(s == 409, 'reviewing twice is a conflict', r)
s, mine = mentor('/api/cohorts/mine')
ok(s == 200 and len(mine) == 1 and mine[0]['mentees'][0]['username'] == student_u, 'mentor cohort page', mine)
ok(len(mine[0]['assignments']) == 1 and mine[0]['canEditAssignments'] is False, 'mentor sees assignments, read-only', mine[0]['assignments'])

s, det = stud(f'/api/assignments/{aid}')
ok(det['status'] == 'changes' and det['submissions'][0]['feedback'] == 'Add tests' and det['submissions'][0]['reviewer']['name'] == 'Nurzhan Mentor', 'student sees feedback and reviewer', det)
s, r = stud(f'/api/assignments/{aid}/submissions', 'POST', {'url': 'https://github.com/x/todo2'})
ok(s == 201, 'student resubmits', r)
s, rv = mentor('/api/reviews')
sid2 = rv['waiting'][0]['id']
s, r = mentor(f'/api/reviews/{sid2}', 'POST', {'verdict': 'accepted'})
ok(s == 200, 'mentor accepts resubmission', r)
s, items = stud('/api/assignments')
ok(items[0]['status'] == 'accepted', 'student sees accepted', items)

# --- head roster after work ---
s, roster = head(f'/api/cohorts/{cid}')
m = roster['mentees'][0]
ok(m['accepted'] == 1 and m['assignmentsTotal'] == 1 and roster['assignments'][0]['submissions'] >= 1, 'roster counts accepted work', m)
s, r = head(f"/api/assignments/{roster['assignments'][0]['id']}", 'DELETE')
ok(s == 409, 'delete assignment with submissions is refused', r)
s, r = head(f"/api/enrollments/{m['enrollmentId']}", 'PATCH', {'status': 'paused'})
ok(s == 200, 'pause enrollment', r)

s, r = stud('/api/auth/logout', 'POST')
s, r = stud('/api/dashboard/mentee')
ok(s == 401, 'logged out user gets 401', r)

print('\nFAILURES:', ok.failed)
sys.exit(1 if ok.failed else 0)
