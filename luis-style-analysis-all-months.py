"""
Luis-Style Three-Way Analysis for All 2023 Months
Replicating Luis's methodology:
1. Cross-reference Telefonica TEMM with Latcom Total (real data)
2. Cross-reference Telefonica TEMM with Latcom Adjusted (reported data)
3. Cross-reference Latcom Adjusted with Latcom Total
"""

import pandas as pd
import numpy as np

# File paths
TEMM_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /Registros_TEMM_NoSoporteActual_202309_202412.csv'
SEP_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL SEPTIEMBRE 20231.xlsx'
OCT_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL OCTUBRE 20231.xlsx'
NOV_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL NOVIEMBRE 2023.xlsx'
DEC_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL DICIEMBRE 2023.xlsx'

OUTPUT_FILE = '/Users/richardmas/latcom-fix/LUIS_STYLE_ANALYSIS_2023.xlsx'

print('=' * 120)
print('LUIS-STYLE THREE-WAY ANALYSIS - 2023 COMPLETE')
print('Replicating Luis methodology for October, November, December')
print('=' * 120)

# Read TEMM file
print('\n📦 Loading Telefonica TEMM file...')
df_temm = pd.read_csv(TEMM_FILE)
df_temm['FECHA'] = pd.to_datetime(df_temm['FECHA'], format='%d/%m/%Y')
df_temm['Year'] = df_temm['FECHA'].dt.year
df_temm['Month'] = df_temm['FECHA'].dt.month
df_temm_2023 = df_temm[df_temm['Year'] == 2023].copy()

# Clean TEMM IDs
df_temm_2023['SEC_ACT_STR'] = df_temm_2023['SEC_ACTUACION'].astype(str).str.strip()

print(f'   Total 2023 TEMM records: {len(df_temm_2023):,}')

# Files configuration
files_config = {
    9: {'file': SEP_FILE, 'name': 'September', 'real_sheet': 'PAQUETES SEPTIEMBRE23'},
    10: {'file': OCT_FILE, 'name': 'October', 'real_sheet': 'PAQUETES OCTUBRE23'},
    11: {'file': NOV_FILE, 'name': 'November', 'real_sheet': 'PAQUETES NOVIEMBRE23'},
    12: {'file': DEC_FILE, 'name': 'December', 'real_sheet': 'PAQUETES DICIEMBRE23'}
}

all_results = {}

