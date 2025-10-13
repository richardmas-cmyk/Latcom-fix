#!/usr/bin/env python3
import pandas as pd
import glob

# Load some sample bundles files and check columns
bundles_files = glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/*.xlsx")[:3] + \
                glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2024/*.xlsx")[:3]

for f in bundles_files:
    print(f"\n{'='*80}")
    print(f"File: {f.split('/')[-1]}")
    print(f"{'='*80}")

    df = pd.read_excel(f)
    print(f"Columns: {list(df.columns)}")
    print(f"Rows: {len(df)}")

    # Check if Product column exists and has data
    if 'Product' in df.columns:
        print(f"Product column exists:")
        print(f"  Non-null: {df['Product'].notna().sum()}")
        print(f"  Null: {df['Product'].isna().sum()}")
        print(f"  Unique products: {df['Product'].nunique()}")
        print(f"  Sample products: {df['Product'].dropna().unique()[:5]}")
    else:
        print("Product column NOT FOUND!")

    # Look for other product-like columns
    product_cols = [col for col in df.columns if 'product' in col.lower() or 'bono' in col.lower()]
    if product_cols:
        print(f"Other product columns: {product_cols}")
        for col in product_cols:
            print(f"  {col}: {df[col].nunique()} unique values, {df[col].notna().sum()} non-null")
            print(f"    Sample: {df[col].dropna().unique()[:5]}")

    # Check sample data
    print("\nFirst 3 rows:")
    print(df.head(3))
