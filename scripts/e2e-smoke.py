"""
End-to-end smoke test for the acceptance criteria in spec/features/.

Needs a LOCAL backend (../backend: docker compose up, migrations, first superuser) and this app running against it:
  NUXT_API_BASE=http://localhost:8000/api/v1 NUXT_PUBLIC_ROLE_IDS_HEAD=<admin id> NUXT_PUBLIC_ROLE_IDS_MENTOR=<mentor id> npx nuxi dev --port 3123
Then: python3 -I scripts/e2e-smoke.py
Seeds a course skeleton straight on the API, builds programs and course content through Nitro and drives every role through Nitro.
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


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def location(bff, path):
    """Status and Location of a Nitro file route, without following the redirect"""
    try:
        res = urllib.request.build_opener(NoRedirect).open(urllib.request.Request(FE + path, headers={'Cookie': bff.cookie}))
        return res.status, res.headers.get('Location'), res.headers.get('Cache-Control')
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Location'), e.headers.get('Cache-Control')


def upload(bff, filename, data, purpose):
    """Sign through Nitro, PUT to storage, complete; returns the file id"""
    s, t = bff('/api/files', 'POST', {'filename': filename, 'size': len(data), 'purpose': purpose})
    assert s == 200, (s, t)
    urllib.request.urlopen(urllib.request.Request(t['uploadUrl'], data=data, method='PUT', headers=t['headers']))
    s, done = bff(f"/api/files/{t['fileId']}/complete", 'POST')
    assert s == 200, done
    return t['fileId']


PDF = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
ZIP = bytes.fromhex('504b0506000000000000000000000000000000000000')


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
    s, l = api(f"/modules/{mod['id']}/lessons", 'POST', {'title': f'Lesson {i + 1}', 'summary': '', 'position': i + 1, 'is_published': True})
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
s, ticket = head('/api/files', 'POST', {'filename': 'cover.png', 'size': len(png), 'purpose': 'cover'})
put = urllib.request.urlopen(urllib.request.Request(ticket['uploadUrl'], data=png, method='PUT', headers=ticket['headers'])).status
s2, done = head(f"/api/files/{ticket['fileId']}/complete", 'POST')
s3, _ = head(f'/api/programs/{pid}', 'PATCH', {'coverFileId': ticket['fileId']})
s4, pd = head(f'/api/programs/{pid}')
ok(s == 200 and put == 200 and s2 == 200 and s3 == 200 and pd['coverUrl'], 'cover upload: signed, stored, completed, saved', (s, put, s2, s3, pd.get('coverUrl')))
s, r = head('/api/files', 'POST', {'filename': 'x.pdf', 'size': 10, 'purpose': 'cover'})
ok(s == 422 and r['statusMessage'] == 'validation_error', 'Nitro refuses a non-image cover', s)

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
s, cc = api(f'/cohorts/{cid}/courses')
ok(any(x['course_id'] == course['id'] and x['lesson_count'] == 3 for x in cc), 'cohort got the curriculum course and its lessons', cc)

# --- course editor through Nitro (spec course-content.md) -----------------------------------
CID = course['id']
s, eo = head(f'/api/editor/courses/{CID}')
ok(s == 200 and eo['can_manage_editors'] and len(eo['modules'][0]['lessons']) == 3, 'editor outline (admin edits every course)', eo.get('modules'))
L1, L2, L3 = (x['id'] for x in sorted(eo['modules'][0]['lessons'], key=lambda x: x['position']))
img = upload(head, 'graph.png', png, 'content_image')
s, md = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Notes', 'kind': 'markdown', 'tags': ['lecture_notes'], 'body': f'## Limits\nInline $x^2$ and\n\n$$\\sum_i i$$\n\n```python\nprint(1)\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n![graph](file:{img})', 'url': None, 'file_ids': [int(img)], 'is_published': True})
ok(s == 201 and md['files'][0]['id'] == int(img), 'markdown material with an attached image', md)
pdf_id = upload(head, 'slides.pdf', PDF, 'content')
s, pdfm = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Slides', 'kind': 'pdf', 'tags': ['slides'], 'body': '', 'url': None, 'file_ids': [int(pdf_id)], 'is_published': True})
s2, vid = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Lecture', 'kind': 'video', 'tags': ['lecture_video'], 'body': '', 'url': 'https://youtu.be/dQw4w9WgXcQ?t=65', 'file_ids': [], 'is_published': True})
zip_id = upload(head, 'starter.zip', ZIP, 'content')
s3, zm = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Starter code', 'kind': 'file', 'tags': ['code'], 'body': '', 'url': None, 'file_ids': [int(zip_id)], 'is_published': True})
s4, lk = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Reading', 'kind': 'link', 'tags': ['reading'], 'body': '', 'url': 'https://example.com/read', 'file_ids': [], 'is_published': True})
pic = upload(head, 'diagram.png', png, 'content')
s5, im = head(f'/api/editor/lessons/{L2}/materials', 'POST', {'title': 'Diagram', 'kind': 'image', 'tags': [], 'body': 'A caption', 'url': None, 'file_ids': [int(pic)], 'is_published': True})
ok(s5 == 201, 'image material', im)
ok((s, s2, s3, s4) == (201, 201, 201, 201) and vid['embed_url'] == 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=65', 'pdf, video, file and link materials', (s, s2, s3, s4, vid.get('embed_url')))
s, r = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Bad', 'kind': 'video', 'tags': [], 'body': '', 'url': 'https://evil.example/v', 'file_ids': [], 'is_published': True})
ok(r.get('statusMessage') in ('video_host_not_allowed', 'validation_error'), 'video host outside the allowlist refused', r)
s, hidden = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Draft notes', 'kind': 'markdown', 'tags': [], 'body': 'draft', 'url': None, 'file_ids': [], 'is_published': False})
order = [lk['id'], md['id'], pdfm['id'], vid['id'], zm['id'], hidden['id']]
s, r = head(f'/api/editor/lessons/{L1}/materials/order', 'PUT', {'material_ids': order})
ok(s == 200, 'reorder materials (full list)', r)
s, page = head(f'/api/editor/courses/{CID}/materials', 'POST', {'title': 'Syllabus', 'kind': 'markdown', 'tags': ['syllabus'], 'body': '# Syllabus', 'url': None, 'file_ids': [], 'is_published': True})
ok(s == 201 and page['lesson_id'] is None, 'course page (material without a lesson)', page)
s, m2 = head(f'/api/editor/courses/{CID}/modules', 'POST', {'title': 'Week 9', 'position': 1, 'release_offset_days': 60})
s2, late = head(f"/api/editor/modules/{m2['id']}/lessons", 'POST', {'title': 'Later lesson', 'summary': '', 'position': 0, 'is_published': True})
s3, r = head(f'/api/editor/lessons/{L3}', 'PATCH', {'module_id': m2['id'], 'position': 1})
s4, eo = head(f'/api/editor/courses/{CID}')
mod2 = next(x for x in eo['modules'] if x['id'] == m2['id'])
ok((s, s2, s3) == (201, 201, 200) and [x['id'] for x in sorted(mod2['lessons'], key=lambda x: x['position'])] == [late['id'], L3], 'add module and lesson; move a lesson to another module', [x['id'] for x in mod2['lessons']])
s, r = mentor(f'/api/editor/courses/{CID}')
ok(s in (403, 404), 'a mentor who edits nothing gets the "not an editor" answer', (s, r))
s, r = head(f'/api/editor/courses/{CID}/editors/{B}', 'PUT', {})
s2, eds = head(f'/api/editor/courses/{CID}/editors')
s3, r3 = head(f'/api/editor/courses/{CID}/editors/{B}', 'DELETE')
s4, eds2 = head(f'/api/editor/courses/{CID}/editors')
ok(s == 200 and any(e['user']['id'] == int(B) and e['source'] == 'editor' for e in eds) and s3 == 200 and not any(e['user']['id'] == int(B) for e in eds2), 'head adds and removes an editor', (r, eds, r3))
s, r = head('/api/files', 'POST', {'filename': 'a.exe', 'size': 10, 'purpose': 'submission'})
s2, r2 = head('/api/files', 'POST', {'filename': 'big.zip', 'size': 30 * 1024 * 1024, 'purpose': 'submission'})
s3, r3 = head('/api/files', 'POST', {'filename': 'notes.ts', 'size': 10, 'purpose': 'submission'})
ok(r.get('statusMessage') == 'validation_error' and r2.get('statusMessage') == 'file_too_large' and s3 == 200, 'upload rules: .exe and 30 MB refused before the API, .ts accepted', (r, r2, s3))
HW = {'statement': 'Build it', 'file_ids': [], 'is_published': True, 'accepts_text': True, 'accepts_links': True, 'accepts_files': True, 'max_files': 10, 'file_types': [], 'trial_enabled': False}
s, hw = head(f'/api/editor/lessons/{L1}/assignments', 'POST', {**HW, 'title': 'Todo app', 'mode': 'homework', 'due_offset_days': 30})
ok(s == 201 and hw['mode'] == 'homework', 'homework assignment through the editor', hw)

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
ok(s == 200 and len(lst['current']) == 1 and lst['current'][0]['mode'] == 'homework' and lst['archive'] == [], 'student assignment list (one call per cohort)', lst)
aid = lst['current'][0]['to'].replace('/assignments/', '')
s, r = stud(f'/api/assignments/resolve/{cid}-{L1}')
ok(s == 200 and r['to'] == f'/assignments/{aid}', 'old /assignments/{cohort}-{lesson} links resolve to the new page', r)

# --- student reads the course --------------------------------------------------------------
s, mc = stud('/api/courses')
grp = next((g for g in mc['cohorts'] if g['cohort']['id'] == cid), None)
row = grp and next((c_ for c_ in grp['courses'] if c_['courseId'] == str(CID)), None)
ok(s == 200 and row and row['doneLessons'] == 0 and row['releasedLessons'] >= 2, '/api/courses: my cohort with its course and figures', mc)
s, ol = stud(f'/api/courses/{cid}/{CID}')
les = {l_['id']: l_ for m_ in ol['modules'] for l_ in m_['lessons']}
ok(s == 200 and not ol['staff'] and les[str(L1)]['isReleased'] and not les[str(late['id'])]['isReleased'] and ol['pages'][0]['title'] == 'Syllabus', 'outline: released lessons, a locked one, course pages', ol)
s, lv = stud(f'/api/courses/{cid}/lessons/{L1}')
ok(s == 200 and [m_['id'] for m_ in lv['materials']] == [str(x) for x in order[:5]] and lv['materials'][1]['files'][0]['id'] == str(img) and 'file:' in lv['materials'][1]['body'], 'lesson: published materials in order, raw body with file metadata', [m_['title'] for m_ in lv.get('materials', [])])
s, r = stud(f"/api/courses/{cid}/lessons/{late['id']}")
ok(s == 403 and r['statusMessage'] == 'lesson_locked', 'a lesson before its day answers lesson_locked', r)
st, loc, cc = location(stud, f'/api/files/cohorts/{cid}/materials/{md["id"]}/{img}')
ok(st == 302 and loc and 'localhost:8333' in loc and 'private' in (cc or ''), 'file route answers 302 to a fresh signed URL', (st, loc, cc))
st, loc, cc = location(stud, f'/api/files/cohorts/{cid}/materials/{md["id"]}/{pdf_id}')
ok(st == 404, 'a file of another material is refused', st)
s, pg = stud(f"/api/courses/{cid}/pages/{page['id']}")
ok(s == 200 and pg['title'] == 'Syllabus' and pg['body'] == '# Syllabus', 'a course page opens for the student', pg)
s, r = head(f'/api/editor/lessons/{L2}', 'PATCH', {'is_published': False})
s2, ol2 = stud(f'/api/courses/{cid}/{CID}')
s3, r3 = head(f'/api/editor/lessons/{L2}', 'PATCH', {'is_published': True})
ok(s == 200 and str(L2) not in [l_['id'] for m_ in ol2['modules'] for l_ in m_['lessons']] and s3 == 200, 'an unpublished lesson disappears for students', [l_['id'] for m_ in ol2['modules'] for l_ in m_['lessons']])
s, r = stud(f'/api/courses/{cid}/lessons/{L1}/complete', 'PUT')
s2, ol = stud(f'/api/courses/{cid}/{CID}')
s3, mc = stud('/api/courses')
ok(s == 200 and next(l_ for m_ in ol['modules'] for l_ in m_['lessons'] if l_['id'] == str(L1))['completed'] and next(c_ for g in mc['cohorts'] for c_ in g['courses'] if c_['courseId'] == str(CID))['doneLessons'] == 1, 'mark complete shows in the outline and the course figure', r)
s, r = stud('/api/files', 'POST', {'filename': 'x.pdf', 'size': 10, 'purpose': 'content'})
ok(s == 403 and r['statusMessage'] == 'permission_denied', 'a student may not upload course content', r)

# --- homework with files -------------------------------------------------------------------
f1 = upload(stud, 'solution.pdf', PDF, 'submission')
f2 = upload(stud, 'code.zip', ZIP, 'submission')
s, r = stud(f'/api/assignments/{aid}/submissions', 'POST', {'body': 'First try, **see** the PDF', 'links': ['https://github.com/x/todo'], 'fileIds': [f1, f2]})
s2, adet = stud(f'/api/assignments/{aid}')
sub = adet['submissions'][0]
ok(s == 201 and len(sub['files']) == 2 and sub['links'] == ['https://github.com/x/todo'] and sub['body'].startswith('First try'), 'student submits two files, a markdown note and a link', sub)

s, rv = mentor('/api/reviews')
ok(s == 200 and len(rv['waiting']) == 1, 'own mentor sees the submission', rv)
s, rd = mentor(rv['waiting'][0]['to'].replace('/reviews/', '/api/reviews/'))
st, loc, _ = location(mentor, f"/api/files/submissions/{rd['submission']['id']}/{f1}")
ok(s == 200 and len(rd['submission']['files']) == 2 and rd['submission']['body'] and st == 302, 'review shows the files (inline through the route) and the note', (rd.get('submission'), st))
s, r = head(f'/api/editor/lessons/{L1}', 'DELETE')
s2, r2 = head(f"/api/editor/assignments/{hw['id']}", 'DELETE')
ok(r.get('statusMessage') == 'content_has_submissions' and r2.get('statusMessage') == 'content_has_submissions', 'deleting a lesson or assignment with submissions is refused', (r, r2))
s, roster = head(f'/api/cohorts/{cid}/roster')
s1row = next(x for x in roster if x['id'] == S1)
ok(s1row['waiting'] == 1 and s1row['lastActivityAt'], 'roster counts the waiting submission and activity', s1row)
s, dash = head('/api/dashboard/head')
load = {m['id']: m for m in dash['mentorLoad']}
ok(s == 200 and load.get(A, {}).get('waiting') == 1, 'head mentor load per mentor', dash['mentorLoad'])

# --- assignments v2: exam with trials and a short window, practice, solutions (spec Phase 2) ----------------------
import datetime as dt
iso = lambda secs: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=secs)).isoformat()
s, ex = head(f'/api/editor/lessons/{L1}/assignments', 'POST', {**HW, 'title': 'Midterm', 'mode': 'exam', 'statement': 'Solve **all**', 'accepts_text': False, 'accepts_links': False, 'max_files': 1, 'file_types': ['pdf'], 'max_score': 10, 'opens_offset_days': 30, 'opens_time': '10:00', 'duration_minutes': 60, 'trial_enabled': True})
s2, r = head(f"/api/cohorts/{cid}/exams/{ex['id']}/window", 'PUT', {'opensAt': iso(25), 'closesAt': iso(40)})
ok(s == 201 and s2 == 200, 'exam created; this cohort gets its own short window', (ex, r))
EX = f"/api/assignments/{cid}/{ex['id']}"
s, e1 = stud(EX)
ok(s == 200 and e1['phase'] == 'not_open' and e1['statement'] is None and e1['canTrial'] and not e1['canSubmit'] and e1['accepts']['maxFiles'] == 1, 'exam before the window: no statement, trial possible', e1)
for i in range(3):
    s, r = stud(f'{EX}/submissions', 'POST', {'fileIds': [upload(stud, f'trial{i}.pdf', PDF, 'submission')], 'isTrial': True})
s2, r2 = stud(f'{EX}/submissions', 'POST', {'fileIds': [upload(stud, 'trial4.pdf', PDF, 'submission')], 'isTrial': True})
s3, e1 = stud(EX)
ok(s == 201 and r2.get('statusMessage') == 'trial_limit' and len(e1['trials']) == 3 and e1['trials'][0]['isTrial'], 'three trials accepted, the fourth refused', (r, r2))
s, r = stud(f'{EX}/submissions', 'POST', {'body': 'text answer'})
ok(r.get('statusMessage') in ('format_not_accepted', 'exam_not_open'), 'a files-only exam refuses text', r)
s, rv = mentor('/api/reviews')
ok(not any(x['title'] == 'Midterm' for x in rv['waiting']), 'trials never reach the review queue', rv['waiting'])
time.sleep(27)
s, e2 = stud(EX)
ok(e2['phase'] == 'open' and e2['statement'] == 'Solve **all**' and e2['canSubmit'] and not e2['canTrial'], 'window open: statement visible, one attempt, no trials', e2.get('phase'))
s, r = stud(f'{EX}/submissions', 'POST', {'fileIds': [upload(stud, 'answer.pdf', PDF, 'submission')]})
s2, r2 = stud(f'{EX}/submissions', 'POST', {'fileIds': [upload(stud, 'again.pdf', PDF, 'submission')]})
ok(s == 201 and r2.get('statusMessage') == 'attempt_used' and s2 == 409, 'one exam submission; a second answers attempt_used', (r, r2))
s, rv = mentor('/api/reviews')
er = next(x for x in rv['waiting'] if x['title'] == 'Midterm')
s, rd = mentor(er['to'].replace('/reviews/', '/api/reviews/'))
s2, r2 = mentor(er['to'].replace('/reviews/', '/api/reviews/'), 'POST', {'verdict': 'changes', 'feedback': 'redo'})
s3, r3 = mentor(er['to'].replace('/reviews/', '/api/reviews/'), 'POST', {'verdict': 'accepted', 'feedback': 'Good', 'score': 8})
s4, e3 = stud(EX)
ok(rd['mode'] == 'exam' and len(rd['trials']) == 3 and rd['assignment']['maxScore'] == 10 and r2.get('statusMessage') == 'review_decision_not_allowed' and s3 == 200 and e3['submissions'][0]['score'] == 8, 'exam review: trials shown, accept with a score only', (r2, r3))

s, pr = head(f'/api/editor/lessons/{L1}/assignments', 'POST', {**HW, 'title': 'Drill', 'mode': 'practice'})
s2, sol = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Drill solution', 'kind': 'markdown', 'tags': [], 'body': 'answer: 42', 'url': None, 'file_ids': [], 'is_published': True, 'solution_of_id': pr['id']})
PR = f"/api/assignments/{cid}/{pr['id']}"
s3, p1 = stud(PR)
ok(s == 201 and sol['release'] == 'after_submit' and p1['solutions'] and not p1['solutions'][0]['isReleased'], 'practice: its solution is listed, locked until a first attempt', (sol.get('release'), p1.get('solutions')))
s, lv = stud(f'/api/courses/{cid}/lessons/{L1}')
s2, al = stud('/api/assignments')
ok({'homework', 'exam', 'practice'} <= {x['mode'] for x in lv['assignments']} and {'homework', 'exam', 'practice'} <= {x['mode'] for x in al['current']}, 'one lesson, several assignments: in its block and in /assignments', [x['mode'] for x in lv['assignments']])
s, r = stud(f'{PR}/submissions', 'POST', {'body': 'try 1'})
s2, r2 = stud(f'{PR}/submissions', 'POST', {'body': 'try 2'})
s3, p2 = stud(PR)
ok(s == 201 and s2 == 201 and len(p2['submissions']) == 2 and p2['solutions'][0]['isReleased'] and p2['solutions'][0]['body'] == 'answer: 42', 'practice: unlimited attempts, solution after the first', p2.get('solutions'))
s, rv = mentor('/api/reviews')
s2, rv2 = mentor('/api/reviews?practice=1')
ok(not any(x['mode'] == 'practice' for x in rv['waiting']) and any(x['mode'] == 'practice' for x in rv2['waiting']), 'practice is out of the queue unless asked for', [x['mode'] for x in rv2['waiting']])

s, ms = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Todo solution', 'kind': 'markdown', 'tags': [], 'body': 'the todo answer', 'url': None, 'file_ids': [], 'is_published': True, 'solution_of_id': hw['id'], 'release': 'manual'})
s2, h1 = stud(f'/api/assignments/{aid}')
s3, sols = head(f'/api/cohorts/{cid}/solutions')
row_ = next((x for x in sols if x['materialId'] == str(ms['id'])), None)
ok(s == 201 and not h1['solutions'][0]['isReleased'] and row_ and row_['canRelease'] and not row_['isReleased'], 'manual solution: hidden, the head may release it', (h1.get('solutions'), row_))
s, r = head(f"/api/cohorts/{cid}/solutions/{ms['id']}", 'PUT')
s2, h2 = stud(f'/api/assignments/{aid}')
s3, other = head(f'/api/cohorts/{pcid}/solutions')
orow = next((x for x in other if x['materialId'] == str(ms['id'])), None)
ok(s == 200 and h2['solutions'][0]['isReleased'] and h2['solutions'][0]['body'] == 'the todo answer' and orow and not orow['isReleased'] and not orow['releasedAt'], 'release now: open in this cohort, still hidden in another', (h2.get('solutions'), orow))
s, msol = mentor(f'/api/cohorts/{cid}/solutions')
ok(s == 200 and msol and not any(x['canRelease'] for x in msol), 'a plain mentor sees solutions read-only', [x['canRelease'] for x in msol] if isinstance(msol, list) else msol)

# after_due: the cohort started 7 days ago, so a 1-day due offset has passed; a 30-day one hasn't
s, hp = head(f'/api/editor/lessons/{L1}/assignments', 'POST', {**HW, 'title': 'Past due', 'mode': 'homework', 'due_offset_days': 1})
s2, hf = head(f'/api/editor/lessons/{L1}/assignments', 'POST', {**HW, 'title': 'Future due', 'mode': 'homework', 'due_offset_days': 30})
s3, ap = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Past solution', 'kind': 'markdown', 'tags': [], 'body': 'past answer', 'url': None, 'file_ids': [], 'is_published': True, 'solution_of_id': hp['id'], 'release': 'after_due'})
s4, af = head(f'/api/editor/lessons/{L1}/materials', 'POST', {'title': 'Future solution', 'kind': 'markdown', 'tags': [], 'body': 'future answer', 'url': None, 'file_ids': [], 'is_published': True, 'solution_of_id': hf['id'], 'release': 'after_due'})
s5, vp = stud(f"/api/assignments/{cid}/{hp['id']}")
s6, vf = stud(f"/api/assignments/{cid}/{hf['id']}")
ok((s, s2, s3, s4) == (201, 201, 201, 201) and vp['solutions'][0]['isReleased'] and vp['solutions'][0]['body'] == 'past answer' and not vf['solutions'][0]['isReleased'] and not vf['solutions'][0].get('body'),
   'after_due solution: open once the due day passed, locked before it', (vp.get('solutions'), vf.get('solutions')))

s, tz = head('/api/cohorts', 'POST', {'name': f'TZ-{RUN}', 'programId': pid, 'startsOn': day(5), 'timezone': 'Europe/Berlin'})
s2, tzd = head(f"/api/cohorts/{tz['id']}")
s3, r3 = head(f'/api/cohorts/{cid}', 'PATCH', {'timezone': 'Europe/Berlin'})
ok(s == 201 and tzd['timezone'] == 'Europe/Berlin' and r3.get('statusMessage') == 'cohort_started', 'cohort timezone: set on create, locked once active', (tzd.get('timezone'), r3))

# The window closes (25 s + 15 s) plus the 2-minute grace: a student who didn't submit has missed it
S4c = Bff()
s, r = S4c('/api/auth/login', 'POST', {'login': f'stud4x{RUN}', 'password': 'Str0ng-pass-123!'})
S4c('/api/auth/role', 'POST', {'role': 'mentee'})  # invited with the mentor role, so the student view is a switch away
closes = dt.datetime.fromisoformat(e2['closesAt'].replace('Z', '+00:00'))
time.sleep(max(0, (closes - dt.datetime.now(dt.timezone.utc)).total_seconds() + 125))
s, m4 = S4c(EX)
ok(s == 200 and m4['phase'] == 'closed' and not m4['canSubmit'] and m4['statement'] and not m4['submissions'], 'after the window: closed, statement stays, nothing to send (missed)', (s, m4))

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
s, lv = stud(f'/api/courses/{cid}/lessons/{L1}')
ok(lv['completeClosed'] == 'finished', 'finished cohort: mark complete closed', lv.get('completeClosed'))
s, r = stud(f'/api/assignments/{aid}/submissions', 'POST', {'links': ['https://github.com/x/todo2']})
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
s, eds = head(f'/api/editor/courses/{CID}/editors')
ok(any(e['user']['id'] == int(LEAD) and e['source'] == 'program_lead' for e in eds), 'the program lead is an editor "via program"', eds)
s, lc = lead('/api/courses')
ok(s == 200 and any(c_['id'] == str(CID) for c_ in lc['editing']), 'the lead (not admin) sees the course under Editing', lc.get('editing'))
s, dash = lead('/api/dashboard/head')
ok(s == 200 and dash['invites'] == [] and all(x['programId'] == pid for x in dash['cohorts']), 'lead dashboard: own cohorts, no invites', [x['programId'] for x in dash.get('cohorts', [])])

s, r = stud('/api/auth/logout', 'POST')
s, r = stud('/api/dashboard/mentee')
ok(s == 401, 'logged out user gets 401', r)

print('\nFAILURES:', ok.failed)
sys.exit(1 if ok.failed else 0)
