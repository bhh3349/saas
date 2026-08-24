import pandas as pd

path = r'D:\c\Users\Administrator\Downloads\一棵树土火锅_菜品库_20260824_1833_a19238245609_1787567635222.xlsx'
xl = pd.ExcelFile(path)
print('SHEETS:', xl.sheet_names)
for s in xl.sheet_names:
    df = pd.read_excel(path, sheet_name=s, header=None, nrows=12)
    print('=== sheet:', s, 'shape:', df.shape)
    print(df.to_string())