# Analyze each month
for month_num in [9, 10, 11, 12]:
    config = files_config[month_num]
    month_name = config['name']

    print(f'\n{"=" * 120}')
    print(f'📅 {month_name.upper()} 2023 - LUIS-STYLE ANALYSIS')
    print('=' * 120)

    # Read Latcom data
    df_adjusted = pd.read_excel(config['file'], sheet_name='ADJUSTED')
    df_real = pd.read_excel(config['file'], sheet_name=config['real_sheet'])

    # Get TEMM for this month
    df_temm_month = df_temm_2023[df_temm_2023['Month'] == month_num].copy()

    # Clean IDs
    df_adjusted['VEND_TX_STR'] = df_adjusted['VENDOR_TRANSACTION_ID'].astype(str).str.split('.').str[0].str.strip()
    df_real['VEND_TX_STR'] = df_real['VENDOR_TRANSACTION_ID'].astype(str).str.split('.').str[0].str.strip()

    # Create ID sets
    temm_ids = set(df_temm_month['SEC_ACT_STR'])
    adjusted_ids = set(df_adjusted['VEND_TX_STR'])
    real_ids = set(df_real['VEND_TX_STR'])

    # Three-way cross-reference (Luis methodology)

    # 1. TEMM vs Real (Total)
    temm_in_real = temm_ids & real_ids
    temm_not_in_real = temm_ids - real_ids

    # 2. TEMM vs Adjusted
    temm_in_adjusted = temm_ids & adjusted_ids
    temm_not_in_adjusted = temm_ids - adjusted_ids

    # 3. Adjusted vs Real
    adjusted_in_real = adjusted_ids & real_ids
    adjusted_not_in_real = adjusted_ids - real_ids

    # 4. Adjusted vs TEMM
    adjusted_in_temm = adjusted_ids & temm_ids
    adjusted_not_in_temm = adjusted_ids - temm_ids

    # 5. Real vs Adjusted (what was removed)
    real_not_in_adjusted = real_ids - adjusted_ids

    # Print results
    print(f'\n📊 DATASET SIZES:')
    print(f'   Telefónica TEMM:   {len(df_temm_month):,} trx, ${df_temm_month["ImpUSD"].sum():,.0f}')
    print(f'   Latcom Total:      {len(df_real):,} trx, ${df_real["TransactionAmountUSD"].sum():,.0f}')
    print(f'   Latcom Adjusted:   {len(df_adjusted):,} trx, ${df_adjusted["TransactionAmountUSD"].sum():,.0f}')

    print(f'\n🔍 1️⃣ TELEFÓNICA vs LATCOM TOTAL:')
    print(f'   ✅ TEMM in Total:        {len(temm_in_real):,} ({len(temm_in_real)/len(df_temm_month)*100:.1f}%)')
    print(f'   ❌ TEMM NOT in Total:    {len(temm_not_in_real):,} (MISSING FROM OUR SYSTEM)')

    # Calculate amount for missing
    df_temm_missing = df_temm_month[df_temm_month['SEC_ACT_STR'].isin(temm_not_in_real)]
    print(f'      Amount missing: ${df_temm_missing["ImpUSD"].sum():,.2f}')

    print(f'\n🔍 2️⃣ TELEFÓNICA vs LATCOM ADJUSTED:')
    print(f'   ✅ TEMM in Adjusted:     {len(temm_in_adjusted):,} ({len(temm_in_adjusted)/len(df_temm_month)*100:.1f}%)')
    print(f'   ❌ TEMM NOT in Adjusted: {len(temm_not_in_adjusted):,}')

    print(f'\n🔍 3️⃣ LATCOM ADJUSTED vs LATCOM TOTAL:')
    print(f'   ✅ Adjusted in Total:    {len(adjusted_in_real):,} ({len(adjusted_in_real)/len(df_adjusted)*100:.1f}%)')
    print(f'   ❌ Adjusted NOT in Total: {len(adjusted_not_in_real):,} (ID ERRORS)')

    print(f'\n🔍 4️⃣ LATCOM ADJUSTED vs TELEFÓNICA (KEY FINDING):')
    print(f'   ✅ Adjusted in TEMM:     {len(adjusted_in_temm):,} ({len(adjusted_in_temm)/len(df_adjusted)*100:.1f}%)')
    print(f'   ❌ Adjusted NOT in TEMM: {len(adjusted_not_in_temm):,} ({len(adjusted_not_in_temm)/len(df_adjusted)*100:.1f}%)')

    # Calculate amounts
    df_adjusted_in_temm = df_adjusted[df_adjusted['VEND_TX_STR'].isin(adjusted_in_temm)]
    df_adjusted_not_in_temm = df_adjusted[df_adjusted['VEND_TX_STR'].isin(adjusted_not_in_temm)]

    print(f'      Amount in TEMM: ${df_adjusted_in_temm["TransactionAmountUSD"].sum():,.2f}')
    print(f'      Amount NOT in TEMM: ${df_adjusted_not_in_temm["TransactionAmountUSD"].sum():,.2f}')

    print(f'\n🔍 5️⃣ FILTERING ANALYSIS:')
    removed_count = len(df_real) - len(df_adjusted)
    removed_pct = (removed_count / len(df_real) * 100)
    print(f'   Transactions removed: {removed_count:,} ({removed_pct:.1f}%)')

    # Store results
    all_results[month_num] = {
        'month_name': month_name,
        'temm': df_temm_month,
        'adjusted': df_adjusted,
        'real': df_real,
        'stats': {
            'temm_count': len(df_temm_month),
            'temm_usd': df_temm_month['ImpUSD'].sum(),
            'adjusted_count': len(df_adjusted),
            'adjusted_usd': df_adjusted['TransactionAmountUSD'].sum(),
            'real_count': len(df_real),
            'real_usd': df_real['TransactionAmountUSD'].sum(),
            'temm_in_real': len(temm_in_real),
            'temm_not_in_real': len(temm_not_in_real),
            'temm_not_in_real_usd': df_temm_missing['ImpUSD'].sum(),
            'temm_in_adjusted': len(temm_in_adjusted),
            'adjusted_in_temm': len(adjusted_in_temm),
            'adjusted_not_in_temm': len(adjusted_not_in_temm),
            'adjusted_in_temm_usd': df_adjusted_in_temm['TransactionAmountUSD'].sum(),
            'adjusted_not_in_temm_usd': df_adjusted_not_in_temm['TransactionAmountUSD'].sum(),
            'adjusted_errors': len(adjusted_not_in_real),
            'removed_count': removed_count,
            'removed_pct': removed_pct
        }
    }

    # Luis-style conclusion
    if len(adjusted_not_in_temm) > len(adjusted_in_temm):
        print(f'\n⚠️  LUIS PATTERN DETECTED:')
        print(f'   {len(adjusted_not_in_temm):,} adjusted transactions NOT in Telefónica TEMM')
        print(f'   This suggests TEMM file is PRE-FILTERED by Telefónica!')

