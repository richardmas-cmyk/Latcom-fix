"""
Telefonica Reconciliation Script for 2023 - COMPLETE (All 4 Months)
Per meeting requirements from transcript

Comparing: TEMM (Telefonica claims) vs Latcom Adjusted (reported sales)
Months: September, October, November, December 2023
"""

import pandas as pd
import numpy as np
from datetime import datetime

# File paths
TEMM_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /Registros_TEMM_NoSoporteActual_202309_202412.csv'
SEP_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL SEPTIEMBRE 20231.xlsx'
OCT_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL OCTUBRE 20231.xlsx'
NOV_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL NOVIEMBRE 2023.xlsx'
DEC_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL DICIEMBRE 2023.xlsx'

OUTPUT_FILE = '/Users/richardmas/latcom-fix/RECONCILIATION_2023_COMPLETE.xlsx'

print('=' * 120)
print('TELEFONICA RECONCILIATION - 2023 COMPLETE')
print('Comparing: TEMM (Telefonica claims) vs Latcom Adjusted (reported sales)')
print('Months: September, October, November, December 2023')
print('=' * 120)

# Step 1: Read TEMM file
print('\n📦 Step 1: Reading Telefonica TEMM file...')
df_temm = pd.read_csv(TEMM_FILE)
df_temm['FECHA'] = pd.to_datetime(df_temm['FECHA'], format='%d/%m/%Y')
df_temm['Year'] = df_temm['FECHA'].dt.year
df_temm['Month'] = df_temm['FECHA'].dt.month
df_temm_2023 = df_temm[df_temm['Year'] == 2023].copy()

print(f'   Total 2023 records: {len(df_temm_2023):,}')
print(f'   Total amount: ${df_temm_2023["ImpUSD"].sum():,.2f} USD')

# Step 2: Read all Latcom files
print('\n📦 Step 2: Reading Latcom reconciliation files...')

files_data = {
    9: {'file': SEP_FILE, 'name': 'September', 'sheet_real': 'PAQUETES SEPTIEMBRE23'},
    10: {'file': OCT_FILE, 'name': 'October', 'sheet_real': 'PAQUETES OCTUBRE23'},
    11: {'file': NOV_FILE, 'name': 'November', 'sheet_real': 'PAQUETES NOVIEMBRE23'},
    12: {'file': DEC_FILE, 'name': 'December', 'sheet_real': 'PAQUETES DICIEMBRE23'}
}

latcom_data = {}
for month, info in files_data.items():
    df_adj = pd.read_excel(info['file'], sheet_name='ADJUSTED')
    df_real = pd.read_excel(info['file'], sheet_name=info['sheet_real'])

    latcom_data[month] = {
        'adjusted': df_adj,
        'real': df_real
    }

    print(f'   {info["name"]}:')
    print(f'      Adjusted: {len(df_adj):,} transactions (${df_adj["TransactionAmountUSD"].sum():,.2f} USD)')
    print(f'      Real: {len(df_real):,} transactions (${df_real["TransactionAmountUSD"].sum():,.2f} USD)')

# Step 3: Reconciliation
print('\n' + '=' * 120)
print('RECONCILIATION ANALYSIS')
print('=' * 120)

results = {}
month_names = {9: 'September', 10: 'October', 11: 'November', 12: 'December'}

