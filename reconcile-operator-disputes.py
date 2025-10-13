#!/usr/bin/env python3
"""
Operator Transaction Reconciliation Script
Compares operator's claimed successful transactions against company records
to verify disputed charges (Sept 2023 - Dec 2024)
"""

import pandas as pd
import os
from datetime import datetime
import glob

print("=" * 80)
print("🔍 OPERATOR TRANSACTION RECONCILIATION")
print("=" * 80)

# File paths
OPERATOR_FILE_1 = "/Users/richardmas/Desktop/Operator_Transactions202309_202312.csv"
OPERATOR_FILE_2 = "/Users/richardmas/Desktop/Operator_Transactions_NoSoporteActual_202309_202412.csv"
COMPANY_RECORDS_DIR = "/Users/richardmas/Downloads/Excel Workings"

# ============================================
# STEP 1: Load Operator Claims
# ============================================
print("\n📂 Loading operator claim files...")

# Load first operator file
print(f"   Loading: {os.path.basename(OPERATOR_FILE_1)}")
op1 = pd.read_csv(OPERATOR_FILE_1, encoding='utf-8-sig')
print(f"   ✅ Loaded {len(op1):,} claimed transactions")
print(f"   Columns: {list(op1.columns)}")

# Load second operator file
print(f"\n   Loading: {os.path.basename(OPERATOR_FILE_2)}")
op2 = pd.read_csv(OPERATOR_FILE_2, encoding='utf-8-sig')
print(f"   ✅ Loaded {len(op2):,} claimed transactions")
print(f"   Columns: {list(op2.columns)}")

# Standardize operator file 1
if 'TransactionID' in op1.columns:
    op1.rename(columns={'TransactionID': 'VENDOR_TRANSACTION_ID',
                        'TargetMSISDN': 'MSISDN',
                        'TransactionAmountUSD': 'AMOUNT'}, inplace=True)

# Standardize operator file 2
if 'SEC_ACTUACION' in op2.columns:
    op2.rename(columns={'SEC_ACTUACION': 'VENDOR_TRANSACTION_ID',
                        'NUM_TELEFONO': 'MSISDN',
                        'ImpUSD': 'AMOUNT'}, inplace=True)

# Combine operator claims
operator_claims = pd.concat([op1, op2], ignore_index=True)
print(f"\n📊 Total operator claims: {len(operator_claims):,} transactions")

# ============================================
# STEP 2: Load Company Records
# ============================================
print("\n📂 Loading company transaction records...")

all_company_records = []

# Load 2023 Excel files
print("\n   2023 Records (Excel):")
for file in glob.glob(f"{COMPANY_RECORDS_DIR}/2023/*.xlsx"):
    if '~$' in file:  # Skip temp files
        continue
    try:
        print(f"      Loading {os.path.basename(file)}...", end=' ')
        df = pd.read_excel(file)
        all_company_records.append(df)
        print(f"✅ {len(df):,} rows")
    except Exception as e:
        print(f"❌ Error: {e}")

# Load 2024 Excel files
print("\n   2024 Records (Excel):")
for file in glob.glob(f"{COMPANY_RECORDS_DIR}/2024/*.xlsx"):
    if '~$' in file:
        continue
    try:
        print(f"      Loading {os.path.basename(file)}...", end=' ')
        df = pd.read_excel(file)
        all_company_records.append(df)
        print(f"✅ {len(df):,} rows")
    except Exception as e:
        print(f"❌ Error: {e}")

# Load 2025 CSV files (for completeness, though dispute is Sept 2023 - Dec 2024)
print("\n   2025 Records (CSV):")
for file in glob.glob(f"{COMPANY_RECORDS_DIR}/2025/*.csv"):
    try:
        print(f"      Loading {os.path.basename(file)}...", end=' ')
        df = pd.read_csv(file)
        all_company_records.append(df)
        print(f"✅ {len(df):,} rows")
    except Exception as e:
        print(f"❌ Error: {e}")

# Combine all company records
print("\n   Combining all records...")
company_df = pd.concat(all_company_records, ignore_index=True)
print(f"   ✅ Total company records: {len(company_df):,} transactions")

