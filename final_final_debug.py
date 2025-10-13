#!/usr/bin/env python3
import pandas as pd
import glob
from datetime import timedelta

# Product mapping
PRODUCT_MAPPING = {
    'BFRECINT': 'TEMXN_BFRECINT_30_DAYS',
    'BFSPRINT': 'TEMXN_BFSPRINT_UNLIMITED_30_DAYS',
    'BFRIQUIN': 'TEMXN_BFRIQUIN_28_DAYS',
    'BFRISEM': 'TEMXN_BFRISEM_7_DAYS',
    'BFRIMEN': 'TEMXN_BFRIMEN_15_DAYS',
    'PQRI412D': 'TEM_4GB_12_DAYS',
    'PQRI3G9D': 'TEM_3GB_9_DAYS',
    'PQRI2G7D': 'TEM_2GB_7_DAYS',
    'PQRI1G4D': 'TEM_1GB_3_DAYS',
    'PQRI6M2D': 'TEM_600MB_2_DAYS',
}

# Load Telefónica
tf = pd.read_csv("/Users/richardmas/Downloads/Datos de TF auditoria/Registros_TEMM_NoSoporteActual_202309_202412.csv", encoding='utf-8-sig')
tf['FECHA'] = pd.to_datetime(tf['FECHA'], format='%d/%m/%Y')
tf['PHONE'] = tf['NUM_TELEFONO'].astype(str).str.strip()
tf['PRODUCT_LATCOM'] = tf['COD_BONO'].map(PRODUCT_MAPPING).fillna('')

# Load ALL Bundles
bundles_files = glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/*.xlsx") + \
                glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2024/*.xlsx")

all_bundles = []
for f in bundles_files:
    df = pd.read_excel(f)
    all_bundles.append(df)

bundles = pd.concat(all_bundles, ignore_index=True)

# Merge product columns properly
product_columns = [col for col in bundles.columns if col in ['Product', 'Product MobiFin', 'Product MoviStar', 'Product Sagar', 'Product ']]

bundles['PRODUCT_NORMALIZED'] = ''
for col in product_columns:
    mask = (bundles['PRODUCT_NORMALIZED'] == '') & (bundles[col].notna())
    bundles.loc[mask, 'PRODUCT_NORMALIZED'] = bundles.loc[mask, col].astype(str)

bundles['PRODUCT_NORMALIZED'] = bundles['PRODUCT_NORMALIZED'].str.strip()
bundles['PRODUCT_NORMALIZED'] = bundles['PRODUCT_NORMALIZED'].replace('nan', '')
bundles['PRODUCT_NORMALIZED'] = bundles['PRODUCT_NORMALIZED'].replace('None', '')

bundles['DATE_PARSED'] = pd.to_datetime(bundles['TransactionDate'], errors='coerce')
bundles['PHONE'] = bundles['TargetMSISDN'].astype(str).str.strip()

print(f"Bundles with products: {(bundles['PRODUCT_NORMALIZED'] != '').sum():,} / {len(bundles):,}")
print(f"Bundles unique products: {bundles['PRODUCT_NORMALIZED'][bundles['PRODUCT_NORMALIZED'] != ''].value_counts()}")

# Filter to clean data
tf_clean = tf[
    tf['PRODUCT_LATCOM'].ne('') &
    tf['FECHA'].notna()
].copy()

bundles_clean = bundles[bundles['DATE_PARSED'].notna()].copy()

print(f"\nTF clean: {len(tf_clean):,}")
print(f"Bundles clean: {len(bundles_clean):,}")

# Create phone+product keys
tf_clean['PHONE_PRODUCT'] = tf_clean['PHONE'] + '|' + tf_clean['PRODUCT_LATCOM']
bundles_clean['PHONE_PRODUCT'] = bundles_clean['PHONE'] + '|' + bundles_clean['PRODUCT_NORMALIZED']

# Check overlap
tf_pp = set(tf_clean['PHONE_PRODUCT'])
bundles_pp = set(bundles_clean['PHONE_PRODUCT'])

overlap = tf_pp.intersection(bundles_pp)

print(f"\nPhone+Product combinations:")
print(f"  TF: {len(tf_pp):,}")
print(f"  Bundles: {len(bundles_pp):,}")
print(f"  Overlap: {len(overlap):,}")

if overlap:
    # Show some examples
    print(f"\nSample overlapping phone+product combinations:")
    for pp in list(overlap)[:5]:
        print(f"  {pp}")

    # Test first one
    test_pp = list(overlap)[0]
    print(f"\n\nTesting: {test_pp}")

    tf_test = tf_clean[tf_clean['PHONE_PRODUCT'] == test_pp]
    bundles_test = bundles_clean[bundles_clean['PHONE_PRODUCT'] == test_pp]

    print(f"\nTF transactions:")
    print(tf_test[['FECHA', 'PHONE', 'COD_BONO', 'PRODUCT_LATCOM', 'ImpUSD']])

    print(f"\nBundles transactions:")
    print(bundles_test[['TransactionDate', 'PHONE', 'PRODUCT_NORMALIZED', 'TransactionAmountUSD']])

    # Try matching
    for _, tf_row in tf_test.head(1).iterrows():
        date = tf_row['FECHA']
        date_min = date - timedelta(days=7)
        date_max = date + timedelta(days=7)

        matches = bundles_test[
            (bundles_test['DATE_PARSED'] >= date_min) &
            (bundles_test['DATE_PARSED'] <= date_max)
        ]

        print(f"\nMatching TF date {date} with ±7 day window:")
        print(f"  Matches found: {len(matches)}")

        if not matches.empty:
            print(matches[['TransactionDate', 'PHONE', 'PRODUCT_NORMALIZED', 'TransactionAmountUSD']])
else:
    print("\nNO PHONE+PRODUCT OVERLAP!")
    print("\nChecking why...")

    # Sample TF phone+product
    sample_tf_pp = list(tf_pp)[:10]
    print(f"\nSample TF phone+product:")
    for pp in sample_tf_pp:
        print(f"  {pp}")

    # Sample bundles phone+product
    sample_bundles_pp = list(bundles_pp)[:10]
    print(f"\nSample Bundles phone+product:")
    for pp in sample_bundles_pp:
        print(f"  {pp}")
