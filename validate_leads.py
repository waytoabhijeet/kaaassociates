import json
import time
import urllib.request
import http.cookiejar

base = 'http://localhost:3000'
loans = [
    'Personal Loan',
    'Business Loan',
    'Home Loan',
    'Loan Against Property',
    'New Car Loan',
    'Used Car Loan',
    'Education Loan',
    'MSME Loan',
    'Working Capital Loan',
    'Mudra Loan',
    'Overdraft (OD) Limit',
    'Project Loan',
    'Builder Project Loan',
]

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

for i, loan in enumerate(loans, 1):
    payload = {
        'loan_type': loan,
        'name': f'Dummy {loan} {i}',
        'mobile': f'9{str(123456780 + i).rjust(9, "0")}',
        'email': f'dummy{i}@example.com',
        'city': 'Delhi',
        'amount': str(50000 + i * 5000),
        'consent': True,
        'details': {'purpose': 'Automation check', 'source': 'QA'}
    }
    req = urllib.request.Request(
        f'{base}/api/leads',
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with opener.open(req, timeout=10) as resp:
            body = resp.read().decode()
            print(f'SUBMIT {i}/{len(loans)} {loan} => {resp.status} {body}')
    except Exception as e:
        print(f'SUBMIT {i}/{len(loans)} {loan} => ERROR {e}')
    time.sleep(0.2)

login_req = urllib.request.Request(
    f'{base}/api/admin/login',
    data=json.dumps({'username': 'admin', 'password': 'admin12345'}).encode(),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
try:
    with opener.open(login_req, timeout=10) as resp:
        print('LOGIN_STATUS', resp.status)
        print('LOGIN_BODY', resp.read().decode())
except Exception as e:
    print('LOGIN_ERROR', e)
    raise

try:
    with opener.open(f'{base}/api/admin/leads', timeout=10) as resp:
        data = json.load(resp)
        print('TOTAL_LEADS', len(data))
        print('LOAN_TYPES', sorted({item['loan_type'] for item in data}))
        print('LATEST', [{'id': x['id'], 'loan_type': x['loan_type'], 'name': x['name']} for x in data[:10]])
except Exception as e:
    print('LEADS_FETCH_ERROR', e)
    raise