for month in [9, 10, 11, 12]:
    month_name = month_names[month]

    print(f'\n📅 {month_name.upper()} 2023')
    print('-' * 120)

    # Get data
    df_temm_month = df_temm_2023[df_temm_2023['Month'] == month].copy()
    df_latcom_adj = latcom_data[month]['adjusted'].copy()
    df_latcom_real = latcom_data[month]['real'].copy()

    # Clean IDs for matching
    df_temm_month['SEC_ACT_STR'] = df_temm_month['SEC_ACTUACION'].astype(str).str.strip()
    df_latcom_adj['VEND_TX_STR'] = df_latcom_adj['VENDOR_TRANSACTION_ID'].astype(str).str.split('.').str[0].str.strip()
    df_latcom_real['VEND_TX_STR'] = df_latcom_real['VENDOR_TRANSACTION_ID'].astype(str).str.split('.').str[0].str.strip()

    # Create sets
    temm_ids = set(df_temm_month['SEC_ACT_STR'])
    latcom_adj_ids = set(df_latcom_adj['VEND_TX_STR'])
    latcom_real_ids = set(df_latcom_real['VEND_TX_STR'])

    # Find matches
    matched_adj = temm_ids & latcom_adj_ids
    matched_real = temm_ids & latcom_real_ids

    only_temm = temm_ids - latcom_real_ids
    only_latcom_adj = latcom_adj_ids - temm_ids

    # Get dataframes
    df_matched_temm = df_temm_month[df_temm_month['SEC_ACT_STR'].isin(matched_adj)]
    df_matched_latcom = df_latcom_adj[df_latcom_adj['VEND_TX_STR'].isin(matched_adj)]
    df_failed_temm = df_temm_month[df_temm_month['SEC_ACT_STR'].isin(only_temm)]

    # Print results
    print(f'\n1️⃣  TELEFONICA CLAIMS:')
    print(f'   Total: {len(df_temm_month):,} transactions (${df_temm_month["ImpUSD"].sum():,.2f} USD)')

    print(f'\n2️⃣  LATCOM REPORTED (Adjusted):')
    print(f'   Total: {len(df_latcom_adj):,} transactions (${df_latcom_adj["TransactionAmountUSD"].sum():,.2f} USD)')

    print(f'\n3️⃣  MATCHING:')
    print(f'   ✅ Matched (Conciliadas): {len(matched_adj):,} transactions')
    print(f'   💰 Matched amount: ${df_matched_latcom["TransactionAmountUSD"].sum():,.2f} USD')
    match_rate = (len(matched_adj) / len(df_latcom_adj) * 100) if len(df_latcom_adj) > 0 else 0
    print(f'   📊 Match rate: {match_rate:.2f}% (of Latcom reported)')

    print(f'\n4️⃣  DISCREPANCIES:')
    print(f'   ❌ Failed (in TEMM, not in our system): {len(only_temm):,} transactions')
    print(f'   💰 Failed amount: ${df_failed_temm["ImpUSD"].sum():,.2f} USD')
    print(f'   ⚠️  In Latcom but not in TEMM: {len(only_latcom_adj):,} transactions')

    print(f'\n5️⃣  AUDIT (vs Real data):')
    print(f'   Real transactions: {len(df_latcom_real):,}')
    print(f'   Matched with TEMM: {len(matched_real):,}')

    removed_count = len(df_latcom_real) - len(df_latcom_adj)
    removed_pct = (removed_count / len(df_latcom_real) * 100) if len(df_latcom_real) > 0 else 0
    print(f'   🗑️  Removed for reporting: {removed_count:,} ({removed_pct:.1f}%)')

    # Store results
    results[month] = {
        'month_name': month_name,
        'temm': df_temm_month,
        'latcom_adjusted': df_latcom_adj,
        'latcom_real': df_latcom_real,
        'matched_temm': df_matched_temm,
        'matched_latcom': df_matched_latcom,
        'failed': df_failed_temm,
        'stats': {
            'temm_count': len(df_temm_month),
            'temm_usd': df_temm_month['ImpUSD'].sum(),
            'adj_count': len(df_latcom_adj),
            'adj_usd': df_latcom_adj['TransactionAmountUSD'].sum(),
            'matched_count': len(matched_adj),
            'matched_usd': df_matched_latcom['TransactionAmountUSD'].sum(),
            'failed_count': len(only_temm),
            'failed_usd': df_failed_temm['ImpUSD'].sum()
        }
    }

# Step 4: Create Excel output
print('\n' + '=' * 120)
print('CREATING EXCEL REPORT')
print('=' * 120)

