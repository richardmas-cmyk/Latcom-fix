#!/usr/bin/env python3
"""
Enhanced Operator Transaction Reconciliation
Uses multiple matching strategies:
1. Vendor Transaction ID
2. Phone + Amount + Date
3. Phone + Amount (looser match)
"""

import pandas as pd
import os
from datetime import datetime, timedelta
import glob
import numpy as np

print("=" * 80)
print("🔍 ENHANCED OPERATOR TRANSACTION RECONCILIATION")
print("=" * 80)

# File paths
OPERATOR_FILE_1 = "/Users/richardmas/Desktop/Operator_Transactions202309_202312.csv"
OPERATOR_FILE_2 = "/Users/richardmas/Desktop/Operator_Transactions_NoSoporteActual_202309_202412.csv"
COMPANY_RECORDS_DIR = "/Users/richardmas/Downloads/Excel Workings"

# ============================================
# STEP 1: Load Operator Claims
# ============================================
print("\n📂 Loading operator claim files...")

op1 = pd.read_csv(OPERATOR_FILE_1, encoding='utf-8-sig')
print(f"   ✅ File 1: {len(op1):,} transactions")

op2 = pd.read_csv(OPERATOR_FILE_2, encoding='utf-8-sig')
print(f"   ✅ File 2: {len(op2):,} transactions")

# Standardize columns
if 'TransactionID' in op1.columns:
    op1.rename(columns={'TransactionID': 'VENDOR_TRANSACTION_ID',
                        'TargetMSISDN': 'MSISDN',
                        'TransactionAmountUSD': 'AMOUNT',
                        'FECHA': 'DATE'}, inplace=True)

if 'SEC_ACTUACION' in op2.columns:
    op2.rename(columns={'SEC_ACTUACION': 'VENDOR_TRANSACTION_ID',
                        'NUM_TELEFONO': 'MSISDN',
                        'ImpUSD': 'AMOUNT',
                        'FECHA': 'DATE'}, inplace=True)

# Combine
operator_claims = pd.concat([op1, op2], ignore_index=True)
print(f"\n📊 Total operator claims: {len(operator_claims):,} transactions")
print(f"   Total USD: ${operator_claims['AMOUNT'].sum():,.2f}")

# Parse operator dates
operator_claims['DATE'] = pd.to_datetime(operator_claims['DATE'], errors='coerce', format='%d/%m/%Y')

# ============================================
# STEP 2: Load Company Records (Optimized)
# ============================================
print("\n📂 Loading company records (this may take a minute)...")

all_records = []

# Load 2023 Excel
for file in glob.glob(f"{COMPANY_RECORDS_DIR}/2023/*.xlsx"):
    if '~$' not in file:
        df = pd.read_excel(file)
        all_records.append(df)

# Load 2024 Excel
for file in glob.glob(f"{COMPANY_RECORDS_DIR}/2024/*.xlsx"):
    if '~$' not in file:
        df = pd.read_excel(file)
        all_records.append(df)

company_df = pd.concat(all_records, ignore_index=True)
print(f"   ✅ Loaded {len(company_df):,} company records")

# Filter to dispute period
company_df['DATETIME'] = pd.to_datetime(company_df['DATETIME'], errors='coerce', utc=True)
company_df['DATETIME'] = company_df['DATETIME'].dt.tz_localize(None)
company_df['DATE'] = company_df['DATETIME'].dt.date

start_date = pd.to_datetime('2023-09-01').date()
end_date = pd.to_datetime('2024-12-31').date()

company_df = company_df[
    (company_df['DATE'] >= start_date) &
    (company_df['DATE'] <= end_date)
].copy()

print(f"   ✅ Filtered to dispute period: {len(company_df):,} transactions")

# ============================================
# STEP 3: Prepare Matching Keys
# ============================================
print("\n🔧 Preparing data for matching...")

# Clean phone numbers
def clean_phone(phone):
    if pd.isna(phone):
        return ''
    phone_str = str(phone).strip()
    phone_str = phone_str.replace('+52', '').replace('52', '', 1)
    phone_str = phone_str.replace(' ', '').replace('-', '').replace('+', '')
    return phone_str[-10:] if len(phone_str) >= 10 else phone_str

