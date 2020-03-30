import time
import binascii
import json
import requests

res = requests.get('https://biblia.sk/api/preklady')
with open('preklady.json', 'wb') as f:
    f.write(res.content)
preklady = res.json()['data']
preklad = preklady[2] # roh
identifier = preklad['identifier']
books = preklad['books']

params = {
    'timestamp': int(time.time()*1000),
    'key': '597133743677397A24432646294A404E635166546A576E5A7234753778214125',
}
for i, book in enumerate(books):
    chapters = {}
    abbr = book['abbreviation']
    for chapter in book['chapters']:
        params['timestamp'] = int(time.time()*1000)
        code = '|'.join([identifier, abbr, str(chapter)])
        code = binascii.b2a_base64(code.encode()).strip().decode()
        while True:
            res = requests.get('https://biblia.sk/api/text/%s' % (code, ), params=params)
            print(res.status_code, res.url)
            if res.status_code == 429:
                print('Too Many Requests, sleeping')
                time.sleep(40)
                continue
            break
        try:
            text = res.json()
        except Exception as e:
            print(res.content)
            raise e
        chapters[chapter] = [v['content'] for v in text['data']]
    book['chapters'] = chapters
    print(chapters)

with open(identifier+'.json', 'w') as f:
    json.dump(preklad, f, indent=2)
