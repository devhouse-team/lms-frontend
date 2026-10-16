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

def invite_user(email, username, name):
    """A second account without the 5-per-hour registration limit: invite (mentor role, which grants nothing) + accept"""
    s, r = head('/api/invites', 'POST', {'email': email, 'role': 'mentor'})
    assert s == 201, r
    time.sleep(1.2)
    msgs = req(MAIL + '/api/v1/messages')[1]['messages']
    mid = next(m['ID'] for m in msgs if any(t['Address'] == email for t in m['To']))
    tok = re.search(r'accept-invite\?token=(\S+)', req(f'{MAIL}/api/v1/message/{mid}')[1]['Text']).group(1)
    who = Bff()
    s, r = who('/api/invites/accept', 'POST', {'token': tok, 'name': name, 'username': username, 'password': 'Str0ng-pass-123!'})
    assert s == 200, r
    return who


day = lambda offset: time.strftime('%Y-%m-%d', time.gmtime(time.time() + offset * 86400))
mentor_b = invite_user(f'mentorb{RUN}@example.com', f'mentb{RUN}', 'Aliya Mentor')
for i in range(2, 6):
    invite_user(f'stud{i}x{RUN}@example.com', f'stud{i}x{RUN}', f'Student {i}')

s, people = head('/api/people/options')
ok(s == 200 and len(people) >= 7, 'people options for pickers', len(people) if isinstance(people, list) else people)
uid = {p['username']: p['id'] for p in people}
A, B, S1 = uid[f'ment{RUN}'], uid[f'mentb{RUN}'], uid[student_u]
S2, S3, S4, S5 = (uid[f'stud{i}x{RUN}'] for i in range(2, 6))

s, programs = head('/api/programs')
ok(s == 200 and any(p['id'] == str(prog['id']) for p in programs), 'programs list', programs)
pid = str(prog['id'])

# --- cohort create, status from dates ---------------------------------------------------
s, c = head('/api/cohorts', 'POST', {'name': f'FE-{RUN}', 'programId': pid, 'startsOn': day(-8), 'endsOn': day(76)})
ok(s == 201, 'create active cohort (no status sent)', c)
cid = c['id']
s, p_ = head('/api/cohorts', 'POST', {'name': f'FE-plan-{RUN}', 'programId': pid, 'startsOn': day(1), 'endsOn': day(90)})
ok(s == 201, 'create planned cohort', p_)
pcid = p_['id']
s, r = head('/api/cohorts', 'POST', {'name': f'fe-{RUN}', 'programId': pid, 'startsOn': day(1), 'endsOn': day(90)})
ok(s == 422 and r['statusMessage'] == 'cohort_name_taken', 'name taken, any letter case', r)
s, r = head('/api/cohorts', 'POST', {'name': f'Past-{RUN}', 'programId': pid, 'startsOn': day(-30), 'endsOn': day(-1)})
ok(s == 422 and r['statusMessage'] == 'cohort_ends_in_past', 'end date in the past', r)

s, det = head(f'/api/cohorts/{cid}')
s2, apic = api(f'/cohorts/{cid}')
ok(det['status'] == 'active' and det['week'] == apic['week'] and det['totalWeeks'] == apic['total_weeks'] and 'mentor' not in det, 'detail status and week come from the API', det)
s, pdet = head(f'/api/cohorts/{pcid}')
ok(pdet['status'] == 'planned' and pdet['week'] == 0, 'starting tomorrow is planned', pdet)
s, r = head(f'/api/cohorts/{cid}', 'PATCH', {'startsOn': day(-7)})
ok(s == 422 and r['statusMessage'] == 'cohort_started', 'active cohort: start date locked', r)
s, r = head(f'/api/cohorts/{cid}', 'PATCH', {'endsOn': day(80)})
ok(s == 200, 'active cohort: end date editable', r)

# --- staff ----------------------------------------------------------------------------
s, r = head(f'/api/cohorts/{cid}/staff/{A}', 'PUT', {'role': 'mentor'})
s2, r2 = head(f'/api/cohorts/{cid}/staff/{B}', 'PUT', {'role': 'mentor'})
ok(s == 200 and s2 == 200 and r['unassignedMentees'] == 0, 'add two mentors', (r, r2))
s, det = head(f'/api/cohorts/{cid}')
ok(sorted(m['role'] for m in det['staff']) == ['mentor', 'mentor'], 'staff lists both with roles', det['staff'])

# --- enroll, auto-assign, bulk ------------------------------------------------------------
for u in (S1, S2, S3, S4):
    s, r = head(f'/api/cohorts/{cid}/enrollments', 'POST', {'userId': u})
    ok(s == 201 and r['result'] == 'enrolled', f'enroll {u}', r)