operator_claims['PHONE_CLEAN'] = operator_claims['MSISDN'].apply(clean_phone)
company_df['PHONE_CLEAN'] = company_df['MSISDN'].apply(clean_phone)

# Round amounts to 2 decimals
operator_claims['AMOUNT'] = operator_claims['AMOUNT'].round(2)
company_df['AMOUNT'] = company_df['AMOUNT'].round(2)

# Clean transaction IDs
operator_claims['TX_ID_CLEAN'] = operator_claims['VENDOR_TRANSACTION_ID'].astype(str).str.strip().str.upper()
company_df['TX_ID_CLEAN'] = company_df['VENDOR_TRANSACTION_ID'].astype(str).str.strip().str.upper()

# Create composite keys
operator_claims['KEY_PHONE_AMOUNT_DATE'] = (
    operator_claims['PHONE_CLEAN'] + '_' +
    operator_claims['AMOUNT'].astype(str) + '_' +
    operator_claims['DATE'].astype(str)
)

company_df['KEY_PHONE_AMOUNT_DATE'] = (
    company_df['PHONE_CLEAN'] + '_' +
    company_df['AMOUNT'].astype(str) + '_' +
    company_df['DATE'].astype(str)
)

operator_claims['KEY_PHONE_AMOUNT'] = (
    operator_claims['PHONE_CLEAN'] + '_' +
    operator_claims['AMOUNT'].astype(str)
)

company_df['KEY_PHONE_AMOUNT'] = (
    company_df['PHONE_CLEAN'] + '_' +
    company_df['AMOUNT'].astype(str)
)

print("   ✅ Data prepared")

# ============================================
# STEP 4: Multi-Strategy Matching
# ============================================
print("\n🔍 Attempting multiple matching strategies...")

results = operator_claims.copy()
results['MATCH_STRATEGY'] = None
results['STATUS'] = None
results['RESPONSE_MESSAGE'] = None
results['VENDOR_RESPONSE_MESSAGE'] = None
results['COMPANY_TX_ID'] = None

# Strategy 1: Match by Transaction ID
print("\n   Strategy 1: Transaction ID matching...")
tx_id_matches = results[results['TX_ID_CLEAN'].isin(company_df['TX_ID_CLEAN'])]
for idx in tx_id_matches.index:
    tx_id = results.loc[idx, 'TX_ID_CLEAN']
    match = company_df[company_df['TX_ID_CLEAN'] == tx_id].iloc[0]
    results.loc[idx, 'MATCH_STRATEGY'] = 'TX_ID'
    results.loc[idx, 'STATUS'] = match['STATUS']
    results.loc[idx, 'RESPONSE_MESSAGE'] = match.get('RESPONSE_MESSAGE', '')
    results.loc[idx, 'VENDOR_RESPONSE_MESSAGE'] = match.get('VENDOR_RESPONSE_MESSAGE', '')
    results.loc[idx, 'COMPANY_TX_ID'] = match['TRANSACTION_ID']

print(f"      ✅ Matched: {len(tx_id_matches):,} transactions")

# Strategy 2: Match by Phone + Amount + Date (for unmatched)
print("\n   Strategy 2: Phone + Amount + Date matching...")
unmatched = results[results['MATCH_STRATEGY'].isna()]
phone_amount_date_matches = unmatched[unmatched['KEY_PHONE_AMOUNT_DATE'].isin(company_df['KEY_PHONE_AMOUNT_DATE'])]

for idx in phone_amount_date_matches.index:
    key = results.loc[idx, 'KEY_PHONE_AMOUNT_DATE']
    matches = company_df[company_df['KEY_PHONE_AMOUNT_DATE'] == key]
    if len(matches) > 0:
        match = matches.iloc[0]  # Take first match
        results.loc[idx, 'MATCH_STRATEGY'] = 'PHONE_AMOUNT_DATE'
        results.loc[idx, 'STATUS'] = match['STATUS']
        results.loc[idx, 'RESPONSE_MESSAGE'] = match.get('RESPONSE_MESSAGE', '')
        results.loc[idx, 'VENDOR_RESPONSE_MESSAGE'] = match.get('VENDOR_RESPONSE_MESSAGE', '')
        results.loc[idx, 'COMPANY_TX_ID'] = match['TRANSACTION_ID']

