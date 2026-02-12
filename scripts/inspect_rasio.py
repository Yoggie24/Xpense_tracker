import pandas as pd

def inspect():
    path = r"b:\Workspace\Keuangan\simple-money-tracker\Keuangan.xlsx"
    try:
        df = pd.read_excel(path, sheet_name='Rasio', header=None)
        with open('headers_output.txt', 'w') as f:
            for idx, row in df.head(20).iterrows():
                f.write(f"Row {idx}: {row.tolist()}\n")
        print("Detailed rows saved to headers_output.txt")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect()