s, r = head(f'/api/cohorts/{cid}/enrollments', 'POST', {'userId': S1})
ok(s == 409 and r['statusMessage'] == 'enrollment_exists', 'duplicate enrollment', r)
s, r = head(f'/api/cohorts/{cid}/staff/{S1}', 'PUT', {'role': 'reviewer'})
ok(s == 422 and r['statusMessage'] == 'student_cannot_be_staff', 'a student cannot be staff', r)

s, r = head(f'/api/cohorts/{cid}/mentors/auto', 'POST')
s2, roster = head(f'/api/cohorts/{cid}/roster')
loads = {}
for x in roster:
    loads[x['mentor']['id'] if x['mentor'] else None] = loads.get(x['mentor']['id'] if x['mentor'] else None, 0) + 1
ok(r.get('assigned') == 4 and loads.get(A) == 2 and loads.get(B) == 2, 'auto-assign: 2 mentors × 2 students', (r, loads))

s, r = head(f'/api/cohorts/{cid}/mentors', 'PUT', {'mentorId': A, 'menteeIds': [S1, S2, S3]})
s2, roster = head(f'/api/cohorts/{cid}/roster')
ok(r.get('assigned') == 3 and all(x['mentor']['id'] == A for x in roster if x['id'] in (S1, S2, S3)), 'bulk assign in one call', r)
s, r = head(f'/api/cohorts/{cid}/mentors/{S3}', 'DELETE')
s2, r2 = head(f'/api/cohorts/{cid}/mentors/{S3}', 'DELETE')
s3, roster = head(f'/api/cohorts/{cid}/roster')
ok(s == 200 and s2 == 200 and next(x for x in roster if x['id'] == S3)['mentor'] is None, 'unassign; already unassigned is fine', (r, r2))

s, r = head(f'/api/cohorts/{cid}/staff/{B}', 'DELETE')
s2, roster = head(f'/api/cohorts/{cid}/roster')
ok(s == 200 and r['unassignedMentees'] == 1 and next(x for x in roster if x['id'] == S4)['mentor'] is None, 'remove mentor reports unassigned students', r)

# --- status changes, re-enroll, CSV ---------------------------------------------------------
enr = {x['id']: x['enrollmentId'] for x in roster}
s, r = head(f'/api/enrollments/{enr[S4]}', 'PATCH', {'status': 'dropped'})
s2, r2 = head(f'/api/cohorts/{cid}/enrollments', 'POST', {'userId': S4})
ok(s == 200 and s2 == 200 and r2['result'] == 'reactivated', 're-adding a dropped student reactivates', r2)
s, r = head(f'/api/enrollments/{enr[S2]}', 'PATCH', {'status': 'dropped'})
s, r = head(f'/api/enrollments/{enr[S2]}', 'PATCH', {'status': 'paused'})
ok(s == 409 and r['statusMessage'] == 'invalid_transition', 'dropped → paused is not allowed', r)

csv = '\n'.join(['email', f'stud5x{RUN}@example.com', f'stud2x{RUN}@example.com', f'{student_u}@example.com', f'nobody{RUN}@example.com', f'mentor{RUN}@example.com']).encode()
boundary = 'b' + RUN
body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="s.csv"\r\nContent-Type: text/csv\r\n\r\n').encode() + csv + f'\r\n--{boundary}--\r\n'.encode()
rq = urllib.request.Request(FE + f'/api/cohorts/{cid}/enrollments/import', data=body, method='POST', headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'Cookie': head.cookie})
rep = json.loads(urllib.request.urlopen(rq).read())
ok([len(rep[k]) for k in ('enrolled', 'reactivated', 'alreadyEnrolled', 'unknown', 'skippedStaff')] == [1, 1, 1, 1, 1], 'CSV report 1/1/1/1/1', rep)

s, roster = head(f'/api/cohorts/{cid}/roster')
enr = {x['id']: x['enrollmentId'] for x in roster}
s, r = head(f'/api/enrollments/{enr[S3]}/move', 'POST', {'cohortId': pcid})
s2, roster = head(f'/api/cohorts/{cid}/roster')
s3, proster = head(f'/api/cohorts/{pcid}/roster')
ok(s == 200 and next(x for x in roster if x['id'] == S3)['enrollment'] == 'dropped' and next(x for x in proster if x['id'] == S3)['enrollment'] == 'active', 'move: dropped here, active there, one call', r)
s, r = head(f'/api/cohorts/{pcid}', 'DELETE')
ok(s == 422 and r['statusMessage'] == 'cohort_not_deletable', 'planned cohort with a student cannot be deleted', r)
s, e_ = head('/api/cohorts', 'POST', {'name': f'Empty-{RUN}', 'programId': pid, 'startsOn': day(3), 'endsOn': day(60)})
s, r = head(f"/api/cohorts/{e_['id']}", 'DELETE')
s2, r2 = head(f"/api/cohorts/{e_['id']}")
ok(s == 200 and s2 == 404, 'empty planned cohort deleted', (r, r2))