print(f"      ✅ Matched: {len(phone_amount_date_matches):,} transactions")

# Strategy 3: Match by Phone + Amount (within 3 days, for unmatched)
print("\n   Strategy 3: Phone + Amount (±3 days) matching...")
unmatched = results[results['MATCH_STRATEGY'].isna()]
phone_amount_matches = unmatched[unmatched['KEY_PHONE_AMOUNT'].isin(company_df['KEY_PHONE_AMOUNT'])]

matched_count = 0
for idx in phone_amount_matches.index:
    key = results.loc[idx, 'KEY_PHONE_AMOUNT']
    op_date = results.loc[idx, 'DATE']

    # Find matches within ±3 days
    matches = company_df[company_df['KEY_PHONE_AMOUNT'] == key]

    for _, match in matches.iterrows():
        company_date = match['DATE']
        if pd.notna(op_date) and pd.notna(company_date):
            date_diff = abs((op_date - pd.to_datetime(company_date)).days)
            if date_diff <= 3:
                results.loc[idx, 'MATCH_STRATEGY'] = f'PHONE_AMOUNT_±{date_diff}d'
                results.loc[idx, 'STATUS'] = match['STATUS']
                results.loc[idx, 'RESPONSE_MESSAGE'] = match.get('RESPONSE_MESSAGE', '')
                results.loc[idx, 'VENDOR_RESPONSE_MESSAGE'] = match.get('VENDOR_RESPONSE_MESSAGE', '')
                results.loc[idx, 'COMPANY_TX_ID'] = match['TRANSACTION_ID']
                matched_count += 1
                break

print(f"      ✅ Matched: {matched_count:,} transactions")

# ============================================
# STEP 5: Categorize Results
# ============================================
print("\n📊 Categorizing results...")

matched = results[results['MATCH_STRATEGY'].notna()]
not_found = results[results['MATCH_STRATEGY'].isna()]

successful = matched[matched['STATUS'] == 'Success']
failed = matched[matched['STATUS'] == 'Fail']

# ============================================
# STEP 6: Enhanced Report
# ============================================
print("\n" + "=" * 80)
print("📋 ENHANCED RECONCILIATION REPORT")
print("=" * 80)

print(f"\n🔢 OPERATOR CLAIMS:")
print(f"   Total transactions: {len(operator_claims):,}")
print(f"   Total USD claimed: ${operator_claims['AMOUNT'].sum():,.2f}")

print(f"\n✅ TOTAL MATCHED IN YOUR RECORDS:")
print(f"   Transactions: {len(matched):,}")
print(f"   Total USD: ${matched['AMOUNT'].sum():,.2f}")

print(f"\n   Breakdown by matching strategy:")
for strategy in matched['MATCH_STRATEGY'].value_counts().head(10).items():
    print(f"      {strategy[0]}: {strategy[1]:,} transactions")

print(f"\n✅ VERIFIED SUCCESSFUL (You likely owe these):")
print(f"   Transactions: {len(successful):,}")
print(f"   Total USD: ${successful['AMOUNT'].sum():,.2f}")

print(f"\n❌ DISPUTED - FAILED IN YOUR RECORDS (You DON'T owe these):")
print(f"   Transactions: {len(failed):,}")
print(f"   Total USD: ${failed['AMOUNT'].sum():,.2f}")

if len(failed) > 0:
    print(f"\n   Top failure reasons:")
    for reason, count in failed['VENDOR_RESPONSE_MESSAGE'].value_counts().head(5).items():
        print(f"      {reason}: {count:,}")

print(f"\n⚠️  STILL NOT FOUND IN YOUR RECORDS:")
print(f"   Transactions: {len(not_found):,}")
print(f"   Total USD: ${not_found['AMOUNT'].sum():,.2f}")