# ============================================
# STEP 3: Filter to Dispute Period (Sep 2023 - Dec 2024)
# ============================================
print("\n📅 Filtering to dispute period (Sept 2023 - Dec 2024)...")

# Convert dates (make timezone-naive for comparison)
company_df['DATETIME'] = pd.to_datetime(company_df['DATETIME'], errors='coerce', utc=True)
company_df['DATETIME'] = company_df['DATETIME'].dt.tz_localize(None)

# Filter date range
start_date = pd.to_datetime('2023-09-01')
end_date = pd.to_datetime('2024-12-31')

company_df_filtered = company_df[
    (company_df['DATETIME'] >= start_date) &
    (company_df['DATETIME'] <= end_date)
]

print(f"   ✅ Filtered to {len(company_df_filtered):,} transactions in dispute period")

# ============================================
# STEP 4: Reconciliation Analysis
# ============================================
print("\n🔍 Performing reconciliation...")

# Clean phone numbers (remove country codes, spaces, etc.)
def clean_phone(phone):
    if pd.isna(phone):
        return ''
    phone_str = str(phone).strip()
    # Remove common prefixes
    phone_str = phone_str.replace('+52', '').replace('52', '', 1)
    phone_str = phone_str.replace(' ', '').replace('-', '')
    return phone_str[-10:] if len(phone_str) >= 10 else phone_str

operator_claims['MSISDN_CLEAN'] = operator_claims['MSISDN'].apply(clean_phone)
company_df_filtered['MSISDN_CLEAN'] = company_df_filtered['MSISDN'].apply(clean_phone)

# Clean transaction IDs
operator_claims['VENDOR_TRANSACTION_ID'] = operator_claims['VENDOR_TRANSACTION_ID'].astype(str).str.strip()
company_df_filtered['VENDOR_TRANSACTION_ID'] = company_df_filtered['VENDOR_TRANSACTION_ID'].astype(str).str.strip()

# Match by Vendor Transaction ID
print("\n   Matching by Vendor Transaction ID...")
matched_by_id = operator_claims.merge(
    company_df_filtered[['VENDOR_TRANSACTION_ID', 'STATUS', 'RESPONSE_MESSAGE',
                         'VENDOR_RESPONSE_MESSAGE', 'AMOUNT', 'MSISDN']],
    on='VENDOR_TRANSACTION_ID',
    how='left',
    suffixes=('_OPERATOR', '_COMPANY')
)

# ============================================
# STEP 5: Categorize Results
# ============================================
print("\n📊 Categorizing results...")

# Found in records
matched = matched_by_id[matched_by_id['STATUS'].notna()]

# Successful in company records
successful = matched[matched['STATUS'] == 'Success']

# Failed in company records
failed = matched[matched['STATUS'] == 'Fail']

# Not found in company records
not_found = matched_by_id[matched_by_id['STATUS'].isna()]

# ============================================
# STEP 6: Generate Report
# ============================================
print("\n" + "=" * 80)
print("📋 RECONCILIATION REPORT")
print("=" * 80)

print(f"\n🔢 OPERATOR CLAIMS:")
print(f"   Total claimed successful: {len(operator_claims):,} transactions")
print(f"   Total USD claimed: ${operator_claims['AMOUNT'].sum():,.2f}")

print(f"\n✅ VERIFIED SUCCESSFUL (You owe these):")
print(f"   Transactions: {len(successful):,}")
print(f"   Total USD: ${successful['AMOUNT_COMPANY'].sum():,.2f}")

print(f"\n❌ DISPUTED - FAILED IN YOUR RECORDS (You DON'T owe these):")
print(f"   Transactions: {len(failed):,}")
print(f"   Total USD: ${failed['AMOUNT_COMPANY'].sum():,.2f}")

print(f"\n⚠️  NOT FOUND IN YOUR RECORDS:")
print(f"   Transactions: {len(not_found):,}")
print(f"   Total USD: ${not_found['AMOUNT_OPERATOR'].sum():,.2f}")

