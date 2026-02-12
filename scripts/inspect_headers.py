import pandas as pd

def inspect():
    path = r"b:\Workspace\Keuangan\simple-money-tracker\Keuangan.xlsx"
    df = pd.read_excel(path, sheet_name='List')
    print("ALL COLUMNS:")
    for col in df.columns:
        print(f"'{col}'")
    
    print("\nFIRST ROW:")
    dict_row = df.iloc[0].to_dict()
    for k,v in dict_row.items():
        print(f"{k}: {v}")

if __name__ == "__main__":
    inspect()
