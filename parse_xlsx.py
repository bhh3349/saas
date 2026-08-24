import zipfile, re
z = zipfile.ZipFile(r'd:\c\saas\temp_tables_ref.xlsx')
xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
rows = re.findall(r'<row[^>]*r="(\d+)"[^>]*>(.*?)</row>', xml, re.S)
for rn, r in rows[:30]:
    cells = []
    for c in re.findall(r'<c\b[^>]*>.*?</c>', r, re.S):
        ref = re.search(r'r="([A-Z]+\d+)"', c)
        val = ''.join(re.findall(r'<t[^>]*>(.*?)</t>', c, re.S))
        cells.append(f'{ref.group(1) if ref else "?"}={val!r}')
    print('R' + rn, ': ', ' | '.join(cells))
