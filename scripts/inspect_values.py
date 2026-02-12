import pandas as pd

def inspect():
    path = r"b:\Workspace\Keuangan\simple-money-tracker\Keuangan.xlsx"
    try:
        df = pd.read_excel(path, sheet_name='Money_tracker')
        print("Unique values in 'Jenis':")
        print(df['Jenis'].unique())
    except Exception as e:
        print(f"Error reading Money_tracker: {e}")

if __name__ == "__main__":
    inspect()