# Calculate disputed amount
legit_amount = successful['AMOUNT_COMPANY'].sum()
disputed_amount = failed['AMOUNT_COMPANY'].sum() + not_found['AMOUNT_OPERATOR'].sum()

print(f"\n💰 FINANCIAL SUMMARY:")
print(f"   Operator claims: ${operator_claims['AMOUNT'].sum():,.2f}")
print(f"   Verified legit:  ${legit_amount:,.2f}")
print(f"   Disputed:        ${disputed_amount:,.2f}")
print(f"   Difference:      ${operator_claims['AMOUNT'].sum() - legit_amount:,.2f}")

# ============================================
# STEP 7: Save Detailed Reports
# ============================================
print(f"\n💾 Saving detailed reports...")

output_dir = "/Users/richardmas/latcom-fix/reconciliation_reports"
os.makedirs(output_dir, exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

# Save verified successful transactions
if len(successful) > 0:
    successful_file = f"{output_dir}/VERIFIED_SUCCESSFUL_{timestamp}.csv"
    successful.to_csv(successful_file, index=False)
    print(f"   ✅ Saved: {successful_file}")

# Save failed transactions with error messages
if len(failed) > 0:
    failed_file = f"{output_dir}/DISPUTED_FAILED_{timestamp}.csv"
    failed[['VENDOR_TRANSACTION_ID', 'MSISDN_OPERATOR', 'AMOUNT_OPERATOR',
            'STATUS', 'RESPONSE_MESSAGE', 'VENDOR_RESPONSE_MESSAGE']].to_csv(failed_file, index=False)
    print(f"   ✅ Saved: {failed_file}")

# Save not found transactions
if len(not_found) > 0:
    not_found_file = f"{output_dir}/DISPUTED_NOT_FOUND_{timestamp}.csv"
    not_found.to_csv(not_found_file, index=False)
    print(f"   ✅ Saved: {not_found_file}")

# Save summary
summary_file = f"{output_dir}/SUMMARY_{timestamp}.txt"
with open(summary_file, 'w') as f:
    f.write("OPERATOR TRANSACTION RECONCILIATION SUMMARY\n")
    f.write("=" * 80 + "\n\n")
    f.write(f"Report Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write(f"Period: September 2023 - December 2024\n\n")
    f.write(f"OPERATOR CLAIMS:\n")
    f.write(f"  Total transactions: {len(operator_claims):,}\n")
    f.write(f"  Total USD claimed: ${operator_claims['AMOUNT'].sum():,.2f}\n\n")
    f.write(f"VERIFIED SUCCESSFUL (Amount you owe):\n")
    f.write(f"  Transactions: {len(successful):,}\n")
    f.write(f"  Total USD: ${legit_amount:,.2f}\n\n")
    f.write(f"DISPUTED - FAILED:\n")
    f.write(f"  Transactions: {len(failed):,}\n")
    f.write(f"  Total USD: ${failed['AMOUNT_COMPANY'].sum():,.2f}\n\n")
    f.write(f"DISPUTED - NOT FOUND:\n")
    f.write(f"  Transactions: {len(not_found):,}\n")
    f.write(f"  Total USD: ${not_found['AMOUNT_OPERATOR'].sum():,.2f}\n\n")
    f.write(f"BOTTOM LINE:\n")
    f.write(f"  Operator claims: ${operator_claims['AMOUNT'].sum():,.2f}\n")
    f.write(f"  You actually owe: ${legit_amount:,.2f}\n")
    f.write(f"  Disputed amount: ${disputed_amount:,.2f}\n")
    f.write(f"  Savings: ${disputed_amount:,.2f}\n")

print(f"   ✅ Saved: {summary_file}")

print("\n" + "=" * 80)
print("✅ RECONCILIATION COMPLETE!")
print("=" * 80)
print(f"\nReports saved to: {output_dir}/")
print("\nTop failure reasons:")
if len(failed) > 0:
    print(failed['VENDOR_RESPONSE_MESSAGE'].value_counts().head(5))

print("\n" + "=" * 80)