# Calculate final numbers
legit_amount = successful['AMOUNT'].sum()
disputed_failed = failed['AMOUNT'].sum()
disputed_not_found = not_found['AMOUNT'].sum()
total_disputed = disputed_failed + disputed_not_found

print(f"\n💰 BOTTOM LINE:")
print(f"   Operator claims:        ${operator_claims['AMOUNT'].sum():,.2f}")
print(f"   Verified successful:    ${legit_amount:,.2f}")
print(f"   Disputed (Failed):      ${disputed_failed:,.2f}")
print(f"   Disputed (Not Found):   ${disputed_not_found:,.2f}")
print(f"   Total Disputed:         ${total_disputed:,.2f}")
print(f"   ───────────────────────────────────────")
print(f"   YOU LIKELY OWE:         ${legit_amount:,.2f}")
print(f"   SAVINGS FROM DISPUTE:   ${total_disputed:,.2f}")

# ============================================
# STEP 7: Save Enhanced Reports
# ============================================
print(f"\n💾 Saving enhanced reports...")

output_dir = "/Users/richardmas/latcom-fix/reconciliation_reports"
os.makedirs(output_dir, exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

# Save all results
results_file = f"{output_dir}/ENHANCED_ALL_RESULTS_{timestamp}.csv"
results[['VENDOR_TRANSACTION_ID', 'MSISDN', 'PHONE_CLEAN', 'AMOUNT', 'DATE',
         'MATCH_STRATEGY', 'STATUS', 'RESPONSE_MESSAGE', 'VENDOR_RESPONSE_MESSAGE',
         'COMPANY_TX_ID']].to_csv(results_file, index=False)
print(f"   ✅ All results: {results_file}")

# Save successful
if len(successful) > 0:
    success_file = f"{output_dir}/ENHANCED_SUCCESSFUL_{timestamp}.csv"
    successful.to_csv(success_file, index=False)
    print(f"   ✅ Successful: {success_file}")

# Save failed
if len(failed) > 0:
    failed_file = f"{output_dir}/ENHANCED_FAILED_{timestamp}.csv"
    failed.to_csv(failed_file, index=False)
    print(f"   ✅ Failed: {failed_file}")

# Save not found
if len(not_found) > 0:
    not_found_file = f"{output_dir}/ENHANCED_NOT_FOUND_{timestamp}.csv"
    not_found.to_csv(not_found_file, index=False)
    print(f"   ✅ Not Found: {not_found_file}")

# Summary
summary_file = f"{output_dir}/ENHANCED_SUMMARY_{timestamp}.txt"
with open(summary_file, 'w') as f:
    f.write("ENHANCED OPERATOR TRANSACTION RECONCILIATION\n")
    f.write("=" * 80 + "\n\n")
    f.write(f"Report Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write(f"Period: September 2023 - December 2024\n\n")
    f.write(f"OPERATOR CLAIMS: ${operator_claims['AMOUNT'].sum():,.2f} ({len(operator_claims):,} txs)\n\n")
    f.write(f"MATCHED IN YOUR RECORDS: {len(matched):,} transactions\n")
    f.write(f"  - Successful: {len(successful):,} (${successful['AMOUNT'].sum():,.2f})\n")
    f.write(f"  - Failed: {len(failed):,} (${failed['AMOUNT'].sum():,.2f})\n\n")
    f.write(f"NOT FOUND: {len(not_found):,} transactions (${not_found['AMOUNT'].sum():,.2f})\n\n")
    f.write(f"BOTTOM LINE:\n")
    f.write(f"  You likely owe: ${legit_amount:,.2f}\n")
    f.write(f"  Total disputed: ${total_disputed:,.2f}\n")
    f.write(f"  Potential savings: ${total_disputed:,.2f}\n")

print(f"   ✅ Summary: {summary_file}")

print("\n" + "=" * 80)
print("✅ ENHANCED RECONCILIATION COMPLETE!")
print("=" * 80)