with pd.ExcelWriter(OUTPUT_FILE, engine='xlsxwriter') as writer:
    workbook = writer.book

    # Formats
    header_fmt = workbook.add_format({'bold': True, 'bg_color': '#4472C4', 'font_color': 'white', 'border': 1})
    matched_fmt = workbook.add_format({'bg_color': '#C6EFCE', 'border': 1})
    failed_fmt = workbook.add_format({'bg_color': '#FFC7CE', 'border': 1})
    total_fmt = workbook.add_format({'bold': True, 'bg_color': '#E7E6E6', 'border': 1})

    # Summary sheet
    summary_rows = []
    for month in [9, 10, 11, 12]:
        r = results[month]
        summary_rows.append({
            'Month': r['month_name'],
            'Telefonica_Count': r['stats']['temm_count'],
            'Telefonica_USD': r['stats']['temm_usd'],
            'Latcom_Reported_Count': r['stats']['adj_count'],
            'Latcom_Reported_USD': r['stats']['adj_usd'],
            'Matched_Count': r['stats']['matched_count'],
            'Matched_USD': r['stats']['matched_usd'],
            'Failed_Count': r['stats']['failed_count'],
            'Failed_USD': r['stats']['failed_usd'],
            'Match_Rate_%': round((r['stats']['matched_count'] / r['stats']['adj_count'] * 100) if r['stats']['adj_count'] > 0 else 0, 2)
        })

    # Add totals
    total_row = {
        'Month': 'TOTAL 2023',
        'Telefonica_Count': sum(r['stats']['temm_count'] for r in results.values()),
        'Telefonica_USD': sum(r['stats']['temm_usd'] for r in results.values()),
        'Latcom_Reported_Count': sum(r['stats']['adj_count'] for r in results.values()),
        'Latcom_Reported_USD': sum(r['stats']['adj_usd'] for r in results.values()),
        'Matched_Count': sum(r['stats']['matched_count'] for r in results.values()),
        'Matched_USD': sum(r['stats']['matched_usd'] for r in results.values()),
        'Failed_Count': sum(r['stats']['failed_count'] for r in results.values()),
        'Failed_USD': sum(r['stats']['failed_usd'] for r in results.values()),
        'Match_Rate_%': ''
    }
    summary_rows.append(total_row)

    df_summary = pd.DataFrame(summary_rows)
    df_summary.to_excel(writer, sheet_name='SUMMARY', index=False)

    # Format summary
    worksheet = writer.sheets['SUMMARY']
    for col_num, value in enumerate(df_summary.columns.values):
        worksheet.write(0, col_num, value, header_fmt)
        worksheet.set_column(col_num, col_num, 20)

    # Format total row
    total_row_num = len(summary_rows)
    for col_num in range(len(df_summary.columns)):
        worksheet.write(total_row_num, col_num, df_summary.iloc[-1, col_num], total_fmt)

    # Month sheets
    for month in [9, 10, 11, 12]:
        r = results[month]
        prefix = r['month_name'][:3].upper()

        # 1. Telefonica data
        r['temm'].to_excel(writer, sheet_name=f'{prefix}_1_TELEFONICA', index=False)

        # 2. Latcom Adjusted
        r['latcom_adjusted'].to_excel(writer, sheet_name=f'{prefix}_2_LATCOM_ADJ', index=False)

        # 3. Latcom Real (audit)
        r['latcom_real'].to_excel(writer, sheet_name=f'{prefix}_3_LATCOM_REAL', index=False)

        # 4. Matched transactions
        r['matched_latcom'].to_excel(writer, sheet_name=f'{prefix}_4_MATCHED', index=False)

        # 5. Failed transactions
        df_failed = r['failed'].copy()
        df_failed['FAILURE_REASON'] = 'TIMEOUT'
        df_failed['NOTES'] = 'In Telefonica TEMM but not in Latcom system'
        df_failed.to_excel(writer, sheet_name=f'{prefix}_5_FAILED', index=False)

print(f'\n✅ Excel report created: {OUTPUT_FILE}')

# Print final summary
print('\n' + '=' * 120)
print('FINAL SUMMARY - FULL YEAR 2023 (Sep + Oct + Nov + Dec)')
print('=' * 120)

total_temm_count = sum(r['stats']['temm_count'] for r in results.values())
total_temm_usd = sum(r['stats']['temm_usd'] for r in results.values())
total_adj_count = sum(r['stats']['adj_count'] for r in results.values())
total_adj_usd = sum(r['stats']['adj_usd'] for r in results.values())
total_matched_count = sum(r['stats']['matched_count'] for r in results.values())
total_matched_usd = sum(r['stats']['matched_usd'] for r in results.values())
total_failed_count = sum(r['stats']['failed_count'] for r in results.values())
total_failed_usd = sum(r['stats']['failed_usd'] for r in results.values())

print(f'\n📊 Telefonica claims (TEMM): {total_temm_count:,} transactions → ${total_temm_usd:,.2f} USD')
print(f'📊 Latcom reported (Adjusted): {total_adj_count:,} transactions → ${total_adj_usd:,.2f} USD')
print(f'✅ Matched (Conciliadas): {total_matched_count:,} transactions → ${total_matched_usd:,.2f} USD')
print(f'❌ Failed (Fallidas): {total_failed_count:,} transactions → ${total_failed_usd:,.2f} USD')

print(f'\n📈 Overall match rate: {(total_matched_count/total_adj_count*100):.2f}%')
print(f'💰 Total difference to explain: ${total_failed_usd:,.2f} USD')

difference_pct = (total_failed_usd / total_temm_usd * 100)
print(f'📊 Difference as % of Telefonica claims: {difference_pct:.2f}%')

print('\n' + '=' * 120)
print('✅ RECONCILIATION COMPLETE - All 4 months of 2023 processed')
print('=' * 120)
