#!/usr/bin/env python3
import pandas as pd
import glob

# Load ALL Bundles
bundles_files = glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/*.xlsx") + \
                glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2024/*.xlsx")

all_bundles = []
for f in bundles_files:
    df = pd.read_excel(f)
    df['SOURCE'] = f.split('/')[-1]
    all_bundles.append(df)

bundles = pd.concat(all_bundles, ignore_index=True)

print(f"Total bundles: {len(bundles):,}")
print(f"Columns: {list(bundles.columns)}")

# Try merging product columns as in the script
product_columns = [col for col in bundles.columns if col in ['Product', 'Product MobiFin', 'Product MoviStar', 'Product Sagar', 'Product ']]

print(f"\nProduct columns found: {product_columns}")

if product_columns:
    # Coalesce all product columns into one
    bundles['PRODUCT_NORMALIZED'] = bundles[product_columns[0]].astype(str)
    for col in product_columns[1:]:
        bundles['PRODUCT_NORMALIZED'] = bundles['PRODUCT_NORMALIZED'].fillna(bundles[col].astype(str))

    # Clean up 'nan' strings
    bundles['PRODUCT_NORMALIZED'] = bundles['PRODUCT_NORMALIZED'].str.strip()
    bundles['PRODUCT_NORMALIZED'] = bundles['PRODUCT_NORMALIZED'].replace('nan', '')
    bundles['PRODUCT_NORMALIZED'] = bundles['PRODUCT_NORMALIZED'].replace('None', '')

    print(f"\nProduct column stats:")
    print(f"  Non-empty: {bundles['PRODUCT_NORMALIZED'].ne('').sum():,}")
    print(f"  Empty: {(bundles['PRODUCT_NORMALIZED'] == '').sum():,}")
    print(f"  Total: {len(bundles):,}")

    print(f"\nUnique products after merge:")
    print(bundles['PRODUCT_NORMALIZED'].value_counts())

    # Check a specific phone
    test_phone = '2282958424'
    bundles['PHONE'] = bundles['TargetMSISDN'].astype(str).str.strip()

    test_rows = bundles[bundles['PHONE'] == test_phone]
    print(f"\nSample rows for phone {test_phone}:")
    print(test_rows[['SOURCE', 'Product', 'Product MobiFin', 'Product MoviStar', 'PRODUCT_NORMALIZED', 'TransactionDate']])