s, rows = head('/api/cohorts')
mine_row = next((x for x in rows if x['id'] == cid), None)
ok(s == 200 and mine_row and mine_row['status'] == 'active' and [m['id'] for m in mine_row['mentors']] == [A] and mine_row['week'] == apic['week'], 'cohorts table row', mine_row)
s, rows = head('/api/cohorts?status=planned')
ok(s == 200 and all(x['status'] == 'planned' for x in rows) and any(x['id'] == pcid for x in rows), 'status filter', [x['status'] for x in rows])
s, opts = head('/api/cohorts/options')
ok(s == 200 and any(o['id'] == pcid for o in opts) and all(o['status'] != 'finished' for o in opts), 'move targets: planned and active only', opts)

# --- assignments and reviews -------------------------------------------------------------
s, r = api(f"/cohorts/{cid}/courses/{course['id']}", 'PUT', {'start_offset_days': 0})
ok(s in (200, 201), 'attach course (API)', r)
s, det = head(f'/api/cohorts/{cid}')
s, r = head('/api/assignments', 'POST', {'lessonId': det['lessons'][0]['id'], 'title': 'Todo app', 'description': 'Build it', 'dueOffsetDays': 30})
ok(s == 201, 'attach assignment to a lesson', r)

stud = Bff()
s, r = stud('/api/auth/login', 'POST', {'login': f'{student_u}@example.com', 'password': 'Str0ng-pass-123!'})
ok(s == 200 and r['role'] == 'mentee', 'student login by email', r)
s, d = stud('/api/dashboard/mentee')
ok(s == 200 and d['cohort']['name'] == f'FE-{RUN}' and d['cohort']['status'] == 'active' and d['mentor']['name'] == 'Nurzhan Mentor', 'student dashboard: active cohort, own mentor', d)
s, lst = stud('/api/assignments')
ok(s == 200 and len(lst['current']) == 1 and lst['archive'] == [], 'student assignment list', lst)
aid = lst['current'][0]['id']
s, r = stud(f'/api/assignments/{aid}/submissions', 'POST', {'url': 'https://github.com/x/todo', 'note': 'first try'})
ok(s == 201, 'student submits', r)

s, rv = mentor('/api/reviews')
ok(s == 200 and len(rv['waiting']) == 1, 'own mentor sees the submission', rv)
s, roster = head(f'/api/cohorts/{cid}/roster')
s1row = next(x for x in roster if x['id'] == S1)
ok(s1row['waiting'] == 1 and s1row['lastActivityAt'], 'roster counts the waiting submission and activity', s1row)
s, dash = head('/api/dashboard/head')
load = {m['id']: m for m in dash['mentorLoad']}
ok(s == 200 and load.get(A, {}).get('waiting') == 1, 'head mentor load per mentor', dash['mentorLoad'])

# --- finish --------------------------------------------------------------------------------
s, r = head(f'/api/cohorts/{cid}/finish', 'POST')
s2, det = head(f'/api/cohorts/{cid}')
s3, roster = head(f'/api/cohorts/{cid}/roster')
statuses = sorted(x['enrollment'] for x in roster)
ok(s == 200 and det['status'] == 'finished' and det['finishedAt'] and 'active' not in statuses and 'paused' not in statuses, 'finish: read-only, active/paused become completed', (det['status'], statuses))
s, r = head(f'/api/cohorts/{cid}/enrollments', 'POST', {'userId': S3})
ok(s == 422 and r['statusMessage'] == 'cohort_finished', 'finished cohort refuses enrolling', r)
s, d = stud('/api/dashboard/mentee')
ok(s == 200 and d['cohort'] is None and any(p_['id'] == cid for p_ in d['pastCohorts']), 'student: finished cohort is in the archive', d.get('pastCohorts'))
s, lst = stud('/api/assignments')
ok(s == 200 and lst['current'] == [] and lst['archive'] and lst['archive'][0]['cohortId'] == cid and lst['archive'][0]['items'], 'student assignments archive', lst)
s, det = stud(f'/api/assignments/{aid}')
ok(s == 200 and det['cohort']['status'] == 'finished' and det['submissions'], 'assignment in a finished cohort: readable, with history', det.get('cohort'))
s, r = stud(f'/api/assignments/{aid}/submissions', 'POST', {'url': 'https://github.com/x/todo2'})
ok(r.get('statusMessage') in ('cohort_not_active', 'submission_pending'), 'submitting in a finished cohort is refused', r)
s, rv = mentor('/api/reviews')
ok(s == 200 and len(rv['waiting']) == 1, 'mentor can still review after the end', rv)
s, mine = mentor('/api/cohorts/mine')
ok(s == 200 and any(x['id'] == cid and x['status'] == 'finished' for x in mine), 'mentor page lists the finished cohort', [x['status'] for x in mine])

s, r = stud('/api/auth/logout', 'POST')
s, r = stud('/api/dashboard/mentee')
ok(s == 401, 'logged out user gets 401', r)

print('\nFAILURES:', ok.failed)
sys.exit(1 if ok.failed else 0)
