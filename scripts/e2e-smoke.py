"""
End-to-end smoke test for the acceptance criteria in spec/features/.

Needs a LOCAL backend (../backend: docker compose up, migrations, first superuser) and this app running against it:
  NUXT_API_BASE=http://localhost:8000/api/v1 NUXT_PUBLIC_ROLE_IDS_HEAD=<admin id> NUXT_PUBLIC_ROLE_IDS_MENTOR=<mentor id> npx nuxi dev --port 3123
Then: python3 -I scripts/e2e-smoke.py
Seeds courses and lessons straight on the API (no UI for them yet), builds the program through Nitro and drives every role through Nitro.
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

s, course = api('/courses/', 'POST', {'title': f'React {RUN}', 'slug': f'react-{RUN}', 'description': '', 'is_published': True})
assert s == 201, course
s, mod = api(f"/courses/{course['id']}/modules", 'POST', {'title': 'Week 1', 'position': 1, 'release_offset_days': 0})
assert s == 201, mod
lessons = []
for i in range(3):
    s, l = api(f"/modules/{mod['id']}/lessons", 'POST', {'title': f'Lesson {i + 1}', 'content': {'type': 'text', 'body': 'x'}, 'position': i + 1, 'is_published': True})
    assert s == 201, l
    lessons.append(l)
extra = []
for name in ('Algorithms', 'Career'):
    s, c_ = api('/courses/', 'POST', {'title': f'{name} {RUN}', 'slug': f'{name.lower()}-{RUN}', 'description': '', 'is_published': False})
    assert s == 201, c_
    extra.append(str(c_['id']))

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

# --- programs v2 (spec programs.md) -------------------------------------------------------
s, r = head('/api/programs', 'POST', {'title': f'Frontend {RUN}', 'slug': f'frontend-{RUN}', 'description': 'Line one\nLine two', 'durationWeeks': 12})
ok(s == 201, 'create program through Nitro (no status, no position)', r)
pid = r['id']
s, pd = head(f'/api/programs/{pid}')
ok(s == 200 and pd['status'] == 'draft' and pd['can']['manage'] and not pd['can']['createCohort'], 'new program is a draft on its page', pd)
s, r = head('/api/programs', 'POST', {'title': 'Dup', 'slug': f'frontend-{RUN}', 'durationWeeks': 4})
ok(r.get('statusMessage') == 'slug_taken', 'slug taken', r)
s, lst = head('/api/programs')
row = next((x for x in lst['programs'] if x['id'] == pid), None)
ok(s == 200 and row and row['status'] == 'draft' and row['cohortCounts'] == {'planned': 0, 'active': 0, 'finished': 0} and lst['can'] == {'create': True, 'reorder': True}, 'list row with counts from the API', row)
s, opts = head('/api/programs/options')
ok(s == 200 and all(o['id'] != pid for o in opts), 'picker leaves out drafts', opts)
s, r = head('/api/cohorts', 'POST', {'name': f'Nope-{RUN}', 'programId': pid, 'startsOn': day(1)})
ok(r.get('statusMessage') == 'program_not_active', 'no cohorts in a draft program', r)

s, cos = head('/api/programs/course-options')
ok(s == 200 and any(c_['id'] == extra[0] and not c_['published'] for c_ in cos), 'course options with published flag', len(cos) if isinstance(cos, list) else cos)
s1, _ = head(f"/api/programs/{pid}/courses/{course['id']}", 'PUT', {'startOffsetDays': 0})
s2, _ = head(f'/api/programs/{pid}/courses/{extra[0]}', 'PUT', {'startOffsetDays': 15})
s3, _ = head(f'/api/programs/{pid}/courses/{extra[1]}', 'PUT', {'startOffsetDays': 21})
s, pd = head(f'/api/programs/{pid}')
ok((s1, s2, s3) == (200, 200, 200) and [c_['courseId'] for c_ in pd['courses']] == [str(course['id'])] + extra and pd['courses'][0]['lessons'] == 3 and pd['courses'][1]['startOffsetDays'] == 15, 'three courses in order with offsets and counts', pd['courses'])
s, _ = head(f'/api/programs/{pid}/courses/order', 'PUT', {'courseIds': [str(course['id']), extra[1], extra[0]]})
s, pd = head(f'/api/programs/{pid}')
ok(s == 200 and [c_['courseId'] for c_ in pd['courses']] == [str(course['id']), extra[1], extra[0]], 'curriculum reorder', [c_['courseId'] for c_ in pd['courses']])
s, _ = head(f'/api/programs/{pid}/courses/{extra[1]}', 'DELETE')
s, pd = head(f'/api/programs/{pid}')
ok(s == 200 and len(pd['courses']) == 2 and pd['courseCount'] == 2, 'remove a course from the curriculum', pd['courses'])
s, _ = head(f"/api/programs/{pid}/courses/{course['id']}", 'PUT', {'startOffsetDays': 3})
s, pd = head(f'/api/programs/{pid}')
ok(s == 200 and pd['courses'][0]['courseId'] == str(course['id']) and pd['courses'][0]['startOffsetDays'] == 3, 'change start without position keeps the course in place', [(c_['courseId'], c_['startOffsetDays']) for c_ in pd['courses']])
s, _ = head(f"/api/programs/{pid}/courses/{course['id']}", 'PUT', {'startOffsetDays': 0})
s, lst = head('/api/programs')
ok(next(x for x in lst['programs'] if x['id'] == pid)['courseCount'] == 2, 'list course count from the API (course_count)', lst['programs'][:1])

# Cover: sign, PUT straight to storage, complete, save
png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082')
s, ticket = head('/api/files', 'POST', {'filename': 'cover.png', 'contentType': 'image/png', 'size': len(png)})
put = urllib.request.urlopen(urllib.request.Request(ticket['uploadUrl'], data=png, method='PUT', headers=ticket['headers'])).status
s2, done = head(f"/api/files/{ticket['fileId']}/complete", 'POST')
s3, _ = head(f'/api/programs/{pid}', 'PATCH', {'coverFileId': ticket['fileId']})
s4, pd = head(f'/api/programs/{pid}')
ok(s == 200 and put == 200 and s2 == 200 and s3 == 200 and pd['coverUrl'], 'cover upload: signed, stored, completed, saved', (s, put, s2, s3, pd.get('coverUrl')))
s, r = head('/api/files', 'POST', {'filename': 'x.pdf', 'contentType': 'application/pdf', 'size': 10})
ok(s == 400, 'Nitro refuses a non-image cover', s)

s, r = head(f'/api/programs/{pid}/activate', 'POST')
s2, opts = head('/api/programs/options')
ok(s == 200 and r['status'] == 'active' and any(o['id'] == pid and o['durationWeeks'] == 12 for o in opts), 'activate: offered in the picker', r)
s, lst = head('/api/programs')
ids = [x['id'] for x in lst['programs']]
s, r = head('/api/programs/order', 'PUT', {'ids': [pid] + [i for i in ids if i != pid]})
s2, lst = head('/api/programs')
s3, opts = head('/api/programs/options')
ok(s == 200 and lst['programs'][0]['id'] == pid and opts[0]['id'] == pid, 'program order: list and picker follow it', (r, opts[:1]))

s, scratch = head('/api/programs', 'POST', {'title': f'Scratch {RUN}', 'slug': f'scratch-{RUN}', 'durationWeeks': 4})
s, r = head(f"/api/programs/{scratch['id']}", 'DELETE')
s2, r2 = head(f"/api/programs/{scratch['id']}")
ok(s == 200 and s2 == 404 and r2['statusMessage'] == 'program_not_found', 'empty draft deleted; then not found', (r, r2))

# --- cohort create, status from dates ---------------------------------------------------
s, c = head('/api/cohorts', 'POST', {'name': f'FE-{RUN}', 'programId': pid, 'startsOn': day(-8)})
s2, apic = api(f"/cohorts/{c['id']}")
ok(s == 201 and c['coursesAttached'] == 2 and apic['ends_on'] == day(-8 + 12 * 7), 'create active cohort: no end date → program duration, curriculum copied', (c, apic.get('ends_on')))
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
s, pd = head(f'/api/programs/{pid}')
pc = next(x for x in pd['cohorts'] if x['id'] == cid)
ok(s == 200 and sorted(m['id'] for m in pc['mentors']) == sorted([A, B]) and pd['cohortCounts']['active'] == 1, 'program page lists every mentor of a cohort', pc)
s, r = head(f'/api/programs/{pid}/draft', 'POST')
ok(r.get('statusMessage') == 'program_has_cohorts', 'back to draft refused once a cohort exists', r)

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
s, det = head(f'/api/cohorts/{cid}')
ok(len(det['lessons']) == 3, 'cohort got the curriculum course and its lessons', len(det['lessons']))
s, r = head('/api/assignments', 'POST', {'lessonId': det['lessons'][0]['id'], 'title': 'Todo app', 'description': 'Build it', 'dueOffsetDays': 30})
ok(s == 201, 'attach assignment to a lesson', r)

stud = Bff()
s, r = stud('/api/auth/login', 'POST', {'login': f'{student_u}@example.com', 'password': 'Str0ng-pass-123!'})
ok(s == 200 and r['role'] == 'mentee', 'student login by email', r)
s, d = stud('/api/dashboard/mentee')
ok(s == 200 and d['cohort']['name'] == f'FE-{RUN}' and d['cohort']['status'] == 'active' and d['mentor']['name'] == 'Nurzhan Mentor', 'student dashboard: active cohort, own mentor', d)
ok(d['cohort']['program']['title'] == f'Frontend {RUN}' and d['cohort']['program']['description'] == 'Line one\nLine two' and d['cohort']['program']['coverUrl'], 'student dashboard: program title, description, cover', d['cohort'].get('program'))
s, r = head(f'/api/programs/{pid}/archive', 'POST')
s2, d2 = stud('/api/dashboard/mentee')
s3, opts = head('/api/programs/options')
s4, crow = head(f'/api/cohorts/{cid}')
ok(r['status'] == 'archived' and d2['cohort']['program']['title'] == d['cohort']['program']['title'] and all(o['id'] != pid for o in opts) and crow['status'] == 'active', 'archive: cohort runs on, student unchanged, gone from the picker', r)
s, r = head(f'/api/programs/{pid}/activate', 'POST')
ok(r['status'] == 'active', 'restore', r)
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
ok(all(x['program']['title'] for x in mine), 'mentor page: program per cohort', [x.get('program') for x in mine])

# --- program lead without admin rights ---------------------------------------------------------
lead = invite_user(f'lead{RUN}@example.com', f'lead{RUN}', 'Dana Lead')
s, people = head('/api/people/options')
LEAD = next(p['id'] for p in people if p['username'] == f'lead{RUN}')
s, r = head(f'/api/programs/{pid}', 'PATCH', {'leadId': LEAD})
lead = Bff()
s2, r2 = lead('/api/auth/login', 'POST', {'login': f'lead{RUN}', 'password': 'Str0ng-pass-123!'})
s3, sess = lead('/api/_auth/session')
ok(s == 200 and r2['role'] == 'head' and sess['user']['headScope'] == 'programs', 'lead signs in to the scoped head view', sess.get('user'))
s, lst = lead('/api/programs')
ok(s == 200 and [x['id'] for x in lst['programs']] == [pid] and lst['can'] == {'create': False, 'reorder': False}, 'lead sees only their program, no create or reorder', lst)
s, pd = lead(f'/api/programs/{pid}')
ok(s == 200 and pd['can'] == {'edit': True, 'manage': False, 'createCohort': True}, 'lead: edit and create cohort, no status actions', pd.get('can'))
s, r = lead(f'/api/programs/{pid}', 'PATCH', {'description': 'By the lead', 'leadId': None})
s2, pd = head(f'/api/programs/{pid}')
ok(s == 200 and pd['description'] == 'By the lead' and pd['lead']['id'] == LEAD, "lead edits the description; their leadId is dropped", (r, pd.get('lead')))
s, r = lead(f'/api/programs/{pid}/courses/{extra[1]}', 'PUT', {'startOffsetDays': 28})
ok(s == 200, 'lead edits the curriculum', r)
s, opts = lead('/api/programs/options')
s2, lc = lead('/api/cohorts', 'POST', {'name': f'Lead-{RUN}', 'programId': pid, 'startsOn': day(10)})
ok([o['id'] for o in opts] == [pid] and s2 == 201 and lc['coursesAttached'] == 3, 'lead picker: own active programs; lead creates a cohort', (opts, lc))
s1, _ = lead('/api/contests')
s2, _ = lead('/api/contests/current/entries')
s3, _ = lead('/api/people')
s4, _ = lead('/api/invites', 'POST', {'email': f'z{RUN}@example.com', 'role': 'mentor'})
s5, _ = lead('/api/people/options')
ok((s1, s2, s3, s4, s5) == (403, 403, 403, 403, 200), 'lead: contests, people, invites 403; people picker open', (s1, s2, s3, s4, s5))
s, dash = lead('/api/dashboard/head')
ok(s == 200 and dash['invites'] == [] and all(x['programId'] == pid for x in dash['cohorts']), 'lead dashboard: own cohorts, no invites', [x['programId'] for x in dash.get('cohorts', [])])

s, r = stud('/api/auth/logout', 'POST')
s, r = stud('/api/dashboard/mentee')
ok(s == 401, 'logged out user gets 401', r)

print('\nFAILURES:', ok.failed)
sys.exit(1 if ok.failed else 0)