# Create Excel with results
print(f'\n{"=" * 120}')
print('CREATING EXCEL REPORT...')
print('=' * 120)

with pd.ExcelWriter(OUTPUT_FILE, engine='xlsxwriter') as writer:
    workbook = writer.book

    # Formats
    header_fmt = workbook.add_format({'bold': True, 'bg_color': '#4472C4', 'font_color': 'white', 'border': 1})
    total_fmt = workbook.add_format({'bold': True, 'bg_color': '#E7E6E6', 'border': 1})
    highlight_fmt = workbook.add_format({'bg_color': '#FFE699', 'border': 1})

    # Summary sheet
    summary_data = []
    for month_num in [9, 10, 11, 12]:
        r = all_results[month_num]
        s = r['stats']
        summary_data.append({
            'Month': r['month_name'],
            'Telefonica_Count': s['temm_count'],
            'Telefonica_USD': s['temm_usd'],
            'Latcom_Total_Count': s['real_count'],
            'Latcom_Total_USD': s['real_usd'],
            'Latcom_Adjusted_Count': s['adjusted_count'],
            'Latcom_Adjusted_USD': s['adjusted_usd'],
            'TEMM_in_Total': s['temm_in_real'],
            'TEMM_NOT_in_Total': s['temm_not_in_real'],
            'Missing_USD': s['temm_not_in_real_usd'],
            'Adjusted_in_TEMM': s['adjusted_in_temm'],
            'Adjusted_NOT_in_TEMM': s['adjusted_not_in_temm'],
            'Adjusted_in_TEMM_USD': s['adjusted_in_temm_usd'],
            'Adjusted_NOT_in_TEMM_USD': s['adjusted_not_in_temm_usd'],
            'Match_Rate_%': round((s['adjusted_in_temm'] / s['adjusted_count'] * 100), 2),
            'Removed_Count': s['removed_count'],
            'Removed_%': round(s['removed_pct'], 1)
        })

    # Add totals
    summary_data.append({
        'Month': 'TOTAL 2023',
        'Telefonica_Count': sum(r['stats']['temm_count'] for r in all_results.values()),
        'Telefonica_USD': sum(r['stats']['temm_usd'] for r in all_results.values()),
        'Latcom_Total_Count': sum(r['stats']['real_count'] for r in all_results.values()),
        'Latcom_Total_USD': sum(r['stats']['real_usd'] for r in all_results.values()),
        'Latcom_Adjusted_Count': sum(r['stats']['adjusted_count'] for r in all_results.values()),
        'Latcom_Adjusted_USD': sum(r['stats']['adjusted_usd'] for r in all_results.values()),
        'TEMM_in_Total': sum(r['stats']['temm_in_real'] for r in all_results.values()),
        'TEMM_NOT_in_Total': sum(r['stats']['temm_not_in_real'] for r in all_results.values()),
        'Missing_USD': sum(r['stats']['temm_not_in_real_usd'] for r in all_results.values()),
        'Adjusted_in_TEMM': sum(r['stats']['adjusted_in_temm'] for r in all_results.values()),
        'Adjusted_NOT_in_TEMM': sum(r['stats']['adjusted_not_in_temm'] for r in all_results.values()),
        'Adjusted_in_TEMM_USD': sum(r['stats']['adjusted_in_temm_usd'] for r in all_results.values()),
        'Adjusted_NOT_in_TEMM_USD': sum(r['stats']['adjusted_not_in_temm_usd'] for r in all_results.values()),
        'Match_Rate_%': '',
        'Removed_Count': sum(r['stats']['removed_count'] for r in all_results.values()),
        'Removed_%': ''
    })

    df_summary = pd.DataFrame(summary_data)
    df_summary.to_excel(writer, sheet_name='SUMMARY', index=False)

    # Format summary
    worksheet = writer.sheets['SUMMARY']
    for col_num, value in enumerate(df_summary.columns.values):
        worksheet.write(0, col_num, value, header_fmt)
        worksheet.set_column(col_num, col_num, 18)

