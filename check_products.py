#!/usr/bin/env python3
import pandas as pd
import glob

# Load ALL Bundles files
bundles_files = glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/*.xlsx") + \
                glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2024/*.xlsx")

all_bundles = []
for f in bundles_files:
    df = pd.read_excel(f)
    all_bundles.append(df)

bundles = pd.concat(all_bundles, ignore_index=True)

print("ALL UNIQUE BUNDLE PRODUCTS:")
print(bundles['Product'].value_counts())

# Check for products containing "4GB" or "PQRI"
print("\n\nProducts containing '4GB':")
print(bundles[bundles['Product'].str.contains('4GB', case=False, na=False)]['Product'].unique())

print("\nProducts containing '3GB':")
print(bundles[bundles['Product'].str.contains('3GB', case=False, na=False)]['Product'].unique())

print("\nProducts containing '2GB':")
print(bundles[bundles['Product'].str.contains('2GB', case=False, na=False)]['Product'].unique())

print("\nProducts containing '600':")
print(bundles[bundles['Product'].str.contains('600', case=False, na=False)]['Product'].unique())

print("\nProducts containing '1G':")
print(bundles[bundles['Product'].str.contains('1G', case=False, na=False)]['Product'].unique())
