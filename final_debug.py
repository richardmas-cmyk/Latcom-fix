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
bundles['DATE_PARSED'] = pd.to_datetime(bundles['TransactionDate'], errors='coerce')
bundles['PHONE'] = bundles['TargetMSISDN'].astype(str).str.strip()
bundles['PRODUCT'] = bundles['Product'].astype(str).str.strip()

print(f"Total TF: {len(tf):,}")
print(f"Total Bundles: {len(bundles):,}")

# Filter clean data as in the script
tf_clean = tf[
    tf['PRODUCT_LATCOM'].ne('') &
    tf['FECHA'].notna()
].copy()

bundles_clean = bundles[bundles['DATE_PARSED'].notna()].copy()

print(f"\nTF clean: {len(tf_clean):,}")
print(f"Bundles clean: {len(bundles_clean):,}")

# Check overlap after cleaning
tf_clean_phones = set(tf_clean['PHONE'])
bundles_clean_phones = set(bundles_clean['PHONE'])

overlap = tf_clean_phones.intersection(bundles_clean_phones)
print(f"\nClean phone overlap: {len(overlap):,}")

if overlap:
    # Test a common phone
    test_phone = list(overlap)[0]
    print(f"\nTesting phone: {test_phone}")

    tf_test = tf_clean[tf_clean['PHONE'] == test_phone]
    bundles_test = bundles_clean[bundles_clean['PHONE'] == test_phone]

    print(f"\nTF transactions for {test_phone}:")
    print(tf_test[['FECHA', 'COD_BONO', 'PRODUCT_LATCOM', 'ImpUSD']])

    print(f"\nBundles transactions for {test_phone}:")
    print(bundles_test[['TransactionDate', 'Product', 'TransactionAmountUSD']])

    # Try to match
    for _, tf_row in tf_test.iterrows():
        date = tf_row['FECHA']
        product = tf_row['PRODUCT_LATCOM']

        date_min = date - timedelta(days=7)
        date_max = date + timedelta(days=7)

        matches = bundles_test[
            (bundles_test['PRODUCT'] == product) &
            (bundles_test['DATE_PARSED'] >= date_min) &
            (bundles_test['DATE_PARSED'] <= date_max)
        ]

        print(f"\nMatching TF date={date}, product={product}:")
        print(f"  Date range: {date_min.date()} to {date_max.date()}")
        print(f"  Matches: {len(matches)}")

        if not matches.empty:
            print(matches[['TransactionDate', 'Product', 'TransactionAmountUSD']])
            print("\nFOUND A MATCH!")
            break
else:
    print("\nNO OVERLAP - Issue is in the filtering!")

    # Check what's being removed
    print(f"\nTF with empty product mapping: {(tf['PRODUCT_LATCOM'] == '').sum():,}")
    print(f"TF with null dates: {tf['FECHA'].isna().sum():,}")
    print(f"Bundles with null dates: {bundles['DATE_PARSED'].isna().sum():,}")

    # Check products in bundles vs TF
    tf_products = set(tf['PRODUCT_LATCOM'][tf['PRODUCT_LATCOM'].ne('')])
    bundles_products = set(bundles['PRODUCT'])

    print(f"\nTF products (after mapping): {tf_products}")
    print(f"Bundles products: {bundles_products}")

    product_overlap = tf_products.intersection(bundles_products)
    print(f"Product overlap: {product_overlap}")