print(f'✅ Report created: {OUTPUT_FILE}')

# Print final summary
print(f'\n{"=" * 120}')
print('FINAL SUMMARY - LUIS METHODOLOGY APPLIED TO ALL 2023')
print('=' * 120)

total_temm = sum(r['stats']['temm_count'] for r in all_results.values())
total_temm_usd = sum(r['stats']['temm_usd'] for r in all_results.values())
total_adjusted = sum(r['stats']['adjusted_count'] for r in all_results.values())
total_adjusted_usd = sum(r['stats']['adjusted_usd'] for r in all_results.values())
total_real = sum(r['stats']['real_count'] for r in all_results.values())
total_real_usd = sum(r['stats']['real_usd'] for r in all_results.values())

total_missing = sum(r['stats']['temm_not_in_real'] for r in all_results.values())
total_missing_usd = sum(r['stats']['temm_not_in_real_usd'] for r in all_results.values())

total_adj_in_temm = sum(r['stats']['adjusted_in_temm'] for r in all_results.values())
total_adj_not_in_temm = sum(r['stats']['adjusted_not_in_temm'] for r in all_results.values())
total_adj_in_temm_usd = sum(r['stats']['adjusted_in_temm_usd'] for r in all_results.values())
total_adj_not_in_temm_usd = sum(r['stats']['adjusted_not_in_temm_usd'] for r in all_results.values())

print(f'\n📊 OVERALL NUMBERS:')
print(f'Telefónica TEMM:     {total_temm:,} transactions → ${total_temm_usd:,.2f}')
print(f'Latcom Total:        {total_real:,} transactions → ${total_real_usd:,.2f}')
print(f'Latcom Adjusted:     {total_adjusted:,} transactions → ${total_adjusted_usd:,.2f}')

print(f'\n🚨 KEY FINDINGS (Luis Pattern):')
print(f'1. Missing from our system:  {total_missing:,} trx → ${total_missing_usd:,.2f}')
print(f'2. Adjusted in TEMM:         {total_adj_in_temm:,} trx → ${total_adj_in_temm_usd:,.2f}')
print(f'3. Adjusted NOT in TEMM:     {total_adj_not_in_temm:,} trx → ${total_adj_not_in_temm_usd:,.2f}')

match_rate = (total_adj_in_temm / total_adjusted * 100)
print(f'\n📈 Overall Match Rate: {match_rate:.2f}%')
print(f'   (Only {match_rate:.1f}% of our adjusted transactions appear in TEMM)')

print(f'\n💡 CONCLUSION:')
if match_rate < 5:
    print('   ⚠️  LUIS PATTERN CONFIRMED FOR ALL MONTHS!')
    print('   TEMM file appears to be PRE-FILTERED by Telefónica')
    print('   They removed most adjusted/successful transactions')
    print(f'   Real discrepancy: ${total_missing_usd:,.2f} (transactions missing from our system)')
else:
    print('   Pattern does not match Luis findings - further investigation needed')

print('=' * 120)
